import React, { useCallback } from "react";
import { View, FlatList, RefreshControl, Pressable } from "react-native";
import { router } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { Ionicons } from "@react-native-vector-icons/ionicons";
import { AppHeader } from "@/src/components/Header";
import { T, Card, Loader, ErrorView, IdentityBadge, Button } from "@/src/components/ui";
import { api } from "@/src/api/client";
import { useAuth } from "@/src/auth/AuthContext";
import { useTheme, fonts, space } from "@/src/theme";

type Contribution = {
  id: string;
  title: string;
  body: string;
  author_name: string;
  author_code: string;
  created_at: string;
  comment_count: number;
};

export default function Home() {
  const { colors } = useTheme();
  const { user } = useAuth();

  const contributions = useQuery({
    queryKey: ["contributions"],
    queryFn: () => api.get<Contribution[]>("/contributions"),
  });
  const transition = useQuery({
    queryKey: ["transition"],
    queryFn: () => api.get("/transition"),
  });

  const showCeremony = transition.data?.available && !transition.data?.ceremony_viewed;

  const header = (
    <View style={{ padding: 16, gap: space.md }}>
      {showCeremony ? (
        <Pressable onPress={() => router.push("/transition")} testID="transition-banner">
          <Card style={{ backgroundColor: colors.trkBg, borderColor: colors.trkBorder, gap: 6 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Ionicons name="shield-checkmark" size={18} color={colors.trkText} />
              <T variant="subtitle" color={colors.trkText}>Your identity has been established</T>
            </View>
            <T variant="bodySm" color={colors.trkText}>
              You’ve crossed into TRK. Open to view your transition — it’s waiting whenever you’re ready.
            </T>
          </Card>
        </Pressable>
      ) : (
        <IdentityBanner />
      )}
      <View style={{ flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between" }}>
        <T variant="display">Tattvaloka</T>
        <T variant="caption">A place to participate</T>
      </View>
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <AppHeader />
      {contributions.isLoading ? (
        <Loader />
      ) : contributions.isError ? (
        <ErrorView onRetry={contributions.refetch} />
      ) : (
        <FlatList
          data={contributions.data}
          keyExtractor={(i) => i.id}
          ListHeaderComponent={header}
          contentContainerStyle={{ paddingBottom: 24 }}
          refreshControl={
            <RefreshControl refreshing={contributions.isFetching} onRefresh={() => { contributions.refetch(); transition.refetch(); }} tintColor={colors.brand} />
          }
          renderItem={({ item }) => (
            <View style={{ paddingHorizontal: 16, paddingBottom: 12 }}>
              <Card onPress={() => router.push(`/content/${item.id}`)} testID={`contribution-${item.id}`} style={{ gap: 8 }}>
                <T variant="title">{item.title}</T>
                <T variant="bodySm" color={colors.textSecondary} numberOfLines={3}>{item.body}</T>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginTop: 4 }}>
                  <T style={{ fontFamily: fonts.mono, fontSize: 11, color: colors.muted }}>{item.author_name}</T>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                    <Ionicons name="chatbubble-outline" size={13} color={colors.muted} />
                    <T variant="caption">{item.comment_count}</T>
                  </View>
                </View>
              </Card>
            </View>
          )}
        />
      )}
      {user?.identity_type === "TRK" && (
        <Pressable
          testID="create-contribution-fab"
          onPress={() => router.push("/create")}
          style={{
            position: "absolute",
            right: 20,
            bottom: 20,
            width: 56,
            height: 56,
            borderRadius: 28,
            backgroundColor: colors.brandPrimary,
            alignItems: "center",
            justifyContent: "center",
            shadowColor: "#111827",
            shadowOpacity: 0.18,
            shadowRadius: 12,
            shadowOffset: { width: 0, height: 6 },
            elevation: 6,
          }}
        >
          <Ionicons name="create-outline" size={24} color={colors.onBrandPrimary} />
        </Pressable>
      )}
    </View>
  );
}

function IdentityBanner() {
  const { colors } = useTheme();
  const { user } = useAuth();
  if (!user) return null;
  if (user.identity_type === "TMP") {
    const day = user.day_of_journey ?? 1;
    const len = user.journey_length ?? 45;
    return (
      <Card style={{ backgroundColor: colors.tmpBg, borderColor: colors.tmpBorder, gap: 8 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <IdentityBadge type="TMP" code={user.identity_code} />
          <T style={{ fontFamily: fonts.mono, fontSize: 12, color: colors.tmpText }}>Day {day} of {len}</T>
        </View>
        <View style={{ height: 6, borderRadius: 3, backgroundColor: colors.surfaceSecondary, overflow: "hidden" }}>
          <View style={{ width: `${(day / len) * 100}%`, height: "100%", backgroundColor: colors.tmpText }} />
        </View>
        <T variant="bodySm" color={colors.tmpText}>
          Your provisional journey. On day {len}, your identity is established as TRK.
        </T>
      </Card>
    );
  }
  return (
    <Card style={{ backgroundColor: colors.trkBg, borderColor: colors.trkBorder, gap: 6 }}>
      <IdentityBadge type="TRK" code={user.identity_code} />
      <T variant="bodySm" color={colors.trkText}>Verified, accountable identity.</T>
    </Card>
  );
}
