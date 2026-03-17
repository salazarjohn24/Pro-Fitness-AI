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

type SignupView = "options" | "email";

export default function SignupScreen() {
  const { signup, loginWithGoogle, loginWithApple, appleAvailable } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [view, setView] = useState<SignupView>("options");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [socialLoading, setSocialLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSignUp = async () => {
    setError(null);
    if (!username.trim() && !email.trim()) { setError("Please provide a username or email."); return; }
    if (password.length < 8) { setError("Password must be at least 8 characters."); return; }
    if (password !== confirmPassword) { setError("Passwords do not match."); return; }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsLoading(true);
    const result = await signup({
      username: username.trim() || undefined,
      email: email.trim() || undefined,
      password,
      firstName: firstName.trim() || undefined,
      lastName: lastName.trim() || undefined,
    });
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
          <Pressable style={styles.topBtn} onPress={() => router.replace("/login")}>
            <Text style={[styles.topBtnText, { color: Colors.orange }]}>Sign In</Text>
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
          <Text style={styles.title}>Create Account</Text>
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
              style={({ pressed }) => [
                styles.optionBtn,
                styles.emailBtn,
                { opacity: pressed ? 0.85 : 1, transform: [{ scale: pressed ? 0.98 : 1 }] },
              ]}
            >
              <View style={styles.optionIcon}>
                <Feather name="mail" size={19} color="#fff" />
              </View>
              <Text style={styles.optionLabel}>Sign Up with Email</Text>
              <View style={styles.optionSpacer} />
            </Pressable>

            {/* Apple — only on iOS */}
            {appleAvailable && (
              <AppleAuthentication.AppleAuthenticationButton
                buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_UP}
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
              label="Sign Up with Google"
              variant="filled"
            />
          </View>
        ) : (
          <View style={styles.form}>
            <View style={styles.row}>
              <View style={[styles.field, { flex: 1 }]}>
                <Text style={styles.label}>First Name</Text>
                <View style={styles.inputWrap}>
                  <TextInput style={styles.input} value={firstName} onChangeText={setFirstName}
                    placeholder="First" placeholderTextColor={Colors.textSubtle}
                    autoCapitalize="words" autoFocus />
                </View>
              </View>
              <View style={[styles.field, { flex: 1 }]}>
                <Text style={styles.label}>Last Name</Text>
                <View style={styles.inputWrap}>
                  <TextInput style={styles.input} value={lastName} onChangeText={setLastName}
                    placeholder="Last" placeholderTextColor={Colors.textSubtle} autoCapitalize="words" />
                </View>
              </View>
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Username</Text>
              <View style={styles.inputWrap}>
                <Feather name="at-sign" size={16} color={Colors.textMuted} style={styles.inputIcon} />
                <TextInput style={styles.input} value={username} onChangeText={setUsername}
                  placeholder="Choose a username" placeholderTextColor={Colors.textSubtle}
                  autoCapitalize="none" autoCorrect={false} />
              </View>
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Email <Text style={styles.optional}>(optional)</Text></Text>
              <View style={styles.inputWrap}>
                <Feather name="mail" size={16} color={Colors.textMuted} style={styles.inputIcon} />
                <TextInput style={styles.input} value={email} onChangeText={setEmail}
                  placeholder="your@email.com" placeholderTextColor={Colors.textSubtle}
                  autoCapitalize="none" autoCorrect={false} keyboardType="email-address" />
              </View>
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Password</Text>
              <View style={styles.inputWrap}>
                <Feather name="lock" size={16} color={Colors.textMuted} style={styles.inputIcon} />
                <TextInput style={[styles.input, { flex: 1 }]} value={password} onChangeText={setPassword}
                  placeholder="Minimum 8 characters" placeholderTextColor={Colors.textSubtle}
                  secureTextEntry={!showPassword} autoCapitalize="none" autoCorrect={false} />
                <Pressable onPress={() => setShowPassword(v => !v)} style={styles.eyeBtn}>
                  <Feather name={showPassword ? "eye-off" : "eye"} size={16} color={Colors.textMuted} />
                </Pressable>
              </View>
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Confirm Password</Text>
              <View style={styles.inputWrap}>
                <Feather name="lock" size={16} color={Colors.textMuted} style={styles.inputIcon} />
                <TextInput style={[styles.input, { flex: 1 }]} value={confirmPassword}
                  onChangeText={setConfirmPassword} placeholder="Re-enter password"
                  placeholderTextColor={Colors.textSubtle} secureTextEntry={!showPassword}
                  autoCapitalize="none" autoCorrect={false}
                  onSubmitEditing={handleSignUp} returnKeyType="done" />
              </View>
            </View>

            <Pressable
              onPress={handleSignUp}
              disabled={anyLoading}
              style={({ pressed }) => [
                styles.submitBtn,
                { opacity: pressed || isLoading ? 0.85 : 1, transform: [{ scale: pressed ? 0.98 : 1 }] },
              ]}
            >
              {isLoading ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.submitBtnText}>CREATE ACCOUNT</Text>
              )}
            </Pressable>
          </View>
        )}

        <View style={styles.footer}>
          <Text style={styles.footerText}>Already have an account? </Text>
          <Pressable onPress={() => router.replace("/login")}>
            <Text style={styles.footerLink}>Sign In</Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 1, paddingHorizontal: 28 },
  topBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 32,
  },
  topBtn: { paddingVertical: 4, paddingHorizontal: 2 },
  topBtnText: { fontSize: 15, fontFamily: "Inter_400Regular", color: Colors.textMuted },
  header: { alignItems: "center", gap: 8, marginBottom: 40 },
  iconRing: {
    width: 68, height: 68, borderRadius: 34, borderWidth: 1,
    borderColor: Colors.border, alignItems: "center", justifyContent: "center",
    backgroundColor: Colors.bgCard, marginBottom: 6,
  },
  iconInner: {
    width: 50, height: 50, borderRadius: 25,
    backgroundColor: "rgba(252, 82, 0, 0.12)", alignItems: "center", justifyContent: "center",
  },
  appName: {
    fontSize: 13, fontFamily: "Inter_900Black", color: Colors.textMuted,
    letterSpacing: 2, fontStyle: "italic",
  },
  title: { fontSize: 28, fontFamily: "Inter_900Black", color: Colors.text, fontStyle: "italic", marginTop: 2 },
  errorBox: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: "rgba(255,68,68,0.1)", borderWidth: 1, borderColor: "rgba(255,68,68,0.3)",
    borderRadius: 12, padding: 12, marginBottom: 16,
  },
  errorText: { color: "#ff4444", fontSize: 13, fontFamily: "Inter_400Regular", flex: 1 },
  buttons: { gap: 12 },
  optionBtn: {
    flexDirection: "row", alignItems: "center", height: 54, borderRadius: 14, paddingHorizontal: 16,
  },
  emailBtn: { backgroundColor: Colors.orange },
  optionIcon: { width: 24, height: 24, alignItems: "center", justifyContent: "center" },
  optionLabel: {
    flex: 1, textAlign: "center", fontSize: 15, fontFamily: "Inter_700Bold", color: "#fff", letterSpacing: 0.1,
  },
  optionSpacer: { width: 24 },
  appleBtn: { width: "100%", height: 54 },
  form: { gap: 16 },
  row: { flexDirection: "row", gap: 12 },
  field: { gap: 6 },
  label: {
    fontSize: 12, fontFamily: "Inter_700Bold", color: Colors.textMuted,
    letterSpacing: 0.5, textTransform: "uppercase",
  },
  optional: { fontSize: 11, fontFamily: "Inter_400Regular", color: Colors.textSubtle, textTransform: "none" },
  inputWrap: {
    flexDirection: "row", alignItems: "center", backgroundColor: Colors.bgCard,
    borderWidth: 1, borderColor: Colors.border, borderRadius: 14, paddingHorizontal: 14, height: 52,
  },
  inputIcon: { marginRight: 10 },
  input: { flex: 1, fontSize: 15, color: Colors.text, fontFamily: "Inter_400Regular" },
  eyeBtn: { padding: 4, marginLeft: 8 },
  submitBtn: {
    backgroundColor: Colors.orange, borderRadius: 14, height: 54,
    alignItems: "center", justifyContent: "center", marginTop: 4,
  },
  submitBtnText: { color: "#fff", fontSize: 15, fontFamily: "Inter_900Black", letterSpacing: 1.5, fontStyle: "italic" },
  footer: { flexDirection: "row", justifyContent: "center", marginTop: 36 },
  footerText: { fontSize: 14, color: Colors.textMuted, fontFamily: "Inter_400Regular" },
  footerLink: { fontSize: 14, color: Colors.orange, fontFamily: "Inter_700Bold" },
});
