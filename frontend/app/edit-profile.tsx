import React, { useState } from "react";
import { View, TextInput } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useMutation } from "@tanstack/react-query";
import { StackHeader } from "@/src/components/Header";
import { Button, Input, T } from "@/src/components/ui";
import { api } from "@/src/api/client";
import { queryClient } from "@/src/query-client";
import { useAuth, Me } from "@/src/auth/AuthContext";
import { useToast } from "@/src/components/Toast";
import { useTheme, space, fonts, radius } from "@/src/theme";

export default function EditProfile() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { user, setUser } = useAuth();
  const { show } = useToast();
  const [displayName, setDisplayName] = useState(user?.display_name ?? "");
  const [bio, setBio] = useState(user?.bio ?? "");
  const [jobTitle, setJobTitle] = useState(user?.job_title ?? "");
  const [organization, setOrganization] = useState(user?.organization ?? "");

  const save = useMutation({
    mutationFn: () =>
      api.put<Me>("/profile/me", {
        display_name: displayName.trim() || undefined,
        bio: bio.trim(),
        job_title: jobTitle.trim(),
        organization: organization.trim(),
      }),
    onSuccess: (me) => {
      setUser(me);
      queryClient.invalidateQueries();
      show("Profile updated", "success");
      router.back();
    },
    onError: () => show("Could not save profile.", "error"),
  });

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <StackHeader title="Edit profile" />
      <KeyboardAwareScrollView bottomOffset={24} contentContainerStyle={{ padding: 16, gap: space.md, paddingBottom: insets.bottom + 24 }} keyboardShouldPersistTaps="handled">
        <Input label="DISPLAY NAME" value={displayName} onChangeText={setDisplayName} testID="edit-name" autoCapitalize="words" />
        <View style={{ gap: 6 }}>
          <T variant="mono" color={colors.textSecondary}>BIO</T>
          <TextInput
            testID="edit-bio"
            value={bio}
            onChangeText={setBio}
            multiline
            placeholder="A short, optional bio"
            placeholderTextColor={colors.muted}
            maxLength={280}
            style={{ minHeight: 96, textAlignVertical: "top", borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: 14, fontFamily: fonts.sans, fontSize: 15, color: colors.textPrimary, backgroundColor: colors.surfaceSecondary }}
          />
        </View>
        <Input label="ROLE / JOB TITLE" value={jobTitle} onChangeText={setJobTitle} placeholder="Optional" testID="edit-job" />
        <Input label="ORGANIZATION" value={organization} onChangeText={setOrganization} placeholder="Optional" testID="edit-org" />
        <Button label="Save" onPress={() => save.mutate()} loading={save.isPending} testID="edit-save" />
      </KeyboardAwareScrollView>
    </View>
  );
}
