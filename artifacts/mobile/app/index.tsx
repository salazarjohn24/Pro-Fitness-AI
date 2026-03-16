import { Redirect } from "expo-router";
import React from "react";
import { ActivityIndicator, View } from "react-native";

import { useAuth } from "@/lib/auth";
import { useProfile } from "@/hooks/useProfile";
import { Colors } from "@/constants/colors";

export default function EntryScreen() {
  const { isLoading, isAuthenticated } = useAuth();
  const { data: profile, isLoading: profileLoading } = useProfile();

  if (isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: Colors.bgPrimary, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator color={Colors.orange} size="large" />
      </View>
    );
  }

  if (!isAuthenticated) {
    return <Redirect href="/welcome" />;
  }

  if (profileLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: Colors.bgPrimary, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator color={Colors.orange} size="large" />
      </View>
    );
  }

  if (profile && !profile.onboardingCompleted) {
    return <Redirect href="/onboarding" />;
  }

  return <Redirect href="/(tabs)" />;
}
