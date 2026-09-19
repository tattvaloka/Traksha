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

export default function InstitutionDepartments() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const { show } = useToast();
  const insQ = useQuery({ queryKey: ["ins", id], queryFn: () => api.get(`/ins/${id}`), enabled: !!id });
  const perms: string[] = insQ.data?.institution?.my_permissions ?? [];
  const canManage = insCan(perms, "departments:manage");
  const q = useQuery({ queryKey: ["ins", id, "departments"], queryFn: () => api.get(`/ins/${id}/departments`), enabled: !!id });
  const depts = q.data?.departments ?? [];

  const [editor, setEditor] = useState<any>(null); // {id?, name, kind, description}
  const [membersFor, setMembersFor] = useState<any>(null);

  const save = useMutation({
    mutationFn: (d: any) => {
      const body = { name: d.name.trim(), kind: d.kind, description: d.description?.trim() || null };
      return d.id ? api.put(`/ins/${id}/departments/${d.id}`, body) : api.post(`/ins/${id}/departments`, body);
    },
    onSuccess: () => { setEditor(null); queryClient.invalidateQueries({ queryKey: ["ins", id, "departments"] }); show("Saved", "success"); },
    onError: (e: any) => show(e instanceof ApiError ? e.message : "Could not save", "error"),
  });
  const archive = useMutation({
    mutationFn: (deptId: string) => api.post(`/ins/${id}/departments/${deptId}/archive`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["ins", id, "departments"] }); show("Archived", "success"); },
    onError: (e: any) => show(e instanceof ApiError ? e.message : "Could not archive", "error"),
  });

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <StackHeader title="Departments & Teams" />
      <ScrollView
        contentContainerStyle={{ padding: 16, gap: space.md, paddingBottom: 48 }}
        refreshControl={<RefreshControl refreshing={q.isFetching} onRefresh={() => q.refetch()} tintColor={colors.brand} />}
      >
        {canManage ? (
          <Button label="Create department / team" icon="add-circle-outline" onPress={() => setEditor({ name: "", kind: "department", description: "" })} testID="dept-create" />
        ) : null}

        {q.isLoading ? <Loader /> : q.isError ? <ErrorView onRetry={() => q.refetch()} /> : depts.length === 0 ? (
          <EmptyState icon="git-branch-outline" title="No departments yet" body="Create departments and teams to organise people and scope authority." />
        ) : (
          <View style={{ gap: 10 }}>
            {depts.map((d: any) => (
              <Card key={d.id} testID={`dept-${d.id}`} style={{ gap: 10 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                  <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: colors.surfaceTertiary, alignItems: "center", justifyContent: "center" }}>
                    <Ionicons name={d.kind === "team" ? "people-circle-outline" : "git-branch-outline"} size={18} color={colors.textPrimary} />
                  </View>
                  <View style={{ flex: 1, gap: 2 }}>
                    <T variant="label">{d.name}</T>
                    <T variant="caption" color={colors.muted} style={{ textTransform: "capitalize" }}>{d.kind} · {d.member_count} member(s)</T>
                  </View>
                </View>
                {d.description ? <T variant="bodySm" color={colors.textSecondary}>{d.description}</T> : null}
                {(d.members || []).length > 0 ? (
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                    {d.members.map((mu: any) => (
                      <View key={mu.id} style={{ flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: colors.surfaceTertiary, borderRadius: radius.full, paddingHorizontal: 8, paddingVertical: 3 }}>
                        <Avatar name={mu.display_name} uri={mu.photo_url} size={18} />
                        <T variant="caption" color={colors.textSecondary}>{mu.display_name}</T>
                      </View>
                    ))}
                  </View>
                ) : null}
                {canManage ? (
                  <>
                    <Divider />
                    <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
                      <Button label="Members" variant="secondary" icon="people-outline" full={false} onPress={() => setMembersFor(d)} testID={`dept-members-${d.id}`} />
                      <Button label="Edit" variant="ghost" icon="create-outline" full={false} onPress={() => setEditor({ id: d.id, name: d.name, kind: d.kind, description: d.description || "" })} testID={`dept-edit-${d.id}`} />
                      <Button label="Archive" variant="destructive" full={false} onPress={() => archive.mutate(d.id)} testID={`dept-archive-${d.id}`} />
                    </View>
                  </>
                ) : null}
              </Card>
            ))}
          </View>
        )}
      </ScrollView>

      {/* Create/Edit modal */}
      <Modal visible={!!editor} transparent animationType="fade" onRequestClose={() => setEditor(null)}>
        <Pressable style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.35)", justifyContent: "flex-end" }} onPress={() => setEditor(null)}>
          <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
            <Pressable style={{ backgroundColor: colors.surface, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, padding: space.lg, gap: 12 }} onPress={() => {}}>
              <T variant="subtitle">{editor?.id ? "Edit" : "New"} department / team</T>
              <Input label="NAME" value={editor?.name} onChangeText={(t: string) => setEditor({ ...editor, name: t })} testID="dept-name" />
              <View style={{ flexDirection: "row", gap: 8 }}>
                {["department", "team"].map((k) => {
                  const on = editor?.kind === k;
                  return (
                    <Pressable key={k} onPress={() => setEditor({ ...editor, kind: k })} testID={`dept-kind-${k}`} style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: radius.full, borderWidth: 1, borderColor: on ? colors.insBorder : colors.border, backgroundColor: on ? colors.insBg : "transparent" }}>
                      <T variant="caption" color={on ? colors.insText : colors.textSecondary} style={{ textTransform: "capitalize" }}>{k}</T>
                    </Pressable>
                  );
                })}
              </View>
              <Input label="DESCRIPTION" value={editor?.description} onChangeText={(t: string) => setEditor({ ...editor, description: t })} multiline />
              <View style={{ flexDirection: "row", gap: 10 }}>
                <Button label="Cancel" variant="ghost" onPress={() => setEditor(null)} full={false} />
                <View style={{ flex: 1 }}><Button label="Save" onPress={() => save.mutate(editor)} disabled={!editor?.name?.trim()} loading={save.isPending} testID="dept-save" /></View>
              </View>
            </Pressable>
          </KeyboardAvoidingView>
        </Pressable>
      </Modal>

      {membersFor ? (
        <MembersModal insId={id!} dept={membersFor} onClose={() => setMembersFor(null)} colors={colors} show={show} />
      ) : null}
    </View>
  );
}

function MembersModal({ insId, dept, onClose, colors, show }: any) {
  const membersQ = useQuery({ queryKey: ["ins", insId, "members"], queryFn: () => api.get(`/ins/${insId}/members`) });
  const detailQ = useQuery({ queryKey: ["ins", insId, "departments", dept.id], queryFn: () => api.get(`/ins/${insId}/departments/${dept.id}`) });
  const current = detailQ.data?.department?.member_ids ?? dept.member_ids ?? [];

  const add = useMutation({
    mutationFn: (user_id: string) => api.post(`/ins/${insId}/departments/${dept.id}/members`, { user_id }),
    onSuccess: () => { detailQ.refetch(); queryClient.invalidateQueries({ queryKey: ["ins", insId, "departments"] }); },
    onError: (e: any) => show(e instanceof ApiError ? e.message : "Could not add", "error"),
  });
  const remove = useMutation({
    mutationFn: (user_id: string) => api.del(`/ins/${insId}/departments/${dept.id}/members/${user_id}`),
    onSuccess: () => { detailQ.refetch(); queryClient.invalidateQueries({ queryKey: ["ins", insId, "departments"] }); },
    onError: (e: any) => show(e instanceof ApiError ? e.message : "Could not remove", "error"),
  });

  const members = membersQ.data?.members ?? [];
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.35)", justifyContent: "flex-end" }} onPress={onClose}>
        <Pressable style={{ backgroundColor: colors.surface, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, padding: space.lg, gap: 12, maxHeight: "75%" }} onPress={() => {}}>
          <T variant="subtitle">Members of {dept.name}</T>
          {membersQ.isLoading ? <Loader /> : (
            <ScrollView style={{ maxHeight: 420 }} contentContainerStyle={{ gap: 8 }}>
              {members.map((m: any) => {
                const uid = m.user?.id;
                const inDept = current.includes(uid);
                return (
                  <View key={m.id} style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                    <Avatar name={m.user?.display_name} uri={m.user?.photo_url} size={36} />
                    <T variant="body" style={{ flex: 1 }}>{m.user?.display_name}</T>
                    <Button label={inDept ? "Remove" : "Add"} variant={inDept ? "destructive" : "secondary"} full={false} onPress={() => (inDept ? remove.mutate(uid) : add.mutate(uid))} testID={`dept-member-toggle-${uid}`} />
                  </View>
                );
              })}
            </ScrollView>
          )}
          <Button label="Done" variant="ghost" onPress={onClose} />
        </Pressable>
      </Pressable>
    </Modal>
  );
}
