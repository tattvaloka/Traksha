import React, { useMemo, useState } from "react";
import { View, FlatList, TextInput, Pressable, Platform, ActivityIndicator, Linking } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, router } from "expo-router";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import { useQuery } from "@tanstack/react-query";
import { Ionicons } from "@react-native-vector-icons/ionicons";
import { StackHeader, IconButton } from "@/src/components/Header";
import { T, Loader, ErrorView, EmptyState, ContextChip, Avatar } from "@/src/components/ui";
import { Sheet } from "@/src/components/Sheet";
import { Button } from "@/src/components/ui";
import { AuthImage, FileCard, ImageViewer, openAttachment } from "@/src/components/Attachment";
import { api, ApiError, uploadAttachment } from "@/src/api/client";
import { normalizeImage, formatBytes } from "@/src/utils/image";
import { queryClient } from "@/src/query-client";
import { useAuth } from "@/src/auth/AuthContext";
import { useRealtime } from "@/src/realtime/RealtimeContext";
import { useToast } from "@/src/components/Toast";
import { useTheme, fonts, radius } from "@/src/theme";

type Attachment = { url?: string; kind: "image" | "file"; name: string; size?: number; mime?: string; width?: number; height?: number };

type Msg = {
  id: string;
  sender_id: string;
  text: string;
  status: string;
  created_at: string;
  client_id?: string | null;
  type?: string;
  attachment?: Attachment | null;
  _local?: boolean;
  _failed?: boolean;
  _uploading?: boolean;
  _localUri?: string;
  _asset?: PickedAsset | null;
};

type PickedAsset = { uri: string; mimeType: string; name: string; kind: "image" | "file"; size?: number; width?: number; height?: number };

export default function Conversation() {
  const { connId, context } = useLocalSearchParams<{ connId: string; context: string }>();
  const ctx = context === "professional" ? "professional" : "personal";
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { user, token } = useAuth();
  const { startCall } = useRealtime();
  const { show } = useToast();
  const [text, setText] = useState("");
  const [pending, setPending] = useState<Msg[]>([]);
  const [callSheet, setCallSheet] = useState(false);
  const [attachSheet, setAttachSheet] = useState(false);
  const [preview, setPreview] = useState<PickedAsset | null>(null);
  const [viewerUrl, setViewerUrl] = useState<string | null>(null);

  const q = useQuery({
    queryKey: ["messages", connId, ctx],
    queryFn: () => api.get(`/conversations/${connId}/${ctx}/messages`),
    refetchOnWindowFocus: true,
  });

  const serverMsgs: Msg[] = q.data?.messages ?? [];
  const other = q.data?.other;
  const connectionContext: string = q.data?.connection_context ?? ctx;
  const isHybrid = connectionContext === "both";

  const merged = useMemo(() => {
    const serverClientIds = new Set(serverMsgs.map((m) => m.client_id).filter(Boolean));
    const localOnly = pending.filter((p) => !serverClientIds.has(p.client_id));
    return [...serverMsgs, ...localOnly];
  }, [serverMsgs, pending]);

  const sendMessage = async (body: string, clientId: string) => {
    try {
      await api.post(`/conversations/${connId}/messages`, { text: body, context: ctx, client_id: clientId });
      setPending((prev) => prev.filter((p) => p.client_id !== clientId));
      queryClient.invalidateQueries({ queryKey: ["messages", connId, ctx] });
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
    } catch (e) {
      setPending((prev) => prev.map((p) => (p.client_id === clientId ? { ...p, _failed: true, status: "failed" } : p)));
    }
  };

  const onSend = () => {
    const body = text.trim();
    if (!body) return;
    const clientId = `${Date.now()}-${Math.random()}`;
    const local: Msg = { id: clientId, client_id: clientId, sender_id: user!.id, text: body, status: "sending", created_at: new Date().toISOString(), _local: true };
    setPending((prev) => [...prev, local]);
    setText("");
    sendMessage(body, clientId);
  };

  const retry = (m: Msg) => {
    if (m.type === "image" || m.type === "file") {
      if (!m._asset) return;
      setPending((prev) => prev.filter((p) => p.client_id !== m.client_id));
      sendAttachment(m._asset, m.client_id!);
      return;
    }
    setPending((prev) => prev.map((p) => (p.client_id === m.client_id ? { ...p, _failed: false, status: "sending" } : p)));
    sendMessage(m.text, m.client_id!);
  };

  const sendAttachment = async (asset: PickedAsset, clientId?: string) => {
    const cid = clientId || `${Date.now()}-${Math.random()}`;
    const local: Msg = {
      id: cid, client_id: cid, sender_id: user!.id, text: "",
      type: asset.kind, status: "sending", created_at: new Date().toISOString(),
      _local: true, _uploading: true, _localUri: asset.kind === "image" ? asset.uri : undefined, _asset: asset,
      attachment: { kind: asset.kind, name: asset.name, size: asset.size, mime: asset.mimeType, width: asset.width, height: asset.height },
    };
    setPending((prev) => [...prev.filter((p) => p.client_id !== cid), local]);
    try {
      await uploadAttachment(connId, { uri: asset.uri, mimeType: asset.mimeType, fileName: asset.name, width: asset.width, height: asset.height }, ctx, cid);
      setPending((prev) => prev.filter((p) => p.client_id !== cid));
      queryClient.invalidateQueries({ queryKey: ["messages", connId, ctx] });
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
    } catch (e) {
      setPending((prev) => prev.map((p) => (p.client_id === cid ? { ...p, _failed: true, _uploading: false, status: "failed" } : p)));
      show(e instanceof ApiError ? e.message : "Could not send attachment.", "error");
    }
  };

  const pickImage = async (fromCamera: boolean) => {
    setAttachSheet(false);
    const perm = fromCamera
      ? await ImagePicker.getCameraPermissionsAsync()
      : await ImagePicker.getMediaLibraryPermissionsAsync();
    let status = perm.status;
    if (status !== "granted") {
      if (perm.canAskAgain || status === "undetermined") {
        const req = fromCamera
          ? await ImagePicker.requestCameraPermissionsAsync()
          : await ImagePicker.requestMediaLibraryPermissionsAsync();
        status = req.status;
      }
      if (status !== "granted") {
        show(`${fromCamera ? "Camera" : "Photo"} access is needed. Enable it in Settings.`, "error");
        if (!perm.canAskAgain) Linking.openSettings();
        return;
      }
    }
    const result = fromCamera
      ? await ImagePicker.launchCameraAsync({ mediaTypes: ["images"], allowsEditing: true, quality: 1 })
      : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], allowsEditing: true, quality: 1 });
    if (result.canceled || !result.assets?.[0]) return;
    const a = result.assets[0];
    try {
      const norm = await normalizeImage(a.uri, { maxSize: 1600, compress: 0.8, sourceWidth: a.width });
      setPreview({ uri: norm.uri, mimeType: norm.mimeType, name: "photo.jpg", kind: "image", width: norm.width, height: norm.height });
    } catch {
      show("Could not process that image.", "error");
    }
  };

  const pickDocument = async () => {
    setAttachSheet(false);
    const res = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true, multiple: false });
    if (res.canceled || !res.assets?.[0]) return;
    const d = res.assets[0];
    const size = d.size ?? 0;
    if (size > 20 * 1024 * 1024) {
      show("File is too large (max 20MB).", "error");
      return;
    }
    setPreview({ uri: d.uri, mimeType: d.mimeType || "application/octet-stream", name: d.name || "document", kind: "file", size });
  };

  const confirmSend = () => {
    if (!preview) return;
    const asset = preview;
    setPreview(null);
    sendAttachment(asset);
  };

  const startCallFlow = async (kind: "audio" | "video") => {
    setCallSheet(false);
    if (!other) return;
    try {
      const res = await api.get(`/calls/can-call/${other.identity_code}?kind=${kind}`);
      if (res.can_call) startCall(other.identity_code, other.display_name, kind);
      else { await api.post("/calls/availability-request", { to_identity_code: other.identity_code, kind }); show("Availability request sent", "info"); }
    } catch (e) {
      show(e instanceof ApiError ? e.message : "Could not start call.", "error");
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <StackHeader
        title={other?.display_name || "Conversation"}
        avatar={other ? <Avatar name={other.display_name} uri={other.photo_url} size={30} /> : undefined}
        right={<IconButton icon="call-outline" onPress={() => setCallSheet(true)} testID="conv-call" />}
      />
      <View style={{ paddingHorizontal: 16, paddingVertical: 8, flexDirection: "row", justifyContent: "space-between", alignItems: "center", borderBottomWidth: 1, borderBottomColor: colors.border, gap: 8 }}>
        {isHybrid ? (
          <View style={{ flexDirection: "row", gap: 6 }}>
            {(["personal", "professional"] as const).map((c) => {
              const sel = ctx === c;
              const accent = c === "personal" ? colors.personalAccent : colors.professionalAccent;
              return (
                <Pressable
                  key={c}
                  testID={`ctx-switch-${c}`}
                  onPress={() => { if (!sel) router.replace(`/conversation/${connId}/${c}`); }}
                  style={{ height: 32, paddingHorizontal: 12, borderRadius: 999, justifyContent: "center", backgroundColor: sel ? accent : colors.surfaceTertiary, borderWidth: 1, borderColor: sel ? accent : colors.border }}
                >
                  <T style={{ fontFamily: fonts.sans, fontSize: 12, fontWeight: "600", color: sel ? "#FFFFFF" : colors.textSecondary, textTransform: "capitalize" }}>{c}</T>
                </Pressable>
              );
            })}
          </View>
        ) : (
          <ContextChip context={ctx} />
        )}
        {other ? (
          <Pressable onPress={() => router.push(`/u/${other.identity_code}`)}>
            <T variant="caption" color={colors.brand}>View profile</T>
          </Pressable>
        ) : null}
      </View>
      {isHybrid ? (
        <View style={{ paddingHorizontal: 16, paddingTop: 8 }}>
          <T variant="caption" color={colors.muted}>Hybrid connection · you're in the {ctx} context</T>
        </View>
      ) : null}

      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
        {q.isLoading ? (
          <Loader />
        ) : q.isError ? (
          <ErrorView message={(q.error as ApiError)?.message} onRetry={q.refetch} />
        ) : (
          <FlatList
            data={merged}
            keyExtractor={(m) => m.id}
            contentContainerStyle={{ padding: 16, gap: 8, flexGrow: 1 }}
            ListEmptyComponent={<EmptyState icon="chatbox-outline" title="Start the conversation" body={`This is your ${ctx} conversation. Messages here stay ${ctx}.`} />}
            renderItem={({ item }) => {
              const mine = item.sender_id === user?.id;
              const isImage = item.type === "image";
              const isFile = item.type === "file";
              const att = item.attachment;
              let thumbW = 200;
              let thumbH = 200;
              if (isImage && att?.width && att?.height) {
                thumbW = 220;
                thumbH = Math.max(120, Math.min(280, Math.round((att.height / att.width) * thumbW)));
              }
              return (
                <View style={{ alignItems: mine ? "flex-end" : "flex-start" }}>
                  {isImage ? (
                    <Pressable
                      testID="attachment-image"
                      onPress={() => { if (!item._local && att?.url) setViewerUrl(att.url); }}
                      style={{ borderRadius: radius.md, overflow: "hidden" }}
                    >
                      <AuthImage url={att?.url} localUri={item._localUri} token={token} width={thumbW} height={thumbH} />
                      {item._uploading ? (
                        <View style={{ position: "absolute", inset: 0, backgroundColor: "rgba(10,12,16,0.35)", alignItems: "center", justifyContent: "center" }}>
                          <ActivityIndicator color="#FFFFFF" />
                        </View>
                      ) : null}
                    </Pressable>
                  ) : isFile ? (
                    <View style={{ maxWidth: "82%", backgroundColor: mine ? colors.brandPrimary : colors.surfaceTertiary, borderRadius: 16, borderBottomRightRadius: mine ? 4 : 16, borderBottomLeftRadius: mine ? 16 : 4, paddingHorizontal: 14, paddingVertical: 12 }}>
                      <FileCard
                        name={att?.name || "Document"}
                        size={att?.size}
                        mime={att?.mime}
                        mine={mine}
                        disabled={!!item._local}
                        onOpen={() => att?.url && openAttachment(att.url, att.name, att.mime).catch(() => show("Could not open the file.", "error"))}
                      />
                      {item._uploading ? (
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 6 }}>
                          <ActivityIndicator size="small" color={mine ? colors.onBrandPrimary : colors.textSecondary} />
                          <T style={{ fontFamily: fonts.mono, fontSize: 10, color: mine ? colors.onBrandPrimary : colors.textSecondary }}>Uploading…</T>
                        </View>
                      ) : null}
                    </View>
                  ) : (
                    <View style={{ maxWidth: "82%", backgroundColor: mine ? colors.brandPrimary : colors.surfaceTertiary, borderRadius: 16, borderBottomRightRadius: mine ? 4 : 16, borderBottomLeftRadius: mine ? 16 : 4, paddingHorizontal: 14, paddingVertical: 10 }}>
                      <T variant="body" color={mine ? colors.onBrandPrimary : colors.textPrimary}>{item.text}</T>
                    </View>
                  )}
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 }}>
                    {item._failed ? (
                      <Pressable onPress={() => retry(item)} testID="retry-message" style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
                        <Ionicons name="alert-circle" size={12} color={colors.error} />
                        <T variant="caption" color={colors.error}>Failed · Retry</T>
                      </Pressable>
                    ) : (
                      <T style={{ fontFamily: fonts.mono, fontSize: 9, color: colors.muted }}>
                        {item._uploading ? "Uploading…" : item.status === "sending" ? "Sending…" : item.status === "delivered" ? "Delivered" : "Sent"}
                      </T>
                    )}
                  </View>
                </View>
              );
            }}
          />
        )}

        <View style={{ flexDirection: "row", gap: 8, padding: 12, paddingBottom: insets.bottom + 12, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.surface, alignItems: "flex-end" }}>
          <Pressable testID="attach-button" onPress={() => setAttachSheet(true)} style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: colors.surfaceTertiary, alignItems: "center", justifyContent: "center" }}>
            <Ionicons name="add" size={24} color={colors.textSecondary} />
          </Pressable>
          <TextInput
            testID="message-input"
            value={text}
            onChangeText={setText}
            placeholder={`Message (${ctx})`}
            placeholderTextColor={colors.muted}
            multiline
            style={{ flex: 1, maxHeight: 120, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: 14, paddingVertical: 10, fontFamily: fonts.sans, fontSize: 15, color: colors.textPrimary, backgroundColor: colors.surfaceSecondary }}
          />
          <Pressable testID="send-message" disabled={!text.trim()} onPress={onSend} style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: colors.brandPrimary, alignItems: "center", justifyContent: "center", opacity: !text.trim() ? 0.5 : 1 }}>
            <Ionicons name="arrow-up" size={20} color={colors.onBrandPrimary} />
          </Pressable>
        </View>
      </KeyboardAvoidingView>

      <Sheet visible={callSheet} onClose={() => setCallSheet(false)} title="Start a call">
        <Button label="Audio call" icon="call-outline" onPress={() => startCallFlow("audio")} testID="conv-call-audio" />
        <Button label="Video call" icon="videocam-outline" variant="secondary" onPress={() => startCallFlow("video")} testID="conv-call-video" />
      </Sheet>

      <Sheet visible={attachSheet} onClose={() => setAttachSheet(false)} title="Add to conversation">
        <Button label="Camera" icon="camera-outline" onPress={() => pickImage(true)} testID="attach-camera" />
        <Button label="Photos" icon="images-outline" variant="secondary" onPress={() => pickImage(false)} testID="attach-photos" />
        <Button label="Document" icon="document-outline" variant="secondary" onPress={pickDocument} testID="attach-document" />
      </Sheet>

      <Sheet visible={!!preview} onClose={() => setPreview(null)} title="Send attachment">
        {preview?.kind === "image" ? (
          <View style={{ alignItems: "center" }}>
            <AuthImage localUri={preview.uri} token={token} width={240} height={240} style={{ borderRadius: radius.lg }} />
          </View>
        ) : preview ? (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12, padding: 14, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, backgroundColor: colors.surfaceTertiary }}>
            <Ionicons name="document-outline" size={24} color={colors.textSecondary} />
            <View style={{ flex: 1 }}>
              <T variant="label" numberOfLines={1}>{preview.name}</T>
              <T variant="caption" color={colors.muted}>{formatBytes(preview.size)}</T>
            </View>
          </View>
        ) : null}
        <Button label="Send" icon="arrow-up" onPress={confirmSend} testID="attach-send" />
        <Button label="Cancel" variant="ghost" onPress={() => setPreview(null)} testID="attach-cancel" />
      </Sheet>

      <ImageViewer url={viewerUrl} token={token} onClose={() => setViewerUrl(null)} />
    </View>
  );
}
