import { useState, type FormEvent } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Mail, Lock, User as UserIcon, Building2, Eye, EyeOff, X, CheckCircle2 } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useTheme } from "../../context/ThemeContext";
import { useDialogFocus } from "../../hooks/useDialogFocus";

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialMode?: "signin" | "signup";
  onSuccess?: () => void;
}

// Official Multi-color Google SVG icon
function GoogleIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24">
      <path
        fill="#4285F4"
        d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z"
      />
      <path
        fill="#FBBC05"
        d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.99 0 12s.45 3.82 1.25 5.42l4.03-3.15z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
      />
    </svg>
  );
}

export default function AuthModal({
  isOpen,
  onClose,
  initialMode = "signin",
  onSuccess,
}: AuthModalProps) {
  const { theme } = useTheme();
  const isLight = theme === "light";
  const { loginWithGoogle, loginWithEmail, signupWithEmail, isLoading } = useAuth();

  const [mode, setMode] = useState<"signin" | "signup">(initialMode);
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [brandName, setBrandName] = useState("");
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);
  const dialogRef = useDialogFocus<HTMLDivElement>(isOpen, onClose);

  if (!isOpen) return null;

  const handleGoogleSignIn = async () => {
    try {
      setError(null);
      await loginWithGoogle();
      setIsSuccess(true);
      setTimeout(() => {
        setIsSuccess(false);
        onSuccess?.();
        onClose();
      }, 700);
    } catch {
      setError("Failed to sign in with Google. Please try again.");
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email || !password) {
      setError("Please fill in all required fields.");
      return;
    }

    if (mode === "signup" && !name) {
      setError("Please enter your name.");
      return;
    }

    try {
      if (mode === "signin") {
        await loginWithEmail(email, password);
      } else {
        await signupWithEmail(name, email, password, brandName);
      }
      setIsSuccess(true);
      setTimeout(() => {
        setIsSuccess(false);
        onSuccess?.();
        onClose();
      }, 700);
    } catch {
      setError("Authentication failed. Please verify credentials.");
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-black/80 backdrop-blur-md cursor-pointer"
        />

        {/* Modal Dialog */}
        <motion.div
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby="auth-modal-title"
          tabIndex={-1}
          initial={{ opacity: 0, scale: 0.94, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.94, y: 15 }}
          transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
          className={`relative w-full max-w-[440px] rounded-[32px] p-6 sm:p-8 shadow-2xl z-10 transition-colors ${
            isLight
              ? "bg-white border-2 border-orange-400/30 text-[#18181B] shadow-[0_25px_80px_rgba(252,115,28,0.18)]"
              : "bg-[#111116] border border-white/20 text-white shadow-[0_30px_90px_rgba(0,0,0,0.98)]"
          }`}
        >
          {/* Close Button */}
          <button
            onClick={onClose}
            className={`absolute top-5 right-5 w-8 h-8 rounded-full flex items-center justify-center transition-colors cursor-pointer ${
              isLight
                ? "bg-neutral-100 hover:bg-neutral-200 text-neutral-800"
                : "bg-white/10 hover:bg-white/20 text-white"
            }`}
            aria-label="Close dialog"
          >
            <X className="w-4 h-4" />
          </button>

          {/* Success Overlay state */}
          {isSuccess ? (
            <div className="py-12 flex flex-col items-center justify-center space-y-4 text-center">
              <div
                className={`w-16 h-16 rounded-full flex items-center justify-center ${
                  isLight ? "bg-emerald-100 text-emerald-600" : "bg-white text-black"
                }`}
              >
                <CheckCircle2 className="w-10 h-10" />
              </div>
              <div className="space-y-1">
                <h3 id="auth-modal-title" className="font-serif text-2xl font-bold">
                  {mode === "signin" ? "Welcome Back!" : "Account Created!"}
                </h3>
                <p className={`text-xs ${isLight ? "text-neutral-600" : "text-neutral-400"}`}>
                  Entering Kaladhar Studio...
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Header Title & Tag */}
              <div className="text-center space-y-1.5">
                <div
                  className={`inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-[10px] font-mono uppercase tracking-widest font-bold ${
                    isLight
                      ? "bg-orange-100/80 text-orange-900 border border-orange-200"
                      : "bg-white/10 text-neutral-300 border border-white/15"
                  }`}
                >
                  Kaladhar Studio Access
                </div>
                <h3 id="auth-modal-title" className="font-serif text-2xl sm:text-3xl font-bold tracking-tight">
                  {mode === "signin" ? "Sign In to Your Studio" : "Create Creator Account"}
                </h3>
                <p className={`text-xs font-sans ${isLight ? "text-neutral-600" : "text-neutral-400"}`}>
                  {mode === "signin"
                    ? "Manage your auto-reels, brand assets, and batch runs."
                    : "Generate viral 9:16 vertical Reels from raw photoshoot footage."}
                </p>
              </div>

              {/* Mode Switcher Tabs */}
              <div
                className={`p-1 rounded-2xl flex items-center transition-colors ${
                  isLight ? "bg-neutral-100 border border-neutral-200" : "bg-[#181822] border border-white/10"
                }`}
              >
                <button
                  type="button"
                  onClick={() => {
                    setMode("signin");
                    setError(null);
                  }}
                  className={`flex-1 py-2 text-xs font-bold font-mono tracking-wider uppercase rounded-xl transition-all cursor-pointer ${
                    mode === "signin"
                      ? isLight
                        ? "bg-white text-black shadow-sm"
                        : "bg-white text-black shadow-sm"
                      : isLight
                      ? "text-neutral-600 hover:text-black"
                      : "text-neutral-400 hover:text-white"
                  }`}
                >
                  Sign In
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMode("signup");
                    setError(null);
                  }}
                  className={`flex-1 py-2 text-xs font-bold font-mono tracking-wider uppercase rounded-xl transition-all cursor-pointer ${
                    mode === "signup"
                      ? isLight
                        ? "bg-gradient-to-r from-[#FF611A] to-[#FC731C] text-white shadow-sm"
                        : "bg-white text-black shadow-sm"
                      : isLight
                      ? "text-neutral-600 hover:text-black"
                      : "text-neutral-400 hover:text-white"
                  }`}
                >
                  Sign Up
                </button>
              </div>

              {/* 1. PRIMARY SOCIAL ACTION: Official Google Sign-In Button */}
              <div className="space-y-3">
                <button
                  type="button"
                  onClick={handleGoogleSignIn}
                  disabled={isLoading}
                  className={`w-full py-3 px-4 rounded-2xl border flex items-center justify-center gap-3 text-xs sm:text-sm font-semibold transition-all cursor-pointer shadow-xs active:scale-[0.99] ${
                    isLight
                      ? "bg-white hover:bg-neutral-50 border-neutral-300 text-[#18181B] hover:shadow-md"
                      : "bg-[#181820] hover:bg-[#22222C] border-white/20 text-white"
                  }`}
                >
                  <GoogleIcon className="w-5 h-5 shrink-0" />
                  <span>Continue with Google</span>
                </button>

                {/* Subtle Divider */}
                <div className="flex items-center gap-3">
                  <div className={`flex-1 h-px ${isLight ? "bg-neutral-200" : "bg-white/15"}`} />
                  <span
                    className={`text-[10px] font-mono tracking-widest uppercase ${
                      isLight ? "text-neutral-500" : "text-neutral-400"
                    }`}
                  >
                    or with email
                  </span>
                  <div className={`flex-1 h-px ${isLight ? "bg-neutral-200" : "bg-white/15"}`} />
                </div>
              </div>

              {/* Error Banner */}
              {error && (
                <div
                  role="alert"
                  className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
                    isLight
                      ? "bg-red-50 border border-red-200 text-red-700"
                      : "bg-red-950/40 border border-red-800/60 text-red-200"
                  }`}
                >
                  <span>⚠️</span>
                  <span>{error}</span>
                </div>
              )}

              {/* 2. EMAIL & PASSWORD FORM */}
              <form onSubmit={handleSubmit} className="space-y-3.5">
                {/* Full Name field (Sign Up only) */}
                {mode === "signup" && (
                  <div className="space-y-1">
                    <label
                      htmlFor="auth-full-name"
                      className={`text-[11px] font-mono uppercase tracking-wider block font-bold ${
                        isLight ? "text-neutral-700" : "text-neutral-300"
                      }`}
                    >
                      Full Name *
                    </label>
                    <div className="relative">
                      <UserIcon
                        className={`w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none ${
                          isLight ? "text-neutral-400" : "text-neutral-500"
                        }`}
                      />
                      <input
                        id="auth-full-name"
                        type="text"
                        required
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Ritu Sharma"
                        className={`w-full pl-10 pr-3.5 py-2.5 rounded-xl border text-xs sm:text-sm transition-colors outline-none focus:ring-2 ${
                          isLight
                            ? "bg-neutral-50 border-neutral-300 text-black focus:border-[#FC731C] focus:ring-orange-500/20"
                            : "bg-[#181822] border-white/15 text-white focus:border-white focus:ring-white/20"
                        }`}
                      />
                    </div>
                  </div>
                )}

                {/* Saree Boutique / Brand Name field (Sign Up only) */}
                {mode === "signup" && (
                  <div className="space-y-1">
                    <label
                      htmlFor="auth-brand-name"
                      className={`text-[11px] font-mono uppercase tracking-wider block font-bold ${
                        isLight ? "text-neutral-700" : "text-neutral-300"
                      }`}
                    >
                      Boutique / Brand Name (Optional)
                    </label>
                    <div className="relative">
                      <Building2
                        className={`w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none ${
                          isLight ? "text-neutral-400" : "text-neutral-500"
                        }`}
                      />
                      <input
                        id="auth-brand-name"
                        type="text"
                        value={brandName}
                        onChange={(e) => setBrandName(e.target.value)}
                        placeholder="e.g. Kalakriti Silks"
                        className={`w-full pl-10 pr-3.5 py-2.5 rounded-xl border text-xs sm:text-sm transition-colors outline-none focus:ring-2 ${
                          isLight
                            ? "bg-neutral-50 border-neutral-300 text-black focus:border-[#FC731C] focus:ring-orange-500/20"
                            : "bg-[#181822] border-white/15 text-white focus:border-white focus:ring-white/20"
                        }`}
                      />
                    </div>
                  </div>
                )}

                {/* Email field */}
                <div className="space-y-1">
                  <label
                    htmlFor="auth-email"
                    className={`text-[11px] font-mono uppercase tracking-wider block font-bold ${
                      isLight ? "text-neutral-700" : "text-neutral-300"
                    }`}
                  >
                    Email Address *
                  </label>
                  <div className="relative">
                    <Mail
                      className={`w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none ${
                        isLight ? "text-neutral-400" : "text-neutral-500"
                      }`}
                    />
                    <input
                    id="auth-email"
                    autoComplete="email"
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="creator@brand.com"
                      className={`w-full pl-10 pr-3.5 py-2.5 rounded-xl border text-xs sm:text-sm transition-colors outline-none focus:ring-2 ${
                        isLight
                          ? "bg-neutral-50 border-neutral-300 text-black focus:border-[#FC731C] focus:ring-orange-500/20"
                          : "bg-[#181822] border-white/15 text-white focus:border-white focus:ring-white/20"
                      }`}
                    />
                  </div>
                </div>

                {/* Password field */}
                <div className="space-y-1">
                  <label
                    htmlFor="auth-password"
                    className={`text-[11px] font-mono uppercase tracking-wider block font-bold ${
                      isLight ? "text-neutral-700" : "text-neutral-300"
                    }`}
                  >
                    Password *
                  </label>
                  <div className="relative">
                    <Lock
                      className={`w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none ${
                        isLight ? "text-neutral-400" : "text-neutral-500"
                      }`}
                    />
                    <input
                    id="auth-password"
                    autoComplete={mode === "signin" ? "current-password" : "new-password"}
                      type={showPassword ? "text" : "password"}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className={`w-full pl-10 pr-10 py-2.5 rounded-xl border text-xs sm:text-sm transition-colors outline-none focus:ring-2 ${
                        isLight
                          ? "bg-neutral-50 border-neutral-300 text-black focus:border-[#FC731C] focus:ring-orange-500/20"
                          : "bg-[#181822] border-white/15 text-white focus:border-white focus:ring-white/20"
                      }`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className={`absolute right-3 top-1/2 -translate-y-1/2 p-1 cursor-pointer transition-colors ${
                        isLight ? "text-neutral-500 hover:text-black" : "text-neutral-400 hover:text-white"
                      }`}
                      aria-label="Toggle password visibility"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Remember Me & Forgot Password (Sign In only) */}
                {mode === "signin" && (
                  <div className="flex items-center justify-between text-xs pt-1">
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={rememberMe}
                        onChange={(e) => setRememberMe(e.target.checked)}
                        className={`rounded ${
                          isLight ? "accent-[#FC731C]" : "accent-white"
                        }`}
                      />
                      <span className={isLight ? "text-neutral-600" : "text-neutral-400"}>
                        Remember me
                      </span>
                    </label>

                    <button
                      type="button"
                      onClick={() => alert("Password reset instructions sent to your email.")}
                      className={`font-medium transition-colors cursor-pointer ${
                        isLight ? "text-[#E05305] hover:underline" : "text-neutral-300 hover:underline"
                      }`}
                    >
                      Forgot password?
                    </button>
                  </div>
                )}

                {/* Primary Submit Button */}
                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={isLoading}
                    className={`w-full py-3 rounded-2xl font-mono font-bold text-xs tracking-wider uppercase transition-all cursor-pointer shadow-md active:scale-[0.99] flex items-center justify-center gap-2 ${
                      isLight
                        ? "bg-gradient-to-r from-[#FF611A] to-[#FC731C] text-white hover:brightness-105 shadow-[0_4px_16px_rgba(252,115,28,0.4)]"
                        : "bg-white text-black hover:bg-neutral-200"
                    }`}
                  >
                    {isLoading ? (
                      <span className="animate-pulse">Authorizing...</span>
                    ) : (
                      <span>
                        {mode === "signin" ? "Sign In to Studio →" : "Create Free Account →"}
                      </span>
                    )}
                  </button>
                </div>
              </form>

              {/* Footer Switcher Note */}
              <div
                className={`text-center text-xs pt-1 border-t transition-colors ${
                  isLight ? "border-neutral-200 text-neutral-600" : "border-white/10 text-neutral-400"
                }`}
              >
                {mode === "signin" ? (
                  <span>
                    New to Kaladhar Auto-Reel?{" "}
                    <button
                      type="button"
                      onClick={() => {
                        setMode("signup");
                        setError(null);
                      }}
                      className={`font-bold transition-colors cursor-pointer ${
                        isLight ? "text-[#E05305] hover:underline" : "text-white hover:underline"
                      }`}
                    >
                      Sign Up Free
                    </button>
                  </span>
                ) : (
                  <span>
                    Already have a studio account?{" "}
                    <button
                      type="button"
                      onClick={() => {
                        setMode("signin");
                        setError(null);
                      }}
                      className={`font-bold transition-colors cursor-pointer ${
                        isLight ? "text-[#E05305] hover:underline" : "text-white hover:underline"
                      }`}
                    >
                      Sign In
                    </button>
                  </span>
                )}
              </div>
            </div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
