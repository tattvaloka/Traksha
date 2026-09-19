import React, { useState } from "react";
import { View, ScrollView, KeyboardAvoidingView, Platform } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@react-native-vector-icons/ionicons";
import { StackHeader } from "@/src/components/Header";
import { T, Card, Button, Input, Divider } from "@/src/components/ui";
import { useToast } from "@/src/components/Toast";
import { useTheme, space } from "@/src/theme";

// Registering an institution does NOT create an INS instantly. It begins a
// verification process that requires institutional information, documentation,
// authorization and review. This screen collects intent + basic details and
// submits a verification request; the institution is activated only after review.
export default function RegisterInstitution() {
  const { colors } = useTheme();
  const { show } = useToast();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const canSubmit = name.trim().length > 1 && email.trim().length > 3 && role.trim().length > 1;

  const submit = () => {
    if (!canSubmit || submitting) return;
    setSubmitting(true);
    setTimeout(() => {
      setSubmitting(false);
      show("Request received. Institutions are activated only after verification.", "success");
      router.back();
    }, 600);
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <StackHeader title="Register an Institution" />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={{ padding: 16, gap: space.md, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.insBg, borderWidth: 1, borderColor: colors.insBorder, alignItems: "center", justifyContent: "center" }}>
              <Ionicons name="business-outline" size={20} color={colors.insText} />
            </View>
            <View style={{ flex: 1 }}>
              <T variant="subtitle">Institution verification</T>
              <T variant="bodySm" color={colors.textSecondary}>Not instant · requires review</T>
            </View>
          </View>

          <Card style={{ gap: 8 }}>
            <T variant="bodySm" color={colors.textSecondary}>
              An institution (INS) is a verified organization, separate from your personal identity. Registration begins a
              verification process. You will be asked for institutional information, supporting documentation and proof of
              your authorization to act for the institution. It becomes active only after review.
            </T>
          </Card>

          <Card style={{ gap: 14 }}>
            <Input label="INSTITUTION NAME" value={name} onChangeText={setName} placeholder="Legal / registered name" testID="ins-name" />
            <Input label="OFFICIAL EMAIL" value={email} onChangeText={setEmail} placeholder="name@institution.org" autoCapitalize="none" keyboardType="email-address" testID="ins-email" />
            <Input label="YOUR ROLE / AUTHORITY" value={role} onChangeText={setRole} placeholder="e.g. Director, Authorized signatory" testID="ins-role" />
          </Card>

          <Card style={{ gap: 8 }}>
            <T variant="label">What happens next</T>
            <Row colorText={colors.textSecondary} text="We review the institution details and documentation." />
            <Divider />
            <Row colorText={colors.textSecondary} text="We confirm your authorization to represent it." />
            <Divider />
            <Row colorText={colors.textSecondary} text="Once verified, the INS identity is activated for you." />
          </Card>

          <Button label="Submit for verification" onPress={submit} disabled={!canSubmit} loading={submitting} testID="ins-submit" />
          <T variant="caption" color={colors.muted} style={{ textAlign: "center" }}>
            Submitting does not create an institution. It starts a verification request.
          </T>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

function Row({ text, colorText }: { text: string; colorText: string }) {
  return (
    <View style={{ paddingVertical: 6 }}>
      <T variant="bodySm" color={colorText}>{text}</T>
    </View>
  );
}
