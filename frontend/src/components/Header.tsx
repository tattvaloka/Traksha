import React from "react";
import { View, Pressable, Text } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Ionicons } from "@react-native-vector-icons/ionicons";
import { useQuery } from "@tanstack/react-query";
import { Logo } from "@/src/components/Logo";
import { useTheme, fonts } from "@/src/theme";
import { api } from "@/src/api/client";

/**
 * Primary app header. Traksha logo is LEFT ALIGNED (locked product decision).
 * Right side: search + notifications with unread indicator.
 */
export function AppHeader() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { data } = useQuery({
    queryKey: ["notifications"],
    queryFn: () => api.get("/notifications"),
    refetchInterval: 30000,
  });
  const unread = data?.unread ?? 0;

  return (
    <View
      style={{
        paddingTop: insets.top + 8,
        paddingBottom: 12,
        paddingHorizontal: 16,
        backgroundColor: colors.surface,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
      }}
    >
      <Logo size={28} />
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
        <IconButton icon="search-outline" onPress={() => router.push("/search")} testID="header-search" />
        <View>
          <IconButton
            icon="notifications-outline"
            onPress={() => router.push("/notifications")}
            testID="header-notifications"
          />
          {unread > 0 && (
            <View
              style={{
                position: "absolute",
                top: 6,
                right: 6,
                minWidth: 16,
                height: 16,
                borderRadius: 8,
                backgroundColor: colors.error,
                alignItems: "center",
                justifyContent: "center",
                paddingHorizontal: 3,
              }}
            >
              <Text style={{ color: colors.onError, fontSize: 10, fontFamily: fonts.sans, fontWeight: "700" }}>
                {unread > 9 ? "9+" : unread}
              </Text>
            </View>
          )}
        </View>
      </View>
    </View>
  );
}

export function IconButton({
  icon,
  onPress,
  testID,
  color,
}: {
  icon: React.ComponentProps<typeof Ionicons>["name"];
  onPress?: () => void;
  testID?: string;
  color?: string;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      hitSlop={8}
      style={({ pressed }) => ({
        width: 40,
        height: 40,
        borderRadius: 20,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: pressed ? colors.surfaceTertiary : "transparent",
      })}
    >
      <Ionicons name={icon} size={22} color={color || colors.textPrimary} />
    </Pressable>
  );
}

/** Stack screen header with a back button and a title. Safe-area aware, sticky. */
export function StackHeader({
  title,
  right,
  onBack,
}: {
  title?: string;
  right?: React.ReactNode;
  onBack?: () => void;
}) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  return (
    <View
      style={{
        paddingTop: insets.top + 6,
        paddingBottom: 10,
        paddingHorizontal: 8,
        backgroundColor: colors.surface,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
        flexDirection: "row",
        alignItems: "center",
      }}
    >
      <IconButton icon="chevron-back" onPress={onBack || (() => router.back())} testID="back-button" />
      <Text
        numberOfLines={1}
        style={{
          flex: 1,
          fontFamily: fonts.serif,
          fontSize: 19,
          color: colors.textPrimary,
          marginLeft: 2,
        }}
      >
        {title}
      </Text>
      {right ? <View style={{ marginRight: 4 }}>{right}</View> : <View style={{ width: 8 }} />}
    </View>
  );
}
