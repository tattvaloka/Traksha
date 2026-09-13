import React, { useState } from "react";
import { View, ScrollView, Pressable } from "react-native";
import { Ionicons } from "@react-native-vector-icons/ionicons";
import { StackHeader } from "@/src/components/Header";
import { Logo } from "@/src/components/Logo";
import { T, Card, Divider } from "@/src/components/ui";
import { useTheme, space } from "@/src/theme";

function Layer({ icon, title, subtitle, defaultOpen, testID, children }: {
  icon: React.ComponentProps<typeof Ionicons>["name"];
  title: string;
  subtitle: string;
  defaultOpen?: boolean;
  testID?: string;
  children: React.ReactNode;
}) {
  const { colors } = useTheme();
  const [open, setOpen] = useState(!!defaultOpen);
  return (
    <Card style={{ padding: 0, overflow: "hidden" }}>
      <Pressable onPress={() => setOpen((o) => !o)} testID={testID} style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 12, padding: 16, backgroundColor: pressed ? colors.surfaceTertiary : "transparent" })}>
        <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: colors.surfaceTertiary, alignItems: "center", justifyContent: "center" }}>
          <Ionicons name={icon} size={18} color={colors.textSecondary} />
        </View>
        <View style={{ flex: 1 }}>
          <T variant="subtitle">{title}</T>
          <T variant="caption" color={colors.muted}>{subtitle}</T>
        </View>
        <Ionicons name={open ? "chevron-up" : "chevron-down"} size={18} color={colors.muted} />
      </Pressable>
      {open ? (
        <>
          <Divider />
          <View style={{ padding: 16, gap: 12 }}>{children}</View>
        </>
      ) : null}
    </Card>
  );
}

function P({ children }: { children: React.ReactNode }) {
  const { colors } = useTheme();
  return <T variant="bodySm" color={colors.textSecondary}>{children}</T>;
}

function Point({ children }: { children: React.ReactNode }) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: "row", gap: 8 }}>
      <T variant="bodySm" color={colors.textSecondary}>•</T>
      <T variant="bodySm" color={colors.textSecondary} style={{ flex: 1 }}>{children}</T>
    </View>
  );
}

export default function About() {
  const { colors } = useTheme();
  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <StackHeader title="About Traksha" />
      <ScrollView contentContainerStyle={{ padding: 16, gap: space.md, paddingBottom: 32 }}>
        <Logo size={34} />
        <T variant="body" color={colors.textSecondary}>
          Traksha is a civic space built by Tattvashila around identity with accountability, privacy
          with control, and connection with consent. Read at the depth you like.
        </T>

        <Layer icon="sunny-outline" title="The simple idea" subtitle="For everyone" defaultOpen testID="about-layer-1">
          <P>
            Traksha is a calm place to connect with real people you choose. There are no likes, no
            follower counts and no streaks — nothing designed to keep you scrolling.
          </P>
          <Point>You decide who you connect with. Every connection needs both people to agree.</Point>
          <Point>You are always in control of your information and can step back at any time.</Point>
          <Point>Your identity carries accountability, like acting in a public square.</Point>
          <P>
            You start with a provisional (TMP) identity so you can participate right away. Over time it
            becomes an established (TRK) identity as trust is built deliberately.
          </P>
        </Layer>

        <Layer icon="book-outline" title="How it actually works" subtitle="For the curious" testID="about-layer-2">
          <P><T variant="label">Connections & consent.</T> Scanning a QR code, sharing a link, or finding someone in search never creates a relationship on its own. It only sends a request — the other person accepts or declines.</P>
          <P><T variant="label">Personal, professional & hybrid.</T> A single connection can carry a personal context, a professional one, or both (hybrid) with separate conversations — without creating duplicate identities.</P>
          <P><T variant="label">What's shared.</T> Others see your public profile: name, photo, bio and identity badge. Sensitive details like your email stay private to you.</P>
          <P><T variant="label">Temporary QR.</T> Your connection QR is short-lived and can be revoked. It carries a temporary token, not your permanent identity, so an old screenshot can't be reused.</P>
          <P><T variant="label">Private notes.</T> Notes you keep on a connection are visible only to you — never to the other person.</P>
          <P><T variant="label">Blocking & reporting.</T> Blocking removes a connection and stops all interaction. Reports are confidential.</P>
        </Layer>

        <Layer icon="construct-outline" title="Technical transparency" subtitle="For advanced readers" testID="about-layer-3">
          <P><T variant="label">Authentication.</T> Sessions use signed, expiring bearer tokens. Passwords are stored only as salted one-way hashes — never in plain text.</P>
          <P><T variant="label">Authorization.</T> Every request is checked against your identity, and messaging, calling and attachments additionally verify you are a member of the specific connection.</P>
          <P><T variant="label">Data isolation.</T> Conversations are partitioned per connection and per context. Private notes are keyed to the writer, so they are never returned to anyone else.</P>
          <P><T variant="label">Connection tokens.</T> QR/remote sessions issue short-lived, single-purpose tokens that expire and can be revoked, and are distinct from your long-lived identity code.</P>
          <P><T variant="label">Messaging.</T> Messages are delivered in real time over an authenticated channel, with offline delivery falling back to notifications. Attachments are served only to authorized connection members.</P>
          <P><T variant="label">Privacy boundaries.</T> Discoverability and connection-request permissions are enforced server-side, not just hidden in the interface.</P>
          <P>This is a conceptual overview for transparency. It intentionally omits secrets, credentials and any implementation detail that could weaken security.</P>
        </Layer>

        <T variant="caption" color={colors.muted}>Traksha · v1.0.0</T>
      </ScrollView>
    </View>
  );
}
