import { useState } from "react";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { router } from "expo-router";
import { StackHeader } from "@/src/components/Header";
import { Button, Input, T, Card } from "@/src/components/ui";
import { api, ApiError } from "@/src/api/client";
import { useToast } from "@/src/components/Toast";
import { useTheme, space } from "@/src/theme";

export default function Recovery() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { show } = useToast();
  const [email, setEmail] = useState("");
  const [devToken, setDevToken] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const requestReset = async () => {
    setLoading(true);
    try {
      const res = await api.post<{ message: string; dev_reset_token?: string }>("/auth/forgot-password", { email: email.trim() });
      show(res.message, "info");
      if (res.dev_reset_token) setDevToken(res.dev_reset_token);
    } catch {
      show("Could not process the request.", "error");
    } finally {
      setLoading(false);
    }
  };

  const doReset = async () => {
    if (!devToken || newPassword.length < 8) {
      show("Enter a new password of at least 8 characters.", "error");
      return;
    }
    setLoading(true);
    try {
      await api.post("/auth/reset-password", { token: devToken, new_password: newPassword });
      show("Password updated. Please sign in.", "success");
      router.replace("/(auth)/sign-in");
    } catch (e) {
      show(e instanceof ApiError ? e.message : "Reset failed.", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <StackHeader title="Recover account" />
      <KeyboardAwareScrollView
        bottomOffset={24}
        contentContainerStyle={{ padding: 24, gap: space.md, paddingBottom: insets.bottom + 24 }}
        keyboardShouldPersistTaps="handled"
      >
        <T variant="bodySm" color={colors.textSecondary}>
          Enter your email and we’ll help you set a new password.
        </T>
        <Input label="EMAIL" value={email} onChangeText={setEmail} placeholder="you@example.com" keyboardType="email-address" autoCapitalize="none" testID="recovery-email" />
        <Button label="Send reset link" onPress={requestReset} loading={loading} testID="recovery-request" />

        {devToken ? (
          <Card style={{ gap: 12, marginTop: 8 }}>
            <T variant="caption" color={colors.textSecondary}>
              Email delivery isn’t configured in this build, so your reset link is shown here for testing.
            </T>
            <Input label="NEW PASSWORD" value={newPassword} onChangeText={setNewPassword} placeholder="At least 8 characters" secureTextEntry testID="recovery-new-password" />
            <Button label="Set new password" onPress={doReset} loading={loading} testID="recovery-reset" />
          </Card>
        ) : null}
      </KeyboardAwareScrollView>
    </View>
  );
}
