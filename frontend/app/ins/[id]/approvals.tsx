import React from "react";
import { View, ScrollView, RefreshControl } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import { StackHeader } from "@/src/components/Header";
import { T, Card, Button, Loader, ErrorView, EmptyState, Avatar } from "@/src/components/ui";
import { api, ApiError } from "@/src/api/client";
import { queryClient } from "@/src/query-client";
import { useToast } from "@/src/components/Toast";
import { useTheme, space } from "@/src/theme";

export default function InstitutionApprovals() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const { show } = useToast();
  const q = useQuery({ queryKey: ["ins", id, "approvals"], queryFn: () => api.get(`/ins/${id}/approvals`), enabled: !!id });
  const items = q.data?.approvals ?? [];

  const decide = useMutation({
    mutationFn: ({ approvalId, action }: any) => api.post(`/ins/${id}/approvals/${approvalId}/${action}`, action === "reject" ? { reason: null } : undefined),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ins", id, "approvals"] });
      queryClient.invalidateQueries({ queryKey: ["ins", id, "members"] });
      show("Decision recorded", "success");
    },
    onError: (e: any) => show(e instanceof ApiError ? e.message : "Could not update", "error"),
  });

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <StackHeader title="Approvals" />
      {q.isLoading ? <Loader /> : q.isError ? <ErrorView onRetry={() => q.refetch()} /> : (
        <ScrollView
          contentContainerStyle={{ padding: 16, gap: space.md, paddingBottom: 48 }}
          refreshControl={<RefreshControl refreshing={q.isFetching} onRefresh={() => q.refetch()} tintColor={colors.brand} />}
        >
          {items.length === 0 ? (
            <EmptyState icon="checkmark-done-outline" title="Nothing to approve" body="Pending role assignments will appear here for review." />
          ) : (
            items.map((a: any) => (
              <Card key={a.id} testID={`ins-approval-${a.id}`} style={{ gap: 12 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                  <Avatar name={a.user?.display_name} uri={a.user?.photo_url} size={44} />
                  <View style={{ flex: 1, gap: 2 }}>
                    <T variant="label">{a.user?.display_name || "Traksha member"}</T>
                    <T variant="bodySm" color={colors.textSecondary}>Nominated for: <T variant="bodySm" color={colors.textPrimary}>{a.role_name}</T></T>
                  </View>
                </View>
                <View style={{ flexDirection: "row", gap: 10 }}>
                  <View style={{ flex: 1 }}>
                    <Button label="Reject" variant="destructive" onPress={() => decide.mutate({ approvalId: a.id, action: "reject" })} testID={`ins-reject-${a.id}`} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Button label="Approve" onPress={() => decide.mutate({ approvalId: a.id, action: "approve" })} testID={`ins-approve-${a.id}`} />
                  </View>
                </View>
              </Card>
            ))
          )}
        </ScrollView>
      )}
    </View>
  );
}
