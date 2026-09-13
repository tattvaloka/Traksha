import React from "react";
import { View, ScrollView } from "react-native";
import { router } from "expo-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import { StackHeader } from "@/src/components/Header";
import { T, Card, Loader, IdentityBadge, Button, Divider } from "@/src/components/ui";
import { api } from "@/src/api/client";
import { useAuth } from "@/src/auth/AuthContext";
import { queryClient } from "@/src/query-client";
import { useToast } from "@/src/components/Toast";
import { useTheme, fonts, space } from "@/src/theme";

export default function Identity() {
  const { colors } = useTheme();
  const { refresh } = useAuth();
  const { show } = useToast();
  const id = useQuery({ queryKey: ["identity"], queryFn: () => api.get("/identity/me") });

  const simulate = useMutation({
    mutationFn: () => api.post("/dev/simulate-transition"),
    onSuccess: async () => { await refresh(); queryClient.invalidateQueries(); show("Transition ready — view your ceremony", "success"); id.refetch(); router.push("/transition"); },
    onError: () => show("Could not simulate transition.", "error"),
  });

  if (id.isLoading) return <View style={{ flex: 1, backgroundColor: colors.surface }}><StackHeader title="Identity" /><Loader /></View>;
  const d = id.data;

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <StackHeader title="Identity" />
      <ScrollView contentContainerStyle={{ padding: 16, gap: space.md, paddingBottom: 32 }}>
        <Card style={{ gap: 12 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <IdentityBadge type={d.identity_type} code={d.identity_code} />
            {d.identity_type === "TMP" ? <T style={{ fontFamily: fonts.mono, fontSize: 12, color: colors.tmpText }}>Day {d.day_of_journey} of {d.journey_length}</T> : null}
          </View>
          {d.identity_type === "TMP" ? (
            <T variant="bodySm" color={colors.textSecondary}>
              Your identity becomes TRK automatically on day {d.journey_length} — at 00:00 UTC — whether you’re online or not. Your history is preserved.
            </T>
          ) : (
            <T variant="bodySm" color={colors.textSecondary}>Your identity is established and accountable. Your earlier TMP history remains attributed to you.</T>
          )}
        </Card>

        <Card style={{ gap: 10 }}>
          <T variant="subtitle">History</T>
          {d.history.map((e: any, i: number) => (
            <View key={i}>
              {i > 0 && <Divider />}
              <View style={{ paddingVertical: 8, gap: 3 }}>
                <T variant="label">{e.type === "TMP_CREATED" ? "Provisional identity created" : "Established as TRK"}</T>
                <T style={{ fontFamily: fonts.mono, fontSize: 11, color: colors.muted }}>
                  {e.trk_code || e.tmp_code} · {e.occurred_at ? new Date(e.occurred_at).toLocaleDateString() : ""}
                </T>
              </View>
            </View>
          ))}
        </Card>

        {d.identity_type === "TMP" ? (
          <Card style={{ backgroundColor: colors.surfaceWarm, gap: 10 }}>
            <T variant="label">Developer tool</T>
            <T variant="bodySm" color={colors.textSecondary}>Simulate the Day-45 transition now to preview the ceremony. This is for testing.</T>
            <Button label="Simulate transition" icon="flash-outline" variant="secondary" onPress={() => simulate.mutate()} loading={simulate.isPending} testID="simulate-transition" />
          </Card>
        ) : null}
      </ScrollView>
    </View>
  );
}
