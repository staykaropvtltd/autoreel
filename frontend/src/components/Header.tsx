import { useState } from "react";
import type { BrandingInfo } from "../branding";
import { useAuth } from "../context/AuthContext";

interface HeaderProps {
  branding: BrandingInfo;
}

export default function Header({ branding }: HeaderProps) {
  const [logoFailed, setLogoFailed] = useState(false);
  const { user, logout } = useAuth();

  return (
    <header className="border-b border-[var(--color-border)] bg-[var(--color-surface)] transition-colors duration-300">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        
        {/* BRAND */}
        <div className="flex items-center gap-3 min-w-0">
          {!logoFailed && (
            <img
              src={branding.logo_url}
              alt={branding.name}
              onError={() => setLogoFailed(true)}
              className="h-10 w-auto object-contain shrink-0"
            />
          )}

          <div className="min-w-0">
            <p className="text-sm sm:text-base font-semibold tracking-wide text-[var(--color-text-primary)] truncate">
              {branding.name}
            </p>
          </div>
        </div>

        {/* RIGHT SIDE */}
        <div className="flex items-center gap-3 shrink-0">
          
          <div className="text-right hidden sm:block">
            <p className="text-sm font-medium text-[var(--color-brand-primary)]">
              Auto-Reel
            </p>

            <p className="text-[11px] text-[var(--color-text-secondary)]">
              {branding.tagline || "AI Content Studio"}
            </p>
          </div>

          {user && (
            <div className="flex items-center gap-2 pl-3 border-l border-[var(--color-border)]">
              
              {user.avatar && (
                <img
                  src={user.avatar}
                  alt={user.name}
                  className="w-7 h-7 rounded-full object-cover border border-[var(--color-border)]"
                />
              )}

              <span className="text-xs font-semibold text-[var(--color-text-primary)] hidden md:inline truncate max-w-[100px]">
                {user.name}
              </span>

              <button
                onClick={logout}
                title="Log Out"
                className="text-[11px] font-mono text-[var(--color-text-secondary)] hover:text-red-500 cursor-pointer transition-colors px-1.5 py-0.5 rounded"
              >
                Exit
              </button>

            </div>
          )}
        </div>

      </div>
    </header>
  );
}