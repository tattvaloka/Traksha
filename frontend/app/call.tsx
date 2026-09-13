import React, { useEffect, useState } from "react";
import { View, Pressable, Text } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Ionicons } from "@react-native-vector-icons/ionicons";
import { Avatar } from "@/src/components/ui";
import { useRealtime } from "@/src/realtime/RealtimeContext";
import { fonts } from "@/src/theme";

const DARK = "#17191E";
const LIGHT = "#F2F1EC";
const MUTED = "#9BA0A8";

export default function CallScreen() {
  const insets = useSafeAreaInsets();
  const { activeCall, endCall } = useRealtime();
  const [seconds, setSeconds] = useState(0);
  const [muted, setMuted] = useState(false);
  const [cameraOff, setCameraOff] = useState(false);

  useEffect(() => {
    if (!activeCall) {
      router.back();
    }
  }, [activeCall]);

  useEffect(() => {
    if (activeCall?.state !== "active") return;
    const iv = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(iv);
  }, [activeCall?.state]);

  if (!activeCall) return <View style={{ flex: 1, backgroundColor: DARK }} />;

  const statusLabel =
    activeCall.state === "outgoing"
      ? "Calling…"
      : activeCall.state === "connecting"
        ? "Connecting…"
        : activeCall.state === "ended"
          ? "Call ended"
          : `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;

  return (
    <View style={{ flex: 1, backgroundColor: DARK, paddingTop: insets.top + 24, paddingBottom: insets.bottom + 32, alignItems: "center", justifyContent: "space-between" }}>
      <View style={{ alignItems: "center", gap: 16, marginTop: 40 }}>
        <Avatar name={activeCall.peerName} size={120} />
        <Text style={{ fontFamily: fonts.serif, fontSize: 26, color: LIGHT }}>{activeCall.peerName}</Text>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Ionicons name={activeCall.kind === "video" ? "videocam" : "call"} size={16} color={MUTED} />
          <Text style={{ fontFamily: fonts.mono, fontSize: 13, color: MUTED, textTransform: "capitalize" }}>
            {activeCall.kind} call · {statusLabel}
          </Text>
        </View>
        {activeCall.kind === "video" && !cameraOff ? (
          <Text style={{ fontFamily: fonts.mono, fontSize: 12, color: MUTED, marginTop: 8 }}>
            Live video runs on the mobile build
          </Text>
        ) : null}
      </View>

      <View style={{ flexDirection: "row", gap: 20, alignItems: "center" }}>
        <RoundBtn icon={muted ? "mic-off" : "mic"} active={muted} onPress={() => setMuted((m) => !m)} testID="call-mute" />
        {activeCall.kind === "video" && (
          <RoundBtn icon={cameraOff ? "videocam-off" : "videocam"} active={cameraOff} onPress={() => setCameraOff((c) => !c)} testID="call-camera" />
        )}
        <Pressable onPress={endCall} testID="call-end" style={{ width: 68, height: 68, borderRadius: 34, backgroundColor: "#993C3C", alignItems: "center", justifyContent: "center" }}>
          <Ionicons name="call" size={28} color="#FFFFFF" style={{ transform: [{ rotate: "135deg" }] }} />
        </Pressable>
      </View>
    </View>
  );
}

function RoundBtn({ icon, active, onPress, testID }: any) {
  return (
    <Pressable onPress={onPress} testID={testID} style={{ width: 60, height: 60, borderRadius: 30, backgroundColor: active ? LIGHT : "rgba(242,241,236,0.15)", alignItems: "center", justifyContent: "center" }}>
      <Ionicons name={icon} size={24} color={active ? DARK : LIGHT} />
    </Pressable>
  );
}
