import React from "react";
import { View, ScrollView } from "react-native";
import { StackHeader } from "@/src/components/Header";
import { Logo } from "@/src/components/Logo";
import { T, Card } from "@/src/components/ui";
import { useTheme, space } from "@/src/theme";

export default function About() {
  const { colors } = useTheme();
  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <StackHeader title="About" />
      <ScrollView contentContainerStyle={{ padding: 16, gap: space.md, paddingBottom: 32 }}>
        <Logo size={34} />
        <T variant="body" color={colors.textSecondary}>
          Traksha is a civic space built by Tattvashila around identity with accountability, privacy with
          control, and connection with consent.
        </T>
        <Card style={{ gap: 8 }}>
          <T variant="subtitle">Our commitments</T>
          <T variant="bodySm" color={colors.textSecondary}>• No likes, streaks, follower counts or popularity scores.</T>
          <T variant="bodySm" color={colors.textSecondary}>• Every connection requires consent.</T>
          <T variant="bodySm" color={colors.textSecondary}>• Sensitive identity data stays private.</T>
          <T variant="bodySm" color={colors.textSecondary}>• Notifications help you act, never pressure you to return.</T>
        </Card>
        <T variant="caption" color={colors.muted}>Traksha · v1.0.0</T>
      </ScrollView>
    </View>
  );
}
