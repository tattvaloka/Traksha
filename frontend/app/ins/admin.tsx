import React from "react";
import { View, ScrollView, RefreshControl } from "react-native";
import { Ionicons } from "@react-native-vector-icons/ionicons";
import { useQuery, useMutation } from "@tanstack/react-query";
import { StackHeader } from "@/src/components/Header";
import { T, Card, Button, Loader, EmptyState, Avatar, Divider } from "@/src/components/ui";
import { api, ApiError } from "@/src/api/client";
import { queryClient } from "@/src/query-client";
import { useToast } from "@/src/components/Toast";
import { useTheme, space } from "@/src/theme";

// Platform verification console. Real external legal/document verification is
// not implemented; this exercises the genuine pending -> approved/rejected
// workflow. Access requires the platform-verifier flag (grantable below for dev).
export default function InstitutionAdmin() {
  const { colors } = useTheme();
  const { show } = useToast();
  const q = useQuery({
    queryKey: ["ins", "admin"],
    queryFn: () => api.get("/ins/admin/applications"),
    retry: false,
  });
  const forbidden = (q.error as any)?.status === 403;

  const grant = useMutation({
    mutationFn: () => api.post("/ins/dev/grant-admin"),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["ins", "admin"] }); show("Platform verifier access granted", "success"); },
    onError: () => show("Could not grant access", "error"),
  });
  const decide = useMutation({
    mutationFn: ({ insId, action }: any) => api.post(`/ins/admin/applications/${insId}/${action}`, action === "reject" ? { reason: "Not approved" } : undefined),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["ins", "admin"] }); queryClient.invalidateQueries({ queryKey: ["ins", "mine"] }); show("Decision recorded", "success"); },
    onError: (e: any) => show(e instanceof ApiError ? e.message : "Could not update", "error"),
  });

  const apps = q.data?.applications ?? [];

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <StackHeader title="Platform verification" />
      <ScrollView
        contentContainerStyle={{ padding: 16, gap: space.md, paddingBottom: 48 }}
        refreshControl={<RefreshControl refreshing={q.isFetching} onRefresh={() => q.refetch()} tintColor={colors.brand} />}
      >
        <View style={{ backgroundColor: colors.surfaceWarm, borderWidth: 1, borderColor: colors.insBorder, borderRadius: 14, padding: space.md, gap: 6 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Ionicons name="construct-outline" size={14} color={colors.insText} />
            <T variant="caption" color={colors.insText}>DEVELOPER TOOL · VERIFICATION</T>
          </View>
          <T variant="bodySm" color={colors.textSecondary}>
            Real document/legal verification is not implemented. This console exercises the genuine approval workflow. Grant yourself verifier access to review applications.
          </T>
          <Button label="Grant me verifier access" variant="secondary" icon="key-outline" onPress={() => grant.mutate()} loading={grant.isPending} testID="ins-grant-admin" />
        </View>

        {q.isLoading ? <Loader /> : forbidden ? (
          <EmptyState icon="lock-closed-outline" title="Verifier access required" body="Grant yourself verifier access above to review pending applications." />
        ) : apps.length === 0 ? (
          <EmptyState icon="file-tray-outline" title="No pending applications" body="Institution registrations awaiting review will appear here." />
        ) : (
          apps.map((ins: any) => (
            <Card key={ins.id} testID={`ins-app-${ins.id}`} style={{ gap: 10 }}>
              <T variant="subtitle">{ins.name}</T>
              {ins.category ? <T variant="bodySm" color={colors.textSecondary}>{ins.category}</T> : null}
              {ins.email ? <T variant="mono" color={colors.muted}>{ins.email}</T> : null}
              <Divider />
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                <Avatar name={ins.applicant?.display_name} uri={ins.applicant?.photo_url} size={36} />
                <View style={{ flex: 1 }}>
                  <T variant="bodySm" color={colors.textPrimary}>{ins.applicant?.display_name}</T>
                  <T variant="caption" color={colors.muted}>Applied as: {ins.application?.applicant_role || "—"}</T>
                </View>
              </View>
              {ins.application?.justification ? <T variant="bodySm" color={colors.textSecondary}>{ins.application.justification}</T> : null}
              <View style={{ flexDirection: "row", gap: 10 }}>
                <View style={{ flex: 1 }}><Button label="Reject" variant="destructive" onPress={() => decide.mutate({ insId: ins.id, action: "reject" })} testID={`ins-app-reject-${ins.id}`} /></View>
                <View style={{ flex: 1 }}><Button label="Approve" onPress={() => decide.mutate({ insId: ins.id, action: "approve" })} testID={`ins-app-approve-${ins.id}`} /></View>
              </View>
            </Card>
          ))
        )}
      </ScrollView>
    </View>
  );
}
