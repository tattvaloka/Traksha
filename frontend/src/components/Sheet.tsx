import React from "react";
import { View, Modal, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { T } from "@/src/components/ui";
import { useTheme } from "@/src/theme";

export function Sheet({
  visible,
  onClose,
  title,
  children,
}: {
  visible: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
}) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <Modal transparent visible={visible} animationType="slide" onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: "rgba(23,25,30,0.5)" }} onPress={onClose} />
      <View
        style={{
          backgroundColor: colors.surfaceSecondary,
          borderTopLeftRadius: 24,
          borderTopRightRadius: 24,
          padding: 20,
          paddingBottom: insets.bottom + 20,
          gap: 12,
        }}
      >
        <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, alignSelf: "center", marginBottom: 4 }} />
        {title ? <T variant="title">{title}</T> : null}
        {children}
      </View>
    </Modal>
  );
}
