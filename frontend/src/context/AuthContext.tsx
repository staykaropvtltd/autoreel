
import {
  useEffect,
  createContext,
  useContext,
  useState,
  type ReactNode,
} from "react";

import {
  loginWithEmail as apiLoginWithEmail,
  loginWithGoogleCredential as apiLoginWithGoogleCredential,
  signupWithEmail as apiSignupWithEmail,
  clearAuthToken,
  getAuthToken,
  type AuthUser,
  getUserPreferences,
  updateUserPreferences as apiUpdateUserPreferences,
  type UserPreferences,
  type UserPreferencesUpdate,
  updateUserProfile as apiUpdateUserProfile,
} from "../api";
import { useTheme } from "./ThemeContext";

export interface User {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  provider: "google" | "email";
  brandName?: string;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  loginWithEmail: (
    email: string,
    password: string
  ) => Promise<void>;
  signupWithEmail: (
    name: string,
    email: string,
    password: string,
    brandName?: string
  ) => Promise<void>;
  loginWithGoogleCredential: (
    credential: string
  ) => Promise<void>;
  logout: () => void;
  updateBrandName: (brandName: string) => Promise<void>;
  preferences: UserPreferences | null;
  preferencesLoading: boolean;
  updatePreferences: (changes: UserPreferencesUpdate) => Promise<void>;
  saveProfile: (name: string, brandName: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(
  undefined
);

const LEGACY_USER_STORAGE_KEY = "kaladhar_user";

function createAvatar(name: string): string {
  return `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(
    name
  )}&backgroundColor=18181b,27272a&textColor=ffffff`;
}

function mapBackendUser(backendUser: AuthUser): User {
  return {
    id: backendUser.id,
    name: backendUser.name,
    email: backendUser.email,
    provider: backendUser.provider,
    brandName: backendUser.brandName || undefined,
    avatar: backendUser.avatar || createAvatar(backendUser.name),
  };
}

export function AuthProvider({
  children,
}: {
  children: ReactNode;
}) {
  const { setTheme } = useTheme();
  const [user, setUser] = useState<User | null>(() => {
    try {
      if (!getAuthToken()) {
        localStorage.removeItem(LEGACY_USER_STORAGE_KEY);
        return null;
      }
      const savedUser = localStorage.getItem(
        LEGACY_USER_STORAGE_KEY
      );

      return savedUser ? (JSON.parse(savedUser) as User) : null;
    } catch {
      return null;
    }
  });

  const [isAuthenticated, setIsAuthenticated] = useState(
    () => !!getAuthToken() && !!localStorage.getItem(LEGACY_USER_STORAGE_KEY)
  );

  const [isLoading, setIsLoading] = useState(false);
  const [preferences, setPreferences] = useState<UserPreferences | null>(null);
  const [preferencesLoading, setPreferencesLoading] = useState(false);

  useEffect(() => {
    if (!isAuthenticated || !user) {
      setPreferences(null);
      setPreferencesLoading(false);
      return;
    }
    let active = true;
    setPreferencesLoading(true);
    getUserPreferences().then((loaded) => {
      if (!active || loaded.user_id !== user.id) return;
      setPreferences(loaded);
      setTheme(loaded.theme);
    }).catch((error) => {
      console.error("Could not load account preferences", error);
    }).finally(() => {
      if (active) setPreferencesLoading(false);
    });
    return () => { active = false; };
  }, [isAuthenticated, user?.id]);

  const updatePreferences = async (changes: UserPreferencesUpdate) => {
    const updated = await apiUpdateUserPreferences(changes);
    if (!user || updated.user_id !== user.id) return;
    setPreferences(updated);
    if (changes.theme) setTheme(changes.theme);
  };

  const saveProfile = async (name: string, brandName: string) => {
    await apiUpdateUserProfile(name.trim(), brandName.trim());
    if (user) setSessionUser({ ...user, name: name.trim(), brandName: brandName.trim() });
  };

  const setSessionUser = (newUser: User | null) => {
    setUser(newUser);
    setIsAuthenticated(!!newUser);

    if (newUser) {
      localStorage.setItem(
        LEGACY_USER_STORAGE_KEY,
        JSON.stringify(newUser)
      );
    } else {
      localStorage.removeItem(LEGACY_USER_STORAGE_KEY);
    }
  };

  const loginWithEmail = async (
    email: string,
    password: string
  ) => {
    setIsLoading(true);

    try {
      const response = await apiLoginWithEmail(
        email.trim(),
        password
      );

      setSessionUser(mapBackendUser(response.user));
    } finally {
      setIsLoading(false);
    }
  };

  const signupWithEmail = async (
    name: string,
    email: string,
    password: string,
    brandName?: string
  ) => {
    setIsLoading(true);

    try {
      const response = await apiSignupWithEmail({
        name: name.trim(),
        email: email.trim(),
        password,
        brand_name: brandName?.trim() || undefined,
      });

      setSessionUser(mapBackendUser(response.user));
    } finally {
      setIsLoading(false);
    }
  };

  const loginWithGoogleCredential = async (
    credential: string
  ) => {
    setIsLoading(true);

    try {
      const response = await apiLoginWithGoogleCredential(credential);
      const user = mapBackendUser(response.user);
      user.avatar = `https://lh3.googleusercontent.com/a/default-user=s96-c`;
      setSessionUser(user);
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    clearAuthToken();
    setSessionUser(null);
    setPreferences(null);
    setTheme("dark");
  };

  const updateBrandName = async (brandName: string) => {
    if (!user) return;
    await apiUpdateUserProfile(user.name, brandName.trim());
    setSessionUser({
      ...user,
      brandName: brandName.trim() || undefined,
    });
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated,
        isLoading,
        loginWithEmail,
        signupWithEmail,
        loginWithGoogleCredential,
        logout,
        updateBrandName,
        preferences,
        preferencesLoading,
        updatePreferences,
        saveProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error(
      "useAuth must be used within an AuthProvider"
    );
  }

  return context;
}
