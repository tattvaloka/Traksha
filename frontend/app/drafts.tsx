import React from "react";
import { View, FlatList, Pressable } from "react-native";
import { router } from "expo-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Ionicons } from "@react-native-vector-icons/ionicons";
import { StackHeader, IconButton } from "@/src/components/Header";
import { T, Card, Loader, EmptyState, Button } from "@/src/components/ui";
import { api } from "@/src/api/client";
import { queryClient } from "@/src/query-client";
import { useToast } from "@/src/components/Toast";
import { useTheme, fonts } from "@/src/theme";

export default function Drafts() {
  const { colors } = useTheme();
  const { show } = useToast();
  const drafts = useQuery({ queryKey: ["drafts"], queryFn: () => api.get<any[]>("/drafts") });

  const remove = useMutation({
    mutationFn: (id: string) => api.del(`/drafts/${id}`),
    onSuccess: () => { show("Draft deleted", "info"); queryClient.invalidateQueries({ queryKey: ["drafts"] }); },
  });

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <StackHeader title="Drafts" right={<IconButton icon="add" onPress={() => router.push("/create")} testID="new-draft" />} />
      {drafts.isLoading ? (
        <Loader />
      ) : (
        <FlatList
          data={drafts.data ?? []}
          keyExtractor={(i) => i.id}
          contentContainerStyle={{ padding: 16, gap: 12 }}
          ListEmptyComponent={
            <EmptyState icon="document-text-outline" title="No drafts" body="Unfinished contributions are saved here so you can return to them anytime." action={<Button label="Start writing" full={false} onPress={() => router.push("/create")} />} testID="empty-drafts" />
          }
          renderItem={({ item }) => (
            <Card onPress={() => router.push(`/create?draftId=${item.id}`)} testID={`draft-${item.id}`} style={{ gap: 8 }}>
              <T variant="subtitle" numberOfLines={1}>{item.title || "Untitled draft"}</T>
              <T variant="bodySm" color={colors.textSecondary} numberOfLines={2}>{item.body || "No content yet"}</T>
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 4 }}>
                <T style={{ fontFamily: fonts.mono, fontSize: 10, color: colors.muted }}>
                  Edited {item.updated_at ? new Date(item.updated_at).toLocaleDateString() : ""}
                </T>
                <Pressable onPress={() => remove.mutate(item.id)} hitSlop={8} testID={`delete-draft-${item.id}`}>
                  <Ionicons name="trash-outline" size={18} color={colors.error} />
                </Pressable>
              </View>
            </Card>
          )}
        />
      )}
    </View>
  );
}
