import React, { useState } from "react";
import { View, FlatList, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, router } from "expo-router";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { Platform, TextInput } from "react-native";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Ionicons } from "@react-native-vector-icons/ionicons";
import { StackHeader, IconButton } from "@/src/components/Header";
import { T, Card, Loader, ErrorView, Divider } from "@/src/components/ui";
import { api } from "@/src/api/client";
import { queryClient } from "@/src/query-client";
import { useTheme, fonts, radius } from "@/src/theme";

export default function ContentDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const [text, setText] = useState("");

  const contribution = useQuery({ queryKey: ["contribution", id], queryFn: () => api.get(`/contributions/${id}`) });
  const comments = useQuery({ queryKey: ["comments", id], queryFn: () => api.get(`/contributions/${id}/comments`) });

  const addComment = useMutation({
    mutationFn: (body: string) => api.post(`/contributions/${id}/comments`, { body }),
    onSuccess: () => {
      setText("");
      queryClient.invalidateQueries({ queryKey: ["comments", id] });
      queryClient.invalidateQueries({ queryKey: ["contribution", id] });
      queryClient.invalidateQueries({ queryKey: ["contributions"] });
    },
  });

  if (contribution.isLoading) return <View style={{ flex: 1, backgroundColor: colors.surface }}><StackHeader title="Contribution" /><Loader /></View>;
  if (contribution.isError) return <View style={{ flex: 1, backgroundColor: colors.surface }}><StackHeader title="Contribution" /><ErrorView onRetry={contribution.refetch} /></View>;
  const c = contribution.data;

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <StackHeader
        title="Contribution"
        right={<IconButton icon="flag-outline" onPress={() => router.push(`/report?target_type=contribution&target_id=${id}`)} testID="report-content" />}
      />
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }} keyboardVerticalOffset={0}>
        <FlatList
          data={comments.data ?? []}
          keyExtractor={(i: any) => i.id}
          contentContainerStyle={{ paddingBottom: 16 }}
          ListHeaderComponent={
            <View style={{ padding: 16, gap: 12 }}>
              <T variant="displayLg">{c.title}</T>
              <T style={{ fontFamily: fonts.mono, fontSize: 11, color: colors.muted }}>{c.author_name} · {new Date(c.created_at).toLocaleDateString()}</T>
              <T variant="body" style={{ lineHeight: 26 }}>{c.body}</T>
              <Divider />
              <T variant="subtitle">Discussion ({c.comment_count})</T>
              {(comments.data?.length ?? 0) === 0 ? (
                <T variant="bodySm" color={colors.textSecondary}>No replies yet. Add the first thoughtful reply.</T>
              ) : null}
            </View>
          }
          renderItem={({ item }) => (
            <View style={{ paddingHorizontal: 16, paddingBottom: 12 }}>
              <Card style={{ gap: 6 }}>
                <T style={{ fontFamily: fonts.mono, fontSize: 11, color: colors.muted }}>{item.author_name}</T>
                <T variant="body">{item.body}</T>
              </Card>
            </View>
          )}
        />
        <View style={{ flexDirection: "row", gap: 8, padding: 12, paddingBottom: insets.bottom + 12, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.surface, alignItems: "flex-end" }}>
          <TextInput
            testID="comment-input"
            value={text}
            onChangeText={setText}
            placeholder="Add a reply"
            placeholderTextColor={colors.muted}
            multiline
            style={{ flex: 1, maxHeight: 120, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: 14, paddingVertical: 10, fontFamily: fonts.sans, fontSize: 15, color: colors.textPrimary, backgroundColor: colors.surfaceSecondary }}
          />
          <Pressable
            testID="send-comment"
            disabled={!text.trim() || addComment.isPending}
            onPress={() => addComment.mutate(text.trim())}
            style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: colors.brandPrimary, alignItems: "center", justifyContent: "center", opacity: !text.trim() ? 0.5 : 1 }}
          >
            <Ionicons name="arrow-up" size={20} color={colors.onBrandPrimary} />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}
