import React, { useState } from "react";
import { View, FlatList, Pressable } from "react-native";
import { router } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { Ionicons } from "@react-native-vector-icons/ionicons";
import { StackHeader } from "@/src/components/Header";
import { T, Card, Loader, EmptyState, Avatar, IdentityBadge, Input } from "@/src/components/ui";
import { api } from "@/src/api/client";
import { useTheme, fonts } from "@/src/theme";

export default function Search() {
  const { colors } = useTheme();
  const [q, setQ] = useState("");
  const [type, setType] = useState<"people" | "content">("people");
  const [submitted, setSubmitted] = useState("");

  const results = useQuery({
    queryKey: ["search", submitted, type],
    queryFn: () => api.get(`/search?q=${encodeURIComponent(submitted)}&type=${type}`),
    enabled: submitted.length > 0,
  });

  const people = results.data?.people ?? [];
  const content = results.data?.content ?? [];
  const list = type === "people" ? people : content;

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <StackHeader title="Search" />
      <View style={{ padding: 16, gap: 12 }}>
        <Input
          testID="search-input"
          value={q}
          onChangeText={setQ}
          onSubmitEditing={() => setSubmitted(q.trim())}
          returnKeyType="search"
          placeholder="Search people or Tattvaloka"
          autoFocus
        />
        <View style={{ flexDirection: "row", gap: 8 }}>
          {(["people", "content"] as const).map((t) => {
            const selected = type === t;
            return (
              <Pressable
                key={t}
                testID={`search-type-${t}`}
                onPress={() => setType(t)}
                style={{ height: 36, paddingHorizontal: 16, borderRadius: 999, justifyContent: "center", backgroundColor: selected ? colors.brandPrimary : colors.surfaceTertiary, borderWidth: 1, borderColor: selected ? colors.brandPrimary : colors.border }}
              >
                <T style={{ fontFamily: fonts.sans, fontWeight: "600", fontSize: 13, color: selected ? colors.onBrandPrimary : colors.textSecondary }}>
                  {t === "people" ? "People" : "Tattvaloka"}
                </T>
              </Pressable>
            );
          })}
        </View>
      </View>

      {submitted.length === 0 ? (
        <EmptyState icon="search-outline" title="Search Traksha" body="Find people by name or identity code, or search Tattvaloka contributions. Only discoverable profiles appear." />
      ) : results.isLoading ? (
        <Loader />
      ) : list.length === 0 ? (
        <EmptyState icon="sad-outline" title="No results" body={`Nothing matched "${submitted}". Try a different search.`} testID="search-empty" />
      ) : (
        <FlatList
          data={list}
          keyExtractor={(i: any) => i.id}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}
          renderItem={({ item }) =>
            type === "people" ? (
              <View style={{ paddingBottom: 12 }}>
                <Card onPress={() => router.push(`/u/${item.identity_code}`)} testID={`person-${item.identity_code}`} style={{ flexDirection: "row", gap: 12, alignItems: "center" }}>
                  <Avatar name={item.display_name} uri={item.photo_url} />
                  <View style={{ flex: 1, gap: 4 }}>
                    <T variant="subtitle" numberOfLines={1}>{item.display_name}</T>
                    <IdentityBadge type={item.identity_type} compact />
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={colors.muted} />
                </Card>
              </View>
            ) : (
              <View style={{ paddingBottom: 12 }}>
                <Card onPress={() => router.push(`/content/${item.id}`)} style={{ gap: 6 }}>
                  <T variant="subtitle" numberOfLines={2}>{item.title}</T>
                  <T variant="bodySm" color={colors.textSecondary} numberOfLines={2}>{item.body}</T>
                </Card>
              </View>
            )
          }
        />
      )}
    </View>
  );
}
