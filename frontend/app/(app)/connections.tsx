import React, { useState } from "react";
import { View, FlatList, Pressable, RefreshControl } from "react-native";
import { router } from "expo-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Ionicons } from "@react-native-vector-icons/ionicons";
import { AppHeader, IconButton } from "@/src/components/Header";
import { T, Card, Loader, ErrorView, EmptyState, Avatar, IdentityBadge, ContextChip, Button } from "@/src/components/ui";
import { api } from "@/src/api/client";
import { queryClient } from "@/src/query-client";
import { useToast } from "@/src/components/Toast";
import { useTheme, fonts, space } from "@/src/theme";

type Tab = "connections" | "incoming" | "outgoing";

export default function Connections() {
  const { colors } = useTheme();
  const { show } = useToast();
  const [tab, setTab] = useState<Tab>("connections");

  const connections = useQuery({ queryKey: ["connections"], queryFn: () => api.get("/connections"), enabled: tab === "connections" });
  const incoming = useQuery({ queryKey: ["requests", "incoming"], queryFn: () => api.get("/connections/requests?direction=incoming"), enabled: tab === "incoming" });
  const outgoing = useQuery({ queryKey: ["requests", "outgoing"], queryFn: () => api.get("/connections/requests?direction=outgoing"), enabled: tab === "outgoing" });

  const accept = useMutation({
    mutationFn: (id: string) => api.post(`/connections/requests/${id}/accept`),
    onSuccess: () => { show("Connection established", "success"); queryClient.invalidateQueries(); },
  });
  const decline = useMutation({
    mutationFn: (id: string) => api.post(`/connections/requests/${id}/decline`),
    onSuccess: () => { show("Request declined", "info"); queryClient.invalidateQueries({ queryKey: ["requests", "incoming"] }); },
  });
  const withdraw = useMutation({
    mutationFn: (id: string) => api.post(`/connections/requests/${id}/withdraw`),
    onSuccess: () => { show("Request withdrawn", "info"); queryClient.invalidateQueries({ queryKey: ["requests", "outgoing"] }); },
  });

  const active = tab === "connections" ? connections : tab === "incoming" ? incoming : outgoing;

  const chips: { key: Tab; label: string }[] = [
    { key: "connections", label: "Connected" },
    { key: "incoming", label: "Incoming" },
    { key: "outgoing", label: "Outgoing" },
  ];

  const header = (
    <View>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingTop: 12 }}>
        <T variant="display">Connections</T>
        <View style={{ flexDirection: "row", gap: 4 }}>
          <IconButton icon="qr-code-outline" onPress={() => router.push("/qr")} testID="open-qr" />
          <IconButton icon="person-add-outline" onPress={() => router.push("/search")} testID="find-people" />
        </View>
      </View>
      <View style={{ flexDirection: "row", gap: 8, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 12 }}>
        {chips.map((c) => {
          const selected = tab === c.key;
          return (
            <Pressable
              key={c.key}
              testID={`conn-tab-${c.key}`}
              onPress={() => setTab(c.key)}
              style={{
                height: 36,
                paddingHorizontal: 14,
                borderRadius: 999,
                justifyContent: "center",
                backgroundColor: selected ? colors.brandPrimary : colors.surfaceTertiary,
                borderWidth: 1,
                borderColor: selected ? colors.brandPrimary : colors.border,
              }}
            >
              <T style={{ fontFamily: fonts.sans, fontWeight: "600", fontSize: 13, color: selected ? colors.onBrandPrimary : colors.textSecondary }}>
                {c.label}
              </T>
            </Pressable>
          );
        })}
      </View>
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <AppHeader />
      {active.isLoading ? (
        <>{header}<Loader /></>
      ) : active.isError ? (
        <>{header}<ErrorView onRetry={active.refetch} /></>
      ) : (
        <FlatList
          data={active.data as any[]}
          keyExtractor={(i) => i.id}
          ListHeaderComponent={header}
          contentContainerStyle={{ paddingBottom: 24 }}
          refreshControl={<RefreshControl refreshing={active.isFetching} onRefresh={active.refetch} tintColor={colors.brand} />}
          ListEmptyComponent={
            tab === "connections" ? (
              <EmptyState icon="people-outline" title="No connections yet" body="Connections are people you've mutually agreed to reach. Find someone in search or share your QR code." action={<Button label="Find people" icon="search" full={false} onPress={() => router.push("/search")} />} testID="empty-connections" />
            ) : tab === "incoming" ? (
              <EmptyState icon="download-outline" title="No incoming requests" body="Requests from others will appear here for you to accept or decline." />
            ) : (
              <EmptyState icon="paper-plane-outline" title="No outgoing requests" body="Requests you've sent will appear here until they're accepted." />
            )
          }
          renderItem={({ item }) => (
            <View style={{ paddingHorizontal: 16, paddingBottom: 12 }}>
              <Card style={{ gap: 12 }}>
                <Pressable onPress={() => router.push(`/u/${item.other.identity_code}`)} style={{ flexDirection: "row", gap: 12, alignItems: "center" }}>
                  <Avatar name={item.other.display_name} uri={item.other.photo_url} />
                  <View style={{ flex: 1, gap: 4 }}>
                    <T variant="subtitle" numberOfLines={1}>{item.other.display_name}</T>
                    <IdentityBadge type={item.other.identity_type} compact />
                  </View>
                  {tab === "connections" && <ContextChip context={item.context} />}
                </Pressable>

                {tab === "connections" && item.note ? (
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <Ionicons name="lock-closed-outline" size={12} color={colors.muted} />
                    <T variant="caption" color={colors.textSecondary} numberOfLines={1} style={{ flex: 1 }}>{item.note}</T>
                  </View>
                ) : null}

                {tab === "incoming" && (
                  <View style={{ flexDirection: "row", gap: 10 }}>
                    <View style={{ flex: 1 }}><Button label="Decline" variant="secondary" onPress={() => decline.mutate(item.id)} testID={`decline-${item.id}`} /></View>
                    <View style={{ flex: 1 }}><Button label="Accept" onPress={() => accept.mutate(item.id)} testID={`accept-${item.id}`} /></View>
                  </View>
                )}
                {tab === "outgoing" && (
                  <Button label="Withdraw" variant="secondary" onPress={() => withdraw.mutate(item.id)} testID={`withdraw-${item.id}`} />
                )}
                {tab === "connections" && (
                  <View style={{ flexDirection: "row", gap: 10 }}>
                    <View style={{ flex: 1 }}><Button label="Message" icon="chatbubble-outline" variant="secondary" onPress={() => router.push(`/conversation/${item.id}/${item.context === "professional" ? "professional" : "personal"}`)} testID={`message-${item.id}`} /></View>
                    <View style={{ flex: 1 }}><Button label="View" variant="secondary" onPress={() => router.push(`/u/${item.other.identity_code}`)} /></View>
                  </View>
                )}
              </Card>
            </View>
          )}
        />
      )}
    </View>
  );
}
