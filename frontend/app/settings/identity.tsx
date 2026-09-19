import React from "react";
import { View, ScrollView } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@react-native-vector-icons/ionicons";
import { useQuery, useMutation } from "@tanstack/react-query";
import { StackHeader } from "@/src/components/Header";
import { T, Card, Loader, Button, Divider } from "@/src/components/ui";
import { api } from "@/src/api/client";
import { useAuth } from "@/src/auth/AuthContext";
import { queryClient } from "@/src/query-client";
import { useToast } from "@/src/components/Toast";
import { useTheme, fonts, radius, space, ThemeColors } from "@/src/theme";

// ---------------------------------------------------------------------------
// TMP — provisional identity. Restrained, warm, "in progress" treatment.
// ---------------------------------------------------------------------------
function ProvisionalCard({ d, colors }: { d: any; colors: ThemeColors }) {
  const total = d.journey_length || 45;
  const day = Math.max(0, Math.min(d.day_of_journey || 0, total));
  const pct = Math.max(0.04, Math.min(day / total, 1));
  return (
    <View
      style={{
        backgroundColor: colors.tmpBg,
        borderWidth: 1,
        borderColor: colors.tmpBorder,
        borderRadius: radius.lg,
        padding: space.md,
        gap: 14,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <Ionicons name="hourglass-outline" size={15} color={colors.tmpText} />
        <T style={{ fontFamily: fonts.sans, fontSize: 12, fontWeight: "700", letterSpacing: 0.8, color: colors.tmpText }}>
          PROVISIONAL IDENTITY
        </T>
      </View>

      <View style={{ gap: 4 }}>
        <T style={{ fontFamily: fonts.mono, fontSize: 20, letterSpacing: 1, color: colors.tmpText }} testID="identity-code">
          TMP-{d.identity_code}
        </T>
        <T variant="bodySm" color={colors.textSecondary}>
          A provisional identity. Active and accountable, but not yet established.
        </T>
      </View>

      <View style={{ gap: 6 }}>
        <T variant="label" color={colors.tmpText}>Provisional period · Day {day} of {total}</T>
        <View style={{ height: 4, borderRadius: 2, backgroundColor: colors.borderStrong, overflow: "hidden" }}>
          <View style={{ width: `${pct * 100}%`, height: 4, backgroundColor: colors.tmpText }} />
        </View>
        <T variant="caption" color={colors.muted}>{Math.max(total - day, 0)} days until your identity is established</T>
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// TRK — established identity. Stronger hierarchy, sealed status, authority.
// ---------------------------------------------------------------------------
function EstablishedCard({ d, colors, establishedAt }: { d: any; colors: ThemeColors; establishedAt?: string }) {
  return (
    <View
      style={{
        backgroundColor: colors.surfaceSecondary,
        borderWidth: 1.5,
        borderColor: colors.trkBorder,
        borderRadius: radius.lg,
        overflow: "hidden",
      }}
    >
      {/* Status strip communicates established authority at a glance */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 8,
          backgroundColor: colors.trkBg,
          borderBottomWidth: 1,
          borderBottomColor: colors.trkBorder,
          paddingHorizontal: space.md,
          paddingVertical: 10,
        }}
      >
        <Ionicons name="shield-checkmark" size={16} color={colors.trkText} />
        <T style={{ fontFamily: fonts.sans, fontSize: 12, fontWeight: "700", letterSpacing: 0.8, color: colors.trkText }}>
          ESTABLISHED IDENTITY
        </T>
      </View>

      <View style={{ padding: space.lg, gap: 12 }}>
        <T variant="display" style={{ letterSpacing: -0.2 }}>Established member</T>
        <View style={{ gap: 4 }}>
          <T style={{ fontFamily: fonts.mono, fontSize: 22, letterSpacing: 1.5, color: colors.trkText }} testID="identity-code">
            TRK-{d.identity_code}
          </T>
          <T variant="bodySm" color={colors.textSecondary}>
            Your identity is established and fully accountable. Your earlier TMP history remains attributed to you.
          </T>
        </View>

        <View style={{ height: 1, backgroundColor: colors.divider }} />

        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Ionicons name="checkmark-circle" size={16} color={colors.success} />
          <T variant="label" color={colors.textPrimary}>Transition complete</T>
          {establishedAt ? (
            <T style={{ fontFamily: fonts.mono, fontSize: 11, color: colors.muted }}>
              · {new Date(establishedAt).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })}
            </T>
          ) : null}
        </View>
      </View>
    </View>
  );
}

export default function Identity() {
  const { colors } = useTheme();
  const { refresh } = useAuth();
  const { show } = useToast();
  const id = useQuery({ queryKey: ["identity"], queryFn: () => api.get("/identity/me") });

  const simulate = useMutation({
    mutationFn: () => api.post("/dev/simulate-transition"),
    onSuccess: async () => {
      await refresh();
      queryClient.invalidateQueries();
      show("Transition ready — view your ceremony", "success");
      id.refetch();
      router.push("/transition");
    },
    onError: () => show("Could not simulate transition.", "error"),
  });

  if (id.isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.surface }}>
        <StackHeader title="Identity" />
        <Loader />
      </View>
    );
  }
  const d = id.data;
  const isTMP = d.identity_type === "TMP";
  const establishedAt = (d.history || []).find((e: any) => e.type !== "TMP_CREATED")?.occurred_at;

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <StackHeader title="Identity" />
      <ScrollView contentContainerStyle={{ padding: 16, gap: space.md, paddingBottom: 40 }}>
        {/* 1 — Current identity state (visually distinct for TMP vs TRK) */}
        {isTMP ? (
          <ProvisionalCard d={d} colors={colors} />
        ) : (
          <EstablishedCard d={d} colors={colors} establishedAt={establishedAt} />
        )}

        {isTMP ? (
          <Card style={{ backgroundColor: colors.surfaceWarm, borderColor: colors.tmpBorder, gap: 6 }}>
            <T variant="label" color={colors.tmpText}>What happens on day {d.journey_length || 45}</T>
            <T variant="bodySm" color={colors.textSecondary}>
              At 00:00 UTC your identity becomes TRK automatically — whether you’re online or not. Your history is preserved
              and stays attributed to you.
            </T>
          </Card>
        ) : null}

        {/* Identity lifecycle / history — TMP → TRK progression */}
        <Card style={{ gap: 10 }}>
          <T variant="subtitle">Identity history</T>
          {(d.history || []).map((e: any, i: number) => (
            <View key={i}>
              {i > 0 && <Divider />}
              <View style={{ paddingVertical: 8, flexDirection: "row", alignItems: "center", gap: 10 }}>
                <Ionicons
                  name={e.type === "TMP_CREATED" ? "hourglass-outline" : "shield-checkmark-outline"}
                  size={16}
                  color={e.type === "TMP_CREATED" ? colors.tmpText : colors.trkText}
                />
                <View style={{ flex: 1, gap: 3 }}>
                  <T variant="label">{e.type === "TMP_CREATED" ? "Provisional identity created" : "Established as TRK"}</T>
                  <T style={{ fontFamily: fonts.mono, fontSize: 11, color: colors.muted }}>
                    {e.trk_code || e.tmp_code} · {e.occurred_at ? new Date(e.occurred_at).toLocaleDateString() : ""}
                  </T>
                </View>
              </View>
            </View>
          ))}
        </Card>

        {/* 2 — Institutional registration (begins a verification flow) */}
        <Card style={{ gap: 12 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: colors.insBg, borderWidth: 1, borderColor: colors.insBorder, alignItems: "center", justifyContent: "center" }}>
              <Ionicons name="business-outline" size={18} color={colors.insText} />
            </View>
            <View style={{ flex: 1 }}>
              <T variant="label">Institutions</T>
              <T variant="bodySm" color={colors.textSecondary}>Verified organizations, separate from your personal identity.</T>
            </View>
          </View>
          <Button
            label="Register an Institution (INS)"
            variant="secondary"
            icon="add-circle-outline"
            onPress={() => router.push("/settings/register-institution")}
            testID="register-institution"
          />
        </Card>

        {/* 3 — Developer tool (testing only) — kept at the very bottom */}
        {isTMP ? (
          <View style={{ marginTop: space.md, gap: 8 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Ionicons name="construct-outline" size={13} color={colors.muted} />
              <T variant="caption" color={colors.muted}>DEVELOPER TOOL · TESTING ONLY</T>
            </View>
            <Card style={{ gap: 10 }}>
              <T variant="bodySm" color={colors.textSecondary}>
                Simulate the Day-{d.journey_length || 45} transition now to preview the ceremony. For testing only.
              </T>
              <Button
                label="Simulate transition"
                icon="flash-outline"
                variant="ghost"
                onPress={() => simulate.mutate()}
                loading={simulate.isPending}
                full={false}
                testID="simulate-transition"
              />
            </Card>
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}
