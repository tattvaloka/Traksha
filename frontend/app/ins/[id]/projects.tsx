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

const STATUSES = ["active", "on_hold", "completed"];
const STATUS_LABEL: Record<string, string> = { active: "Active", on_hold: "On hold", completed: "Completed", archived: "Archived" };

export default function InstitutionProjects() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const { show } = useToast();
  const insQ = useQuery({ queryKey: ["ins", id], queryFn: () => api.get(`/ins/${id}`), enabled: !!id });
  const perms: string[] = insQ.data?.institution?.my_permissions ?? [];
  const canManage = insCan(perms, "projects:manage");
  const q = useQuery({ queryKey: ["ins", id, "projects"], queryFn: () => api.get(`/ins/${id}/projects`), enabled: !!id });
  const deptsQ = useQuery({ queryKey: ["ins", id, "departments"], queryFn: () => api.get(`/ins/${id}/departments`), enabled: !!id });
  const projects = q.data?.projects ?? [];
  const depts = deptsQ.data?.departments ?? [];

  const [editor, setEditor] = useState<any>(null); // {id?, name, description, status, department_id}
  const [assignFor, setAssignFor] = useState<any>(null);

  const statusColor = (s: string) => (s === "active" ? colors.success : s === "completed" ? colors.trkText : colors.warning);

  const save = useMutation({
    mutationFn: (p: any) => {
      const body = { name: p.name.trim(), description: p.description?.trim() || null, status: p.status, department_id: p.department_id || null };
      return p.id ? api.put(`/ins/${id}/projects/${p.id}`, body) : api.post(`/ins/${id}/projects`, body);
    },
    onSuccess: () => { setEditor(null); queryClient.invalidateQueries({ queryKey: ["ins", id, "projects"] }); show("Saved", "success"); },
    onError: (e: any) => show(e instanceof ApiError ? e.message : "Could not save", "error"),
  });
  const archive = useMutation({
    mutationFn: (pid: string) => api.post(`/ins/${id}/projects/${pid}/archive`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["ins", id, "projects"] }); show("Archived", "success"); },
    onError: (e: any) => show(e instanceof ApiError ? e.message : "Could not archive", "error"),
  });

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <StackHeader title="Projects" />
      <ScrollView
        contentContainerStyle={{ padding: 16, gap: space.md, paddingBottom: 48 }}
        refreshControl={<RefreshControl refreshing={q.isFetching} onRefresh={() => q.refetch()} tintColor={colors.brand} />}
      >
        {canManage ? (
          <Button label="Create project" icon="add-circle-outline" onPress={() => setEditor({ name: "", description: "", status: "active", department_id: null })} testID="project-create" />
        ) : null}

        {q.isLoading ? <Loader /> : q.isError ? <ErrorView onRetry={() => q.refetch()} /> : projects.length === 0 ? (
          <EmptyState icon="briefcase-outline" title="No projects yet" body="Create projects, associate them with a department and assign people." />
        ) : (
          <View style={{ gap: 10 }}>
            {projects.map((p: any) => (
              <Card key={p.id} testID={`project-${p.id}`} style={{ gap: 10 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                  <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: colors.surfaceTertiary, alignItems: "center", justifyContent: "center" }}>
                    <Ionicons name="briefcase-outline" size={18} color={colors.textPrimary} />
                  </View>
                  <View style={{ flex: 1, gap: 2 }}>
                    <T variant="label">{p.name}</T>
                    {p.department_name ? <T variant="caption" color={colors.muted}>{p.department_name}</T> : null}
                  </View>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: colors.surfaceTertiary, borderRadius: radius.full, paddingHorizontal: 9, paddingVertical: 4 }}>
                    <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: statusColor(p.status) }} />
                    <T variant="caption" color={colors.textSecondary}>{STATUS_LABEL[p.status] || p.status}</T>
                  </View>
                </View>
                {p.description ? <T variant="bodySm" color={colors.textSecondary}>{p.description}</T> : null}
                {(p.assignees || []).length > 0 ? (
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                    {p.assignees.map((mu: any) => (
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
                      <Button label="People" variant="secondary" icon="people-outline" full={false} onPress={() => setAssignFor(p)} testID={`project-people-${p.id}`} />
                      <Button label="Edit" variant="ghost" icon="create-outline" full={false} onPress={() => setEditor({ id: p.id, name: p.name, description: p.description || "", status: p.status, department_id: p.department_id })} testID={`project-edit-${p.id}`} />
                      <Button label="Archive" variant="destructive" full={false} onPress={() => archive.mutate(p.id)} testID={`project-archive-${p.id}`} />
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
            <Pressable style={{ backgroundColor: colors.surface, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, padding: space.lg, gap: 12, maxHeight: "85%" }} onPress={() => {}}>
              <ScrollView contentContainerStyle={{ gap: 12 }} keyboardShouldPersistTaps="handled">
                <T variant="subtitle">{editor?.id ? "Edit" : "New"} project</T>
                <Input label="NAME" value={editor?.name} onChangeText={(t: string) => setEditor({ ...editor, name: t })} testID="project-name" />
                <Input label="DESCRIPTION" value={editor?.description} onChangeText={(t: string) => setEditor({ ...editor, description: t })} multiline />
                <View style={{ gap: 6 }}>
                  <T variant="mono" color={colors.textSecondary}>STATUS</T>
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                    {STATUSES.map((s) => {
                      const on = editor?.status === s;
                      return (
                        <Pressable key={s} onPress={() => setEditor({ ...editor, status: s })} testID={`project-status-${s}`} style={{ paddingHorizontal: 12, paddingVertical: 7, borderRadius: radius.full, borderWidth: 1, borderColor: on ? colors.insBorder : colors.border, backgroundColor: on ? colors.insBg : "transparent" }}>
                          <T variant="caption" color={on ? colors.insText : colors.textSecondary}>{STATUS_LABEL[s]}</T>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
                <View style={{ gap: 6 }}>
                  <T variant="mono" color={colors.textSecondary}>DEPARTMENT (OPTIONAL)</T>
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                    <Pressable onPress={() => setEditor({ ...editor, department_id: null })} testID="project-dept-none" style={{ paddingHorizontal: 12, paddingVertical: 7, borderRadius: radius.full, borderWidth: 1, borderColor: !editor?.department_id ? colors.insBorder : colors.border, backgroundColor: !editor?.department_id ? colors.insBg : "transparent" }}>
                      <T variant="caption" color={!editor?.department_id ? colors.insText : colors.textSecondary}>None</T>
                    </Pressable>
                    {depts.map((d: any) => {
                      const on = editor?.department_id === d.id;
                      return (
                        <Pressable key={d.id} onPress={() => setEditor({ ...editor, department_id: d.id })} testID={`project-dept-${d.id}`} style={{ paddingHorizontal: 12, paddingVertical: 7, borderRadius: radius.full, borderWidth: 1, borderColor: on ? colors.insBorder : colors.border, backgroundColor: on ? colors.insBg : "transparent" }}>
                          <T variant="caption" color={on ? colors.insText : colors.textSecondary}>{d.name}</T>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
                <View style={{ flexDirection: "row", gap: 10 }}>
                  <Button label="Cancel" variant="ghost" onPress={() => setEditor(null)} full={false} />
                  <View style={{ flex: 1 }}><Button label="Save" onPress={() => save.mutate(editor)} disabled={!editor?.name?.trim()} loading={save.isPending} testID="project-save" /></View>
                </View>
              </ScrollView>
            </Pressable>
          </KeyboardAvoidingView>
        </Pressable>
      </Modal>

      {assignFor ? (
        <AssigneesModal insId={id!} project={assignFor} onClose={() => setAssignFor(null)} colors={colors} show={show} />
      ) : null}
    </View>
  );
}

function AssigneesModal({ insId, project, onClose, colors, show }: any) {
  const membersQ = useQuery({ queryKey: ["ins", insId, "members"], queryFn: () => api.get(`/ins/${insId}/members`) });
  const detailQ = useQuery({ queryKey: ["ins", insId, "projects", project.id], queryFn: () => api.get(`/ins/${insId}/projects/${project.id}`) });
  const current = detailQ.data?.project?.assignee_ids ?? project.assignee_ids ?? [];

  const add = useMutation({
    mutationFn: (user_id: string) => api.post(`/ins/${insId}/projects/${project.id}/assignees`, { user_id }),
    onSuccess: () => { detailQ.refetch(); queryClient.invalidateQueries({ queryKey: ["ins", insId, "projects"] }); },
    onError: (e: any) => show(e instanceof ApiError ? e.message : "Could not add", "error"),
  });
  const remove = useMutation({
    mutationFn: (user_id: string) => api.del(`/ins/${insId}/projects/${project.id}/assignees/${user_id}`),
    onSuccess: () => { detailQ.refetch(); queryClient.invalidateQueries({ queryKey: ["ins", insId, "projects"] }); },
    onError: (e: any) => show(e instanceof ApiError ? e.message : "Could not remove", "error"),
  });

  const members = membersQ.data?.members ?? [];
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.35)", justifyContent: "flex-end" }} onPress={onClose}>
        <Pressable style={{ backgroundColor: colors.surface, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, padding: space.lg, gap: 12, maxHeight: "75%" }} onPress={() => {}}>
          <T variant="subtitle">People on {project.name}</T>
          {membersQ.isLoading ? <Loader /> : (
            <ScrollView style={{ maxHeight: 420 }} contentContainerStyle={{ gap: 8 }}>
              {members.map((m: any) => {
                const uid = m.user?.id;
                const on = current.includes(uid);
                return (
                  <View key={m.id} style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                    <Avatar name={m.user?.display_name} uri={m.user?.photo_url} size={36} />
                    <T variant="body" style={{ flex: 1 }}>{m.user?.display_name}</T>
                    <Button label={on ? "Remove" : "Assign"} variant={on ? "destructive" : "secondary"} full={false} onPress={() => (on ? remove.mutate(uid) : add.mutate(uid))} testID={`project-assignee-toggle-${uid}`} />
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
