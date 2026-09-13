import React from "react";
import { View, FlatList } from "react-native";
import { router } from "expo-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import { StackHeader } from "@/src/components/Header";
import { T, Card, Loader, EmptyState, Avatar, IdentityBadge, Button } from "@/src/components/ui";
import { api } from "@/src/api/client";
import { queryClient } from "@/src/query-client";
import { useToast } from "@/src/components/Toast";
import { useTheme } from "@/src/theme";

export default function Safety() {
  const { colors } = useTheme();
  const { show } = useToast();
  const blocks = useQuery({ queryKey: ["blocks"], queryFn: () => api.get("/blocks") });

  const unblock = useMutation({
    mutationFn: (code: string) => api.del(`/blocks/${code}`),
    onSuccess: () => { show("Unblocked", "info"); queryClient.invalidateQueries({ queryKey: ["blocks"] }); },
  });

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <StackHeader title="Safety" />
      {blocks.isLoading ? (
        <Loader />
      ) : (
        <FlatList
          data={blocks.data ?? []}
          keyExtractor={(i: any) => i.identity_code}
          contentContainerStyle={{ padding: 16, gap: 12 }}
          ListHeaderComponent={<T variant="subtitle" style={{ marginBottom: 4 }}>Blocked people</T>}
          ListEmptyComponent={<EmptyState icon="shield-checkmark-outline" title="No one is blocked" body="People you block will appear here. Blocking removes connections and stops all interaction." testID="empty-blocks" />}
          renderItem={({ item }) => (
            <Card style={{ flexDirection: "row", gap: 12, alignItems: "center" }}>
              <Avatar name={item.display_name} uri={item.photo_url} />
              <View style={{ flex: 1, gap: 4 }}>
                <T variant="subtitle" numberOfLines={1}>{item.display_name}</T>
                <IdentityBadge type={item.identity_type} compact />
              </View>
              <Button label="Unblock" variant="secondary" full={false} onPress={() => unblock.mutate(item.identity_code)} testID={`unblock-${item.identity_code}`} />
            </Card>
          )}
        />
      )}
    </View>
  );
}
