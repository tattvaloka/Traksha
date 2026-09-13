import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { storage } from "@/src/utils/storage";
import { api, TOKEN_KEY } from "@/src/api/client";
import { queryClient } from "@/src/query-client";

export type Me = {
  id: string;
  identity_code: string;
  identity_type: "TMP" | "TRK";
  identity_label: string;
  display_name: string;
  bio?: string | null;
  photo_url?: string | null;
  job_title?: string | null;
  organization?: string | null;
  email: string;
  tmp_code?: string | null;
  trk_code?: string | null;
  created_at?: string;
  transition_due_at?: string;
  transition_at?: string | null;
  transition_state?: string | null;
  day_of_journey?: number | null;
  journey_length?: number;
  verified: boolean;
  member_since?: string;
  privacy?: {
    profile_visibility?: string;
    discoverable?: boolean;
    allow_connection_requests?: boolean;
  };
  availability?: { audio_on?: boolean; video_on?: boolean };
};

type AuthState = {
  ready: boolean;
  token: string | null;
  user: Me | null;
  register: (email: string, password: string, display_name: string) => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
  setUser: (u: Me) => void;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [user, setUserState] = useState<Me | null>(null);

  const bootstrap = useCallback(async () => {
    const t = await storage.secureGet<string>(TOKEN_KEY, "");
    if (t) {
      setToken(t);
      try {
        const me = await api.get<Me>("/auth/me");
        setUserState(me);
      } catch {
        await storage.secureRemove(TOKEN_KEY);
        setToken(null);
      }
    }
    setReady(true);
  }, []);

  useEffect(() => {
    bootstrap();
  }, [bootstrap]);

  const finishAuth = async (res: { access_token: string; user: Me }) => {
    await storage.secureSet(TOKEN_KEY, res.access_token);
    setToken(res.access_token);
    setUserState(res.user);
  };

  const register = async (email: string, password: string, display_name: string) => {
    const res = await api.post<{ access_token: string; user: Me }>("/auth/register", {
      email,
      password,
      display_name,
    });
    await finishAuth(res);
  };

  const login = async (email: string, password: string) => {
    const res = await api.post<{ access_token: string; user: Me }>("/auth/login", {
      email,
      password,
    });
    await finishAuth(res);
  };

  const logout = async () => {
    try {
      await api.post("/auth/logout");
    } catch {}
    await storage.secureRemove(TOKEN_KEY);
    setToken(null);
    setUserState(null);
    queryClient.clear();
  };

  const refresh = async () => {
    try {
      const me = await api.get<Me>("/auth/me");
      setUserState(me);
    } catch {}
  };

  const setUser = (u: Me) => setUserState(u);

  return (
    <AuthContext.Provider
      value={{ ready, token, user, register, login, logout, refresh, setUser }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
