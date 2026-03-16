import React, { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

const AUTH_TOKEN_KEY = "auth_session_token";
const IS_WEB = Platform.OS === "web";

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
  signup: (params: SignupParams) => Promise<{ error?: string }>;
  signin: (identifier: string, password: string) => Promise<{ error?: string }>;
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
  signup: async () => ({}),
  signin: async () => ({}),
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

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

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

      const token = await getStoredToken();
      if (!token) {
        setUser(null);
        setIsLoading(false);
        return;
      }

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

  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  const signup = useCallback(async (params: SignupParams): Promise<{ error?: string }> => {
    try {
      const apiBase = getApiBaseUrl();
      const res = await fetch(`${apiBase}/api/auth/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params),
      });
      const data = await res.json();

      if (!res.ok) {
        return { error: data.error || "Failed to create account" };
      }

      if (data.token) {
        await setStoredToken(data.token);
        setIsLoading(true);
        await fetchUser();
      }
      return {};
    } catch {
      return { error: "Network error. Please try again." };
    }
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

      if (!res.ok) {
        return { error: data.error || "Failed to sign in" };
      }

      if (data.token) {
        await setStoredToken(data.token);
        setIsLoading(true);
        await fetchUser();
      }
      return {};
    } catch {
      return { error: "Network error. Please try again." };
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
      setUser(null);
    }
  }, []);

  return (
    <AuthContext.Provider value={{ user, isLoading, isAuthenticated: !!user, signup, signin, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  return useContext(AuthContext);
}
