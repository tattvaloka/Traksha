import React, { useState } from "react";
import { View, ScrollView, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, router } from "expo-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Ionicons } from "@react-native-vector-icons/ionicons";
import { StackHeader, IconButton } from "@/src/components/Header";
import { T, Card, Loader, ErrorView, Avatar, IdentityBadge, Button, ContextChip, Divider } from "@/src/components/ui";
import { api, ApiError } from "@/src/api/client";
import { queryClient } from "@/src/query-client";
import { useToast } from "@/src/components/Toast";
import { useAuth } from "@/src/auth/AuthContext";
import { useRealtime } from "@/src/realtime/RealtimeContext";
import { Sheet } from "@/src/components/Sheet";
import { useTheme, fonts, space, radius } from "@/src/theme";

export default function PublicProfile() {
  const { code } = useLocalSearchParams<{ code: string }>();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { show } = useToast();
  const { user } = useAuth();
  const { startCall } = useRealtime();
  const [connectSheet, setConnectSheet] = useState(false);
  const [callSheet, setCallSheet] = useState(false);
  const [moreSheet, setMoreSheet] = useState(false);

  const profile = useQuery({ queryKey: ["profile", code], queryFn: () => api.get(`/profile/${code}`) });

  const connect = useMutation({
    mutationFn: (context: string) => api.post("/connections/request", { to_identity_code: code, context }),
    onSuccess: () => { setConnectSheet(false); show("Request sent", "success"); queryClient.invalidateQueries({ queryKey: ["profile", code] }); },
    onError: (e) => { setConnectSheet(false); show(e instanceof ApiError ? e.message : "Could not send request.", "error"); },
  });
  const withdraw = useMutation({
    mutationFn: (rid: string) => api.post(`/connections/requests/${rid}/withdraw`),
    onSuccess: () => { show("Request withdrawn", "info"); queryClient.invalidateQueries({ queryKey: ["profile", code] }); },
  });
  const block = useMutation({
    mutationFn: () => api.post("/blocks", { identity_code: code }),
    onSuccess: () => { setMoreSheet(false); show("Blocked", "info"); queryClient.invalidateQueries(); router.back(); },
  });

  if (profile.isLoading) return <View style={{ flex: 1, backgroundColor: colors.surface }}><StackHeader title="Profile" /><Loader /></View>;
  if (profile.isError) return <View style={{ flex: 1, backgroundColor: colors.surface }}><StackHeader title="Profile" /><ErrorView message={(profile.error as ApiError)?.message} onRetry={profile.refetch} /></View>;

  const p = profile.data;
  const rel = p.relationship?.status ?? "none";
  const isSelf = p.is_self;

  const startCallFlow = async (kind: "audio" | "video") => {
    setCallSheet(false);
    try {
      const res = await api.get(`/calls/can-call/${code}?kind=${kind}`);
      if (res.can_call) {
        startCall(p.identity_code, p.display_name, kind);
      } else {
        await api.post("/calls/availability-request", { to_identity_code: code, kind });
        show("Availability request sent", "info");
      }
    } catch (e) {
      show(e instanceof ApiError ? e.message : "Could not start call.", "error");
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <StackHeader
        title="Profile"
        right={!isSelf ? <IconButton icon="ellipsis-horizontal" onPress={() => setMoreSheet(true)} testID="profile-more" /> : undefined}
      />
      <ScrollView contentContainerStyle={{ padding: 16, gap: space.md, paddingBottom: insets.bottom + 24 }}>
        <Card style={{ alignItems: "center", gap: 12 }}>
          <Avatar name={p.display_name} uri={p.photo_url} size={84} />
          <T variant="display" style={{ textAlign: "center" }}>{p.display_name}</T>
          {p.job_title || p.organization ? (
            <T variant="bodySm" color={colors.textSecondary}>{[p.job_title, p.organization].filter(Boolean).join(" · ")}</T>
          ) : null}
          <IdentityBadge type={p.identity_type} code={p.identity_code} />
          {p.bio ? <T variant="body" color={colors.textSecondary} style={{ textAlign: "center" }}>{p.bio}</T> : null}
          <T style={{ fontFamily: fonts.mono, fontSize: 11, color: colors.muted }}>
            Member since {p.member_since ? new Date(p.member_since).toLocaleDateString(undefined, { year: "numeric", month: "long" }) : "—"}
          </T>
        </Card>

        {isSelf ? (
          <Button label="Edit profile" icon="create-outline" variant="secondary" onPress={() => router.push("/edit-profile")} />
        ) : rel === "connected" ? (
          <View style={{ gap: 10 }}>
            <View style={{ flexDirection: "row", justifyContent: "center" }}><ContextChip context={p.relationship.context} /></View>
            <View style={{ flexDirection: "row", gap: 10 }}>
              <View style={{ flex: 1 }}><Button label="Message" icon="chatbubble-outline" onPress={() => router.push(`/conversation/${p.relationship.connection_id}/${p.relationship.context === "professional" ? "professional" : "personal"}`)} testID="message-button" /></View>
              <View style={{ flex: 1 }}><Button label="Call" icon="call-outline" variant="secondary" onPress={() => setCallSheet(true)} testID="call-button" /></View>
            </View>
          </View>
        ) : rel === "outgoing" ? (
          <Button label="Withdraw request" variant="secondary" onPress={() => withdraw.mutate(p.relationship.request_id)} testID="withdraw-button" />
        ) : rel === "incoming" ? (
          <Button label="Respond to request" icon="arrow-forward" onPress={() => router.push(`/requests/${p.relationship.request_id}`)} testID="respond-button" />
        ) : rel === "blocked" ? (
          <Card style={{ backgroundColor: colors.surfaceWarm }}><T variant="bodySm" color={colors.textSecondary}>Interaction with this person is unavailable.</T></Card>
        ) : (
          <Button label="Connect" icon="person-add-outline" onPress={() => setConnectSheet(true)} disabled={p.allow_connection_requests === false} testID="connect-button" />
        )}
        {!isSelf && rel === "none" && p.allow_connection_requests === false ? (
          <T variant="caption" color={colors.textSecondary} style={{ textAlign: "center" }}>This person isn’t accepting connection requests.</T>
        ) : null}
      </ScrollView>

      {/* Connect context sheet */}
      <Sheet visible={connectSheet} onClose={() => setConnectSheet(false)} title="Choose a context">
        <T variant="bodySm" color={colors.textSecondary}>How would you like to connect? You can change this later.</T>
        {(["personal", "professional", "both"] as const).map((ctx) => (
          <Pressable key={ctx} onPress={() => connect.mutate(ctx)} testID={`connect-context-${ctx}`} style={({ pressed }) => ({ padding: 14, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: pressed ? colors.surfaceTertiary : colors.surfaceSecondary, flexDirection: "row", alignItems: "center", justifyContent: "space-between" })}>
            <T variant="label" style={{ textTransform: "capitalize" }}>{ctx === "both" ? "Personal + Professional" : ctx}</T>
            <Ionicons name="chevron-forward" size={18} color={colors.muted} />
          </Pressable>
        ))}
      </Sheet>

      {/* Call kind sheet */}
      <Sheet visible={callSheet} onClose={() => setCallSheet(false)} title="Start a call">
        <T variant="bodySm" color={colors.textSecondary}>If they aren’t available, we’ll send a Call Availability Request instead — never a surprise ring.</T>
        <Button label="Audio call" icon="call-outline" onPress={() => startCallFlow("audio")} testID="call-audio" />
        <Button label="Video call" icon="videocam-outline" variant="secondary" onPress={() => startCallFlow("video")} testID="call-video" />
      </Sheet>

      {/* More sheet: report / block */}
      <Sheet visible={moreSheet} onClose={() => setMoreSheet(false)} title={p.display_name}>
        <Button label="Report" icon="flag-outline" variant="secondary" onPress={() => { setMoreSheet(false); router.push(`/report?target_type=profile&target_id=${code}`); }} testID="report-profile" />
        <Button label="Block" icon="ban-outline" variant="destructive" onPress={() => block.mutate()} testID="block-profile" />
        <T variant="caption" color={colors.textSecondary}>Blocking removes any connection and prevents future requests, messages and calls between you.</T>
      </Sheet>
    </View>
  );
}
