import React, { useState } from "react";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useMutation } from "@tanstack/react-query";
import { StackHeader } from "@/src/components/Header";
import { Button, Input, T } from "@/src/components/ui";
import { api, ApiError } from "@/src/api/client";
import { queryClient } from "@/src/query-client";
import { useToast } from "@/src/components/Toast";
import { useTheme, space, fonts, radius } from "@/src/theme";
import { TextInput } from "react-native";

export default function CreateContribution() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { show } = useToast();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");

  const create = useMutation({
    mutationFn: () => api.post("/contributions", { title: title.trim(), body: body.trim() }),
    onSuccess: () => {
      show("Published to Tattvaloka", "success");
      queryClient.invalidateQueries({ queryKey: ["contributions"] });
      router.back();
    },
    onError: (e) => show(e instanceof ApiError ? e.message : "Could not publish.", "error"),
  });

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <StackHeader title="New contribution" />
      <KeyboardAwareScrollView bottomOffset={24} contentContainerStyle={{ padding: 16, gap: space.md, paddingBottom: insets.bottom + 24 }} keyboardShouldPersistTaps="handled">
        <Input label="TITLE" value={title} onChangeText={setTitle} placeholder="A clear, honest title" testID="create-title" />
        <View style={{ gap: 6 }}>
          <T variant="mono" color={colors.textSecondary}>BODY</T>
          <TextInput
            testID="create-body"
            value={body}
            onChangeText={setBody}
            multiline
            placeholder="Write something worth reading..."
            placeholderTextColor={colors.muted}
            style={{ minHeight: 200, textAlignVertical: "top", borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: 14, fontFamily: fonts.sans, fontSize: 15, lineHeight: 24, color: colors.textPrimary, backgroundColor: colors.surfaceSecondary }}
          />
        </View>
        <Button label="Publish" onPress={() => create.mutate()} loading={create.isPending} disabled={!title.trim() || !body.trim()} testID="create-submit" />
      </KeyboardAwareScrollView>
    </View>
  );
}
