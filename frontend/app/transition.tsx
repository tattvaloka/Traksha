import React, { useEffect, useRef } from "react";
import { View, Animated } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Ionicons } from "@react-native-vector-icons/ionicons";
import { T, Button, Loader, IdentityBadge } from "@/src/components/ui";
import { api } from "@/src/api/client";
import { useAuth } from "@/src/auth/AuthContext";
import { queryClient } from "@/src/query-client";
import { useTheme, fonts, space } from "@/src/theme";

export default function Transition() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { refresh } = useAuth();
  const fade1 = useRef(new Animated.Value(0)).current;
  const fade2 = useRef(new Animated.Value(0)).current;
  const fade3 = useRef(new Animated.Value(0)).current;

  const q = useQuery({ queryKey: ["transition"], queryFn: () => api.get("/transition") });

  const complete = useMutation({
    mutationFn: () => api.post("/transition/complete"),
    onSuccess: async () => {
      await refresh();
      queryClient.invalidateQueries();
      router.replace("/(app)");
    },
  });

  useEffect(() => {
    if (q.data?.available) {
      Animated.stagger(700, [
        Animated.timing(fade1, { toValue: 1, duration: 900, useNativeDriver: true }),
        Animated.timing(fade2, { toValue: 1, duration: 900, useNativeDriver: true }),
        Animated.timing(fade3, { toValue: 1, duration: 900, useNativeDriver: true }),
      ]).start();
    }
  }, [q.data]); // eslint-disable-line

  if (q.isLoading) return <View style={{ flex: 1, backgroundColor: colors.surface }}><Loader /></View>;

  if (!q.data?.available) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center", padding: 24, gap: 16 }}>
        <T variant="title">No transition yet</T>
        <T variant="bodySm" color={colors.textSecondary} style={{ textAlign: "center" }}>Your identity transition will be preserved here when it occurs.</T>
        <Button label="Back" full={false} onPress={() => router.back()} />
      </View>
    );
  }

  const d = q.data;
  const when = d.occurred_at ? new Date(d.occurred_at).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" }) : "";

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface, paddingTop: insets.top, paddingBottom: insets.bottom + 24, paddingHorizontal: 24, justifyContent: "space-between" }}>
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: space.xl }}>
        <Animated.View style={{ opacity: fade1, alignItems: "center", gap: 10 }}>
          <T variant="caption" color={colors.muted}>YOU BEGAN AS</T>
          <IdentityBadge type="TMP" code={d.tmp_code} />
        </Animated.View>

        <Animated.View style={{ opacity: fade2, alignItems: "center", gap: 8 }}>
          <Ionicons name="arrow-down" size={22} color={colors.textSecondary} />
          <T variant="displayLg" style={{ textAlign: "center" }}>You have crossed a threshold.</T>
          <T variant="body" color={colors.textSecondary} style={{ textAlign: "center", maxWidth: 320 }}>
            On {when}, your identity was established. Everything you contributed as TMP remains yours.
          </T>
        </Animated.View>

        <Animated.View style={{ opacity: fade3, alignItems: "center", gap: 10 }}>
          <T variant="caption" color={colors.muted}>YOU ARE NOW</T>
          <IdentityBadge type="TRK" code={d.trk_code} />
        </Animated.View>
      </View>

      <Animated.View style={{ opacity: fade3 }}>
        <Button label="Enter as TRK" onPress={() => complete.mutate()} loading={complete.isPending} testID="transition-complete" />
      </Animated.View>
    </View>
  );
}
