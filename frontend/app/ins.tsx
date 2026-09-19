import React from "react";
import { View, ScrollView, RefreshControl } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@react-native-vector-icons/ionicons";
import { useQuery } from "@tanstack/react-query";
import { StackHeader } from "@/src/components/Header";
import { T, Card, Button, Loader, ErrorView, EmptyState, SectionLabel } from "@/src/components/ui";
import { api } from "@/src/api/client";
import { useTheme, space, radius } from "@/src/theme";
import { STATUS_META } from "@/src/ins/perms";

export default function InstitutionsList() {
  const { colors } = useTheme();
  const q = useQuery({ queryKey: ["ins", "mine"], queryFn: () => api.get("/ins/mine") });
  const items = q.data?.institutions ?? [];

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <StackHeader
        title="Institutions"
        right={
          <Ionicons
            name="shield-outline"
            size={20}
            color={colors.muted}
            onPress={() => router.push("/ins/admin")}
            testID="ins-admin-entry"
          />
        }
      />
      {q.isLoading ? (
        <Loader />
      ) : q.isError ? (
        <ErrorView onRetry={() => q.refetch()} />
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: 16, gap: space.md, paddingBottom: 48 }}
          refreshControl={<RefreshControl refreshing={q.isFetching} onRefresh={() => q.refetch()} tintColor={colors.brand} />}
        >
          <Card style={{ gap: 12 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.insBg, borderWidth: 1, borderColor: colors.insBorder, alignItems: "center", justifyContent: "center" }}>
                <Ionicons name="business-outline" size={20} color={colors.insText} />
              </View>
              <View style={{ flex: 1 }}>
                <T variant="subtitle">Your institutions</T>
                <T variant="bodySm" color={colors.textSecondary}>Institutions you own or are authorised to act for.</T>
              </View>
            </View>
            <Button
              label="Register an Institution"
              variant="secondary"
              icon="add-circle-outline"
              onPress={() => router.push("/settings/register-institution")}
              testID="ins-register-cta"
            />
          </Card>

          {items.length === 0 ? (
            <EmptyState
              icon="business-outline"
              title="No institutions yet"
              body="Register an institution to begin verification. Institutions are separate from your personal identity."
            />
          ) : (
            <View style={{ gap: 10 }}>
              <SectionLabel>Relationships</SectionLabel>
              {items.map((ins: any) => {
                const meta = STATUS_META[ins.status] || STATUS_META.pending;
                const tone =
                  meta.tone === "approved" ? colors.success : meta.tone === "rejected" ? colors.error : colors.warning;
                return (
                  <Card key={ins.id} onPress={() => router.push(`/ins/${ins.id}`)} testID={`ins-item-${ins.id}`} style={{ gap: 10 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                      <View style={{ width: 44, height: 44, borderRadius: radius.md, backgroundColor: colors.insBg, borderWidth: 1, borderColor: colors.insBorder, alignItems: "center", justifyContent: "center" }}>
                        <Ionicons name="business" size={20} color={colors.insText} />
                      </View>
                      <View style={{ flex: 1, gap: 3 }}>
                        <T variant="label" numberOfLines={1}>{ins.name}</T>
                        {ins.category ? <T variant="bodySm" color={colors.textSecondary} numberOfLines={1}>{ins.category}</T> : null}
                      </View>
                      <Ionicons name="chevron-forward" size={18} color={colors.muted} />
                    </View>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: colors.surfaceTertiary, borderRadius: radius.full, paddingHorizontal: 10, paddingVertical: 4 }}>
                        <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: tone }} />
                        <T variant="caption" color={colors.textSecondary}>{meta.label}</T>
                      </View>
                      {ins.is_owner ? (
                        <View style={{ backgroundColor: colors.trkBg, borderColor: colors.trkBorder, borderWidth: 1, borderRadius: radius.full, paddingHorizontal: 10, paddingVertical: 4 }}>
                          <T variant="caption" color={colors.trkText}>Owner</T>
                        </View>
                      ) : ins.my_relationship === "member" ? (
                        <View style={{ backgroundColor: colors.surfaceTertiary, borderRadius: radius.full, paddingHorizontal: 10, paddingVertical: 4 }}>
                          <T variant="caption" color={colors.textSecondary}>Member</T>
                        </View>
                      ) : null}
                    </View>
                  </Card>
                );
              })}
            </View>
          )}
        </ScrollView>
      )}
    </View>
  );
}
