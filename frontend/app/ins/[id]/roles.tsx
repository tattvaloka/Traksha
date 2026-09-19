import React from "react";
import { View, ScrollView, Pressable, RefreshControl } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@react-native-vector-icons/ionicons";
import { useQuery, useMutation } from "@tanstack/react-query";
import { StackHeader } from "@/src/components/Header";
import { T, Card, Button, Loader, ErrorView, EmptyState, Divider } from "@/src/components/ui";
import { api, ApiError } from "@/src/api/client";
import { queryClient } from "@/src/query-client";
import { useToast } from "@/src/components/Toast";
import { useTheme, space, radius } from "@/src/theme";
import { insCan } from "@/src/ins/perms";

export default function InstitutionRoles() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const { show } = useToast();
  const insQ = useQuery({ queryKey: ["ins", id], queryFn: () => api.get(`/ins/${id}`), enabled: !!id });
  const perms: string[] = insQ.data?.institution?.my_permissions ?? [];
  const canManage = insCan(perms, "roles:manage");
  const q = useQuery({ queryKey: ["ins", id, "roles"], queryFn: () => api.get(`/ins/${id}/roles`), enabled: !!id });
  const roles = q.data?.roles ?? [];

  const del = useMutation({
    mutationFn: (roleId: string) => api.del(`/ins/${id}/roles/${roleId}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["ins", id, "roles"] }); show("Role deleted", "success"); },
    onError: (e: any) => show(e instanceof ApiError ? e.message : "Could not delete", "error"),
  });

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <StackHeader title="Roles & permissions" />
      <ScrollView
        contentContainerStyle={{ padding: 16, gap: space.md, paddingBottom: 48 }}
        refreshControl={<RefreshControl refreshing={q.isFetching} onRefresh={() => q.refetch()} tintColor={colors.brand} />}
      >
        <Card style={{ gap: 6 }}>
          <T variant="bodySm" color={colors.textSecondary}>
            A role is a human-readable authority label. Actual access is granted by the structured permissions and scope you attach to it. A role is not the same as ownership.
          </T>
        </Card>

        {canManage ? (
          <Button label="Create a role" icon="add-circle-outline" onPress={() => router.push(`/ins/${id}/role`)} testID="ins-create-role" />
        ) : null}

        {q.isLoading ? <Loader /> : q.isError ? <ErrorView onRetry={() => q.refetch()} /> : roles.length === 0 ? (
          <EmptyState icon="ribbon-outline" title="No roles yet" body="Create custom roles with specific permissions and scope." />
        ) : (
          <View style={{ gap: 10 }}>
            {roles.map((r: any) => (
              <Card key={r.id} testID={`ins-role-${r.id}`} style={{ gap: 8 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                  <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: colors.surfaceTertiary, alignItems: "center", justifyContent: "center" }}>
                    <Ionicons name="ribbon-outline" size={18} color={colors.textPrimary} />
                  </View>
                  <View style={{ flex: 1, gap: 2 }}>
                    <T variant="label">{r.name}</T>
                    {r.description ? <T variant="bodySm" color={colors.textSecondary} numberOfLines={2}>{r.description}</T> : null}
                  </View>
                  {canManage ? (
                    <Pressable hitSlop={8} onPress={() => router.push({ pathname: `/ins/${id}/role`, params: { roleId: r.id } })} testID={`ins-edit-role-${r.id}`}>
                      <Ionicons name="create-outline" size={20} color={colors.muted} />
                    </Pressable>
                  ) : null}
                </View>
                <Divider />
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: colors.insBg, borderColor: colors.insBorder, borderWidth: 1, borderRadius: radius.full, paddingHorizontal: 9, paddingVertical: 3 }}>
                    <Ionicons name="locate-outline" size={11} color={colors.insText} />
                    <T variant="caption" color={colors.insText}>scope: {r.scope?.type || "institution"}{r.scope?.label ? ` · ${r.scope.label}` : ""}</T>
                  </View>
                  {(r.permissions || []).map((p: string) => (
                    <View key={p} style={{ backgroundColor: colors.surfaceTertiary, borderRadius: radius.full, paddingHorizontal: 9, paddingVertical: 3 }}>
                      <T variant="caption" color={colors.textSecondary}>{p}</T>
                    </View>
                  ))}
                  {(r.permissions || []).length === 0 ? <T variant="caption" color={colors.muted}>No permissions</T> : null}
                </View>
                {canManage ? (
                  <Button label="Delete role" variant="destructive" full={false} onPress={() => del.mutate(r.id)} testID={`ins-delete-role-${r.id}`} />
                ) : null}
              </Card>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}
