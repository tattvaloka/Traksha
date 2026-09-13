import React from "react";
import { View, FlatList, RefreshControl } from "react-native";
import { router } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { AppHeader } from "@/src/components/Header";
import { T, Card, Loader, ErrorView, EmptyState, Avatar, ContextChip, Button } from "@/src/components/ui";
import { api } from "@/src/api/client";
import { useTheme, fonts } from "@/src/theme";

export default function Messages() {
  const { colors } = useTheme();
  const conversations = useQuery({ queryKey: ["conversations"], queryFn: () => api.get<any[]>("/conversations") });

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <AppHeader />
      {conversations.isLoading ? (
        <Loader />
      ) : conversations.isError ? (
        <ErrorView onRetry={conversations.refetch} />
      ) : (
        <FlatList
          data={conversations.data}
          keyExtractor={(i) => i.conversation_id}
          contentContainerStyle={{ paddingBottom: 24 }}
          ListHeaderComponent={<View style={{ padding: 16 }}><T variant="display">Messages</T></View>}
          refreshControl={<RefreshControl refreshing={conversations.isFetching} onRefresh={conversations.refetch} tintColor={colors.brand} />}
          ListEmptyComponent={
            <EmptyState
              icon="chatbubbles-outline"
              title="No conversations yet"
              body="Once you're connected with someone, your personal and professional conversations appear here."
              action={<Button label="View connections" full={false} onPress={() => router.push("/(app)/connections")} />}
              testID="empty-messages"
            />
          }
          renderItem={({ item }) => (
            <View style={{ paddingHorizontal: 16, paddingBottom: 12 }}>
              <Card onPress={() => router.push(`/conversation/${item.connection_id}/${item.context}`)} testID={`conversation-${item.conversation_id}`} style={{ flexDirection: "row", gap: 12, alignItems: "center" }}>
                <Avatar name={item.other.display_name} uri={item.other.photo_url} />
                <View style={{ flex: 1, gap: 4 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                    <T variant="subtitle" numberOfLines={1} style={{ flex: 1 }}>{item.other.display_name}</T>
                    {item.unread > 0 && (
                      <View style={{ minWidth: 20, height: 20, borderRadius: 10, backgroundColor: colors.brandPrimary, alignItems: "center", justifyContent: "center", paddingHorizontal: 5 }}>
                        <T style={{ color: colors.onBrandPrimary, fontSize: 11, fontFamily: fonts.sans, fontWeight: "700" }}>{item.unread}</T>
                      </View>
                    )}
                  </View>
                  <ContextChip context={item.context} />
                  <T variant="bodySm" color={colors.textSecondary} numberOfLines={1}>
                    {item.last_message?.text || "No messages yet"}
                  </T>
                </View>
              </Card>
            </View>
          )}
        />
      )}
    </View>
  );
}
