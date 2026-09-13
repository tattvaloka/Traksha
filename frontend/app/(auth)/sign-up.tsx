import { useState } from "react";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { router } from "expo-router";
import { StackHeader } from "@/src/components/Header";
import { Button, Input, T } from "@/src/components/ui";
import { useAuth } from "@/src/auth/AuthContext";
import { useToast } from "@/src/components/Toast";
import { ApiError } from "@/src/api/client";
import { useTheme, space } from "@/src/theme";

export default function SignUp() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { register } = useAuth();
  const { show } = useToast();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async () => {
    setErr(null);
    if (!name.trim() || !email.trim() || password.length < 8) {
      setErr("Enter a name, email, and a password of at least 8 characters.");
      return;
    }
    setLoading(true);
    try {
      await register(email.trim(), password, name.trim());
      show("Your TMP identity has been created", "success");
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "Could not create account.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <StackHeader title="Create account" />
      <KeyboardAwareScrollView
        bottomOffset={24}
        contentContainerStyle={{ padding: 24, gap: space.md, paddingBottom: insets.bottom + 24 }}
        keyboardShouldPersistTaps="handled"
      >
        <T variant="bodySm" color={colors.textSecondary}>
          You’ll receive a provisional TMP identity immediately and begin the 45-day journey.
        </T>
        <Input label="DISPLAY NAME" value={name} onChangeText={setName} placeholder="Your name" testID="signup-name" autoCapitalize="words" />
        <Input label="EMAIL" value={email} onChangeText={setEmail} placeholder="you@example.com" keyboardType="email-address" autoCapitalize="none" autoComplete="email" testID="signup-email" />
        <Input label="PASSWORD" value={password} onChangeText={setPassword} placeholder="At least 8 characters" secureTextEntry testID="signup-password" />
        {err ? <T variant="caption" color={colors.error}>{err}</T> : null}
        <Button label="Create account" onPress={submit} loading={loading} testID="signup-submit" />
        <View style={{ flexDirection: "row", justifyContent: "center", gap: 6, marginTop: 4 }}>
          <T variant="bodySm" color={colors.textSecondary}>Already have an account?</T>
          <T variant="bodySm" color={colors.brand} style={{ fontWeight: "700" }} onPress={() => router.replace("/(auth)/sign-in")}>Sign in</T>
        </View>
      </KeyboardAwareScrollView>
    </View>
  );
}
