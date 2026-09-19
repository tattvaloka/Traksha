import React, { useEffect, useMemo, useState } from "react";
import { View, ScrollView, Pressable, KeyboardAvoidingView, Platform } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@react-native-vector-icons/ionicons";
import { useQuery, useMutation } from "@tanstack/react-query";
import { StackHeader } from "@/src/components/Header";
import { T, Card, Button, Input, Loader, SectionLabel } from "@/src/components/ui";
import { api, ApiError } from "@/src/api/client";
import { queryClient } from "@/src/query-client";
import { useToast } from "@/src/components/Toast";
import { useTheme, space, radius } from "@/src/theme";

export default function RoleEditor() {
  const { id, roleId } = useLocalSearchParams<{ id: string; roleId?: string }>();
  const { colors } = useTheme();
  const { show } = useToast();
  const editing = !!roleId;

  const catalogQ = useQuery({ queryKey: ["ins", "catalog"], queryFn: () => api.get("/ins/permissions/catalog") });
  const rolesQ = useQuery({ queryKey: ["ins", id, "roles"], queryFn: () => api.get(`/ins/${id}/roles`), enabled: editing });

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [scopeType, setScopeType] = useState("institution");
  const [scopeLabel, setScopeLabel] = useState("");
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (!editing || hydrated || !rolesQ.data) return;
    const role = (rolesQ.data.roles || []).find((r: any) => r.id === roleId);
    if (role) {
      setName(role.name || "");
      setDescription(role.description || "");
      setSelected(role.permissions || []);
      setScopeType(role.scope?.type || "institution");
      setScopeLabel(role.scope?.label || "");
      setHydrated(true);
    }
  }, [editing, hydrated, rolesQ.data, roleId]);

  const scopes: string[] = catalogQ.data?.scopes ?? ["institution", "department", "project", "resource"];
  const grouped = useMemo(() => {
    const cat: Record<string, any[]> = {};
    (catalogQ.data?.permissions ?? []).forEach((p: any) => {
      (cat[p.category] = cat[p.category] || []).push(p);
    });
    return cat;
  }, [catalogQ.data]);

  const toggle = (key: string) => setSelected((s) => (s.includes(key) ? s.filter((k) => k !== key) : [...s, key]));

  const save = useMutation({
    mutationFn: () => {
      const body = { name: name.trim(), description: description.trim() || null, permissions: selected, scope: { type: scopeType, label: scopeLabel.trim() || null } };
      return editing ? api.put(`/ins/${id}/roles/${roleId}`, body) : api.post(`/ins/${id}/roles`, body);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ins", id, "roles"] });
      show(editing ? "Role updated" : "Role created", "success");
      router.back();
    },
    onError: (e: any) => show(e instanceof ApiError ? e.message : "Could not save role", "error"),
  });

  if (catalogQ.isLoading || (editing && rolesQ.isLoading)) {
    return <View style={{ flex: 1, backgroundColor: colors.surface }}><StackHeader title={editing ? "Edit role" : "New role"} /><Loader /></View>;
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <StackHeader title={editing ? "Edit role" : "New role"} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={{ padding: 16, gap: space.md, paddingBottom: 48 }} keyboardShouldPersistTaps="handled">
          <Card style={{ gap: 12 }}>
            <Input label="ROLE NAME" value={name} onChangeText={setName} placeholder="e.g. Coordinator, Editor, Volunteer Lead" testID="role-name" />
            <Input label="DESCRIPTION" value={description} onChangeText={setDescription} placeholder="What this role is responsible for" multiline />
          </Card>

          <View style={{ gap: 8 }}>
            <SectionLabel>Scope</SectionLabel>
            <Card style={{ gap: 10 }}>
              <T variant="bodySm" color={colors.textSecondary}>Where this role&apos;s permissions apply. Extensible for future institutional assets.</T>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                {scopes.map((s) => {
                  const on = scopeType === s;
                  return (
                    <Pressable key={s} onPress={() => setScopeType(s)} testID={`scope-${s}`} style={{ paddingHorizontal: 12, paddingVertical: 7, borderRadius: radius.full, borderWidth: 1, borderColor: on ? colors.insBorder : colors.border, backgroundColor: on ? colors.insBg : "transparent" }}>
                      <T variant="caption" color={on ? colors.insText : colors.textSecondary} style={{ textTransform: "capitalize" }}>{s}</T>
                    </Pressable>
                  );
                })}
              </View>
              {scopeType !== "institution" ? (
                <Input label="SCOPE LABEL (OPTIONAL)" value={scopeLabel} onChangeText={setScopeLabel} placeholder="e.g. Operations, Project Alpha" />
              ) : null}
            </Card>
          </View>

          <View style={{ gap: 8 }}>
            <SectionLabel>Permissions</SectionLabel>
            {Object.entries(grouped).map(([category, perms]) => (
              <Card key={category} style={{ gap: 10 }}>
                <T variant="label">{category}</T>
                {(perms as any[]).map((p) => {
                  const on = selected.includes(p.key);
                  return (
                    <Pressable key={p.key} onPress={() => toggle(p.key)} testID={`perm-${p.key}`} style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                      <Ionicons name={on ? "checkbox" : "square-outline"} size={22} color={on ? colors.brand : colors.muted} />
                      <View style={{ flex: 1, gap: 1 }}>
                        <T variant="body">{p.label}</T>
                        <T variant="caption" color={colors.muted}>{p.description}</T>
                      </View>
                    </Pressable>
                  );
                })}
              </Card>
            ))}
          </View>

          <Button label={editing ? "Save role" : "Create role"} onPress={() => save.mutate()} disabled={name.trim().length < 1} loading={save.isPending} testID="role-save" />
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
