import React from "react";
import { View, ScrollView, Pressable } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@react-native-vector-icons/ionicons";
import { StackHeader } from "@/src/components/Header";
import { T, Card, Divider } from "@/src/components/ui";
import { useAuth } from "@/src/auth/AuthContext";
import { useToast } from "@/src/components/Toast";
import { useTheme, space } from "@/src/theme";

function Row({ icon, label, onPress, testID, danger, last }: any) {
  const { colors } = useTheme();
  return (
    <>
      <Pressable onPress={onPress} testID={testID} style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 14, paddingVertical: 14, paddingHorizontal: 16, backgroundColor: pressed ? colors.surfaceTertiary : "transparent" })}>
        <Ionicons name={icon} size={20} color={danger ? colors.error : colors.textSecondary} />
        <T variant="body" color={danger ? colors.error : colors.textPrimary} style={{ flex: 1 }}>{label}</T>
        {!danger && <Ionicons name="chevron-forward" size={18} color={colors.muted} />}
      </Pressable>
      {!last && <Divider />}
    </>
  );
}

export default function Settings() {
  const { colors } = useTheme();
  const { logout } = useAuth();
  const { show } = useToast();

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <StackHeader title="Preferences" />
      <ScrollView contentContainerStyle={{ padding: 16, gap: space.md, paddingBottom: 32 }}>
        <Card style={{ padding: 0, overflow: "hidden" }}>
          <Row icon="person-outline" label="Account" onPress={() => router.push("/settings/account")} testID="set-account" />
          <Row icon="finger-print-outline" label="Identity" onPress={() => router.push("/settings/identity")} testID="set-identity" />
          <Row icon="shield-outline" label="Privacy" onPress={() => router.push("/settings/privacy")} testID="set-privacy" />
          <Row icon="alert-circle-outline" label="Safety" onPress={() => router.push("/settings/safety")} testID="set-safety" />
          <Row icon="call-outline" label="Communication" onPress={() => router.push("/settings/communication")} testID="set-communication" />
          <Row icon="mail-outline" label="Contact us" onPress={() => router.push("/settings/contact")} testID="set-contact" last />
        </Card>

        <Card style={{ padding: 0, overflow: "hidden" }}>
          <Row icon="log-out-outline" label="Sign out" danger onPress={async () => { await logout(); show("Signed out", "info"); }} testID="sign-out" last />
        </Card>
      </ScrollView>
    </View>
  );
}
