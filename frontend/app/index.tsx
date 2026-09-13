import { View, ActivityIndicator } from "react-native";
import { themes } from "@/src/theme";

// Redirect is handled by RootNavigator in app/_layout.tsx.
export default function Index() {
  return (
    <View style={{ flex: 1, backgroundColor: themes.light.surface, alignItems: "center", justifyContent: "center" }}>
      <ActivityIndicator color={themes.light.brand} />
    </View>
  );
}
