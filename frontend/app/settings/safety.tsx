import React from "react";
import { View, ScrollView, Pressable } from "react-native";
import { router } from "expo-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Ionicons } from "@react-native-vector-icons/ionicons";
import { StackHeader } from "@/src/components/Header";
import { T, Card, Loader, EmptyState, Avatar, IdentityBadge, Button, Divider, SectionLabel } from "@/src/components/ui";
import { api } from "@/src/api/client";
import { queryClient } from "@/src/query-client";
import { useToast } from "@/src/components/Toast";
import { useTheme, space } from "@/src/theme";

function ControlRow({ icon, label, hint, onPress, testID }: any) {
  const { colors } = useTheme();
  return (
    <Pressable onPress={onPress} testID={testID} style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 14, paddingVertical: 14, paddingHorizontal: 16, backgroundColor: pressed ? colors.surfaceTertiary : "transparent" })}>
      <Ionicons name={icon} size={20} color={colors.textSecondary} />
      <View style={{ flex: 1 }}>
        <T variant="body">{label}</T>
        {hint ? <T variant="caption" color={colors.muted}>{hint}</T> : null}
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.muted} />
    </Pressable>
  );
}

export default function Safety() {
  const { colors } = useTheme();
  const { show } = useToast();
  const blocks = useQuery({ queryKey: ["blocks"], queryFn: () => api.get<any[]>("/blocks") });

  const unblock = useMutation({
    mutationFn: (code: string) => api.del(`/blocks/${code}`),
    onSuccess: () => { show("Unblocked", "info"); queryClient.invalidateQueries({ queryKey: ["blocks"] }); },
  });

  const list = blocks.data ?? [];

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <StackHeader title="Safety" />
      <ScrollView contentContainerStyle={{ padding: 16, gap: space.lg, paddingBottom: 32 }}>
        <T variant="bodySm" color={colors.textSecondary}>
          Your controls for protecting how you connect and communicate. Every interaction on Traksha
          requires consent — these settings let you tighten it further.
        </T>

        <View>
          <SectionLabel>Who can reach you</SectionLabel>
          <Card style={{ padding: 0, overflow: "hidden" }}>
            <ControlRow icon="shield-outline" label="Privacy & discoverability" hint="Control who can find you and send requests" onPress={() => router.push("/settings/privacy")} testID="safety-privacy" />
            <Divider />
            <ControlRow icon="call-outline" label="Call availability" hint="Choose who may call you and when" onPress={() => router.push("/settings/communication")} testID="safety-communication" />
          </Card>
        </View>

        <View>
          <SectionLabel>Blocked people</SectionLabel>
          {blocks.isLoading ? (
            <Loader />
          ) : list.length === 0 ? (
            <Card>
              <EmptyState
                icon="shield-checkmark-outline"
                title="No one is blocked"
                body="People you block will appear here. Blocking removes any connection and stops all messages and calls."
                testID="empty-blocks"
              />
            </Card>
          ) : (
            <View style={{ gap: 12 }}>
              {list.map((item: any) => (
                <Card key={item.identity_code} style={{ flexDirection: "row", gap: 12, alignItems: "center" }}>
                  <Avatar name={item.display_name} uri={item.photo_url} />
                  <View style={{ flex: 1, gap: 4 }}>
                    <T variant="subtitle" numberOfLines={1}>{item.display_name}</T>
                    <IdentityBadge type={item.identity_type} compact />
                  </View>
                  <Button label="Unblock" variant="secondary" full={false} onPress={() => unblock.mutate(item.identity_code)} testID={`unblock-${item.identity_code}`} />
                </Card>
              ))}
            </View>
          )}
        </View>

        <View>
          <SectionLabel>Reporting</SectionLabel>
          <Card style={{ gap: 8 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Ionicons name="flag-outline" size={18} color={colors.textSecondary} />
              <T variant="label">Report a problem</T>
            </View>
            <T variant="bodySm" color={colors.textSecondary}>
              You can report any profile or message from its menu (⋯). Reports are confidential and
              reviewed by the Traksha team. To stop someone immediately, block them above.
            </T>
          </Card>
        </View>
      </ScrollView>
    </View>
  );
}
