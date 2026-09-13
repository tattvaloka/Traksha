import React from "react";
import { View, ScrollView, Pressable } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@react-native-vector-icons/ionicons";
import { AppHeader } from "@/src/components/Header";
import { T, Card, Avatar, IdentityBadge, Divider } from "@/src/components/ui";
import { useAuth } from "@/src/auth/AuthContext";
import { useTheme, fonts, space } from "@/src/theme";

function Row({ icon, label, onPress, testID, danger }: any) {
  const { colors } = useTheme();
  return (
    <Pressable onPress={onPress} testID={testID} style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 14, paddingVertical: 14, paddingHorizontal: 16, backgroundColor: pressed ? colors.surfaceTertiary : "transparent" })}>
      <Ionicons name={icon} size={20} color={danger ? colors.error : colors.textSecondary} />
      <T variant="body" color={danger ? colors.error : colors.textPrimary} style={{ flex: 1 }}>{label}</T>
      <Ionicons name="chevron-forward" size={18} color={colors.muted} />
    </Pressable>
  );
}

export default function Profile() {
  const { colors } = useTheme();
  const { user } = useAuth();
  if (!user) return null;

  const memberSince = user.member_since ? new Date(user.member_since).toLocaleDateString(undefined, { year: "numeric", month: "long" }) : "—";

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <AppHeader />
      <ScrollView contentContainerStyle={{ paddingBottom: 32 }}>
        <View style={{ padding: 16, gap: space.md }}>
          <Card style={{ alignItems: "center", gap: 12 }}>
            <Avatar name={user.display_name} uri={user.photo_url} size={80} />
            <View style={{ alignItems: "center", gap: 6 }}>
              <T variant="display" style={{ textAlign: "center" }}>{user.display_name}</T>
              {user.job_title || user.organization ? (
                <T variant="bodySm" color={colors.textSecondary}>
                  {[user.job_title, user.organization].filter(Boolean).join(" · ")}
                </T>
              ) : null}
              <IdentityBadge type={user.identity_type} code={user.identity_code} />
            </View>
            {user.bio ? <T variant="body" color={colors.textSecondary} style={{ textAlign: "center" }}>{user.bio}</T> : null}
            <T style={{ fontFamily: fonts.mono, fontSize: 11, color: colors.muted }}>Member since {memberSince}</T>
          </Card>
        </View>

        <View style={{ paddingHorizontal: 16, marginBottom: 8 }}>
          <Card style={{ padding: 0, overflow: "hidden" }}>
            <Row icon="create-outline" label="Edit profile" onPress={() => router.push("/edit-profile")} testID="edit-profile-row" />
            <Divider />
            <Row icon="qr-code-outline" label="My connection QR" onPress={() => router.push("/qr")} testID="my-qr-row" />
            <Divider />
            <Row icon="finger-print-outline" label="Identity" onPress={() => router.push("/settings/identity")} testID="identity-row" />
          </Card>
        </View>

        <View style={{ paddingHorizontal: 16, marginBottom: 8 }}>
          <Card style={{ padding: 0, overflow: "hidden" }}>
            <Row icon="settings-outline" label="Settings" onPress={() => router.push("/settings")} testID="settings-row" />
            <Divider />
            <Row icon="shield-outline" label="Privacy" onPress={() => router.push("/settings/privacy")} testID="privacy-row" />
            <Divider />
            <Row icon="alert-circle-outline" label="Safety" onPress={() => router.push("/settings/safety")} testID="safety-row" />
          </Card>
        </View>

        <View style={{ paddingHorizontal: 16 }}>
          <Card style={{ backgroundColor: colors.insBg, borderColor: colors.insBorder, flexDirection: "row", alignItems: "center", gap: 12 }}>
            <Ionicons name="business-outline" size={20} color={colors.insText} />
            <View style={{ flex: 1 }}>
              <T variant="label" color={colors.insText}>Institutions (INS)</T>
              <T variant="caption" color={colors.insText}>Coming soon</T>
            </View>
          </Card>
        </View>
      </ScrollView>
    </View>
  );
}
