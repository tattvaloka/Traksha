import { View, ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Ionicons } from "@react-native-vector-icons/ionicons";
import { StackHeader } from "@/src/components/Header";
import { Button, T, Card, IdentityBadge } from "@/src/components/ui";
import { useTheme, space } from "@/src/theme";

export default function Overview() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <StackHeader title="Overview" />
      <ScrollView contentContainerStyle={{ padding: 24, gap: space.md, paddingBottom: 24 }}>
        <T variant="display">How it works</T>

        <Card style={{ gap: 10 }}>
          <T variant="subtitle">Your identity grows</T>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <IdentityBadge type="TMP" compact />
            <Ionicons name="arrow-forward" size={16} color={colors.textSecondary} />
            <IdentityBadge type="TRK" compact />
          </View>
          <T variant="bodySm" color={colors.textSecondary}>
            You start as TMP — a genuine 45-day participation stage. On day 45 your identity is established as
            TRK, a verified, accountable identity. Your history is preserved.
          </T>
        </Card>

        <Card style={{ gap: 8 }}>
          <T variant="subtitle">Tattvaloka</T>
          <T variant="bodySm" color={colors.textSecondary}>
            A place to read, discuss and contribute — ordered by recency, never popularity.
          </T>
        </Card>

        <Card style={{ gap: 8 }}>
          <T variant="subtitle">Personal & Professional</T>
          <T variant="bodySm" color={colors.textSecondary}>
            The same connection can carry both contexts. A personal message stays personal; a professional
            message stays professional.
          </T>
        </Card>
      </ScrollView>
      <View style={{ padding: 24, paddingBottom: insets.bottom + 16 }}>
        <Button label="Create account" onPress={() => router.push("/(auth)/sign-up")} testID="overview-continue" />
      </View>
    </View>
  );
}
