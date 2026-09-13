// Traksha design tokens — "Restrained Civic Humanism".
// Values are taken from the approved design system document. Light theme only.
//
// Build styles with makeStyles((c) => ({...})) and read colors via useTheme().
// Typography families are loaded in app/_layout.tsx via expo-font.

import { useMemo } from "react";
import { Appearance, StyleSheet, useColorScheme } from "react-native";

export type ColorScheme = "light" | "dark";

const light = {
  // Surfaces
  surface: "#FBFBF9", // primary canvas
  onSurface: "#17191E", // archival charcoal ink
  surfaceSecondary: "#FFFFFF", // cards, sheets, list rows
  onSurfaceSecondary: "#17191E",
  surfaceTertiary: "#F4F3EE", // muted canvas, inputs, sidebars
  onSurfaceTertiary: "#5A606D",
  surfaceWarm: "#F7F2EA", // warm informational callouts
  surfaceInverse: "#30312E", // snackbars / toasts
  onSurfaceInverse: "#F2F1EC",
  muted: "#8A909D", // timestamps, subtle counts

  // Brand (deep slate ink)
  brand: "#111827",
  onBrand: "#FFFFFF",
  brandPrimary: "#111827",
  onBrandPrimary: "#FFFFFF",
  brandPrimaryHover: "#1F2937",
  brandSecondary: "#F7F2EA",
  onBrandSecondary: "#17191E",
  brandTertiary: "#EFEEE9",
  onBrandTertiary: "#17191E",

  // Text tiers
  textPrimary: "#17191E",
  textSecondary: "#5A606D",

  // Status
  success: "#1D4A43",
  onSuccess: "#FFFFFF",
  warning: "#805524",
  onWarning: "#FFFFFF",
  error: "#993C3C",
  onError: "#FFFFFF",
  info: "#1F2937",
  onInfo: "#FFFFFF",

  // Identity state tokens
  tmpBg: "#EAE3D9",
  tmpBorder: "#D4C7B5",
  tmpText: "#6E5A44",
  trkBg: "#EBF3F0",
  trkBorder: "#B6D6CD",
  trkText: "#1D4A43",
  insBg: "#EFEFEF",
  insBorder: "#DCDCDC",
  insText: "#555555",

  // Communication context tokens
  personalBg: "#F3EFEA",
  personalBorder: "#DED6CC",
  personalAccent: "#9A6B38",
  professionalBg: "#EEF2F6",
  professionalBorder: "#CBD5E1",
  professionalAccent: "#1F2937",

  // Lines
  border: "#E5E4DE", // hairline
  borderStrong: "#D4C7B5",
  divider: "#E5E4DE",
};

export type ThemeColors = typeof light;

export const defaultScheme = "light" satisfies ColorScheme;
export const themes: { light: ThemeColors; dark?: ThemeColors } = { light };

// Font families (registered in app/_layout.tsx)
export const fonts = {
  serif: "Newsreader",
  sans: "PlusJakartaSans",
  mono: "JetBrainsMono",
};

export const radius = { sm: 4, md: 8, lg: 16, xl: 24, full: 9999 };
export const space = { xs: 4, sm: 8, md: 16, lg: 24, xl: 40 };

export function setColorScheme(scheme: ColorScheme | null) {
  Appearance.setColorScheme?.(scheme);
}
setColorScheme?.(themes.dark ? null : defaultScheme);

export function useTheme(): { scheme: ColorScheme; colors: ThemeColors } {
  const system = useColorScheme();
  const scheme: ColorScheme = system && themes[system] ? system : defaultScheme;
  return { scheme, colors: themes[scheme] ?? themes.light };
}

export function makeStyles<T extends StyleSheet.NamedStyles<T> | StyleSheet.NamedStyles<any>>(
  factory: (colors: ThemeColors) => T & StyleSheet.NamedStyles<any>,
): () => T {
  return function useStyles(): T {
    const { colors } = useTheme();
    return useMemo(() => StyleSheet.create(factory(colors)), [colors]);
  };
}
