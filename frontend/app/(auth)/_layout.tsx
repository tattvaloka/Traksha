import { Stack } from "expo-router";
import { Platform } from "react-native";
import { themes } from "@/src/theme";

export default function AuthLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: Platform.OS === "web" ? "none" : "default",
        contentStyle: { backgroundColor: themes.light.surface },
      }}
    />
  );
}
