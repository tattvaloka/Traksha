import React, { useState } from "react";
import { View, ScrollView, KeyboardAvoidingView, Platform, RefreshControl } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@react-native-vector-icons/ionicons";
import { useQuery, useMutation } from "@tanstack/react-query";
import { StackHeader } from "@/src/components/Header";
import { T, Card, Button, Input, Loader, ErrorView, Divider } from "@/src/components/ui";
import { api, ApiError } from "@/src/api/client";
import { queryClient } from "@/src/query-client";
import { useToast } from "@/src/components/Toast";
import { useTheme, space, radius } from "@/src/theme";
import { insCan, STATUS_META } from "@/src/ins/perms";

export default function InstitutionDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const { show } = useToast();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<any>(null);

  const q = useQuery({ queryKey: ["ins", id], queryFn: () => api.get(`/ins/${id}`), enabled: !!id });
  const ins = q.data?.institution;
  const perms: string[] = ins?.my_permissions ?? [];

  const save = useMutation({
    mutationFn: (body: any) => api.put(`/ins/${id}/profile`, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ins", id] });
      queryClient.invalidateQueries({ queryKey: ["ins", "mine"] });
      setEditing(false);
      show("Institution profile updated", "success");
    },
    onError: (e: any) => show(e instanceof ApiError ? e.message : "Could not save", "error"),
  });

  if (q.isLoading) return <View style={{ flex: 1, backgroundColor: colors.surface }}><StackHeader title="Institution" /><Loader /></View>;
  if (q.isError || !ins) return <View style={{ flex: 1, backgroundColor: colors.surface }}><StackHeader title="Institution" /><ErrorView onRetry={() => q.refetch()} /></View>;

  const meta = STATUS_META[ins.status] || STATUS_META.pending;
  const isApproved = ins.status === "approved";

  const startEdit = () => {
    setForm({ name: ins.name || "", category: ins.category || "", description: ins.description || "", website: ins.website || "", location: ins.location || "", email: ins.email || "" });
    setEditing(true);
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <StackHeader title={ins.name} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView
          contentContainerStyle={{ padding: 16, gap: space.md, paddingBottom: 48 }}
          keyboardShouldPersistTaps="handled"
          refreshControl={<RefreshControl refreshing={q.isFetching} onRefresh={() => q.refetch()} tintColor={colors.brand} />}
        >
          {/* Status banner */}
          {!isApproved ? (
            <View style={{ backgroundColor: ins.status === "rejected" ? colors.surfaceSecondary : colors.surfaceWarm, borderWidth: 1, borderColor: ins.status === "rejected" ? colors.error : colors.insBorder, borderRadius: radius.lg, padding: space.md, gap: 6 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Ionicons name={ins.status === "rejected" ? "close-circle-outline" : "hourglass-outline"} size={16} color={ins.status === "rejected" ? colors.error : colors.insText} />
                <T variant="label" color={ins.status === "rejected" ? colors.error : colors.insText}>{meta.label}</T>
              </View>
              <T variant="bodySm" color={colors.textSecondary}>
                {ins.status === "rejected"
                  ? (ins.rejection_reason || "This application was not approved.")
                  : "Your registration is under review. Management tools unlock once the institution is verified."}
              </T>
              {ins.application?.applicant_role ? (
                <T variant="caption" color={colors.muted}>Applied as: {ins.application.applicant_role}</T>
              ) : null}
            </View>
          ) : null}

          {/* Institutional profile */}
          <View style={{ alignItems: "center", gap: 10, paddingVertical: 8 }}>
            <View style={{ width: 72, height: 72, borderRadius: radius.lg, backgroundColor: colors.insBg, borderWidth: 1, borderColor: colors.insBorder, alignItems: "center", justifyContent: "center" }}>
              <Ionicons name="business" size={32} color={colors.insText} />
            </View>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: colors.insBg, borderColor: colors.insBorder, borderWidth: 1, borderRadius: radius.md, paddingHorizontal: 10, paddingVertical: 4 }}>
              <Ionicons name="business-outline" size={12} color={colors.insText} />
              <T variant="caption" color={colors.insText}>INS</T>
            </View>
          </View>

          {editing ? (
            <Card style={{ gap: 12 }}>
              <T variant="subtitle">Edit institution</T>
              <Input label="NAME" value={form.name} onChangeText={(t: string) => setForm({ ...form, name: t })} testID="ins-edit-name" />
              <Input label="CATEGORY" value={form.category} onChangeText={(t: string) => setForm({ ...form, category: t })} placeholder="e.g. School, NGO, Company" />
              <Input label="DESCRIPTION" value={form.description} onChangeText={(t: string) => setForm({ ...form, description: t })} multiline />
              <Input label="WEBSITE" value={form.website} onChangeText={(t: string) => setForm({ ...form, website: t })} autoCapitalize="none" />
              <Input label="LOCATION" value={form.location} onChangeText={(t: string) => setForm({ ...form, location: t })} />
              <Input label="OFFICIAL EMAIL" value={form.email} onChangeText={(t: string) => setForm({ ...form, email: t })} autoCapitalize="none" keyboardType="email-address" />
              <View style={{ flexDirection: "row", gap: 10 }}>
                <Button label="Cancel" variant="ghost" onPress={() => setEditing(false)} full={false} />
                <View style={{ flex: 1 }}><Button label="Save" onPress={() => save.mutate(form)} loading={save.isPending} testID="ins-edit-save" /></View>
              </View>
            </Card>
          ) : (
            <Card style={{ gap: 10 }}>
              {ins.category ? <InfoRow icon="pricetag-outline" label={ins.category} colors={colors} /> : null}
              {ins.location ? <InfoRow icon="location-outline" label={ins.location} colors={colors} /> : null}
              {ins.website ? <InfoRow icon="globe-outline" label={ins.website} colors={colors} /> : null}
              {ins.email ? <InfoRow icon="mail-outline" label={ins.email} colors={colors} /> : null}
              {ins.description ? (
                <><Divider /><T variant="bodySm" color={colors.textSecondary}>{ins.description}</T></>
              ) : null}
              {isApproved && insCan(perms, "institution:manage") ? (
                <Button label="Edit profile" variant="secondary" icon="create-outline" onPress={startEdit} testID="ins-edit-profile" />
              ) : null}
            </Card>
          )}

          {/* Management */}
          {isApproved ? (
            <View style={{ gap: 10 }}>
              <NavCard icon="people-outline" title="People" subtitle="Members associated with this institution" onPress={() => router.push(`/ins/${id}/people`)} colors={colors} testID="ins-nav-people" />
              <NavCard icon="ribbon-outline" title="Roles & permissions" subtitle="Custom roles, permissions and scope" onPress={() => router.push(`/ins/${id}/roles`)} colors={colors} testID="ins-nav-roles" />
              {insCan(perms, "approvals:manage") ? (
                <NavCard icon="checkmark-done-outline" title="Approvals" subtitle="Review pending role assignments" onPress={() => router.push(`/ins/${id}/approvals`)} colors={colors} testID="ins-nav-approvals" />
              ) : null}
            </View>
          ) : null}

          {ins.is_owner ? (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6, justifyContent: "center", paddingTop: 4 }}>
              <Ionicons name="shield-checkmark" size={13} color={colors.trkText} />
              <T variant="caption" color={colors.trkText}>You are the owner · ownership is separate from roles</T>
            </View>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

function InfoRow({ icon, label, colors }: any) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
      <Ionicons name={icon} size={16} color={colors.muted} />
      <T variant="body" color={colors.textPrimary} style={{ flex: 1 }} numberOfLines={2}>{label}</T>
    </View>
  );
}

function NavCard({ icon, title, subtitle, onPress, colors, testID }: any) {
  return (
    <Card onPress={onPress} testID={testID} style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
      <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surfaceTertiary, alignItems: "center", justifyContent: "center" }}>
        <Ionicons name={icon} size={20} color={colors.textPrimary} />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <T variant="label">{title}</T>
        <T variant="bodySm" color={colors.textSecondary}>{subtitle}</T>
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.muted} />
    </Card>
  );
}
