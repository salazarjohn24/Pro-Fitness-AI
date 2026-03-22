import {
  Inter_400Regular,
  Inter_700Bold,
  Inter_900Black,
  useFonts,
} from "@expo-google-fonts/inter";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { router, Stack } from "expo-router";
import * as Notifications from "expo-notifications";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect } from "react";
import { Platform } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import { AuthProvider } from "@/lib/auth";
import { initNotifications } from "@/lib/notifications";
import { checkHealthKitAvailableViaAPI, readDiag } from "@/services/healthKit";

SplashScreen.preventAutoHideAsync();

function RootLayoutNav() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="welcome" options={{ headerShown: false }} />
      <Stack.Screen name="login" options={{ headerShown: false, animation: "slide_from_right" }} />
      <Stack.Screen name="signup" options={{ headerShown: false, animation: "slide_from_right" }} />
      <Stack.Screen name="auth-callback" options={{ headerShown: false, animation: "fade" }} />
      <Stack.Screen name="onboarding" options={{ headerShown: false, animation: "slide_from_right" }} />
      <Stack.Screen name="gym-setup" options={{ headerShown: false, animation: "slide_from_right" }} />
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="workout-session" options={{ headerShown: false, animation: "slide_from_bottom" }} />
      <Stack.Screen name="workout-architect" options={{ headerShown: false, animation: "slide_from_bottom" }} />
      <Stack.Screen name="workout-detail" options={{ headerShown: false, animation: "slide_from_right" }} />
      <Stack.Screen name="external-workouts" options={{ headerShown: false, animation: "slide_from_right" }} />
      <Stack.Screen name="exercise/[id]" options={{ headerShown: false, animation: "slide_from_right" }} />
    </Stack>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_700Bold,
    Inter_900Black,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
      initNotifications();
    }
  }, [fontsLoaded, fontError]);

  useEffect(() => {
    if (Platform.OS !== "ios") return;
    (async () => {
      try {
        const hkAvailable = await checkHealthKitAvailableViaAPI();
        const diag = await readDiag();
        console.log(
          "[health-diag-startup]",
          `healthkit_available=${hkAvailable}`,
          `entitlement_detected=${hkAvailable}`,
          `auth_request_attempted=${diag.authRequestAttempted}`,
          `auth_status=${JSON.stringify(diag.authResult ?? {})}`,
          `init_error=${diag.initHealthKitError ?? "none"}`,
        );
      } catch (e) {
        console.log("[health-diag-startup] error", String(e));
      }
    })();
  }, []);

  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener(response => {
      const screen = response.notification.request.content.data?.screen;
      if (screen === "architect") {
        router.push("/workout-architect");
      }
    });
    return () => sub.remove();
  }, []);

  if (!fontsLoaded && !fontError) return null;

  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <GestureHandlerRootView>
              <RootLayoutNav />
            </GestureHandlerRootView>
          </AuthProvider>
        </QueryClientProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}
