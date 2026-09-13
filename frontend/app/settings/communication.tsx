import React from "react";
import { View, ScrollView, Switch } from "react-native";
import { useQuery, useMutation } from "@tanstack/react-query";
import { StackHeader } from "@/src/components/Header";
import { T, Card, Divider, Loader } from "@/src/components/ui";
import { api } from "@/src/api/client";
import { useAuth } from "@/src/auth/AuthContext";
import { useToast } from "@/src/components/Toast";
import { useTheme, space } from "@/src/theme";

export default function Communication() {
  const { colors } = useTheme();
  const { refresh } = useAuth();
  const { show } = useToast();
  const me = useQuery({ queryKey: ["me-availability"], queryFn: () => api.get("/auth/me") });

  const update = useMutation({
    mutationFn: (patch: any) => api.put("/settings/availability", patch),
    onSuccess: async () => { await refresh(); me.refetch(); show("Availability updated", "success"); },
  });

  if (me.isLoading) return <View style={{ flex: 1, backgroundColor: colors.surface }}><StackHeader title="Communication" /><Loader /></View>;
  const a = me.data?.availability ?? {};

  const Row = ({ title, body, value, onValueChange, testID, last }: any) => (
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

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <StackHeader title="Communication" />
      <ScrollView contentContainerStyle={{ padding: 16, gap: space.md, paddingBottom: 32 }}>
        <T variant="bodySm" color={colors.textSecondary}>
          Audio and video availability are controlled independently. When off, calls don’t ring — callers must send a Call Availability Request.
        </T>
        <Card style={{ padding: 0, overflow: "hidden" }}>
          <Row title="Audio availability" body="Allow connections to ring you for audio calls." value={a.audio_on ?? false} onValueChange={(v: boolean) => update.mutate({ audio_on: v })} testID="toggle-audio" />
          <Row title="Video availability" body="Allow connections to ring you for video calls." value={a.video_on ?? false} onValueChange={(v: boolean) => update.mutate({ video_on: v })} testID="toggle-video" last />
        </Card>
      </ScrollView>
    </View>
  );
}
