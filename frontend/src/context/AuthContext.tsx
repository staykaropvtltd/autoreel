import { createContext, useContext, useState, type ReactNode } from "react";
import { parseGoogleJwt } from "../services/googleAuth";

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
  loginWithEmail: (email: string, password: string) => Promise<void>;
  signupWithEmail: (name: string, email: string, password: string, brandName?: string) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  loginWithGoogleCredential: (credential: string) => Promise<void>;
  logout: () => void;
  updateBrandName: (brandName: string) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);
const LEGACY_USER_STORAGE_KEY = "kaladhar_user";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const setSessionUser = (newUser: User | null) => {
    setUser(newUser);
    setIsAuthenticated(!!newUser);
  };

  const loginWithEmail = async (email: string, _password: string) => {
    setIsLoading(true);
    // Simulate brief network latency for realism
    await new Promise((r) => setTimeout(r, 450));
    const namePart = email.split("@")[0];
    const formattedName = namePart.charAt(0).toUpperCase() + namePart.slice(1);
    const authenticatedUser: User = {
      id: `usr_${Date.now()}`,
      name: formattedName,
      email,
      provider: "email",
      avatar: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(formattedName)}&backgroundColor=18181b,27272a&textColor=ffffff`,
    };
    setSessionUser(authenticatedUser);
    setIsLoading(false);
  };

  const signupWithEmail = async (name: string, email: string, _password: string, brandName?: string) => {
    setIsLoading(true);
    await new Promise((r) => setTimeout(r, 550));
    const newUser: User = {
      id: `usr_${Date.now()}`,
      name: name.trim(),
      email: email.trim(),
      provider: "email",
      brandName: brandName?.trim() || undefined,
      avatar: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(name)}&backgroundColor=18181b,27272a&textColor=ffffff`,
    };
    setSessionUser(newUser);
    setIsLoading(false);
  };

  const loginWithGoogle = async () => {
    setIsLoading(true);
    // Simulate Google OAuth flow delay
    await new Promise((r) => setTimeout(r, 600));
    const googleUser: User = {
      id: `g_${Date.now()}`,
      name: "Kaladhar Creator",
      email: "creator@kaladhar.studio",
      provider: "google",
      avatar: "https://lh3.googleusercontent.com/a/default-user=s96-c",
      brandName: "Ethnic Studio",
    };
    setSessionUser(googleUser);
    setIsLoading(false);
  };

  const loginWithGoogleCredential = async (credential: string) => {
    setIsLoading(true);
    const payload = parseGoogleJwt(credential);
    if (!payload) {
      setIsLoading(false);
      throw new Error("Invalid Google credential received.");
    }
    const googleUser: User = {
      id: payload.sub,
      name: payload.name,
      email: payload.email,
      provider: "google",
      avatar:
        payload.picture ||
        `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(payload.name)}&backgroundColor=18181b,27272a&textColor=ffffff`,
      brandName: payload.given_name ? `${payload.given_name}'s Studio` : "Kaladhar Studio",
    };
    setSessionUser(googleUser);
    setIsLoading(false);
  };

  const logout = () => {
    setSessionUser(null);
    localStorage.removeItem(LEGACY_USER_STORAGE_KEY);
  };

  const updateBrandName = (brandName: string) => {
    if (!user) return;
    const updated = { ...user, brandName };
    setSessionUser(updated);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated,
        isLoading,
        loginWithEmail,
        signupWithEmail,
        loginWithGoogle,
        loginWithGoogleCredential,
        logout,
        updateBrandName,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
