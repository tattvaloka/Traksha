import { Stack } from "expo-router";
import { themes } from "@/src/theme";

export default function AuthLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: themes.light.surface },
      }}
    />
  );
}
