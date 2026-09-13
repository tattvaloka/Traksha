import React, { useState } from "react";
import { View, ScrollView, Pressable } from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Ionicons } from "@react-native-vector-icons/ionicons";
import { StackHeader } from "@/src/components/Header";
import { T, Card, Loader, ErrorView, Avatar, IdentityBadge, Button } from "@/src/components/ui";
import { api } from "@/src/api/client";
import { queryClient } from "@/src/query-client";
import { useToast } from "@/src/components/Toast";
import { useRealtime } from "@/src/realtime/RealtimeContext";
import { useTheme, space, radius, fonts } from "@/src/theme";

export default function AvailabilityRequest() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const { show } = useToast();
  const { startCall } = useRealtime();
  const [window, setWindow] = useState(20);

  const req = useQuery({ queryKey: ["availability", id], queryFn: () => api.get(`/calls/availability-request/${id}`) });

  const accept = useMutation({
    mutationFn: () => api.post(`/calls/availability-request/${id}/accept`, { window_minutes: window }),
    onSuccess: () => { show(`Available for ${window} minutes`, "success"); queryClient.invalidateQueries({ queryKey: ["availability", id] }); },
  });
  const decline = useMutation({
    mutationFn: () => api.post(`/calls/availability-request/${id}/decline`),
    onSuccess: () => { show("Declined", "info"); queryClient.invalidateQueries({ queryKey: ["availability", id] }); router.back(); },
  });

  if (req.isLoading) return <View style={{ flex: 1, backgroundColor: colors.surface }}><StackHeader title="Availability" /><Loader /></View>;
  if (req.isError) return <View style={{ flex: 1, backgroundColor: colors.surface }}><StackHeader title="Availability" /><ErrorView onRetry={req.refetch} /></View>;
  const r = req.data;

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <StackHeader title="Call availability" />
      <ScrollView contentContainerStyle={{ padding: 16, gap: space.md }}>
        <Card style={{ alignItems: "center", gap: 10 }}>
          <Avatar name={r.other?.display_name} uri={r.other?.photo_url} size={68} />
          <T variant="display">{r.other?.display_name}</T>
          {r.other ? <IdentityBadge type={r.other.identity_type} code={r.other.identity_code} /> : null}
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <Ionicons name={r.kind === "video" ? "videocam-outline" : "call-outline"} size={16} color={colors.textSecondary} />
            <T variant="bodySm" color={colors.textSecondary}>{r.kind} availability request</T>
          </View>
          {r.message ? <T variant="body" color={colors.textSecondary} style={{ textAlign: "center" }}>“{r.message}”</T> : null}
        </Card>

        {r.status === "pending" && r.direction === "incoming" ? (
          <>
            <Card style={{ gap: 10 }}>
              <T variant="subtitle">Open a temporary window</T>
              <T variant="bodySm" color={colors.textSecondary}>When it ends, your availability returns to off automatically.</T>
              <View style={{ flexDirection: "row", gap: 8 }}>
                {[20, 30].map((m) => {
                  const sel = window === m;
                  return (
                    <Pressable key={m} onPress={() => setWindow(m)} testID={`window-${m}`} style={{ flex: 1, height: 44, borderRadius: radius.md, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: sel ? colors.brandPrimary : colors.border, backgroundColor: sel ? colors.brandPrimary : colors.surfaceSecondary }}>
                      <T style={{ fontFamily: fonts.sans, fontWeight: "600", color: sel ? colors.onBrandPrimary : colors.textSecondary }}>{m} min</T>
                    </Pressable>
                  );
                })}
              </View>
            </Card>
            <View style={{ flexDirection: "row", gap: 10 }}>
              <View style={{ flex: 1 }}><Button label="Decline" variant="secondary" onPress={() => decline.mutate()} testID="availability-decline" /></View>
              <View style={{ flex: 1 }}><Button label="Accept" onPress={() => accept.mutate()} testID="availability-accept" /></View>
            </View>
          </>
        ) : r.status === "accepted" ? (
          <>
            <Card style={{ backgroundColor: colors.trkBg, borderColor: colors.trkBorder }}>
              <T variant="bodySm" color={colors.trkText}>
                {r.direction === "outgoing" ? `${r.other?.display_name} is available for ${r.window_minutes} minutes. You can call now.` : `You're available for ${r.window_minutes} minutes.`}
              </T>
            </Card>
            {r.direction === "outgoing" && r.other ? (
              <Button label={`Call ${r.other.display_name}`} icon="call" onPress={() => startCall(r.other.identity_code, r.other.display_name, r.kind)} testID="availability-call-now" />
            ) : null}
          </>
        ) : (
          <Card style={{ backgroundColor: colors.surfaceWarm }}>
            <T variant="bodySm" color={colors.textSecondary} style={{ textTransform: "capitalize" }}>This request is {r.status}.</T>
          </Card>
        )}
      </ScrollView>
    </View>
  );
}
