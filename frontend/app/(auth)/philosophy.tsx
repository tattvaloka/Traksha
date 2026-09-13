import { View, ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Ionicons } from "@react-native-vector-icons/ionicons";
import { StackHeader } from "@/src/components/Header";
import { Button, T, Card } from "@/src/components/ui";
import { useTheme, space } from "@/src/theme";

const PRINCIPLES = [
  { icon: "shield-checkmark-outline", title: "Identity with accountability", body: "You begin as a provisional identity and grow into a verified, accountable one." },
  { icon: "hand-left-outline", title: "Connection with consent", body: "Every connection needs a request and an acceptance. Nothing happens to you without your say." },
  { icon: "book-outline", title: "Participation, not consumption", body: "No likes, streaks, or popularity scores. Read slowly, reply when you have something to add." },
];

export default function Philosophy() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <StackHeader title="Philosophy" />
      <ScrollView contentContainerStyle={{ padding: 24, gap: space.md, paddingBottom: 24 }}>
        <T variant="display">What Traksha stands for</T>
        {PRINCIPLES.map((p) => (
          <Card key={p.title} style={{ flexDirection: "row", gap: 14, alignItems: "flex-start" }}>
            <Ionicons name={p.icon as any} size={22} color={colors.personalAccent} style={{ marginTop: 2 }} />
            <View style={{ flex: 1, gap: 4 }}>
              <T variant="subtitle">{p.title}</T>
              <T variant="bodySm" color={colors.textSecondary}>{p.body}</T>
            </View>
          </Card>
        ))}
      </ScrollView>
      <View style={{ padding: 24, paddingBottom: insets.bottom + 16 }}>
        <Button label="Continue" onPress={() => router.push("/(auth)/overview")} testID="philosophy-continue" />
      </View>
    </View>
  );
}
