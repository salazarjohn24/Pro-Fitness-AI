import React, { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import * as SecureStore from "expo-secure-store";
import * as WebBrowser from "expo-web-browser";
import * as Linking from "expo-linking";
import * as AppleAuthentication from "expo-apple-authentication";
import { Platform } from "react-native";
import { queryClient } from "@/lib/queryClient";

WebBrowser.maybeCompleteAuthSession();

const AUTH_TOKEN_KEY = "auth_session_token";
const HAS_SIGNED_IN_KEY = "has_signed_in_before";
const IS_WEB = Platform.OS === "web";
const IS_IOS = Platform.OS === "ios";

interface User {
  id: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  profileImageUrl: string | null;
}

interface AuthContextValue {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  hasSignedInBefore: boolean;
  signup: (params: SignupParams) => Promise<{ error?: string }>;
  signin: (identifier: string, password: string) => Promise<{ error?: string }>;
  loginWithGoogle: () => Promise<{ error?: string }>;
  loginWithGitHub: () => Promise<{ error?: string }>;
  loginWithTwitter: () => Promise<{ error?: string }>;
  loginWithApple: () => Promise<{ error?: string }>;
  appleAvailable: boolean;
  logout: () => Promise<void>;
}

interface SignupParams {
  username?: string;
  email?: string;
  password: string;
  firstName?: string;
  lastName?: string;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  isLoading: true,
  isAuthenticated: false,
  hasSignedInBefore: false,
  signup: async () => ({}),
  signin: async () => ({}),
  loginWithGoogle: async () => ({}),
  loginWithGitHub: async () => ({}),
  loginWithTwitter: async () => ({}),
  loginWithApple: async () => ({}),
  appleAvailable: false,
  logout: async () => {},
});

function getApiBaseUrl(): string {
  if (process.env.EXPO_PUBLIC_DOMAIN) {
    return `https://${process.env.EXPO_PUBLIC_DOMAIN}`;
  }
  return "";
}

async function getStoredToken(): Promise<string | null> {
  if (IS_WEB) return null;
  try { return await SecureStore.getItemAsync(AUTH_TOKEN_KEY); } catch { return null; }
}

async function setStoredToken(token: string): Promise<void> {
  if (IS_WEB) return;
  await SecureStore.setItemAsync(AUTH_TOKEN_KEY, token);
}

async function clearStoredToken(): Promise<void> {
  if (IS_WEB) return;
  try { await SecureStore.deleteItemAsync(AUTH_TOKEN_KEY); } catch {}
}

async function markHasSignedIn(): Promise<void> {
  if (IS_WEB) return;
  try { await SecureStore.setItemAsync(HAS_SIGNED_IN_KEY, "true"); } catch {}
}

async function readHasSignedIn(): Promise<boolean> {
  if (IS_WEB) return false;
  try { return (await SecureStore.getItemAsync(HAS_SIGNED_IN_KEY)) === "true"; } catch { return false; }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [appleAvailable, setAppleAvailable] = useState(false);
  const [hasSignedInBefore, setHasSignedInBefore] = useState(false);

  useEffect(() => {
    if (IS_IOS) {
      AppleAuthentication.isAvailableAsync().then(setAppleAvailable).catch(() => setAppleAvailable(false));
    }
  }, []);

  const fetchUser = useCallback(async () => {
    try {
      const apiBase = getApiBaseUrl();
      if (IS_WEB) {
        const res = await fetch(`${apiBase}/api/auth/user`, { credentials: "include" });
        const data = await res.json();
        setUser(data.user ?? null);
        setIsLoading(false);
        return;
      }
      const [token, prevSignIn] = await Promise.all([getStoredToken(), readHasSignedIn()]);
      setHasSignedInBefore(prevSignIn);
      if (!token) { setUser(null); setIsLoading(false); return; }
      const res = await fetch(`${apiBase}/api/auth/user`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.user) {
        setUser(data.user);
      } else {
        await clearStoredToken();
        setUser(null);
      }
    } catch {
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { fetchUser(); }, [fetchUser]);

  const signup = useCallback(async (params: SignupParams): Promise<{ error?: string }> => {
    try {
      const apiBase = getApiBaseUrl();
      const res = await fetch(`${apiBase}/api/auth/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params),
      });
      const data = await res.json();
      if (!res.ok) return { error: data.error || "Failed to create account" };
      if (data.token) {
        await Promise.all([setStoredToken(data.token), markHasSignedIn()]);
        setHasSignedInBefore(true);
        setIsLoading(true);
        await fetchUser();
      }
      return {};
    } catch { return { error: "Network error. Please try again." }; }
  }, [fetchUser]);

  const signin = useCallback(async (identifier: string, password: string): Promise<{ error?: string }> => {
    try {
      const apiBase = getApiBaseUrl();
      const res = await fetch(`${apiBase}/api/auth/signin`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier, password }),
      });
      const data = await res.json();
      if (!res.ok) return { error: data.error || "Failed to sign in" };
      if (data.token) {
        await Promise.all([setStoredToken(data.token), markHasSignedIn()]);
        setHasSignedInBefore(true);
        setIsLoading(true);
        await fetchUser();
      }
      return {};
    } catch { return { error: "Network error. Please try again." }; }
  }, [fetchUser]);

  const loginWithSocial = useCallback(async (provider: "google" | "github" | "twitter"): Promise<{ error?: string }> => {
    const apiBase = getApiBaseUrl();
    if (!apiBase) return { error: "API not configured" };

    if (IS_WEB) {
      return new Promise((resolve) => {
        const authUrl = `${apiBase}/api/auth/social/${provider}?platform=web`;
        const popup = window.open(authUrl, "_blank", "width=500,height=650,noopener");

        const handler = (event: MessageEvent) => {
          if (!event.data || event.data.success == null) return;
          window.removeEventListener("message", handler);
          clearInterval(pollTimer);
          if (event.data.error) {
            resolve({ error: decodeURIComponent(event.data.error) });
          } else {
            setIsLoading(true);
            fetchUser().then(() => resolve({}));
          }
        };
        window.addEventListener("message", handler);

        const pollTimer = setInterval(() => {
          if (popup?.closed) {
            clearInterval(pollTimer);
            window.removeEventListener("message", handler);
            fetchUser().then(() => resolve({}));
          }
        }, 500);
      });
    }

    try {
      const result = await WebBrowser.openAuthSessionAsync(
        `${apiBase}/api/auth/social/${provider}`,
        "mobile://auth-callback",
        { showInRecents: true },
      );

      if (result.type === "success") {
        const parsed = Linking.parse(result.url);
        const token = parsed.queryParams?.token as string | undefined;
        const error = parsed.queryParams?.error as string | undefined;
        if (error) return { error: decodeURIComponent(error) };
        if (token) {
          await Promise.all([setStoredToken(token), markHasSignedIn()]);
          setHasSignedInBefore(true);
          setIsLoading(true);
          await fetchUser();
        }
      } else if (result.type === "cancel") {
        return {};
      }
      return {};
    } catch (err) {
      console.error(`${provider} login error:`, err);
      return { error: "Authentication failed. Please try again." };
    }
  }, [fetchUser]);

  const loginWithGoogle = useCallback(() => loginWithSocial("google"), [loginWithSocial]);
  const loginWithGitHub = useCallback(() => loginWithSocial("github"), [loginWithSocial]);
  const loginWithTwitter = useCallback(() => loginWithSocial("twitter"), [loginWithSocial]);

  const loginWithApple = useCallback(async (): Promise<{ error?: string }> => {
    if (!IS_IOS) return { error: "Apple Sign In is only available on iOS" };
    try {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });

      if (!credential.identityToken) return { error: "Apple did not return a valid token" };

      const apiBase = getApiBaseUrl();
      const res = await fetch(`${apiBase}/api/auth/social/apple`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          identityToken: credential.identityToken,
          authorizationCode: credential.authorizationCode,
          fullName: credential.fullName,
        }),
      });
      const data = await res.json();
      if (!res.ok) return { error: data.error || "Apple sign in failed" };
      if (data.token) {
        await Promise.all([setStoredToken(data.token), markHasSignedIn()]);
        setHasSignedInBefore(true);
        setIsLoading(true);
        await fetchUser();
      }
      return {};
    } catch (err: any) {
      if (err?.code === "ERR_CANCELED") return {};
      console.error("Apple login error:", err);
      return { error: "Apple sign in failed. Please try again." };
    }
  }, [fetchUser]);

  const logout = useCallback(async () => {
    try {
      const token = await getStoredToken();
      if (token) {
        const apiBase = getApiBaseUrl();
        await fetch(`${apiBase}/api/mobile-auth/logout`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        });
      }
    } catch {
    } finally {
      await clearStoredToken();
      queryClient.clear();
      setUser(null);
    }
  }, []);

  return (
    <AuthContext.Provider value={{
      user, isLoading, isAuthenticated: !!user, hasSignedInBefore,
      signup, signin, loginWithGoogle, loginWithGitHub, loginWithTwitter, loginWithApple,
      appleAvailable, logout,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  return useContext(AuthContext);
}
