import React, { useState } from "react";
import { View, ScrollView } from "react-native";
import { router } from "expo-router";
import { useMutation } from "@tanstack/react-query";
import { StackHeader } from "@/src/components/Header";
import { T, Card, Button, Divider } from "@/src/components/ui";
import { Sheet } from "@/src/components/Sheet";
import { api } from "@/src/api/client";
import { useAuth } from "@/src/auth/AuthContext";
import { useToast } from "@/src/components/Toast";
import { useTheme, fonts, space } from "@/src/theme";

export default function Account() {
  const { colors } = useTheme();
  const { user, logout } = useAuth();
  const { show } = useToast();
  const [confirm, setConfirm] = useState(false);

  const del = useMutation({
    mutationFn: () => api.del("/account"),
    onSuccess: async () => { setConfirm(false); await logout(); show("Your account has been deleted.", "info"); },
    onError: () => show("Could not delete account.", "error"),
  });

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <StackHeader title="Account" />
      <ScrollView contentContainerStyle={{ padding: 16, gap: space.md, paddingBottom: 32 }}>
        <Card style={{ gap: 10 }}>
          <T variant="mono" color={colors.textSecondary}>EMAIL</T>
          <T variant="body">{user?.email}</T>
          <Divider />
          <T variant="mono" color={colors.textSecondary}>IDENTITY</T>
          <T style={{ fontFamily: fonts.mono, fontSize: 13, color: colors.textPrimary }}>{user?.identity_label}</T>
        </Card>

        <Button label="Sign out" icon="log-out-outline" variant="secondary" onPress={async () => { await logout(); }} testID="account-signout" />

        <Card style={{ gap: 10, borderColor: colors.error }}>
          <T variant="subtitle" color={colors.error}>Delete account</T>
          <T variant="bodySm" color={colors.textSecondary}>
            This removes your profile and connections. This cannot be undone. Your identity code will not be reissued.
          </T>
          <Button label="Delete account" variant="destructive" onPress={() => setConfirm(true)} testID="delete-account" />
        </Card>
      </ScrollView>

      <Sheet visible={confirm} onClose={() => setConfirm(false)} title="Delete account?">
        <T variant="bodySm" color={colors.textSecondary}>
          You’ll be signed out and your account will be deleted. This action is permanent.
        </T>
        <Button label="Delete account" variant="destructive" onPress={() => del.mutate()} loading={del.isPending} testID="confirm-delete" />
        <Button label="Cancel" variant="secondary" onPress={() => setConfirm(false)} testID="cancel-delete" />
      </Sheet>
    </View>
  );
}
