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

export default function SignupScreen() {
  const { signup, loginWithGoogle, loginWithApple, appleAvailable } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();

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
    if (result.error) setError(result.error);
  };

  const handleSocial = async (provider: string, fn: () => Promise<{ error?: string }>) => {
    setError(null);
    setSocialLoading(provider);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const result = await fn();
    setSocialLoading(null);
    if (result.error) setError(result.error);
  };

  const socialProviders = [
    { id: "google", label: "Continue with Google", icon: "globe", color: "#EA4335", fn: loginWithGoogle },
  ];

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: Colors.bgPrimary }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 32 }]}
        keyboardShouldPersistTaps="handled"
      >
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <Feather name="arrow-left" size={22} color={Colors.text} />
        </Pressable>

        <View style={styles.header}>
          <View style={styles.iconRing}>
            <View style={styles.iconInner}>
              <Feather name="zap" size={26} color={Colors.orange} />
            </View>
          </View>
          <Text style={styles.title}>Create Account</Text>
          <Text style={styles.subtitle}>Join Pro Fitness AI today</Text>
        </View>

        <View style={styles.form}>
          {error && (
            <View style={styles.errorBox}>
              <Feather name="alert-circle" size={14} color="#ff4444" />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          <View style={styles.row}>
            <View style={[styles.field, { flex: 1 }]}>
              <Text style={styles.label}>First Name</Text>
              <View style={styles.inputWrap}>
                <TextInput style={styles.input} value={firstName} onChangeText={setFirstName}
                  placeholder="First" placeholderTextColor={Colors.textSubtle} autoCapitalize="words" />
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
                autoCapitalize="none" autoCorrect={false} onSubmitEditing={handleSignUp} returnKeyType="done" />
            </View>
          </View>

          <Pressable
            onPress={handleSignUp}
            disabled={isLoading || !!socialLoading}
            style={({ pressed }) => [
              styles.submitBtn,
              { opacity: pressed || isLoading ? 0.8 : 1, transform: [{ scale: pressed ? 0.98 : 1 }] },
            ]}
          >
            {isLoading ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.submitBtnText}>CREATE ACCOUNT</Text>
            )}
          </Pressable>

          <View style={styles.dividerRow}>
            <View style={styles.divider} />
            <Text style={styles.dividerText}>or sign up with</Text>
            <View style={styles.divider} />
          </View>

          {appleAvailable && (
            <AppleAuthentication.AppleAuthenticationButton
              buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_UP}
              buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.WHITE}
              cornerRadius={14}
              style={styles.appleBtn}
              onPress={() => handleSocial("apple", loginWithApple)}
            />
          )}

          {socialProviders.map(({ id, label, icon, color, fn }) => (
            <Pressable
              key={id}
              style={({ pressed }) => [styles.socialBtn, { opacity: pressed || !!socialLoading ? 0.7 : 1 }]}
              onPress={() => handleSocial(id, fn)}
              disabled={!!socialLoading || isLoading}
            >
              {socialLoading === id ? (
                <ActivityIndicator size="small" color={color} />
              ) : (
                <Feather name={icon as any} size={18} color={color} />
              )}
              <Text style={styles.socialBtnText}>{label}</Text>
            </Pressable>
          ))}
        </View>

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
  backBtn: { width: 40, height: 40, justifyContent: "center", marginBottom: 24 },
  header: { alignItems: "center", gap: 10, marginBottom: 32 },
  iconRing: {
    width: 72, height: 72, borderRadius: 36, borderWidth: 1,
    borderColor: Colors.border, alignItems: "center", justifyContent: "center",
    backgroundColor: Colors.bgCard, marginBottom: 4,
  },
  iconInner: {
    width: 54, height: 54, borderRadius: 27,
    backgroundColor: "rgba(252, 82, 0, 0.12)", alignItems: "center", justifyContent: "center",
  },
  title: { fontSize: 26, fontFamily: "Inter_900Black", color: Colors.text, fontStyle: "italic" },
  subtitle: { fontSize: 14, color: Colors.textMuted, fontFamily: "Inter_400Regular" },
  form: { gap: 16 },
  errorBox: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: "rgba(255,68,68,0.1)", borderWidth: 1, borderColor: "rgba(255,68,68,0.3)",
    borderRadius: 12, padding: 12,
  },
  errorText: { color: "#ff4444", fontSize: 13, fontFamily: "Inter_400Regular", flex: 1 },
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
    backgroundColor: Colors.orange, borderRadius: 16, paddingVertical: 17,
    alignItems: "center", justifyContent: "center", marginTop: 4,
  },
  submitBtnText: { color: "#fff", fontSize: 15, fontFamily: "Inter_900Black", letterSpacing: 1.5, fontStyle: "italic" },
  dividerRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  divider: { flex: 1, height: 1, backgroundColor: Colors.border },
  dividerText: { fontSize: 12, color: Colors.textSubtle, fontFamily: "Inter_400Regular" },
  appleBtn: { width: "100%", height: 52 },
  socialBtn: {
    flexDirection: "row", alignItems: "center",
    justifyContent: "center", gap: 10, backgroundColor: Colors.bgCard,
    borderWidth: 1, borderColor: Colors.border, borderRadius: 14, paddingVertical: 15, paddingHorizontal: 16,
  },
  socialBtnText: { fontSize: 13, color: Colors.text, fontFamily: "Inter_700Bold" },
  footer: { flexDirection: "row", justifyContent: "center", marginTop: 28 },
  footerText: { fontSize: 14, color: Colors.textMuted, fontFamily: "Inter_400Regular" },
  footerLink: { fontSize: 14, color: Colors.orange, fontFamily: "Inter_700Bold" },
});
