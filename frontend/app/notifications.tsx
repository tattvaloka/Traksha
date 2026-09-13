import React from "react";
import { View, FlatList, Pressable, RefreshControl } from "react-native";
import { router } from "expo-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Ionicons } from "@react-native-vector-icons/ionicons";
import { StackHeader } from "@/src/components/Header";
import { T, Loader, ErrorView, EmptyState, Divider } from "@/src/components/ui";
import { api } from "@/src/api/client";
import { queryClient } from "@/src/query-client";
import { useTheme, fonts } from "@/src/theme";

const ICON: Record<string, string> = {
  connection_request: "person-add-outline",
  connection_accepted: "checkmark-circle-outline",
  message: "chatbubble-outline",
  call_availability_request: "call-outline",
  call: "call-outline",
  identity_transition: "shield-checkmark-outline",
};

export default function Notifications() {
  const { colors } = useTheme();
  const notifications = useQuery({ queryKey: ["notifications"], queryFn: () => api.get("/notifications") });
  const readAll = useMutation({
    mutationFn: () => api.post("/notifications/read-all"),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifications"] }),
  });
  const readOne = useMutation({
    mutationFn: (id: string) => api.post(`/notifications/${id}/read`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifications"] }),
  });

  const open = (n: any) => {
    if (!n.read) readOne.mutate(n.id);
    const route = n.data?.route;
    if (route) router.push(route);
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <StackHeader
        title="Notifications"
        right={
          (notifications.data?.unread ?? 0) > 0 ? (
            <Pressable onPress={() => readAll.mutate()} testID="mark-all-read">
              <T variant="bodySm" color={colors.brand} style={{ fontWeight: "700" }}>Mark all</T>
            </Pressable>
          ) : undefined
        }
      />
      {notifications.isLoading ? (
        <Loader />
      ) : notifications.isError ? (
        <ErrorView onRetry={notifications.refetch} />
      ) : (
        <FlatList
          data={notifications.data?.items ?? []}
          keyExtractor={(i: any) => i.id}
          refreshControl={<RefreshControl refreshing={notifications.isFetching} onRefresh={notifications.refetch} tintColor={colors.brand} />}
          ItemSeparatorComponent={Divider}
          ListEmptyComponent={<EmptyState icon="notifications-off-outline" title="Nothing new" body="Meaningful updates about connections, messages and your identity will appear here." testID="empty-notifications" />}
          renderItem={({ item }) => (
            <Pressable onPress={() => open(item)} testID={`notification-${item.id}`} style={({ pressed }) => ({ flexDirection: "row", gap: 14, padding: 16, backgroundColor: pressed ? colors.surfaceTertiary : item.read ? "transparent" : colors.surfaceWarm })}>
              <Ionicons name={(ICON[item.kind] || "ellipse-outline") as any} size={20} color={colors.textSecondary} style={{ marginTop: 2 }} />
              <View style={{ flex: 1, gap: 3 }}>
                <T variant="label">{item.title}</T>
                <T variant="bodySm" color={colors.textSecondary}>{item.body}</T>
                <T style={{ fontFamily: fonts.mono, fontSize: 10, color: colors.muted }}>
                  {new Date(item.created_at).toLocaleString()}
                </T>
              </View>
              {!item.read && <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.brandPrimary, marginTop: 6 }} />}
            </Pressable>
          )}
        />
      )}
    </View>
  );
}
