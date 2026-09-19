import React, { useState } from "react";
import { View, ScrollView, Modal, Pressable, KeyboardAvoidingView, Platform, RefreshControl } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { Ionicons } from "@react-native-vector-icons/ionicons";
import { useQuery, useMutation } from "@tanstack/react-query";
import { StackHeader } from "@/src/components/Header";
import { T, Card, Button, Input, Loader, ErrorView, EmptyState, Avatar, Divider } from "@/src/components/ui";
import { api, ApiError } from "@/src/api/client";
import { queryClient } from "@/src/query-client";
import { useToast } from "@/src/components/Toast";
import { useTheme, space, radius } from "@/src/theme";
import { insCan } from "@/src/ins/perms";

const STATE_LABEL: Record<string, string> = {
  pending_approval: "Pending approval",
  active: "Active",
  rejected: "Rejected",
  revoked: "Revoked",
};

export default function InstitutionPeople() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const { show } = useToast();
  const [code, setCode] = useState("");
  const [assignFor, setAssignFor] = useState<any>(null); // member being assigned a role

  const insQ = useQuery({ queryKey: ["ins", id], queryFn: () => api.get(`/ins/${id}`), enabled: !!id });
  const perms: string[] = insQ.data?.institution?.my_permissions ?? [];
  const membersQ = useQuery({ queryKey: ["ins", id, "members"], queryFn: () => api.get(`/ins/${id}/members`), enabled: !!id });
  const rolesQ = useQuery({ queryKey: ["ins", id, "roles"], queryFn: () => api.get(`/ins/${id}/roles`), enabled: !!id && !!assignFor });

  const canInvite = insCan(perms, "members:invite");
  const canRemove = insCan(perms, "members:remove");
  const canAssign = insCan(perms, "roles:assign");

  const add = useMutation({
    mutationFn: (identity_code: string) => api.post(`/ins/${id}/members`, { identity_code }),
    onSuccess: () => { setCode(""); queryClient.invalidateQueries({ queryKey: ["ins", id, "members"] }); show("Person added to the institution", "success"); },
    onError: (e: any) => show(e instanceof ApiError ? e.message : "Could not add person", "error"),
  });
  const remove = useMutation({
    mutationFn: (memberId: string) => api.del(`/ins/${id}/members/${memberId}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["ins", id, "members"] }); show("Removed", "success"); },
    onError: (e: any) => show(e instanceof ApiError ? e.message : "Could not remove", "error"),
  });
  const assign = useMutation({
    mutationFn: ({ memberId, roleId }: any) => api.post(`/ins/${id}/members/${memberId}/roles`, { role_id: roleId }),
    onSuccess: () => { setAssignFor(null); queryClient.invalidateQueries({ queryKey: ["ins", id, "members"] }); queryClient.invalidateQueries({ queryKey: ["ins", id, "approvals"] }); show("Role nominated — pending approval", "success"); },
    onError: (e: any) => show(e instanceof ApiError ? e.message : "Could not assign role", "error"),
  });
  const revoke = useMutation({
    mutationFn: ({ memberId, assignmentId }: any) => api.del(`/ins/${id}/members/${memberId}/roles/${assignmentId}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["ins", id, "members"] }); show("Role revoked", "success"); },
    onError: (e: any) => show(e instanceof ApiError ? e.message : "Could not revoke", "error"),
  });

  const members = membersQ.data?.members ?? [];

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <StackHeader title="People" />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView
          contentContainerStyle={{ padding: 16, gap: space.md, paddingBottom: 48 }}
          keyboardShouldPersistTaps="handled"
          refreshControl={<RefreshControl refreshing={membersQ.isFetching} onRefresh={() => membersQ.refetch()} tintColor={colors.brand} />}
        >
          {canInvite ? (
            <Card style={{ gap: 10 }}>
              <T variant="subtitle">Add a person</T>
              <T variant="bodySm" color={colors.textSecondary}>Associate an existing Traksha person by their identity code (TMP/TRK).</T>
              <Input label="IDENTITY CODE" value={code} onChangeText={setCode} placeholder="e.g. XK53HVFKN516SHEJ" autoCapitalize="characters" testID="ins-member-code" />
              <Button label="Add person" icon="person-add-outline" onPress={() => add.mutate(code.trim())} disabled={code.trim().length < 4} loading={add.isPending} testID="ins-member-add" />
            </Card>
          ) : null}

          {membersQ.isLoading ? <Loader /> : membersQ.isError ? <ErrorView onRetry={() => membersQ.refetch()} /> : members.length === 0 ? (
            <EmptyState icon="people-outline" title="No people yet" body="Add authorised people to this institution." />
          ) : (
            <View style={{ gap: 10 }}>
              {members.map((m: any) => (
                <Card key={m.id} testID={`ins-member-${m.id}`} style={{ gap: 10 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                    <Avatar name={m.user?.display_name} uri={m.user?.photo_url} size={44} />
                    <View style={{ flex: 1, gap: 2 }}>
                      <T variant="label" numberOfLines={1}>{m.user?.display_name || "Traksha member"}</T>
                      <T variant="mono" color={colors.muted}>{m.user?.identity_label}</T>
                    </View>
                    {m.relationship === "owner" ? (
                      <View style={{ backgroundColor: colors.trkBg, borderColor: colors.trkBorder, borderWidth: 1, borderRadius: radius.full, paddingHorizontal: 10, paddingVertical: 4 }}>
                        <T variant="caption" color={colors.trkText}>Owner</T>
                      </View>
                    ) : null}
                  </View>

                  {(m.roles || []).length > 0 ? (
                    <View style={{ gap: 6 }}>
                      <Divider />
                      {m.roles.map((r: any) => (
                        <View key={r.assignment_id} style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                          <Ionicons name={r.state === "active" ? "ribbon" : "time-outline"} size={15} color={r.state === "active" ? colors.trkText : colors.warning} />
                          <T variant="bodySm" color={colors.textPrimary} style={{ flex: 1 }}>{r.role_name}</T>
                          <T variant="caption" color={r.state === "active" ? colors.success : colors.warning}>{STATE_LABEL[r.state] || r.state}</T>
                          {canAssign ? (
                            <Pressable hitSlop={8} onPress={() => revoke.mutate({ memberId: m.id, assignmentId: r.assignment_id })} testID={`ins-revoke-${r.assignment_id}`}>
                              <Ionicons name="close-circle" size={18} color={colors.muted} />
                            </Pressable>
                          ) : null}
                        </View>
                      ))}
                    </View>
                  ) : null}

                  {(canAssign || (canRemove && m.relationship !== "owner")) ? (
                    <View style={{ flexDirection: "row", gap: 8 }}>
                      {canAssign ? <Button label="Assign role" variant="secondary" icon="add" full={false} onPress={() => setAssignFor(m)} testID={`ins-assign-${m.id}`} /> : null}
                      {canRemove && m.relationship !== "owner" ? <Button label="Remove" variant="destructive" full={false} onPress={() => remove.mutate(m.id)} /> : null}
                    </View>
                  ) : null}
                </Card>
              ))}
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Assign-role picker */}
      <Modal visible={!!assignFor} transparent animationType="fade" onRequestClose={() => setAssignFor(null)}>
        <Pressable style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.35)", justifyContent: "flex-end" }} onPress={() => setAssignFor(null)}>
          <Pressable style={{ backgroundColor: colors.surface, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, padding: space.lg, gap: 12, maxHeight: "70%" }} onPress={() => {}}>
            <T variant="subtitle">Assign a role to {assignFor?.user?.display_name}</T>
            <T variant="bodySm" color={colors.textSecondary}>The assignment stays pending until approved.</T>
            {rolesQ.isLoading ? <Loader /> : (
              <ScrollView style={{ maxHeight: 340 }} contentContainerStyle={{ gap: 8 }}>
                {(rolesQ.data?.roles ?? []).length === 0 ? (
                  <T variant="bodySm" color={colors.muted}>No roles defined yet. Create one under Roles & permissions.</T>
                ) : (
                  (rolesQ.data?.roles ?? []).map((role: any) => (
                    <Card key={role.id} onPress={() => assign.mutate({ memberId: assignFor.id, roleId: role.id })} testID={`ins-pick-role-${role.id}`} style={{ gap: 4 }}>
                      <T variant="label">{role.name}</T>
                      <T variant="caption" color={colors.muted}>{(role.permissions || []).length} permission(s) · scope: {role.scope?.type || "institution"}</T>
                    </Card>
                  ))
                )}
              </ScrollView>
            )}
            <Button label="Cancel" variant="ghost" onPress={() => setAssignFor(null)} />
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}
