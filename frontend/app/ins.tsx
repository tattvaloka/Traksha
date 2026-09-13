import React from "react";
import { View } from "react-native";
import { Ionicons } from "@react-native-vector-icons/ionicons";
import { StackHeader } from "@/src/components/Header";
import { T } from "@/src/components/ui";
import { useTheme } from "@/src/theme";

export default function INS() {
  const { colors } = useTheme();
  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <StackHeader title="Institutions" />
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 24, gap: 14 }}>
        <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: colors.insBg, borderWidth: 1, borderColor: colors.insBorder, alignItems: "center", justifyContent: "center" }}>
          <Ionicons name="business-outline" size={28} color={colors.insText} />
        </View>
        <T variant="display" style={{ textAlign: "center" }}>Institutions</T>
        <T variant="body" color={colors.textSecondary} style={{ textAlign: "center", maxWidth: 320 }}>
          Institutional identities (INS) represent organizations with accountable TRK leadership. This is coming soon and not part of the current build.
        </T>
      </View>
    </View>
  );
}
