import React, { useState } from "react";
import { View, Pressable, TextInput } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, router } from "expo-router";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Ionicons } from "@react-native-vector-icons/ionicons";
import { StackHeader } from "@/src/components/Header";
import { T, Card, Button, Loader } from "@/src/components/ui";
import { api } from "@/src/api/client";
import { useToast } from "@/src/components/Toast";
import { useTheme, radius, fonts, space } from "@/src/theme";

const LABELS: Record<string, string> = {
  harassment: "Harassment",
  spam: "Spam",
  impersonation: "Impersonation",
  abusive_behavior: "Abusive behavior",
  serious_violation: "Serious violation",
};

export default function Report() {
  const { target_type, target_id } = useLocalSearchParams<{ target_type: string; target_id: string }>();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { show } = useToast();
  const [reason, setReason] = useState<string | null>(null);
  const [detail, setDetail] = useState("");

  const reasons = useQuery({ queryKey: ["report-reasons"], queryFn: () => api.get("/reports/reasons") });

  const submit = useMutation({
    mutationFn: () => api.post("/reports", { target_type, target_id, reason, detail: detail.trim() || undefined }),
    onSuccess: () => { show("Report received. Thank you.", "success"); router.back(); },
    onError: () => show("Could not submit report.", "error"),
  });

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <StackHeader title="Report" />
      {reasons.isLoading ? (
        <Loader />
      ) : (
        <KeyboardAwareScrollView bottomOffset={24} contentContainerStyle={{ padding: 16, gap: space.md, paddingBottom: insets.bottom + 24 }} keyboardShouldPersistTaps="handled">
          <T variant="bodySm" color={colors.textSecondary}>Reports are confidential. Choose the reason that best fits.</T>
          <Card style={{ padding: 0, overflow: "hidden" }}>
            {(reasons.data?.reasons ?? []).map((r: string, i: number) => (
              <Pressable key={r} onPress={() => setReason(r)} testID={`reason-${r}`} style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 12, padding: 16, borderTopWidth: i === 0 ? 0 : 1, borderTopColor: colors.border, backgroundColor: pressed ? colors.surfaceTertiary : "transparent" })}>
                <Ionicons name={reason === r ? "radio-button-on" : "radio-button-off"} size={20} color={reason === r ? colors.brand : colors.muted} />
                <T variant="body" style={{ flex: 1 }}>{LABELS[r] || r}</T>
              </Pressable>
            ))}
          </Card>
          <View style={{ gap: 6 }}>
            <T variant="mono" color={colors.textSecondary}>DETAILS (OPTIONAL)</T>
            <TextInput
              testID="report-detail"
              value={detail}
              onChangeText={setDetail}
              multiline
              placeholder="Add any helpful context"
              placeholderTextColor={colors.muted}
              style={{ minHeight: 96, textAlignVertical: "top", borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: 14, fontFamily: fonts.sans, fontSize: 15, color: colors.textPrimary, backgroundColor: colors.surfaceSecondary }}
            />
          </View>
          <Button label="Submit report" onPress={() => submit.mutate()} loading={submit.isPending} disabled={!reason} testID="report-submit" />
        </KeyboardAwareScrollView>
      )}
    </View>
  );
}
