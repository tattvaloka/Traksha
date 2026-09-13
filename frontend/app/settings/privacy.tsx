import React from "react";
import { View, ScrollView, Switch } from "react-native";
import { useQuery, useMutation } from "@tanstack/react-query";
import { StackHeader } from "@/src/components/Header";
import { T, Card, Divider, Loader } from "@/src/components/ui";
import { api } from "@/src/api/client";
import { useAuth } from "@/src/auth/AuthContext";
import { useToast } from "@/src/components/Toast";
import { useTheme, space } from "@/src/theme";

function ToggleRow({ title, body, value, onValueChange, testID, last }: any) {
  const { colors } = useTheme();
  return (
    <>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12, padding: 16 }}>
        <View style={{ flex: 1, gap: 4 }}>
          <T variant="label">{title}</T>
          <T variant="bodySm" color={colors.textSecondary}>{body}</T>
        </View>
        <Switch value={value} onValueChange={onValueChange} testID={testID} trackColor={{ true: colors.brandPrimary, false: colors.border }} thumbColor="#FFFFFF" />
      </View>
      {!last && <Divider />}
    </>
  );
}

export default function Privacy() {
  const { colors } = useTheme();
  const { refresh } = useAuth();
  const { show } = useToast();
  const me = useQuery({ queryKey: ["me-privacy"], queryFn: () => api.get("/auth/me") });

  const update = useMutation({
    mutationFn: (patch: any) => api.put("/settings/privacy", patch),
    onSuccess: async () => { await refresh(); me.refetch(); show("Privacy updated", "success"); },
  });

  if (me.isLoading) return <View style={{ flex: 1, backgroundColor: colors.surface }}><StackHeader title="Privacy" /><Loader /></View>;
  const p = me.data?.privacy ?? {};

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <StackHeader title="Privacy" />
      <ScrollView contentContainerStyle={{ padding: 16, gap: space.md, paddingBottom: 32 }}>
        <T variant="bodySm" color={colors.textSecondary}>
          You control two separate things: whether people can find you, and whether they can send you requests.
        </T>
        <Card style={{ padding: 0, overflow: "hidden" }}>
          <ToggleRow
            title="Discoverable in search"
            body="When off, you won't appear in People search. Existing connections are unaffected."
            value={p.discoverable ?? true}
            onValueChange={(v: boolean) => update.mutate({ discoverable: v })}
            testID="toggle-discoverable"
          />
          <ToggleRow
            title="Allow connection requests"
            body="When off, no one can send you a new connection request."
            value={p.allow_connection_requests ?? true}
            onValueChange={(v: boolean) => update.mutate({ allow_connection_requests: v })}
            testID="toggle-requests"
          />
          <ToggleRow
            title="Restrict profile"
            body="When on, your profile shows only the minimum public details."
            value={p.profile_visibility === "restricted"}
            onValueChange={(v: boolean) => update.mutate({ profile_visibility: v ? "restricted" : "public" })}
            testID="toggle-visibility"
            last
          />
        </Card>
      </ScrollView>
    </View>
  );
}
