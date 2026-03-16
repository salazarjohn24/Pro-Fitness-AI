import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

const AUTH_TOKEN_KEY = "auth_session_token";
const IS_WEB = Platform.OS === "web";

export function getApiBase(): string {
  if (process.env.EXPO_PUBLIC_DOMAIN) {
    return `https://${process.env.EXPO_PUBLIC_DOMAIN}`;
  }
  return "";
}

export async function getAuthHeaders(): Promise<Record<string, string>> {
  if (IS_WEB) {
    return { "Content-Type": "application/json" };
  }
  try {
    const token = await SecureStore.getItemAsync(AUTH_TOKEN_KEY);
    return token
      ? { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }
      : { "Content-Type": "application/json" };
  } catch {
    return { "Content-Type": "application/json" };
  }
}

export function getFetchOptions(headers: Record<string, string>): RequestInit {
  return IS_WEB ? { headers, credentials: "include" } : { headers };
}
