import React, { useEffect, useState } from "react";
import { View, ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import QRCode from "react-native-qrcode-svg";
import { useMutation } from "@tanstack/react-query";
import { StackHeader } from "@/src/components/Header";
import { T, Card, Button, Loader, Avatar, IdentityBadge } from "@/src/components/ui";
import { LogoMark } from "@/src/components/Logo";
import { api } from "@/src/api/client";
import { useAuth } from "@/src/auth/AuthContext";
import { useToast } from "@/src/components/Toast";
import { useTheme, fonts, space } from "@/src/theme";

export default function QRScreen() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { user } = useAuth();
  const { show } = useToast();
  const [session, setSession] = useState<{ token: string; expires_at: string } | null>(null);
  const [remaining, setRemaining] = useState(0);

  const create = useMutation({
    mutationFn: () => api.post<{ token: string; expires_at: string }>("/qr/create"),
    onSuccess: (s) => setSession(s),
    onError: () => show("Could not generate a code.", "error"),
  });
  const revoke = useMutation({
    mutationFn: () => api.post("/qr/revoke"),
    onSuccess: () => { setSession(null); show("Code revoked", "info"); },
  });

  useEffect(() => { create.mutate(); }, []); // eslint-disable-line

  useEffect(() => {
    if (!session) return;
    const tick = () => {
      const ms = new Date(session.expires_at).getTime() - Date.now();
      setRemaining(Math.max(0, Math.floor(ms / 1000)));
    };
    tick();
    const iv = setInterval(tick, 1000);
    return () => clearInterval(iv);
  }, [session]);

  const expired = session && remaining <= 0;
  const mmss = `${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, "0")}`;

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <StackHeader title="Connection QR" />
      <ScrollView contentContainerStyle={{ padding: 16, gap: space.md, paddingBottom: insets.bottom + 24 }}>
        {user ? (
          <Card testID="qr-identity-preview" style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <Avatar name={user.display_name} uri={user.photo_url} size={52} />
            <View style={{ flex: 1, gap: 6 }}>
              <T variant="subtitle" numberOfLines={1}>{user.display_name}</T>
              <IdentityBadge type={user.identity_type} code={user.identity_code} />
            </View>
          </Card>
        ) : null}

        <Card style={{ alignItems: "center", gap: 16, paddingVertical: 28 }}>
          {create.isPending && !session ? (
            <Loader />
          ) : session && !expired ? (
            <>
              <View testID="my-qr-code" style={{ padding: 12, backgroundColor: "#FFFFFF", borderRadius: 16 }}>
                <QRCode
                  value={`traksha:${session.token}`}
                  size={216}
                  color="#17191E"
                  backgroundColor="#FFFFFF"
                  logo={LogoMark}
                  logoSize={46}
                  logoBackgroundColor="transparent"
                  quietZone={8}
                  ecl="H"
                />
              </View>
              <View style={{ alignItems: "center", gap: 4 }}>
                <T variant="bodySm" color={colors.textSecondary}>Valid for</T>
                <T style={{ fontFamily: fonts.mono, fontSize: 22, color: colors.textPrimary }}>{mmss}</T>
              </View>
            </>
          ) : (
            <View style={{ alignItems: "center", gap: 12, paddingVertical: 20 }}>
              <T variant="subtitle">This code has expired</T>
              <T variant="bodySm" color={colors.textSecondary} style={{ textAlign: "center" }}>Codes last 5 minutes for your safety. Generate a fresh one.</T>
            </View>
          )}
        </Card>

        <T variant="bodySm" color={colors.textSecondary} style={{ textAlign: "center" }}>
          Someone scans this to send you a request. Scanning never connects you — you always accept first.
        </T>

        <View style={{ gap: 10 }}>
          <Button label={expired ? "Generate new code" : "Refresh code"} icon="refresh" onPress={() => create.mutate()} loading={create.isPending} testID="refresh-qr" />
          {session && !expired ? <Button label="Revoke" variant="secondary" onPress={() => revoke.mutate()} testID="revoke-qr" /> : null}
          <Button label="Scan a code" icon="scan-outline" variant="secondary" onPress={() => router.push("/scanner")} testID="open-scanner" />
        </View>
      </ScrollView>
    </View>
  );
}
