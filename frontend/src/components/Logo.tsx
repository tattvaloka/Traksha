import React from "react";
import { View, Text } from "react-native";
import { Image } from "expo-image";
import { fonts, useTheme } from "@/src/theme";

const LOGO = require("../../assets/logo/traksha-logo.png");

export function Logo({ size = 30, wordmark = true }: { size?: number; wordmark?: boolean }) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 9 }}>
      <Image source={LOGO} style={{ width: size, height: size }} contentFit="contain" />
      {wordmark && (
        <Text
          style={{
            fontFamily: fonts.serif,
            fontSize: size * 0.66,
            color: colors.textPrimary,
            letterSpacing: 0.5,
          }}
        >
          Traksha
        </Text>
      )}
    </View>
  );
}

export const LogoMark = LOGO;
