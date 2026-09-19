import React, { useEffect, useState } from "react";
import { View, ActivityIndicator, LogBox, Platform } from "react-native";
import { Stack, useRouter, useSegments, useRootNavigationState } from "expo-router";
import { useFonts } from "expo-font";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { StatusBar } from "expo-status-bar";
import { QueryClientProvider } from "@tanstack/react-query";
import { enableScreens } from "react-native-screens";

import { ErrorBoundary } from "@/src/components/error-boundary";
import { queryClient } from "@/src/query-client";
import { AuthProvider, useAuth } from "@/src/auth/AuthContext";
import { ToastProvider } from "@/src/components/Toast";
import { RealtimeProvider } from "@/src/realtime/RealtimeContext";
import { IncomingCallOverlay } from "@/src/components/IncomingCallOverlay";
import { themes } from "@/src/theme";

LogBox.ignoreAllLogs(true);

// On web, native screen containers (react-native-screens) can leave nested
// stack screens mounted-but-unpainted. Fall back to plain views on web only.
if (Platform.OS === "web") {
  enableScreens(false);
}

function Splash() {
  return (
    <View style={{ flex: 1, backgroundColor: themes.light.surface, alignItems: "center", justifyContent: "center" }}>
      <ActivityIndicator color={themes.light.brand} />
    </View>
  );
}

function RootNavigator() {
  const { ready, user } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const rootNavigationState = useRootNavigationState();
  const isNavigationReady = rootNavigationState?.key != null;

  useEffect(() => {
    if (!ready || !isNavigationReady) return;
    const inApp = segments[0] === "(app)";
    const inAuth = segments[0] === "(auth)";
    if (!user && (inApp || segments.length === 0)) {
      router.replace("/(auth)/welcome");
    } else if (user && (inAuth || segments.length === 0)) {
      router.replace("/(app)");
    }
  }, [ready, isNavigationReady, user, segments, router]);

  if (!ready) return <Splash />;

  return (
    <>
      <Stack screenOptions={{ headerShown: false, animation: Platform.OS === "web" ? "none" : "default", contentStyle: { backgroundColor: themes.light.surface } }}>
        <Stack.Screen name="call" options={{ presentation: "fullScreenModal", animation: "fade" }} />
      </Stack>
      <IncomingCallOverlay />
    </>
  );
}

export default function RootLayout() {
  // Load brand fonts, but never block the whole app on them: on web the font
  // asset request can intermittently stall, which previously left the app stuck
  // on the splash spinner. Text falls back to the system font until they load.
  const [loaded, error] = useFonts({
    Newsreader: require("../assets/fonts/Newsreader-Regular.ttf"),
    PlusJakartaSans: require("../assets/fonts/PlusJakartaSans.ttf"),
    JetBrainsMono: require("../assets/fonts/JetBrainsMono.ttf"),
  });

  // Give fonts a brief window on native for a clean first paint; on web (and on
  // any font error) render immediately so we can never hang on the splash.
  const [fontTimeout, setFontTimeout] = useState(Platform.OS === "web");
  useEffect(() => {
    if (loaded || error) return;
    const t = setTimeout(() => setFontTimeout(true), 1500);
    return () => clearTimeout(t);
  }, [loaded, error]);

  const canRender = loaded || !!error || fontTimeout;

  return (
    <ErrorBoundary>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaProvider>
          <KeyboardProvider>
            <QueryClientProvider client={queryClient}>
              <ToastProvider>
                <AuthProvider>
                  <RealtimeProvider>
                    <StatusBar style="dark" />
                    {canRender ? <RootNavigator /> : <Splash />}
                  </RealtimeProvider>
                </AuthProvider>
              </ToastProvider>
            </QueryClientProvider>
          </KeyboardProvider>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </ErrorBoundary>
  );
}
