import React from "react";
import { View, ScrollView } from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import { StackHeader } from "@/src/components/Header";
import { T, Card, Loader, ErrorView, Avatar, IdentityBadge, ContextChip, Button } from "@/src/components/ui";
import { api } from "@/src/api/client";
import { queryClient } from "@/src/query-client";
import { useToast } from "@/src/components/Toast";
import { useTheme, space, fonts } from "@/src/theme";

export default function RequestDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const { show } = useToast();
  const req = useQuery({ queryKey: ["request", id], queryFn: () => api.get(`/connections/requests/${id}`) });

  const accept = useMutation({
    mutationFn: () => api.post(`/connections/requests/${id}/accept`),
    onSuccess: () => { show("Connection established", "success"); queryClient.invalidateQueries(); router.replace("/(app)/connections"); },
  });
  const decline = useMutation({
    mutationFn: () => api.post(`/connections/requests/${id}/decline`),
    onSuccess: () => { show("Request declined", "info"); queryClient.invalidateQueries(); router.back(); },
  });
  const withdraw = useMutation({
    mutationFn: () => api.post(`/connections/requests/${id}/withdraw`),
    onSuccess: () => { show("Request withdrawn", "info"); queryClient.invalidateQueries(); router.back(); },
  });

  if (req.isLoading) return <View style={{ flex: 1, backgroundColor: colors.surface }}><StackHeader title="Request" /><Loader /></View>;
  if (req.isError) return <View style={{ flex: 1, backgroundColor: colors.surface }}><StackHeader title="Request" /><ErrorView onRetry={req.refetch} /></View>;
  const r = req.data;

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <StackHeader title="Connection request" />
      <ScrollView contentContainerStyle={{ padding: 16, gap: space.md }}>
        <Card style={{ alignItems: "center", gap: 12 }}>
          <Avatar name={r.other.display_name} uri={r.other.photo_url} size={72} />
          <T variant="display">{r.other.display_name}</T>
          <IdentityBadge type={r.other.identity_type} code={r.other.identity_code} />
          <ContextChip context={r.context} />
          {r.message ? <T variant="body" color={colors.textSecondary} style={{ textAlign: "center" }}>“{r.message}”</T> : null}
          <T style={{ fontFamily: fonts.mono, fontSize: 11, color: colors.muted }}>
            {r.direction === "incoming" ? "Received" : "Sent"} · via {r.source}
          </T>
        </Card>

        {r.status !== "pending" ? (
          <Card style={{ backgroundColor: colors.surfaceWarm }}>
            <T variant="bodySm" color={colors.textSecondary} style={{ textTransform: "capitalize" }}>This request is {r.status}.</T>
          </Card>
        ) : r.direction === "incoming" ? (
          <View style={{ flexDirection: "row", gap: 10 }}>
            <View style={{ flex: 1 }}><Button label="Decline" variant="secondary" onPress={() => decline.mutate()} testID="request-decline" /></View>
            <View style={{ flex: 1 }}><Button label="Accept" onPress={() => accept.mutate()} testID="request-accept" /></View>
          </View>
        ) : (
          <Button label="Withdraw request" variant="secondary" onPress={() => withdraw.mutate()} testID="request-withdraw" />
        )}
      </ScrollView>
    </View>
  );
}
