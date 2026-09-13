import React, { useEffect, useState } from "react";
import { View, TextInput } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useMutation, useQuery } from "@tanstack/react-query";
import { StackHeader, IconButton } from "@/src/components/Header";
import { Button, Input, T, Loader } from "@/src/components/ui";
import { api, ApiError } from "@/src/api/client";
import { queryClient } from "@/src/query-client";
import { useToast } from "@/src/components/Toast";
import { useTheme, space, fonts, radius } from "@/src/theme";

export default function CreateContribution() {
  const { draftId } = useLocalSearchParams<{ draftId?: string }>();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { show } = useToast();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [currentDraft, setCurrentDraft] = useState<string | null>(draftId ?? null);

  const draft = useQuery({
    queryKey: ["draft", draftId],
    queryFn: () => api.get(`/drafts/${draftId}`),
    enabled: !!draftId,
  });

  useEffect(() => {
    if (draft.data) {
      setTitle(draft.data.title || "");
      setBody(draft.data.body || "");
      setCurrentDraft(draft.data.id);
    }
  }, [draft.data]);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["contributions"] });
    queryClient.invalidateQueries({ queryKey: ["drafts"] });
  };

  const saveDraft = useMutation({
    mutationFn: async () => {
      const payload = { title: title.trim(), body: body.trim() };
      if (currentDraft) return api.put(`/drafts/${currentDraft}`, payload);
      return api.post("/drafts", payload);
    },
    onSuccess: (d: any) => {
      setCurrentDraft(d.id);
      invalidate();
      show("Draft saved", "success");
      router.back();
    },
    onError: (e) => show(e instanceof ApiError ? e.message : "Could not save draft.", "error"),
  });

  const publish = useMutation({
    mutationFn: async () => {
      if (currentDraft) {
        await api.put(`/drafts/${currentDraft}`, { title: title.trim(), body: body.trim() });
        return api.post(`/drafts/${currentDraft}/publish`);
      }
      return api.post("/contributions", { title: title.trim(), body: body.trim() });
    },
    onSuccess: () => {
      invalidate();
      show("Published to Tattvaloka", "success");
      router.back();
    },
    onError: (e) => show(e instanceof ApiError ? e.message : "Could not publish.", "error"),
  });

  if (draftId && draft.isLoading) {
    return <View style={{ flex: 1, backgroundColor: colors.surface }}><StackHeader title="Draft" /><Loader /></View>;
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <StackHeader
        title={currentDraft ? "Edit draft" : "New contribution"}
        right={<IconButton icon="documents-outline" onPress={() => router.push("/drafts")} testID="open-drafts" />}
      />
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
        <Button label="Publish" onPress={() => publish.mutate()} loading={publish.isPending} disabled={!title.trim() || !body.trim()} testID="create-submit" />
        <Button label="Save draft" variant="secondary" onPress={() => saveDraft.mutate()} loading={saveDraft.isPending} disabled={!title.trim() && !body.trim()} testID="save-draft" />
      </KeyboardAwareScrollView>
    </View>
  );
}
