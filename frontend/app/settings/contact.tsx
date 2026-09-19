import React from "react";
import { View, ScrollView, Pressable, Linking, Platform } from "react-native";
import { Ionicons } from "@react-native-vector-icons/ionicons";
import { StackHeader } from "@/src/components/Header";
import { T, Card, Divider } from "@/src/components/ui";
import { useToast } from "@/src/components/Toast";
import { useTheme, space } from "@/src/theme";

const EMAIL = "Write2us@tattvashila.org";
const PHONE_DISPLAY = "+91 92446 22322";
const PHONE_DIAL = "+919244622322";

export default function ContactUs() {
  const { colors } = useTheme();
  const { show } = useToast();

  const open = async (url: string, label: string) => {
    try {
      const ok = await Linking.canOpenURL(url);
      if (ok) await Linking.openURL(url);
      else show(`Couldn't open ${label}`, "error");
    } catch {
      show(`Couldn't open ${label}`, "error");
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <StackHeader title="Contact us" />
      <ScrollView contentContainerStyle={{ padding: 16, gap: space.md, paddingBottom: 32 }}>
        <T variant="bodySm" color={colors.textSecondary}>
          Reach the Traksha team directly. We read every message.
        </T>

        <Card style={{ padding: 0, overflow: "hidden" }}>
          <Pressable
            onPress={() => open(`mailto:${EMAIL}`, "email")}
            testID="contact-email"
            style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 14, padding: 16, backgroundColor: pressed ? colors.surfaceTertiary : "transparent" })}
          >
            <Ionicons name="mail-outline" size={20} color={colors.textSecondary} />
            <View style={{ flex: 1 }}>
              <T variant="label">Email</T>
              <T variant="bodySm" color={colors.textSecondary}>{EMAIL}</T>
            </View>
            <Ionicons name="open-outline" size={18} color={colors.muted} />
          </Pressable>
          <Divider />
          <Pressable
            onPress={() => open(`tel:${PHONE_DIAL}`, "phone")}
            testID="contact-phone"
            style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 14, padding: 16, backgroundColor: pressed ? colors.surfaceTertiary : "transparent" })}
          >
            <Ionicons name="call-outline" size={20} color={colors.textSecondary} />
            <View style={{ flex: 1 }}>
              <T variant="label">Phone</T>
              <T variant="bodySm" color={colors.textSecondary}>{PHONE_DISPLAY}</T>
            </View>
            <Ionicons name={Platform.OS === "web" ? "open-outline" : "call-outline"} size={18} color={colors.muted} />
          </Pressable>
        </Card>
      </ScrollView>
    </View>
  );
}
