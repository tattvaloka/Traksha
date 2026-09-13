import React from "react";
import { View, Pressable, Modal, Platform, ActivityIndicator } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Image } from "expo-image";
import * as FileSystem from "expo-file-system";
import * as Sharing from "expo-sharing";
import { Ionicons } from "@react-native-vector-icons/ionicons";
import { T } from "@/src/components/ui";
import { mediaUrl, getToken } from "@/src/api/client";
import { formatBytes } from "@/src/utils/image";
import { useTheme, radius, fonts } from "@/src/theme";

const isWeb = Platform.OS === "web";

/** Authenticated image (attachments are served only to connection members). */
export function AuthImage({ url, localUri, token, width, height, style }: {
  url?: string;
  localUri?: string;
  token: string | null;
  width: number;
  height: number;
  style?: any;
}) {
  const { colors } = useTheme();
  const source = localUri
    ? { uri: localUri }
    : url
    ? { uri: mediaUrl(url), headers: token ? { Authorization: `Bearer ${token}` } : undefined }
    : undefined;
  return (
    <Image
      source={source as any}
      style={[{ width, height, borderRadius: radius.md, backgroundColor: colors.surfaceTertiary }, style]}
      contentFit="cover"
      transition={150}
    />
  );
}

function iconForMime(mime?: string): React.ComponentProps<typeof Ionicons>["name"] {
  if (!mime) return "document-outline";
  if (mime.includes("pdf")) return "document-text-outline";
  if (mime.includes("sheet") || mime.includes("excel") || mime.includes("csv")) return "grid-outline";
  if (mime.includes("presentation") || mime.includes("powerpoint")) return "easel-outline";
  if (mime.includes("word") || mime.includes("msword")) return "document-outline";
  if (mime.startsWith("text/")) return "reader-outline";
  return "document-outline";
}

export async function openAttachment(url: string, name: string, mime?: string) {
  const token = await getToken();
  const abs = mediaUrl(url)!;
  if (isWeb) {
    const res = await fetch(abs, { headers: token ? { Authorization: `Bearer ${token}` } : undefined });
    const blob = await res.blob();
    const objUrl = URL.createObjectURL(blob);
    (globalThis as any).open(objUrl, "_blank");
    return;
  }
  const safe = name.replace(/[^a-zA-Z0-9._-]/g, "_") || "file";
  const dest = `${FileSystem.cacheDirectory}${Date.now()}_${safe}`;
  const dl = await FileSystem.downloadAsync(abs, dest, {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(dl.uri, { mimeType: mime, dialogTitle: name });
  }
}

/** File (document) attachment card inside a chat bubble. */
export function FileCard({ name, size, mime, mine, onOpen, disabled }: {
  name: string;
  size?: number;
  mime?: string;
  mine: boolean;
  onOpen?: () => void;
  disabled?: boolean;
}) {
  const { colors } = useTheme();
  const fg = mine ? colors.onBrandPrimary : colors.textPrimary;
  const sub = mine ? colors.onBrandPrimary : colors.textSecondary;
  return (
    <Pressable onPress={disabled ? undefined : onOpen} testID="attachment-file" style={{ flexDirection: "row", alignItems: "center", gap: 10, maxWidth: 260 }}>
      <View style={{ width: 40, height: 40, borderRadius: radius.sm, backgroundColor: mine ? "rgba(255,255,255,0.18)" : colors.surfaceTertiary, alignItems: "center", justifyContent: "center" }}>
        <Ionicons name={iconForMime(mime)} size={20} color={fg} />
      </View>
      <View style={{ flex: 1 }}>
        <T variant="bodySm" color={fg} numberOfLines={1} style={{ fontWeight: "600" }}>{name}</T>
        <T style={{ fontFamily: fonts.mono, fontSize: 10, color: sub }}>
          {formatBytes(size)}{!disabled ? " · Tap to open" : ""}
        </T>
      </View>
      {!disabled ? <Ionicons name="download-outline" size={18} color={sub} /> : null}
    </Pressable>
  );
}

/** Full-screen image viewer. */
export function ImageViewer({ url, token, onClose }: { url: string | null; token: string | null; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={!!url} transparent animationType="fade" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: "rgba(10,12,16,0.96)" }}>
        <Pressable onPress={onClose} testID="image-viewer-close" style={{ position: "absolute", top: insets.top + 8, right: 16, zIndex: 2, width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(255,255,255,0.14)", alignItems: "center", justifyContent: "center" }}>
          <Ionicons name="close" size={22} color="#FFFFFF" />
        </Pressable>
        <Pressable style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 16 }} onPress={onClose}>
          {url ? (
            <Image
              source={{ uri: mediaUrl(url), headers: token ? { Authorization: `Bearer ${token}` } : undefined } as any}
              style={{ width: "100%", height: "80%" }}
              contentFit="contain"
              transition={150}
            />
          ) : (
            <ActivityIndicator color="#FFFFFF" />
          )}
        </Pressable>
      </View>
    </Modal>
  );
}
