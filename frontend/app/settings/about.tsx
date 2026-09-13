import React, { useState } from "react";
import { View, ScrollView, Pressable, Text } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@react-native-vector-icons/ionicons";
import { StackHeader } from "@/src/components/Header";
import { Logo } from "@/src/components/Logo";
import { T, Card, Divider } from "@/src/components/ui";
import { useTheme, space, fonts } from "@/src/theme";

/* ---------------------------------------------------------------------- */
/* Small building blocks                                                   */
/* ---------------------------------------------------------------------- */
function P({ children }: { children: React.ReactNode }) {
  const { colors } = useTheme();
  return <T variant="bodySm" color={colors.textSecondary}>{children}</T>;
}

function InlineLink({ label, onPress }: { label: string; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Text onPress={onPress} style={{ color: colors.brand, fontFamily: fonts.sans, fontSize: 13, fontWeight: "600" }}>
      {label}
    </Text>
  );
}

function Lead({ children }: { children: React.ReactNode }) {
  const { colors } = useTheme();
  return <T variant="body" color={colors.textSecondary} style={{ lineHeight: 25 }}>{children}</T>;
}

function Point({ title, children }: { title?: string; children: React.ReactNode }) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: "row", gap: 8 }}>
      <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: colors.brand, marginTop: 8 }} />
      <T variant="bodySm" color={colors.textSecondary} style={{ flex: 1 }}>
        {title ? <T variant="bodySm" color={colors.textPrimary} style={{ fontWeight: "700" }}>{title} </T> : null}
        {children}
      </T>
    </View>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <T variant="title" style={{ marginBottom: 4 }}>{children}</T>;
}

/* Progressive-depth card (visually communicates increasing depth 1..3). */
function DepthCard({ icon, title, audience, depth, defaultOpen, testID, children }: {
  icon: React.ComponentProps<typeof Ionicons>["name"];
  title: string;
  audience: string;
  depth: 1 | 2 | 3;
  defaultOpen?: boolean;
  testID?: string;
  children: React.ReactNode;
}) {
  const { colors } = useTheme();
  const [open, setOpen] = useState(!!defaultOpen);
  return (
    <Card style={{ padding: 0, overflow: "hidden" }}>
      <Pressable onPress={() => setOpen((o) => !o)} testID={testID} style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 12, padding: 16, backgroundColor: pressed ? colors.surfaceTertiary : "transparent" })}>
        <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: colors.surfaceTertiary, alignItems: "center", justifyContent: "center" }}>
          <Ionicons name={icon} size={18} color={colors.textSecondary} />
        </View>
        <View style={{ flex: 1 }}>
          <T variant="subtitle">{title}</T>
          <T variant="caption" color={colors.muted}>{audience}</T>
        </View>
        <View style={{ flexDirection: "row", gap: 3, marginRight: 6 }}>
          {[1, 2, 3].map((d) => (
            <View key={d} style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: d <= depth ? colors.brand : colors.border }} />
          ))}
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

/* FAQ accordion row (independent toggle). */
function FaqRow({ q, a, first }: { q: string; a: React.ReactNode; first?: boolean }) {
  const { colors } = useTheme();
  const [open, setOpen] = useState(false);
  return (
    <>
      {!first && <Divider />}
      <Pressable onPress={() => setOpen((o) => !o)} style={({ pressed }) => ({ paddingVertical: 14, paddingHorizontal: 16, backgroundColor: pressed ? colors.surfaceTertiary : "transparent", gap: 8 })}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <T variant="body" style={{ flex: 1, fontWeight: "600" }}>{q}</T>
          <Ionicons name={open ? "remove" : "add"} size={18} color={colors.muted} />
        </View>
        {open ? (typeof a === "string" ? <P>{a}</P> : a) : null}
      </Pressable>
    </>
  );
}

function FaqGroup({ label, items }: { label: string; items: { q: string; a: React.ReactNode }[] }) {
  const { colors } = useTheme();
  return (
    <View style={{ gap: 8 }}>
      <T variant="mono" color={colors.textSecondary}>{label.toUpperCase()}</T>
      <Card style={{ padding: 0, overflow: "hidden" }}>
        {items.map((it, i) => (
          <FaqRow key={it.q} q={it.q} a={it.a} first={i === 0} />
        ))}
      </Card>
    </View>
  );
}

/* ---------------------------------------------------------------------- */
/* Screen                                                                  */
/* ---------------------------------------------------------------------- */
export default function About() {
  const { colors } = useTheme();

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <StackHeader title="About Traksha" />
      <ScrollView contentContainerStyle={{ padding: 16, gap: space.lg, paddingBottom: 40 }}>
        {/* 01 · Introduction */}
        <View style={{ gap: 14 }}>
          <Logo size={34} />
          <Lead>
            Traksha is a civic space built by Tattvashila around a simple belief: people should be
            able to connect without surrendering control over who they are, what they share, or whom
            they trust.
          </Lead>
          <Lead>
            It was conceived as an answer to a growing problem in digital life — we have made it
            incredibly easy to connect, but not necessarily easier to know who we are connecting with,
            what we can trust, or what happens to our identity once we enter a platform.
          </Lead>
          <Lead>
            Traksha brings identity, accountability, privacy, consent and connection into one system —
            designed not simply to connect people, but to make those connections more understandable
            and responsible.
          </Lead>
          <T variant="bodySm" color={colors.muted}>Read at the depth you like.</T>
        </View>

        {/* 02 · Why Traksha Exists */}
        <View style={{ gap: 12 }}>
          <SectionTitle>Why Traksha exists</SectionTitle>

          <View style={{ gap: 6 }}>
            <T variant="label">The problem we noticed</T>
            <P>
              Connecting online has never been easier — but knowing who you’re connecting with, what
              you can trust, and what happens to your identity once you join a platform has not kept
              pace.
            </P>
          </View>

          <Card style={{ backgroundColor: colors.surfaceWarm, borderColor: colors.brand, gap: 6 }}>
            <T variant="mono" color={colors.textSecondary}>THE QUESTION THAT STARTED TRAKSHA</T>
            <T variant="subtitle" style={{ lineHeight: 26 }}>
              If digital identity is becoming more important every day, shouldn’t people have more
              control over it?
            </T>
          </Card>

          <View style={{ gap: 6 }}>
            <T variant="label">The idea behind Traksha</T>
            <P>
              Bring identity, accountability, privacy, consent and connection into one coherent system
              — designed to make connections more understandable and responsible, not simply more
              numerous.
            </P>
          </View>
          <View style={{ gap: 6 }}>
            <T variant="label">What we are trying to solve</T>
            <P>
              The gap between easy connection and informed, controlled connection — where being
              reachable doesn’t have to mean being exposed.
            </P>
          </View>
          <View style={{ gap: 6 }}>
            <T variant="label">What we believe should be different</T>
            <P>
              Identity should carry responsibility, privacy should come with control, and no connection
              should quietly turn into unlimited access.
            </P>
          </View>

          <P>
            Traksha is being built in the open. Throughout this page we separate what is a principle,
            what works today, and what is a future direction.
          </P>
        </View>

        {/* 03 · The Simple Idea (depth 1) */}
        <DepthCard icon="sunny-outline" title="The simple idea" audience="For everyone" depth={1} defaultOpen testID="about-layer-1">
          <Point>Traksha is about identity with accountability.</Point>
          <Point>Privacy should come with control, not just secrecy.</Point>
          <Point>Connection should involve consent.</Point>
          <Point>Safety should be part of the experience, not a hidden afterthought.</Point>
          <Point>A person’s identity should not automatically mean unlimited access to them.</Point>
          <Point>The product avoids social-media mechanics such as likes, followers and gamification.</Point>
        </DepthCard>

        {/* 04 · What Traksha Can Help Solve */}
        <View style={{ gap: 12 }}>
          <SectionTitle>What Traksha can help solve</SectionTitle>
          <P>These are the problems Traksha is designed to help with — not promises to remove every online risk.</P>
          <Card style={{ gap: 12 }}>
            <Point title="Unclear identity:">helping users understand who or what they are connecting with.</Point>
            <Point title="Uncontrolled visibility:">giving users clearer control over what is shared and with whom.</Point>
            <Point title="Consent ambiguity:">making connection an intentional action rather than an assumption.</Point>
            <Point title="Weak accountability:">creating a model in which identity and interaction can be treated more responsibly.</Point>
            <Point title="Overexposure:">reducing the assumption that being connected means having access to everything.</Point>
            <Point title="Fragmented trust:">bringing identity, consent, privacy and safety principles into a coherent experience.</Point>
          </Card>
        </View>

        {/* 05 · What Makes Traksha Different */}
        <View style={{ gap: 12 }}>
          <SectionTitle>What makes Traksha different</SectionTitle>
          <Card style={{ backgroundColor: colors.surfaceWarm, borderColor: colors.brand }}>
            <T variant="body" color={colors.textPrimary} style={{ lineHeight: 24 }}>
              Traksha isn’t built around collecting more about people. It’s built around giving people
              more control over what they reveal, whom they connect with, and how those connections
              remain accountable.
            </T>
          </Card>
          <Card style={{ gap: 12 }}>
            <Point title="Identity:">not merely a username; identity is treated as a meaningful part of responsible connection.</Point>
            <Point title="Consent:">a connection should not silently become unlimited access.</Point>
            <Point title="Privacy:">visibility should be understandable and controllable.</Point>
            <Point title="Accountability:">identity should have responsibility attached to it.</Point>
            <Point title="Safety:">protection should be part of the system, not an afterthought.</Point>
            <Point title="Connection:">the goal is meaningful, responsible connection — not attention, reach or engagement for its own sake.</Point>
          </Card>
        </View>

        {/* 06 · How It Actually Works (depth 2) */}
        <DepthCard icon="git-network-outline" title="How it actually works" audience="For the curious" depth={2} testID="about-layer-2">
          <Point title="Identity">establishes who is participating.</Point>
          <Point title="Visibility & privacy controls">determine what can be seen.</Point>
          <Point title="Consent">governs whether a connection or access is actually accepted.</Point>
          <Point title="Connection">represents an intentional relationship rather than passive exposure.</Point>
          <Point title="Accountability">provides a principle for responsible interaction.</Point>
          <Point title="Safety">provides mechanisms and user controls for handling unwanted or harmful interactions.</Point>
          <Divider />
          <T variant="label">Consent by design: the QR model</T>
          <P>
            Scanning a code only sends a request — the code’s owner must accept before any connection
            exists. When you scan from inside Traksha, the request can be sent directly. For someone
            who doesn’t yet have Traksha, the planned flow has them install, register, and then
            explicitly confirm Yes or No before a request is sent.
          </P>
          <P>
            This is an example of consent-by-design. For the full set of safety controls, see{" "}
            <InlineLink label="Settings → Safety" onPress={() => router.push("/settings/safety")} />.
          </P>
        </DepthCard>

        {/* 07 · Technical Transparency (depth 3) */}
        <DepthCard icon="construct-outline" title="Technical transparency" audience="For advanced readers" depth={3} testID="about-layer-3">
          <Point title="Identity model:">you begin with a provisional (TMP) identity that becomes an established (TRK) identity over time; an identity represents an accountable participant, not just a handle.</Point>
          <Point title="Permissions:">access follows your connections and settings — messaging, calling and attachments verify you are a member of that specific connection, and access ends when you remove a connection or block someone.</Point>
          <Point title="Consent events:">sending or accepting a request, and accepting a call, are consent actions. Scanning a code, sharing a link, or appearing in search do not by themselves create access.</Point>
          <Point title="Data handling:">Traksha stores the account details you provide, your profile, connections, messages and any private notes you write. Private notes are kept for you alone.</Point>
          <Point title="Security:">passwords are stored only as salted one-way hashes, never in plain text, and connections to Traksha use encrypted transport (HTTPS). We describe only protections that are implemented and imply no certifications.</Point>
          <Point title="Privacy boundaries:">private information (such as your email and notes) stays with you; profile information (name, photo, bio, badge) is what others see; connection information is shared only with people you’ve connected to.</Point>
          <Point title="System limitations:">some areas are still being developed — for example, Institutions (INS) and richer connection flows. These are labelled as future directions rather than current capabilities.</Point>
          <Point title="Versioning:">these statements describe Traksha v1.0.0.</Point>
          <T variant="caption" color={colors.muted}>Technical details describe the current system and may evolve as Traksha develops.</T>
        </DepthCard>

        {/* 08 · FAQ (separate section) */}
        <View style={{ gap: 12 }}>
          <SectionTitle>Frequently asked questions</SectionTitle>
          <P>Direct, practical answers — kept separate from the narrative above.</P>

          <FaqGroup label="About Traksha" items={[
            { q: "What is Traksha?", a: "Traksha is a civic space for connecting with real people you choose, built around identity, accountability, privacy, consent and safety rather than engagement." },
            { q: "Why was Traksha created?", a: "To give people more control over their identity and connections, at a time when it's easy to connect online but hard to know who you're connecting with or what happens to your identity." },
            { q: "Who is behind Traksha?", a: "Traksha is built by Tattvashila." },
            { q: "Is Traksha a social network?", a: "No. There are no likes, followers, reach or gamification. Connection here is intentional, not performance." },
            { q: "Is Traksha a dating app?", a: "No. Traksha is a general civic space for responsible connection, not matchmaking." },
            { q: "Is Traksha a messaging platform?", a: "Messaging exists to support real, consented connections — it isn't the whole product." },
          ]} />

          <FaqGroup label="Identity" items={[
            { q: "What is a Traksha identity?", a: "It represents who is participating. You begin with a provisional (TMP) identity, which becomes an established (TRK) identity over time." },
            { q: "Why do I need an identity?", a: "Identity is what makes connection accountable — a meaningful part of connecting responsibly, not just a username." },
            { q: "Can I control what other people see?", a: "Yes. Others see your public profile (name, photo, bio, badge); sensitive details like your email stay private. Discoverability and who can send requests are yours to control." },
            { q: "Can I change my information?", a: "Yes — from Edit profile at any time." },
          ]} />

          <FaqGroup label="Privacy & consent" items={[
            { q: "What information does Traksha collect?", a: "The account details you provide (like email and profile) and the connections and messages you create. See Technical transparency for how this is handled." },
            { q: "Who can see my information?", a: "Only your public profile is visible to others. Private details and your personal notes are visible only to you." },
            { q: "What does consent mean in Traksha?", a: "A connection only exists when both people agree. Scanning a code, sharing a link or being found in search only sends a request — it never creates a connection on its own." },
            { q: "Can I revoke access?", a: "Yes. Removing a connection or blocking someone ends messaging and calling between you." },
          ]} />

          <FaqGroup label="Safety & accountability" items={[
            { q: "How does Traksha help keep people safe?", a: (<P>Safety is part of the product: consent on every connection, blocking, reporting and privacy controls. For the full toolkit, see <InlineLink label="Settings → Safety" onPress={() => router.push("/settings/safety")} />.</P>) },
            { q: "What happens if someone behaves improperly?", a: "You can block them immediately and report them confidentially. Reports are reviewed by the Traksha team." },
            { q: "Can someone block me?", a: "Yes — just as you can block anyone. Blocking removes the connection and stops all interaction." },
            { q: "What happens when I report something?", a: "Your report is confidential and reviewed. To stop someone right away, block them." },
          ]} />

          <FaqGroup label="Connections" items={[
            { q: "How do connections work?", a: "You send a request; the other person accepts or declines. A single connection can be personal, professional, or both (hybrid) with separate conversations." },
            { q: "Can I connect with someone without giving them full access?", a: "Yes. Being connected doesn't mean unlimited access — context and your privacy settings shape what's shared." },
            { q: "What happens when a connection ends?", a: "Messaging and calling stop, and any private note you kept on that connection is removed." },
            { q: "What happens when I scan someone's Traksha QR?", a: "Scanning only sends a connection request. The code's owner must accept before any connection is created." },
          ]} />

          <FaqGroup label="Technology" items={[
            { q: "Where is my data stored?", a: "Your account and connection data are kept in Traksha's managed database. Traksha doesn't sell your data." },
            { q: "Is my information encrypted?", a: "Your password is stored only as a salted one-way hash, never in plain text, and connections to Traksha use encrypted transport (HTTPS). Broader encryption work continues as Traksha develops." },
            { q: "Does Traksha use AI?", a: "Traksha's core experience doesn't rely on AI to decide who you connect with or to profile you." },
            { q: "Can Traksha see private information?", a: "Your private notes are yours alone and are never shown to other users. Running the service means some data is processed to deliver it." },
          ]} />

          <FaqGroup label="The future" items={[
            { q: "Is Traksha free?", a: "Traksha is available to use while it's being built. Pricing is a future direction and isn't finalized." },
            { q: "Is Traksha open to everyone?", a: "Anyone can create a provisional identity and begin participating today." },
            { q: "What is still being developed?", a: "Institutions (INS) are coming soon, and richer connection flows are planned. We label future directions honestly rather than presenting them as current features." },
          ]} />
        </View>

        {/* 09 · Closing principles */}
        <Card style={{ gap: 8 }}>
          <T variant="label">Closing thought</T>
          <P>
            Traksha is still being built. The aim is not to create another place where people simply
            connect, but to explore what connection can look like when identity, privacy, consent and
            accountability are treated as part of the foundation.
          </P>
        </Card>

        <T variant="caption" color={colors.muted} style={{ textAlign: "center" }}>Traksha · v1.0.0</T>
      </ScrollView>
    </View>
  );
}
