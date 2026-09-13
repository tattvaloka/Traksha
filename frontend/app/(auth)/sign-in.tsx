import { useState } from "react";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { router } from "expo-router";
import { Logo } from "@/src/components/Logo";
import { Button, Input, T } from "@/src/components/ui";
import { useAuth } from "@/src/auth/AuthContext";
import { ApiError } from "@/src/api/client";
import { useTheme, space } from "@/src/theme";

export default function SignIn() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async () => {
    setErr(null);
    if (!email.trim() || !password) {
      setErr("Enter your email and password.");
      return;
    }
    setLoading(true);
    try {
      await login(email.trim(), password);
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "Could not sign in.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <KeyboardAwareScrollView
        bottomOffset={24}
        contentContainerStyle={{ flexGrow: 1, padding: 24, paddingTop: insets.top + 32, paddingBottom: insets.bottom + 24, gap: space.md }}
        keyboardShouldPersistTaps="handled"
      >
        <Logo size={34} />
        <T variant="display" style={{ marginTop: 8 }}>Welcome back</T>
        <View style={{ gap: space.md, marginTop: 8 }}>
          <Input label="EMAIL" value={email} onChangeText={setEmail} placeholder="you@example.com" keyboardType="email-address" autoCapitalize="none" autoComplete="email" testID="signin-email" />
          <Input label="PASSWORD" value={password} onChangeText={setPassword} placeholder="Your password" secureTextEntry testID="signin-password" />
          {err ? <T variant="caption" color={colors.error}>{err}</T> : null}
          <Button label="Sign in" onPress={submit} loading={loading} testID="signin-submit" />
          <T variant="bodySm" color={colors.brand} style={{ textAlign: "center", fontWeight: "700" }} onPress={() => router.push("/(auth)/recovery")}>
            Forgot password?
          </T>
        </View>
        <View style={{ flexDirection: "row", justifyContent: "center", gap: 6, marginTop: 8 }}>
          <T variant="bodySm" color={colors.textSecondary}>New to Traksha?</T>
          <T variant="bodySm" color={colors.brand} style={{ fontWeight: "700" }} onPress={() => router.replace("/(auth)/welcome")}>Get started</T>
        </View>
      </KeyboardAwareScrollView>
    </View>
  );
}
