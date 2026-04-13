import { useState, useEffect, useCallback } from "react";
import type { AuthUser } from "@workspace/api-client-react";

export type { AuthUser };

interface AuthState {
  user: AuthUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: () => void;
  logout: () => void;
  refresh: () => void;
}

async function fetchUser(): Promise<AuthUser | null> {
  try {
    const res = await fetch("/api/auth/user", { credentials: "include" });
    if (!res.ok) return null;
    const data = await res.json() as { user: AuthUser | null };
    return data.user ?? null;
  } catch {
    return null;
  }
}

export function useAuth(): AuthState {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const load = useCallback(async () => {
    const u = await fetchUser();
    setUser(u);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    load();
    // Listen for manual refresh events triggered after profile updates
    window.addEventListener("auth-updated", load);
    return () => window.removeEventListener("auth-updated", load);
  }, [load]);

  const login = useCallback(() => {
    window.location.href = "/login";
  }, []);

  const logout = useCallback(() => {
    fetch("/api/logout", { method: "POST", credentials: "include" }).finally(() => {
      window.location.href = "/";
    });
  }, []);

  const refresh = useCallback(() => {
    load();
  }, [load]);

  return {
    user,
    isLoading,
    isAuthenticated: !!user,
    login,
    logout,
    refresh,
  };
}
