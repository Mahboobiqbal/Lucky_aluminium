import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";
import { api, setToken, clearToken, getToken, type SessionUser, type UserPermission } from "@/lib/api";

const SESSION_KEY = "udyana_session";

type AuthContextType = {
  currentUser: SessionUser | null;
  isAuthenticated: boolean;
  isAdmin: boolean;
  isManager: boolean;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<{ success: boolean; error?: string; user?: SessionUser }>;
  logout: () => void;
  can: (moduleKey: string, action?: "view" | "create" | "edit" | "delete" | "print" | "export") => boolean;
  getPermissions: (userId: number) => Promise<UserPermission[]>;
  refreshPermissions: () => Promise<void>;
  updatePassword: (userId: number, currentPassword: string, newPassword: string) => Promise<{ success: boolean; error?: string }>;
};

const AuthContext = createContext<AuthContextType>({
  currentUser: null,
  isAuthenticated: false,
  isAdmin: false,
  isManager: false,
  isLoading: true,
  login: async () => ({ success: false }),
  logout: () => {},
  can: () => false,
  getPermissions: async () => [],
  refreshPermissions: async () => {},
  updatePassword: async () => ({ success: false }),
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUser] = useState<SessionUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [userPermissions, setUserPermissions] = useState<UserPermission[]>([]);

  // Restore session on mount
  useEffect(() => {
    const stored = localStorage.getItem(SESSION_KEY);
    if (stored && getToken()) {
      try {
        const user = JSON.parse(stored) as SessionUser;
        setCurrentUser(user);
        // Validate token is still valid
        api.get<UserPermission[]>(`/api/permissions/user/${user.id}`).then(setUserPermissions).catch(() => {
          // Token invalid or expired — clear session
          clearToken();
          localStorage.removeItem(SESSION_KEY);
          setCurrentUser(null);
        });
      } catch {
        localStorage.removeItem(SESSION_KEY);
        clearToken();
      }
    }
    setIsLoading(false);
  }, []);

  const navigate = useNavigate();

  const login = async (username: string, password: string): Promise<{ success: boolean; error?: string; user?: SessionUser }> => {
    try {
      const res = await api.post<{ token: string; user: SessionUser }>("/api/auth/login", { username, password });
      setToken(res.token);
      localStorage.setItem(SESSION_KEY, JSON.stringify(res.user));
      setCurrentUser(res.user);

      // Load permissions
      const perms = await api.get<UserPermission[]>(`/api/permissions/user/${res.user.id}`);
      setUserPermissions(perms);

      return { success: true, user: res.user };
    } catch (err: any) {
      return { success: false, error: err.message || "Login failed" };
    }
  };

  const logout = () => {
    clearToken();
    localStorage.removeItem(SESSION_KEY);
    setCurrentUser(null);
    setUserPermissions([]);
    navigate({ to: "/login", replace: true });
  };

  const refreshPermissions = useCallback(async () => {
    if (!currentUser) return;
    try {
      const perms = await api.get<UserPermission[]>(`/api/permissions/user/${currentUser.id}`);
      setUserPermissions(perms);
    } catch {}
  }, [currentUser]);

  const can = useCallback((moduleKey: string, action: "view" | "create" | "edit" | "delete" | "print" | "export" = "view"): boolean => {
    if (!currentUser) return false;
    if (currentUser.role === "admin") return true;

    const perm = userPermissions.find((p) => p.moduleKey === moduleKey);
    if (!perm) return false;

    switch (action) {
      case "view": return perm.canView;
      case "create": return perm.canCreate;
      case "edit": return perm.canEdit;
      case "delete": return perm.canDelete;
      case "print": return perm.canPrint;
      case "export": return perm.canExport;
      default: return perm.canView;
    }
  }, [currentUser, userPermissions]);

  const getPermissions = useCallback(async (userId: number): Promise<UserPermission[]> => {
    return api.get<UserPermission[]>(`/api/permissions/user/${userId}`);
  }, []);

  const updatePassword = useCallback(async (userId: number, currentPassword: string, newPassword: string): Promise<{ success: boolean; error?: string }> => {
    try {
      await api.put("/api/auth/password", { currentPassword, newPassword });
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || "Failed to update password" };
    }
  }, []);

  return (
      <AuthContext.Provider
        value={{
          currentUser,
          isAuthenticated: !!currentUser,
          isAdmin: currentUser?.role === "admin",
          isManager: currentUser?.role === "manager",
          isLoading,
          login,
          logout,
          can,
          getPermissions,
          refreshPermissions,
          updatePassword,
        }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
