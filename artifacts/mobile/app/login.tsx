import { Feather } from "@expo/vector-icons";
import * as AppleAuthentication from "expo-apple-authentication";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "@/lib/auth";
import { Colors } from "@/constants/colors";
import { GoogleSignInButton } from "@/components/GoogleSignInButton";

type LoginView = "options" | "email";

export default function LoginScreen() {
  const { signin, loginWithGoogle, loginWithApple, appleAvailable } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [view, setView] = useState<LoginView>("options");
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [socialLoading, setSocialLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSignIn = async () => {
    if (!identifier.trim() || !password) {
      setError("Please enter your username/email and password.");
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setError(null);
    setIsLoading(true);
    const result = await signin(identifier.trim(), password);
    setIsLoading(false);
    if (result.error) {
      setError(result.error);
    } else {
      router.replace("/");
    }
  };

  const handleSocial = async (provider: string, fn: () => Promise<{ error?: string }>) => {
    setError(null);
    setSocialLoading(provider);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const result = await fn();
    setSocialLoading(null);
    if (result.error) {
      setError(result.error);
    } else {
      router.replace("/");
    }
  };

  const handleBack = () => {
    if (view === "email") {
      setView("options");
      setError(null);
      setIdentifier("");
      setPassword("");
    } else {
      router.back();
    }
  };

  const anyLoading = isLoading || !!socialLoading;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: Colors.bgPrimary }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 40 },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        {/* Top bar */}
        <View style={styles.topBar}>
          <Pressable style={styles.topBtn} onPress={handleBack}>
            <Text style={styles.topBtnText}>{view === "email" ? "Back" : "Cancel"}</Text>
          </Pressable>
          <Pressable style={styles.topBtn} onPress={() => router.replace("/signup")}>
            <Text style={[styles.topBtnText, { color: Colors.orange }]}>Sign Up</Text>
          </Pressable>
        </View>

        {/* Header */}
        <View style={styles.header}>
          <View style={styles.iconRing}>
            <View style={styles.iconInner}>
              <Feather name="zap" size={28} color={Colors.orange} />
            </View>
          </View>
          <Text style={styles.appName}>PRO FITNESS <Text style={{ color: Colors.orange }}>AI</Text></Text>
          <Text style={styles.title}>Welcome Back</Text>
        </View>

        {/* Error box */}
        {error && (
          <View style={styles.errorBox}>
            <Feather name="alert-circle" size={14} color="#ff4444" />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {view === "options" ? (
          <View style={styles.buttons}>
            {/* Email */}
            <Pressable
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setView("email"); }}
              disabled={anyLoading}
              style={({ pressed }) => [styles.optionBtn, styles.emailBtn, { opacity: pressed ? 0.85 : 1, transform: [{ scale: pressed ? 0.98 : 1 }] }]}
            >
              <View style={styles.optionIcon}>
                <Feather name="mail" size={19} color="#fff" />
              </View>
              <Text style={styles.optionLabel}>Sign In with Email</Text>
              <View style={styles.optionSpacer} />
            </Pressable>

            {/* Apple — only on iOS */}
            {appleAvailable && (
              <AppleAuthentication.AppleAuthenticationButton
                buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
                buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
                cornerRadius={14}
                style={styles.appleBtn}
                onPress={() => handleSocial("apple", loginWithApple)}
              />
            )}

            {/* Google */}
            <GoogleSignInButton
              onPress={() => handleSocial("google", loginWithGoogle)}
              loading={socialLoading === "google"}
              disabled={anyLoading}
              label="Sign In with Google"
              variant="filled"
            />
          </View>
        ) : (
          <View style={styles.form}>
            <View style={styles.field}>
              <Text style={styles.label}>Username or Email</Text>
              <View style={styles.inputWrap}>
                <Feather name="user" size={16} color={Colors.textMuted} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  value={identifier}
                  onChangeText={setIdentifier}
                  placeholder="Enter username or email"
                  placeholderTextColor={Colors.textSubtle}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="email-address"
                  autoFocus
                />
              </View>
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Password</Text>
              <View style={styles.inputWrap}>
                <Feather name="lock" size={16} color={Colors.textMuted} style={styles.inputIcon} />
                <TextInput
                  style={[styles.input, { flex: 1 }]}
                  value={password}
                  onChangeText={setPassword}
                  placeholder="Enter password"
                  placeholderTextColor={Colors.textSubtle}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                  onSubmitEditing={handleSignIn}
                  returnKeyType="done"
                />
                <Pressable onPress={() => setShowPassword(v => !v)} style={styles.eyeBtn}>
                  <Feather name={showPassword ? "eye-off" : "eye"} size={16} color={Colors.textMuted} />
                </Pressable>
              </View>
            </View>

            <Pressable
              onPress={handleSignIn}
              disabled={anyLoading}
              style={({ pressed }) => [
                styles.submitBtn,
                { opacity: pressed || isLoading ? 0.85 : 1, transform: [{ scale: pressed ? 0.98 : 1 }] },
              ]}
            >
              {isLoading ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.submitBtnText}>SIGN IN</Text>
              )}
            </Pressable>
          </View>
        )}

        <View style={styles.footer}>
          <Text style={styles.footerText}>Don't have an account? </Text>
          <Pressable onPress={() => router.replace("/signup")}>
            <Text style={styles.footerLink}>Create one</Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flexGrow: 1,
    paddingHorizontal: 28,
  },
  topBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 32,
  },
  topBtn: {
    paddingVertical: 4,
    paddingHorizontal: 2,
  },
  topBtnText: {
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    color: Colors.textMuted,
  },
  header: {
    alignItems: "center",
    gap: 8,
    marginBottom: 40,
  },
  iconRing: {
    width: 68,
    height: 68,
    borderRadius: 34,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.bgCard,
    marginBottom: 6,
  },
  iconInner: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: "rgba(252, 82, 0, 0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  appName: {
    fontSize: 13,
    fontFamily: "Inter_900Black",
    color: Colors.textMuted,
    letterSpacing: 2,
    fontStyle: "italic",
  },
  title: {
    fontSize: 28,
    fontFamily: "Inter_900Black",
    color: Colors.text,
    fontStyle: "italic",
    marginTop: 2,
  },
  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(255,68,68,0.1)",
    borderWidth: 1,
    borderColor: "rgba(255,68,68,0.3)",
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  errorText: {
    color: "#ff4444",
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    flex: 1,
  },
  buttons: {
    gap: 12,
  },
  optionBtn: {
    flexDirection: "row",
    alignItems: "center",
    height: 54,
    borderRadius: 14,
    paddingHorizontal: 16,
  },
  emailBtn: {
    backgroundColor: Colors.orange,
  },
  optionIcon: {
    width: 24,
    height: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  optionLabel: {
    flex: 1,
    textAlign: "center",
    fontSize: 15,
    fontFamily: "Inter_700Bold",
    color: "#fff",
    letterSpacing: 0.1,
  },
  optionSpacer: {
    width: 24,
  },
  appleBtn: {
    width: "100%",
    height: 54,
  },
  form: {
    gap: 18,
  },
  field: {
    gap: 6,
  },
  label: {
    fontSize: 12,
    fontFamily: "Inter_700Bold",
    color: Colors.textMuted,
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  inputWrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 14,
    paddingHorizontal: 14,
    height: 52,
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    fontSize: 15,
    color: Colors.text,
    fontFamily: "Inter_400Regular",
  },
  eyeBtn: {
    padding: 4,
    marginLeft: 8,
  },
  submitBtn: {
    backgroundColor: Colors.orange,
    borderRadius: 14,
    height: 54,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
  },
  submitBtnText: {
    color: "#fff",
    fontSize: 15,
    fontFamily: "Inter_900Black",
    letterSpacing: 1.5,
    fontStyle: "italic",
  },
  footer: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: 36,
  },
  footerText: {
    fontSize: 14,
    color: Colors.textMuted,
    fontFamily: "Inter_400Regular",
  },
  footerLink: {
    fontSize: 14,
    color: Colors.orange,
    fontFamily: "Inter_700Bold",
  },
});
