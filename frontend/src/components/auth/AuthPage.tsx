import { useState, useEffect, useRef, type FormEvent } from "react";
import { useAuth } from "../../context/AuthContext";
import { useTheme } from "../../context/ThemeContext";
import IOKnob from "../landing/IOKnob";
import {
  loadGoogleGsiScript,
  getGoogleClientId,
} from "../../services/googleAuth";
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  User,
  Tag,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";

interface AuthPageProps {
  initialMode?: "signin" | "signup";
  onSuccess: () => void;
  onBackToHome: () => void;
  onSwitchMode: (mode: "signin" | "signup") => void;
}

export default function AuthPage({
  initialMode = "signin",
  onSuccess,
  onBackToHome,
  onSwitchMode,
}: AuthPageProps) {
  const mode = initialMode;
  const { theme } = useTheme();
  const isLight = theme === "light";
  const { loginWithGoogleCredential, loginWithEmail, signupWithEmail } = useAuth();

  // Clean empty inputs - no hardcoded or testing garbage values
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [brandName, setBrandName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);

  // States
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [googleClientConfigured, setGoogleClientConfigured] = useState(false);

  const googleBtnContainerRef = useRef<HTMLDivElement>(null);
  const googleLoginRef = useRef(loginWithGoogleCredential);
  const onSuccessRef = useRef(onSuccess);
  googleLoginRef.current = loginWithGoogleCredential;
  onSuccessRef.current = onSuccess;

  // Initialize Google Identity Services (GSI)
  useEffect(() => {
    const clientId = getGoogleClientId();
    if (!clientId) {
      setGoogleClientConfigured(false);
      return;
    }

    setGoogleClientConfigured(false);

    loadGoogleGsiScript().then((loaded) => {
      if (!loaded || !window.google?.accounts?.id) return;
      setGoogleClientConfigured(true);

      try {
        window.google.accounts.id.initialize({
          client_id: clientId,
          callback: async (response) => {
            if (response.credential) {
              setIsLoading(true);
              setError(null);
              try {
                await googleLoginRef.current(response.credential);
                setSuccessMessage("Signed in with Google! Opening Studio...");
                setTimeout(() => {
                  onSuccessRef.current();
                }, 600);
              } catch {
                setError("Google authentication failed. Please try again.");
              } finally {
                setIsLoading(false);
              }
            }
          },
          cancel_on_tap_outside: true,
        });

        window.setTimeout(() => {
          const container = googleBtnContainerRef.current;
          if (!container || !window.google?.accounts?.id) return;
          container.innerHTML = "";
          window.google.accounts.id.renderButton(container, {
            type: "standard",
            theme: isLight ? "outline" : "filled_black",
            size: "large",
            text: mode === "signin" ? "signin_with" : "signup_with",
            shape: "pill",
            width: 360,
            logo_alignment: "left",
          });
        }, 0);
      } catch (err) {
        console.warn("Google GSI initialization error:", err);
      }
    });
  }, [isLight, mode]);

  // Submit Handler (1-click passthrough for email form)
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      if (mode === "signin") {
        const userEmail = email.trim();
        if (!userEmail || !password) throw new Error("Email and password are required.");
        await loginWithEmail(userEmail, password);
        setSuccessMessage("Signed in successfully! Opening Dashboard...");
        setTimeout(() => {
          onSuccess();
        }, 400);
      } else {
        const userName = name.trim();
        const userEmail = email.trim();
        if (!userName || !userEmail || !password) throw new Error("Name, email, and password are required.");
        await signupWithEmail(userName, userEmail, password, brandName.trim());
        setSuccessMessage("Studio account created! Opening Dashboard...");
        setTimeout(() => {
          onSuccess();
        }, 400);
      }
    } catch {
      setError("Authentication failed. Please check your credentials.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      className={`min-h-screen h-screen max-h-screen w-full flex flex-col justify-between items-center font-sans transition-colors duration-300 overflow-y-auto sm:overflow-hidden select-none px-4 ${
        isLight
          ? "bg-[#F7F5F0] text-[#0A0A0C]"
          : "bg-[#09090B] text-white"
      }`}
    >
      {/* 1. TOP UTILITY BAR (FULL WIDTH: BACK ON LEFT, KALADHAR MATHEMATICALLY CENTERED, THEME KNOB ON RIGHT) */}
      <header className="relative w-full px-4 sm:px-8 md:px-12 py-3.5 sm:py-4 flex items-center justify-between z-20 shrink-0">
        {/* Top Left: Back to Home Button */}
        <div className="flex items-center">
          <button
            type="button"
            onClick={onBackToHome}
            className={`group flex items-center gap-1.5 text-xs font-mono uppercase tracking-wider font-semibold transition-all cursor-pointer px-3.5 py-1.5 rounded-full border ${
              isLight
                ? "border-neutral-300 bg-white/80 text-neutral-800 hover:bg-white hover:border-neutral-900 shadow-2xs"
                : "border-white/20 bg-white/5 text-neutral-300 hover:bg-white/15 hover:border-white hover:text-white"
            }`}
          >
            <ArrowLeft className="w-3.5 h-3.5 transition-transform group-hover:-translate-x-0.5" />
            <span>Back to Home</span>
          </button>
        </div>

        {/* Center: Mathematically Screen-Centered KALADHAR Name */}
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center select-none pointer-events-none">
          <span className="font-['Pixelify_Sans',_sans-serif] text-2xl sm:text-3xl md:text-4xl font-bold uppercase tracking-wider leading-none pointer-events-auto">
            KALADHAR
          </span>
          <span
            className={`text-[8px] sm:text-[9px] font-mono tracking-[0.24em] uppercase font-semibold transition-colors pointer-events-auto ${
              isLight ? "text-[#C26715]" : "text-neutral-400"
            }`}
          >
            AUTO-REEL · STUDIO
          </span>
        </div>

        {/* Top Right: Theme Toggle Switch */}
        <div className="flex items-center">
          <IOKnob size="sm" />
        </div>
      </header>

      {/* 2. OPTION C: CENTERED LUXURY CARD (FITS 100% IN VIEWPORT) */}
      <main className="w-full max-w-[430px] my-auto py-2 flex flex-col justify-center min-h-0">
        <div
          className={`w-full rounded-3xl sm:rounded-4xl p-6 sm:p-7 md:p-8 border shadow-2xl transition-all duration-300 ${
            isLight
              ? "bg-white border-[#E5DFD5] shadow-[0_20px_50px_rgba(0,0,0,0.07)] text-neutral-950"
              : "bg-[#121216] border-white/12 shadow-[0_20px_60px_rgba(0,0,0,0.85)] text-white"
          }`}
        >
          {/* Card Header: Simplified to just Sign In to Studio / Create Studio Account */}
          <div className="text-center mb-6">
            <h1 className="text-2xl sm:text-3xl font-serif font-medium tracking-tight">
              {mode === "signin" ? "Sign In to Studio" : "Create Studio Account"}
            </h1>
          </div>

          {/* Status Notifications */}
          {error && (
            <div role="alert" className="mb-4 p-2.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-600 dark:text-red-400 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}
          {successMessage && (
            <div role="status" aria-live="polite" className="mb-4 p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{successMessage}</span>
            </div>
          )}

          {/* Official Google GSI Button Container (or Custom Button) */}
          <div className="space-y-3">
            {googleClientConfigured ? (
              <div
                ref={googleBtnContainerRef}
                className="w-full flex items-center justify-center min-h-[40px]"
              />
            ) : (
              <button
                type="button"
                disabled
                className={`w-full py-2.5 px-4 rounded-xl border font-mono font-bold text-xs tracking-wider uppercase flex items-center justify-center gap-2.5 transition-all cursor-pointer shadow-2xs ${
                  isLight
                    ? "bg-white hover:bg-neutral-50 text-neutral-800 border-neutral-300 hover:border-neutral-400"
                    : "bg-white/10 hover:bg-white/15 text-white border-white/20 hover:border-white/35"
                }`}
              >
                {/* Official 4-Color Google G Logo */}
                <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
                <span>Google sign-in is not configured</span>
              </button>
            )}

            {/* Divider */}
            <div className="relative flex items-center justify-center my-3">
              <div
                className={`w-full border-t ${
                  isLight ? "border-neutral-200" : "border-white/10"
                }`}
              />
              <span
                className={`absolute px-2.5 text-[10px] font-mono uppercase tracking-wider ${
                  isLight ? "bg-white text-neutral-500" : "bg-[#121216] text-neutral-400"
                }`}
              >
                or continue with email
              </span>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} autoComplete="off" className="space-y-3">
              {mode === "signup" && (
                <>
                  {/* Full Name */}
                  <div className="space-y-1 text-left">
                    <label
                      htmlFor="full-name"
                      className={`text-[11px] font-mono uppercase tracking-wider font-semibold ${
                        isLight ? "text-neutral-700" : "text-neutral-300"
                      }`}
                    >
                      Full Name
                    </label>
                    <div className="relative">
                      <User className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 opacity-50" />
                      <input
                        id="full-name"
                        type="text"
                        required
                        autoComplete="off"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Your full name"
                        className={`w-full pl-9 pr-3 py-2 rounded-xl text-xs sm:text-sm border transition-colors outline-hidden ${
                          isLight
                            ? "bg-neutral-50 border-neutral-300 text-neutral-950 focus:border-black focus:bg-white"
                            : "bg-white/5 border-white/15 text-white focus:border-white focus:bg-white/10"
                        }`}
                      />
                    </div>
                  </div>

                  {/* Boutique / Brand Name */}
                  <div className="space-y-1 text-left">
                    <label
                      htmlFor="brand-name"
                      className={`text-[11px] font-mono uppercase tracking-wider font-semibold ${
                        isLight ? "text-neutral-700" : "text-neutral-300"
                      }`}
                    >
                      Boutique / Brand Name
                    </label>
                    <div className="relative">
                      <Tag className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 opacity-50" />
                      <input
                        id="brand-name"
                        type="text"
                        autoComplete="off"
                        value={brandName}
                        onChange={(e) => setBrandName(e.target.value)}
                        placeholder="Brand or boutique name"
                        className={`w-full pl-9 pr-3 py-2 rounded-xl text-xs sm:text-sm border transition-colors outline-hidden ${
                          isLight
                            ? "bg-neutral-50 border-neutral-300 text-neutral-950 focus:border-black focus:bg-white"
                            : "bg-white/5 border-white/15 text-white focus:border-white focus:bg-white/10"
                        }`}
                      />
                    </div>
                  </div>
                </>
              )}

              {/* Email Address */}
              <div className="space-y-1 text-left">
                <label
                  htmlFor="email-address"
                  className={`text-[11px] font-mono uppercase tracking-wider font-semibold ${
                    isLight ? "text-neutral-700" : "text-neutral-300"
                  }`}
                >
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 opacity-50" />
                  <input
                    id="email-address"
                    type="email"
                    required
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@boutique.com"
                    className={`w-full pl-9 pr-3 py-2 rounded-xl text-xs sm:text-sm border transition-colors outline-hidden ${
                      isLight
                        ? "bg-neutral-50 border-neutral-300 text-neutral-950 focus:border-black focus:bg-white"
                        : "bg-white/5 border-white/15 text-white focus:border-white focus:bg-white/10"
                    }`}
                  />
                </div>
              </div>

              {/* Password */}
              <div className="space-y-1 text-left">
                <label
                  htmlFor="user-password"
                  className={`text-[11px] font-mono uppercase tracking-wider font-semibold ${
                    isLight ? "text-neutral-700" : "text-neutral-300"
                  }`}
                >
                  Password
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 opacity-50" />
                  <input
                    id="user-password"
                    type={showPassword ? "text" : "password"}
                    required
                    autoComplete={mode === "signin" ? "current-password" : "new-password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter password"
                    className={`w-full pl-9 pr-9 py-2 rounded-xl text-xs sm:text-sm border transition-colors outline-hidden ${
                      isLight
                        ? "bg-neutral-50 border-neutral-300 text-neutral-950 focus:border-black focus:bg-white"
                        : "bg-white/5 border-white/15 text-white focus:border-white focus:bg-white/10"
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    className="absolute right-3 top-1/2 -translate-y-1/2 opacity-50 hover:opacity-100 transition-opacity cursor-pointer"
                  >
                    {showPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              {/* Remember Me & Forgot Password (Sign In only) */}
              {mode === "signin" && (
                <div className="flex items-center justify-between text-[11px] pt-0.5">
                  <label className="flex items-center gap-1.5 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="rounded border-neutral-400 accent-neutral-900"
                    />
                    <span className={isLight ? "text-neutral-600" : "text-neutral-400"}>
                      Remember this studio
                    </span>
                  </label>
                  <button
                    type="button"
                    onClick={() =>
                      alert("Password reset instructions sent to your email.")
                    }
                    className={`transition-colors cursor-pointer ${
                      isLight
                        ? "text-[#E05305] hover:underline"
                        : "text-neutral-300 hover:text-white hover:underline"
                    }`}
                  >
                    Forgot password?
                  </button>
                </div>
              )}

              {/* Submit CTA */}
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isLoading}
                  className={`w-full py-2.5 px-5 rounded-xl font-bold text-xs tracking-wider uppercase transition-all cursor-pointer flex items-center justify-center gap-2 shadow-sm ${
                    isLight
                      ? "bg-gradient-to-r from-[#FF611A] to-[#FC731C] text-white hover:brightness-105 shadow-[0_3px_14px_rgba(252,115,28,0.35)]"
                      : "bg-white text-black hover:bg-neutral-200 shadow-md"
                  }`}
                >
                  {isLoading ? (
                    <span>Validating credentials...</span>
                  ) : (
                    <>
                      <span>
                        {mode === "signin"
                          ? "Sign In to Studio"
                          : "Create Free Studio Account"}
                      </span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </>
                  )}
                </button>
              </div>
            </form>

            {/* Switch Mode Link */}
            <div className="pt-2 text-center text-xs">
              {mode === "signin" ? (
                <p className={isLight ? "text-neutral-600" : "text-neutral-400"}>
                  New to Kaladhar?{" "}
                  <button
                    type="button"
                    onClick={() => onSwitchMode("signup")}
                    className={`font-bold transition-colors cursor-pointer ${
                      isLight
                        ? "text-[#E05305] hover:underline"
                        : "text-white hover:underline"
                    }`}
                  >
                    Create Account →
                  </button>
                </p>
              ) : (
                <p className={isLight ? "text-neutral-600" : "text-neutral-400"}>
                  Already have an account?{" "}
                  <button
                    type="button"
                    onClick={() => onSwitchMode("signin")}
                    className={`font-bold transition-colors cursor-pointer ${
                      isLight
                        ? "text-[#E05305] hover:underline"
                        : "text-white hover:underline"
                    }`}
                  >
                    Sign In →
                  </button>
                </p>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* 3. SUBTLE COMPACT FOOTER */}
      <footer className="w-full py-2 text-center text-[10px] font-mono opacity-40 shrink-0">
        KALADHAR STUDIO
      </footer>
    </div>
  );
}
