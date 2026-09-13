import React, { useRef, useState } from "react";
import { View, Pressable, Linking, Platform, TextInput } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { CameraView, useCameraPermissions } from "expo-camera";
import { Ionicons } from "@react-native-vector-icons/ionicons";
import { StackHeader } from "@/src/components/Header";
import { T, Button, Avatar, IdentityBadge, EmptyState } from "@/src/components/ui";
import { Sheet } from "@/src/components/Sheet";
import { api, ApiError } from "@/src/api/client";
import { queryClient } from "@/src/query-client";
import { useToast } from "@/src/components/Toast";
import { useTheme, radius, fonts, space } from "@/src/theme";

function extractToken(raw: string): string {
  return raw.startsWith("traksha:") ? raw.slice("traksha:".length) : raw.trim();
}

export default function Scanner() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { show } = useToast();
  const [permission, requestPermission] = useCameraPermissions();
  const [preview, setPreview] = useState<any>(null);
  const [token, setToken] = useState<string | null>(null);
  const [manual, setManual] = useState("");
  const locked = useRef(false);

  const doScan = async (raw: string) => {
    if (locked.current) return;
    locked.current = true;
    const t = extractToken(raw);
    try {
      const res = await api.post("/qr/scan", { token: t });
      setPreview(res.preview);
      setToken(t);
    } catch (e) {
      show(e instanceof ApiError ? e.message : "This code is not valid.", "error");
      setTimeout(() => (locked.current = false), 1500);
    }
  };

  const connect = async (context: string) => {
    if (!token) return;
    try {
      await api.post("/qr/connect", { token, context });
      show("Request sent — waiting for acceptance", "success");
      queryClient.invalidateQueries();
      router.back();
    } catch (e) {
      show(e instanceof ApiError ? e.message : "Could not send request.", "error");
    } finally {
      setPreview(null);
    }
  };

  const ManualEntry = (
    <View style={{ padding: 16, gap: 10, borderTopWidth: 1, borderTopColor: colors.border }}>
      <T variant="mono" color={colors.textSecondary}>OR ENTER A CODE MANUALLY</T>
      <View style={{ flexDirection: "row", gap: 8 }}>
        <TextInput
          testID="manual-token"
          value={manual}
          onChangeText={setManual}
          placeholder="Paste connection token"
          placeholderTextColor={colors.muted}
          autoCapitalize="none"
          style={{ flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: 12, paddingVertical: 10, fontFamily: fonts.mono, fontSize: 13, color: colors.textPrimary, backgroundColor: colors.surfaceSecondary }}
        />
        <Button label="Check" full={false} onPress={() => manual.trim() && doScan(manual.trim())} testID="manual-check" />
      </View>
    </View>
  );

  const renderBody = () => {
    if (!permission) return null;
    if (Platform.OS !== "web" && !permission.granted) {
      return (
        <EmptyState
          icon="camera-outline"
          title="Camera access needed"
          body="To scan a Traksha code we need to use your camera. We only use it while scanning."
          action={
            permission.canAskAgain ? (
              <Button label="Enable camera" onPress={requestPermission} testID="enable-camera" />
            ) : (
              <Button label="Open Settings" onPress={() => Linking.openSettings()} testID="open-settings" />
            )
          }
        />
      );
    }
    return (
      <View style={{ flex: 1 }}>
        {Platform.OS !== "web" ? (
          <View style={{ flex: 1, overflow: "hidden" }}>
            <CameraView
              style={{ flex: 1 }}
              facing="back"
              barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
              onBarcodeScanned={({ data }) => doScan(data)}
            />
            <View pointerEvents="none" style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, alignItems: "center", justifyContent: "center" }}>
              <View style={{ width: 220, height: 220, borderWidth: 2, borderColor: "#FFFFFF", borderRadius: 20 }} />
            </View>
          </View>
        ) : (
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 24, gap: 8 }}>
            <Ionicons name="scan-outline" size={44} color={colors.textSecondary} />
            <T variant="bodySm" color={colors.textSecondary} style={{ textAlign: "center" }}>
              Live camera scanning runs on the mobile app. Paste a connection token below to test the flow.
            </T>
          </View>
        )}
        {ManualEntry}
      </View>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <StackHeader title="Scan a code" />
      {renderBody()}

      <Sheet visible={!!preview} onClose={() => { setPreview(null); locked.current = false; }} title="Send a connection request?">
        {preview && (
          <>
            <View style={{ flexDirection: "row", gap: 12, alignItems: "center" }}>
              <Avatar name={preview.display_name} uri={preview.photo_url} />
              <View style={{ flex: 1, gap: 4 }}>
                <T variant="subtitle">{preview.display_name}</T>
                <IdentityBadge type={preview.identity_type} code={preview.identity_code} />
              </View>
            </View>
            <T variant="bodySm" color={colors.textSecondary}>Scanning shows you their identity. They still choose whether to accept.</T>
            {(["personal", "professional", "both"] as const).map((ctx) => (
              <Pressable key={ctx} onPress={() => connect(ctx)} testID={`scan-context-${ctx}`} style={({ pressed }) => ({ padding: 14, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: pressed ? colors.surfaceTertiary : colors.surfaceSecondary, flexDirection: "row", justifyContent: "space-between", alignItems: "center" })}>
                <T variant="label" style={{ textTransform: "capitalize" }}>{ctx === "both" ? "Personal + Professional" : ctx}</T>
                <Ionicons name="chevron-forward" size={18} color={colors.muted} />
              </Pressable>
            ))}
          </>
        )}
      </Sheet>
    </View>
  );
}
