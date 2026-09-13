import React from "react";
import { View, Text, Modal } from "react-native";
import { Ionicons } from "@react-native-vector-icons/ionicons";
import { useRealtime } from "@/src/realtime/RealtimeContext";
import { useTheme, fonts } from "@/src/theme";
import { Button, Avatar } from "@/src/components/ui";

export function IncomingCallOverlay() {
  const { incomingCall, acceptIncoming, declineIncoming } = useRealtime();
  const { colors } = useTheme();
  if (!incomingCall) return null;

  return (
    <Modal transparent animationType="fade" visible>
      <View
        style={{
          flex: 1,
          backgroundColor: "rgba(23,25,30,0.75)",
          alignItems: "center",
          justifyContent: "center",
          padding: 24,
        }}
      >
        <View
          testID="incoming-call-overlay"
          style={{
            width: "100%",
            maxWidth: 360,
            backgroundColor: colors.surfaceSecondary,
            borderRadius: 24,
            padding: 28,
            alignItems: "center",
            gap: 16,
          }}
        >
          <Avatar name={incomingCall.fromName} size={72} />
          <View style={{ alignItems: "center", gap: 4 }}>
            <Text style={{ fontFamily: fonts.serif, fontSize: 22, color: colors.textPrimary }}>
              {incomingCall.fromName}
            </Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Ionicons
                name={incomingCall.kind === "video" ? "videocam" : "call"}
                size={14}
                color={colors.textSecondary}
              />
              <Text style={{ fontFamily: fonts.sans, fontSize: 14, color: colors.textSecondary }}>
                Incoming {incomingCall.kind} call
              </Text>
            </View>
          </View>
          <View style={{ flexDirection: "row", gap: 12, width: "100%", marginTop: 8 }}>
            <View style={{ flex: 1 }}>
              <Button label="Decline" variant="destructive" onPress={declineIncoming} testID="decline-call" />
            </View>
            <View style={{ flex: 1 }}>
              <Button label="Accept" onPress={acceptIncoming} testID="accept-call" />
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}
