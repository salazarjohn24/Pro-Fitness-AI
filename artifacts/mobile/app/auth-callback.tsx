import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useRef } from "react";
import { ActivityIndicator, Text, View } from "react-native";

import { Colors } from "@/constants/colors";
import { useAuth } from "@/lib/auth";

export default function AuthCallbackScreen() {
  const { token, error } = useLocalSearchParams<{ token?: string; error?: string }>();
  const { signin } = useAuth();
  const router = useRouter();
  const handled = useRef(false);

  useEffect(() => {
    if (handled.current) return;
    handled.current = true;

    if (error) {
      router.replace({ pathname: "/login", params: { socialError: decodeURIComponent(error) } });
      return;
    }

    if (token) {
      import("expo-secure-store").then(async (SecureStore) => {
        try {
          await SecureStore.setItemAsync("auth_session_token", token);
          router.replace("/");
        } catch {
          router.replace("/login");
        }
      });
      return;
    }

    router.replace("/login");
  }, [token, error, router, signin]);

  return (
    <View style={{ flex: 1, backgroundColor: Colors.bgPrimary, alignItems: "center", justifyContent: "center", gap: 16 }}>
      <ActivityIndicator color={Colors.orange} size="large" />
      <Text style={{ color: Colors.textMuted, fontFamily: "Inter_400Regular", fontSize: 14 }}>
        Completing sign in...
      </Text>
    </View>
  );
}
