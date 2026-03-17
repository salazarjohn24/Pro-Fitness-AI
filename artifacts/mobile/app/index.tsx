import { Redirect } from "expo-router";
import React, { useEffect } from "react";
import { ActivityIndicator, View } from "react-native";

import { useAuth } from "@/lib/auth";
import { useProfile, useUpdateProfile } from "@/hooks/useProfile";
import { Colors } from "@/constants/colors";

export default function EntryScreen() {
  const { isLoading, isAuthenticated, hasSignedInBefore } = useAuth();
  const { data: profile, isLoading: profileLoading } = useProfile();
  const { mutate: updateProfile } = useUpdateProfile();

  const hasCompletedBiometrics =
    profile != null &&
    profile.age != null &&
    profile.weight != null &&
    profile.height != null;

  const onboardingDone =
    profile?.onboardingCompleted === true || hasCompletedBiometrics;

  useEffect(() => {
    if (
      profile &&
      hasCompletedBiometrics &&
      !profile.onboardingCompleted
    ) {
      updateProfile({ onboardingCompleted: true });
    }
  }, [profile, hasCompletedBiometrics]);

  if (isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: Colors.bgPrimary, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator color={Colors.orange} size="large" />
      </View>
    );
  }

  if (!isAuthenticated) {
    return <Redirect href={hasSignedInBefore ? "/login" : "/welcome"} />;
  }

  if (profileLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: Colors.bgPrimary, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator color={Colors.orange} size="large" />
      </View>
    );
  }

  if (!onboardingDone) {
    return <Redirect href="/onboarding" />;
  }

  return <Redirect href="/(tabs)" />;
}
