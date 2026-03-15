import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";

import { useAuth } from "@/lib/auth";
import { Colors } from "@/constants/colors";

export default function WelcomeScreen() {
  const { login, isLoading } = useAuth();
  const insets = useSafeAreaInsets();

  const handleLogin = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await login();
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom + 24 }]}>
      {/* Background gradient orb */}
      <View style={styles.bgOrb} />

      <View style={styles.content}>
        {/* Logo area */}
        <View style={styles.logoArea}>
          <View style={styles.iconRing}>
            <View style={styles.iconInner}>
              <Feather name="zap" size={32} color={Colors.orange} />
            </View>
          </View>
          <Text style={styles.appTitle}>
            PRO FITNESS <Text style={styles.appTitleAccent}>AI</Text>
          </Text>
          <Text style={styles.tagline}>Your high-performance training partner</Text>
        </View>

        {/* Feature bullets */}
        <View style={styles.features}>
          {[
            { icon: "cpu", text: "AI-powered workout recommendations" },
            { icon: "trending-up", text: "Smart progress tracking" },
            { icon: "shield", text: "Personalized recovery protocols" },
          ].map(({ icon, text }) => (
            <View key={text} style={styles.featureRow}>
              <View style={styles.featureIcon}>
                <Feather name={icon as any} size={14} color={Colors.orange} />
              </View>
              <Text style={styles.featureText}>{text}</Text>
            </View>
          ))}
        </View>

        {/* CTA */}
        <View style={styles.ctaArea}>
          <Pressable
            onPress={handleLogin}
            disabled={isLoading}
            style={({ pressed }) => [
              styles.loginButton,
              { opacity: pressed ? 0.85 : 1, transform: [{ scale: pressed ? 0.98 : 1 }] },
            ]}
          >
            {isLoading ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <>
                <Feather name="log-in" size={18} color="#fff" />
                <Text style={styles.loginButtonText}>GET STARTED</Text>
              </>
            )}
          </Pressable>

          <Text style={styles.legalText}>
            By continuing, you agree to our Terms of Service and Privacy Policy
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bgPrimary,
  },
  bgOrb: {
    position: "absolute",
    top: -100,
    left: -80,
    width: 340,
    height: 340,
    borderRadius: 170,
    backgroundColor: Colors.orange,
    opacity: 0.08,
  },
  content: {
    flex: 1,
    paddingHorizontal: 28,
    justifyContent: "space-between",
    paddingTop: 60,
  },
  logoArea: {
    alignItems: "center",
    gap: 16,
  },
  iconRing: {
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.bgCard,
  },
  iconInner: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "rgba(252, 82, 0, 0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  appTitle: {
    fontSize: 28,
    fontFamily: "Inter_900Black",
    color: Colors.text,
    letterSpacing: 1,
    fontStyle: "italic",
    textAlign: "center",
    marginTop: 8,
  },
  appTitleAccent: {
    color: Colors.orange,
  },
  tagline: {
    fontSize: 15,
    color: Colors.textMuted,
    textAlign: "center",
    fontFamily: "Inter_400Regular",
    lineHeight: 22,
  },
  features: {
    gap: 16,
    paddingHorizontal: 8,
  },
  featureRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  featureIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: "rgba(252,82,0,0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  featureText: {
    fontSize: 13,
    color: Colors.text,
    fontFamily: "Inter_400Regular",
    flex: 1,
  },
  ctaArea: {
    gap: 16,
  },
  loginButton: {
    backgroundColor: Colors.orange,
    borderRadius: 18,
    paddingVertical: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  loginButtonText: {
    color: "#fff",
    fontSize: 15,
    fontFamily: "Inter_900Black",
    letterSpacing: 1.5,
    fontStyle: "italic",
  },
  legalText: {
    fontSize: 11,
    color: Colors.textSubtle,
    textAlign: "center",
    fontFamily: "Inter_400Regular",
    lineHeight: 16,
  },
});
