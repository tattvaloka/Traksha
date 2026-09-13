import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Logo } from "@/src/components/Logo";
import { Button, T } from "@/src/components/ui";
import { useTheme, space } from "@/src/theme";

export default function Welcome() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  return (
    <View style={{ flex: 1, backgroundColor: colors.surface, paddingHorizontal: 24, paddingTop: insets.top, paddingBottom: insets.bottom + 24 }}>
      <View style={{ flex: 1, justifyContent: "center", gap: space.lg }}>
        <Logo size={40} />
        <T variant="displayLg" style={{ marginTop: 8 }}>
          A civic space for accountable connection.
        </T>
        <T variant="body" color={colors.textSecondary}>
          Traksha is built around identity with accountability, privacy with control, and connection with
          consent — not engagement tricks. Participate deliberately.
        </T>
      </View>
      <View style={{ gap: 12 }}>
        <Button label="Get started" onPress={() => router.push("/(auth)/philosophy")} testID="get-started-button" />
        <Button label="Sign in" variant="secondary" onPress={() => router.push("/(auth)/sign-in")} testID="welcome-signin-button" />
      </View>
    </View>
  );
}
