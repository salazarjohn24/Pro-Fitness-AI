import React from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import Svg, { Path } from "react-native-svg";

interface Props {
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  label?: string;
  variant?: "outlined" | "filled";
}

function GoogleLogoColored({ size = 20 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <Path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <Path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" />
      <Path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </Svg>
  );
}

function GoogleLogoWhite({ size = 20 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path fill="#fff" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <Path fill="#fff" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <Path fill="#fff" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" />
      <Path fill="#fff" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </Svg>
  );
}

export function GoogleSignInButton({
  onPress,
  loading = false,
  disabled = false,
  label = "Continue with Google",
  variant = "outlined",
}: Props) {
  const isFilled = variant === "filled";

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.button,
        isFilled ? styles.buttonFilled : styles.buttonOutlined,
        { opacity: pressed || disabled ? 0.7 : 1 },
      ]}
    >
      <View style={styles.logoWrapper}>
        {loading ? (
          <ActivityIndicator size="small" color={isFilled ? "#fff" : "#4285F4"} />
        ) : isFilled ? (
          <GoogleLogoWhite size={20} />
        ) : (
          <GoogleLogoColored size={20} />
        )}
      </View>
      <Text style={[styles.label, isFilled ? styles.labelFilled : styles.labelOutlined]}>
        {label}
      </Text>
      <View style={styles.spacer} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 14,
    height: 54,
    paddingHorizontal: 16,
  },
  buttonOutlined: {
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#DADCE0",
  },
  buttonFilled: {
    backgroundColor: "#4285F4",
  },
  logoWrapper: {
    width: 24,
    height: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  label: {
    flex: 1,
    textAlign: "center",
    fontSize: 15,
    fontFamily: "Inter_700Bold",
    letterSpacing: 0.1,
  },
  labelOutlined: {
    color: "#3C4043",
  },
  labelFilled: {
    color: "#ffffff",
  },
  spacer: {
    width: 24,
  },
});
