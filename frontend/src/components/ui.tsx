import React from "react";
import {
  View,
  Text,
  Pressable,
  ActivityIndicator,
  TextInput,
  StyleSheet,
  ViewStyle,
  TextStyle,
  StyleProp,
} from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@react-native-vector-icons/ionicons";
import { useTheme, makeStyles, fonts, radius, space, ThemeColors } from "@/src/theme";

// ---------------------------------------------------------------------------
// Text helpers
// ---------------------------------------------------------------------------
type TVariant =
  | "displayLg"
  | "display"
  | "title"
  | "subtitle"
  | "body"
  | "bodySm"
  | "label"
  | "caption"
  | "mono";

export function T({
  variant = "body",
  color,
  style,
  children,
  numberOfLines,
  testID,
}: {
  variant?: TVariant;
  color?: string;
  style?: StyleProp<TextStyle>;
  children: React.ReactNode;
  numberOfLines?: number;
  testID?: string;
}) {
  const { colors } = useTheme();
  const base = variantStyles(colors)[variant];
  return (
    <Text
      testID={testID}
      numberOfLines={numberOfLines}
      style={[base, color ? { color } : null, style]}
    >
      {children}
    </Text>
  );
}

function variantStyles(c: ThemeColors): Record<TVariant, TextStyle> {
  return {
    displayLg: { fontFamily: fonts.serif, fontSize: 34, lineHeight: 42, color: c.textPrimary, letterSpacing: -0.3 },
    display: { fontFamily: fonts.serif, fontSize: 26, lineHeight: 34, color: c.textPrimary, letterSpacing: -0.2 },
    title: { fontFamily: fonts.serif, fontSize: 20, lineHeight: 28, color: c.textPrimary },
    subtitle: { fontFamily: fonts.sans, fontSize: 16, lineHeight: 24, color: c.textPrimary, fontWeight: "600" },
    body: { fontFamily: fonts.sans, fontSize: 15, lineHeight: 24, color: c.textPrimary },
    bodySm: { fontFamily: fonts.sans, fontSize: 13, lineHeight: 20, color: c.textSecondary },
    label: { fontFamily: fonts.sans, fontSize: 14, lineHeight: 20, color: c.textPrimary, fontWeight: "600" },
    caption: { fontFamily: fonts.sans, fontSize: 12, lineHeight: 16, color: c.muted, letterSpacing: 0.2 },
    mono: { fontFamily: fonts.mono, fontSize: 12, lineHeight: 16, color: c.textSecondary, letterSpacing: 0.4 },
  };
}

// ---------------------------------------------------------------------------
// Button
// ---------------------------------------------------------------------------
export function Button({
  label,
  onPress,
  variant = "primary",
  loading,
  disabled,
  icon,
  style,
  testID,
  full = true,
}: {
  label: string;
  onPress?: () => void;
  variant?: "primary" | "secondary" | "destructive" | "ghost";
  loading?: boolean;
  disabled?: boolean;
  icon?: React.ComponentProps<typeof Ionicons>["name"];
  style?: StyleProp<ViewStyle>;
  testID?: string;
  full?: boolean;
}) {
  const { colors } = useTheme();
  const isDisabled = disabled || loading;
  const palette: Record<string, { bg: string; fg: string; border?: string }> = {
    primary: { bg: colors.brandPrimary, fg: colors.onBrandPrimary },
    secondary: { bg: "transparent", fg: colors.textPrimary, border: colors.borderStrong },
    destructive: { bg: "transparent", fg: colors.error, border: colors.error },
    ghost: { bg: "transparent", fg: colors.textPrimary },
  };
  const p = palette[variant];
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => [
        {
          height: 48,
          borderRadius: radius.md,
          alignItems: "center",
          justifyContent: "center",
          flexDirection: "row",
          gap: 8,
          paddingHorizontal: 20,
          backgroundColor: p.bg,
          borderWidth: p.border ? 1 : 0,
          borderColor: p.border,
          opacity: isDisabled ? 0.5 : pressed ? 0.85 : 1,
          alignSelf: full ? "stretch" : "flex-start",
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={p.fg} />
      ) : (
        <>
          {icon && <Ionicons name={icon} size={18} color={p.fg} />}
          <Text style={{ color: p.fg, fontFamily: fonts.sans, fontSize: 15, fontWeight: "600" }} numberOfLines={1}>
            {label}
          </Text>
        </>
      )}
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// Card
// ---------------------------------------------------------------------------
export function Card({
  children,
  style,
  onPress,
  testID,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
  testID?: string;
}) {
  const { colors } = useTheme();
  const base: ViewStyle = {
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: space.md,
  };
  if (onPress) {
    return (
      <Pressable testID={testID} onPress={onPress} style={({ pressed }) => [base, { opacity: pressed ? 0.9 : 1 }, style]}>
        {children}
      </Pressable>
    );
  }
  return (
    <View testID={testID} style={[base, style]}>
      {children}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Input
// ---------------------------------------------------------------------------
export const Input = React.forwardRef<TextInput, any>(function Input(
  { label, error, style, testID, ...props }: any,
  ref,
) {
  const { colors } = useTheme();
  const [focused, setFocused] = React.useState(false);
  return (
    <View style={{ gap: 6 }}>
      {label && <T variant="mono" color={colors.textSecondary}>{label}</T>}
      <TextInput
        ref={ref}
        testID={testID}
        placeholderTextColor={colors.muted}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={[
          {
            borderWidth: 1,
            borderColor: error ? colors.error : focused ? colors.brand : colors.border,
            backgroundColor: colors.surfaceSecondary,
            borderRadius: radius.md,
            paddingHorizontal: 14,
            paddingVertical: 12,
            fontFamily: fonts.sans,
            fontSize: 15,
            color: colors.textPrimary,
          },
          style,
        ]}
        {...props}
      />
      {error ? <T variant="caption" color={colors.error}>{error}</T> : null}
    </View>
  );
});

// ---------------------------------------------------------------------------
// Identity badge (TMP / TRK / INS)
// ---------------------------------------------------------------------------
export function IdentityBadge({
  type,
  code,
  compact,
  testID,
}: {
  type: "TMP" | "TRK" | "INS";
  code?: string;
  compact?: boolean;
  testID?: string;
}) {
  const { colors } = useTheme();
  const map = {
    TMP: { bg: colors.tmpBg, border: colors.tmpBorder, text: colors.tmpText, icon: "hourglass-outline" as const },
    TRK: { bg: colors.trkBg, border: colors.trkBorder, text: colors.trkText, icon: "shield-checkmark-outline" as const },
    INS: { bg: colors.insBg, border: colors.insBorder, text: colors.insText, icon: "business-outline" as const },
  };
  const p = map[type];
  return (
    <View
      testID={testID}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        alignSelf: "flex-start",
        backgroundColor: p.bg,
        borderColor: p.border,
        borderWidth: 1,
        borderRadius: radius.md,
        paddingHorizontal: 10,
        paddingVertical: 5,
      }}
    >
      <Ionicons name={p.icon} size={13} color={p.text} />
      <Text style={{ fontFamily: fonts.mono, fontSize: 11, color: p.text, letterSpacing: 0.4 }}>
        {compact || !code ? type : `${type}-${code}`}
      </Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Context chip (personal / professional)
// ---------------------------------------------------------------------------
export function ContextChip({ context }: { context: "personal" | "professional" | "both" }) {
  const { colors } = useTheme();
  if (context === "both") {
    return (
      <View style={{ flexDirection: "row", gap: 4 }}>
        <ContextChip context="personal" />
        <ContextChip context="professional" />
      </View>
    );
  }
  const p =
    context === "personal"
      ? { bg: colors.personalBg, border: colors.personalBorder, fg: colors.personalAccent, label: "Personal", icon: "leaf-outline" as const }
      : { bg: colors.professionalBg, border: colors.professionalBorder, fg: colors.professionalAccent, label: "Professional", icon: "briefcase-outline" as const };
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 5,
        backgroundColor: p.bg,
        borderColor: p.border,
        borderWidth: 1,
        borderRadius: radius.full,
        paddingHorizontal: 10,
        paddingVertical: 4,
        alignSelf: "flex-start",
      }}
    >
      <Ionicons name={p.icon} size={12} color={p.fg} />
      <Text style={{ fontFamily: fonts.sans, fontSize: 12, fontWeight: "600", color: p.fg }}>{p.label}</Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Avatar
// ---------------------------------------------------------------------------
export function Avatar({ name, uri, size = 44 }: { name?: string; uri?: string | null; size?: number }) {
  const { colors } = useTheme();
  const initials = (name || "?")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase())
    .join("");
  if (uri) {
    return (
      <Image
        source={{ uri }}
        style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: colors.surfaceTertiary }}
        contentFit="cover"
      />
    );
  }
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: colors.surfaceTertiary,
        borderWidth: 1,
        borderColor: colors.border,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Text style={{ fontFamily: fonts.serif, fontSize: size * 0.38, color: colors.textPrimary }}>{initials}</Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Empty state
// ---------------------------------------------------------------------------
export function EmptyState({
  icon = "sparkles-outline",
  title,
  body,
  action,
  testID,
}: {
  icon?: React.ComponentProps<typeof Ionicons>["name"];
  title: string;
  body?: string;
  action?: React.ReactNode;
  testID?: string;
}) {
  const { colors } = useTheme();
  return (
    <View testID={testID} style={{ alignItems: "center", paddingVertical: 48, paddingHorizontal: 24, gap: 12 }}>
      <View
        style={{
          width: 56,
          height: 56,
          borderRadius: 28,
          backgroundColor: colors.surfaceTertiary,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Ionicons name={icon} size={26} color={colors.textSecondary} />
      </View>
      <T variant="title" style={{ textAlign: "center" }}>
        {title}
      </T>
      {body ? (
        <T variant="bodySm" color={colors.textSecondary} style={{ textAlign: "center", maxWidth: 320 }}>
          {body}
        </T>
      ) : null}
      {action ? <View style={{ marginTop: 8 }}>{action}</View> : null}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Loader + error
// ---------------------------------------------------------------------------
export function Loader() {
  const { colors } = useTheme();
  return (
    <View style={{ paddingVertical: 48, alignItems: "center" }}>
      <ActivityIndicator color={colors.brand} />
    </View>
  );
}

export function ErrorView({ message, onRetry }: { message?: string; onRetry?: () => void }) {
  const { colors } = useTheme();
  return (
    <EmptyState
      icon="cloud-offline-outline"
      title="Something went wrong"
      body={message || "We couldn't load this right now."}
      action={onRetry ? <Button label="Retry" icon="refresh" onPress={onRetry} full={false} /> : undefined}
    />
  );
}

// ---------------------------------------------------------------------------
// Divider + Section label + Row
// ---------------------------------------------------------------------------
export function Divider() {
  const { colors } = useTheme();
  return <View style={{ height: 1, backgroundColor: colors.divider }} />;
}

export function SectionLabel({ children }: { children: React.ReactNode }) {
  const { colors } = useTheme();
  return (
    <Text
      style={{
        fontFamily: fonts.sans,
        fontSize: 12,
        fontWeight: "700",
        letterSpacing: 0.6,
        textTransform: "uppercase",
        color: colors.muted,
        marginBottom: 8,
      }}
    >
      {children}
    </Text>
  );
}

export const styles = StyleSheet.create({});
