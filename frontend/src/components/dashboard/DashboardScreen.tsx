import { useState, useEffect, useRef } from "react";
import { useAuth } from "../../context/AuthContext";
import { useTheme } from "../../context/ThemeContext";
import IOKnob from "../landing/IOKnob";
import {
  LayoutGrid,
  Film,
  Plus,
  Video,
  Layers,
  Search,
  Sparkles,
  Play,
  Pause,
  Volume2,
  VolumeX,
  Download,
  Trash2,
  Check,
  LogOut,
  Maximize2,
  Calendar,
  Grid,
  List,
  Menu,
  X,
  ArrowUpRight,
  RotateCcw,
  Share2,
} from "lucide-react";

export interface ReelProject {
  id: string;
  title: string;
  category: "Sarees" | "Lehengas" | "Kurtis" | "Bridal";
  durationSeconds: number;
  resolution: string;
  videoUrl: string;
  thumbnailUrl: string;
  createdAt: string;
  viewsCount?: string;
  status: "ready" | "rendering" | "draft";
  productPrice?: string;
}

interface DashboardScreenProps {
  onCreateNewReel: (projectName?: string, category?: string) => void;
  onLaunchDemo?: () => void;
  onBackToLanding: () => void;
}

const SAMPLE_PROJECTS_PRESET: ReelProject[] = [
  {
    id: "reel-001",
    title: "Banarasi Katan Silk Saree · Festive Drop",
    category: "Sarees",
    durationSeconds: 15,
    resolution: "1080x1920 (9:16)",
    videoUrl: "/sample_reel_1.mp4",
    thumbnailUrl: "/tv_model_1.jpg",
    createdAt: "Just now",
    viewsCount: "18.4K",
    status: "ready",
    productPrice: "₹14,500",
  },
  {
    id: "reel-002",
    title: "Bridal Crimson Velvet Lehenga · Heritage Edition",
    category: "Bridal",
    durationSeconds: 10,
    resolution: "1080x1920 (9:16)",
    videoUrl: "/sample_reel_2.mp4",
    thumbnailUrl: "/tv_model_2.jpg",
    createdAt: "Yesterday",
    viewsCount: "42.1K",
    status: "ready",
    productPrice: "₹48,000",
  },
  {
    id: "reel-003",
    title: "Chanderi Zari Handloom Saree · Summer Edit",
    category: "Sarees",
    durationSeconds: 12,
    resolution: "1080x1920 (9:16)",
    videoUrl: "/sample_reel_3.mp4",
    thumbnailUrl: "/tv_model_3.jpg",
    createdAt: "2 days ago",
    viewsCount: "9.8K",
    status: "ready",
    productPrice: "₹8,900",
  },
  {
    id: "reel-004",
    title: "Pastel Mulberry Silk Anarkali Pret",
    category: "Kurtis",
    durationSeconds: 15,
    resolution: "1080x1920 (9:16)",
    videoUrl: "/sample_reel_4.mp4",
    thumbnailUrl: "/tv_editorial_1.jpg",
    createdAt: "3 days ago",
    viewsCount: "26.3K",
    status: "ready",
    productPrice: "₹11,200",
  },
];

export default function DashboardScreen({
  onCreateNewReel,
  onBackToLanding,
}: DashboardScreenProps) {
  const { user, logout } = useAuth();
  const { theme } = useTheme();
  const isLight = theme === "light";

  const storageKey = user ? `kaladhar_reels_${user.id}` : "kaladhar_reels_guest";

  // DEVELOPER-GRADE INITIALIZATION:
  // A fresh user starts with [] (empty library).
  // Projects only exist if saved in localStorage from previous work or loaded via demo.
  const [projects, setProjects] = useState<ReelProject[]>(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed: ReelProject[] = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          // If the storage only contains the old hardcoded sample preset,
          // clear it so the developer/new user sees the true fresh empty state.
          const isOnlyPreset =
            parsed.length === 4 &&
            parsed.every((p) => p.id.startsWith("reel-00"));
          if (isOnlyPreset) {
            return [];
          }
          return parsed.map((p, idx) => {
            if (p.videoUrl?.includes("commondatastorage.googleapis.com") || !p.videoUrl) {
              const fallbackIdx = (idx % 4) + 1;
              return { ...p, videoUrl: `/sample_reel_${fallbackIdx}.mp4` };
            }
            return p;
          });
        }
      }
    } catch {
      // fallback
    }
    return []; // 100% clean empty state for a new user!
  });

  // Sync projects to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(projects));
    } catch {
      // ignore
    }
  }, [projects, storageKey]);

  // Navigation & Filter States
  const [activeTab, setActiveTab] = useState<"library" | "upload" | "collections">("library");
  const [selectedCategory, setSelectedCategory] = useState<string>("All");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeCinemaReel, setActiveCinemaReel] = useState<ReelProject | null>(null);
  const [playingCardId, setPlayingCardId] = useState<string | null>(null);
  const [isMuted, setIsMuted] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // New Reel Modal State (Prompts for Project Name & Category)
  const [newReelModalOpen, setNewReelModalOpen] = useState(false);
  const [newReelTitle, setNewReelTitle] = useState("");
  const [newReelCategory, setNewReelCategory] = useState<"Sarees" | "Lehengas" | "Kurtis" | "Bridal">("Sarees");

  const handleConfirmCreateReel = (e?: React.FormEvent) => {
    e?.preventDefault();
    const finalTitle = newReelTitle.trim() || "Untitled Ethnic Reel";
    onCreateNewReel(finalTitle, newReelCategory);
    setNewReelModalOpen(false);
    setNewReelTitle("");
  };

  // Inline Quick-Start Creator State (for clean empty canvas)
  const [inlineTitle, setInlineTitle] = useState("");
  const [inlineCategory, setInlineCategory] = useState<"Sarees" | "Lehengas" | "Kurtis" | "Bridal">("Sarees");

  const handleInlineCreate = (e?: React.FormEvent) => {
    e?.preventDefault();
    const finalTitle = inlineTitle.trim() || "Untitled Ethnic Reel";
    onCreateNewReel(finalTitle, inlineCategory);
  };

  const handleShare = async (project: ReelProject, e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({
          title: project.title,
          text: `Watch this 9:16 reel by ${displayBrand}: ${project.title}`,
          url: window.location.origin + project.videoUrl,
        });
        return;
      } catch {
        // Fall back to copy link if user cancels or share fails
      }
    }
    handleCopyLink(project.id, e);
  };

  const displayName = user?.name ? user.name : "Creator";
  const displayBrand = user?.brandName ? user.brandName : "Boutique Studio";

  // Filtered list
  const filteredProjects = projects.filter((p) => {
    const matchesCat =
      selectedCategory === "All" || p.category.toLowerCase() === selectedCategory.toLowerCase();
    const matchesSearch =
      !searchQuery.trim() ||
      p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.category.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCat && matchesSearch;
  });

  const handleDeleteProject = (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (confirm("Remove this Reel from your library?")) {
      setProjects((prev) => prev.filter((p) => p.id !== id));
      if (activeCinemaReel?.id === id) setActiveCinemaReel(null);
      if (playingCardId === id) setPlayingCardId(null);
    }
  };

  const handleClearLibrary = () => {
    if (confirm("Reset library to empty? (You can test the fresh new user state)")) {
      setProjects([]);
      localStorage.removeItem(storageKey);
    }
  };

  const handleLoadSampleProjects = () => {
    setProjects(SAMPLE_PROJECTS_PRESET);
  };

  const handleCopyLink = (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    navigator.clipboard.writeText(`${window.location.origin}/#reel-${id}`);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div
      className={`min-h-screen w-full flex font-sans transition-colors duration-200 ${
        isLight ? "bg-[#F7F6F3] text-[#0A0A0C]" : "bg-[#0A0A0C] text-[#EDEDED]"
      }`}
    >
      {/* ========================================================= */}
      {/* 1. LEFT WORKSPACE SIDEBAR                                  */}
      {/* ========================================================= */}
      <aside
        className={`w-64 xl:w-68 shrink-0 border-r hidden lg:flex flex-col justify-between h-screen sticky top-0 z-30 transition-colors ${
          isLight
            ? "bg-white/90 border-[#E5DFD5] backdrop-blur-md"
            : "bg-[#0E0E12]/90 border-white/8 backdrop-blur-md"
        }`}
      >
        <div className="p-4 space-y-5">
          {/* Brand & Studio Identity */}
          <div className="flex items-center justify-between pb-1 border-b border-inherit">
            <button
              onClick={onBackToLanding}
              className="flex items-center gap-2.5 text-left group cursor-pointer"
              title="Return to Kaladhar Landing"
            >
              <div
                className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm text-white shadow-xs ${
                  isLight
                    ? "bg-gradient-to-tr from-[#FF611A] to-[#FC731C]"
                    : "bg-gradient-to-tr from-neutral-800 to-neutral-700 border border-white/10"
                }`}
              >
                K
              </div>
              <div>
                <p className="text-sm font-bold tracking-tight leading-none text-current">
                  KALADHAR
                </p>
                <p className="text-[10px] font-mono tracking-widest text-[#FF611A] font-bold uppercase mt-0.5">
                  STUDIO
                </p>
              </div>
            </button>

            <span
              className={`text-[9px] font-mono font-semibold px-2 py-0.5 rounded-full uppercase tracking-wider border ${
                isLight
                  ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                  : "bg-emerald-950/40 text-emerald-400 border-emerald-800/40"
              }`}
            >
              Active
            </span>
          </div>

          {/* Navigation Links */}
          <nav className="space-y-1">
            <button
              type="button"
              onClick={() => setActiveTab("library")}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-all cursor-pointer ${
                activeTab === "library"
                  ? isLight
                    ? "bg-[#18181B] text-white shadow-xs font-semibold"
                    : "bg-white text-black shadow-xs font-semibold"
                  : isLight
                  ? "text-neutral-600 hover:bg-neutral-100 hover:text-black"
                  : "text-neutral-400 hover:bg-white/5 hover:text-white"
              }`}
            >
              <div className="flex items-center gap-2.5">
                <LayoutGrid className="w-4 h-4" />
                <span>Reel Library</span>
              </div>
              <span
                className={`text-[10px] px-2 py-0.5 rounded-full font-mono font-bold ${
                  activeTab === "library"
                    ? isLight
                      ? "bg-white/20 text-white"
                      : "bg-black/20 text-black"
                    : isLight
                    ? "bg-neutral-200 text-neutral-700"
                    : "bg-white/10 text-neutral-300"
                }`}
              >
                {projects.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setNewReelModalOpen(true)}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-all cursor-pointer ${
                isLight
                  ? "text-neutral-700 hover:bg-neutral-100 hover:text-black"
                  : "text-neutral-300 hover:bg-white/5 hover:text-white"
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Plus className="w-4 h-4 text-[#FF611A]" />
                <span>Create New Reel</span>
              </div>
              <span className="text-[9px] uppercase font-bold text-[#FF611A] bg-[#FF611A]/10 px-1.5 py-0.5 rounded">
                +AI
              </span>
            </button>

            <button
              type="button"
              onClick={() => setNewReelModalOpen(true)}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-all cursor-pointer ${
                isLight
                  ? "text-neutral-600 hover:bg-neutral-100 hover:text-black"
                  : "text-neutral-400 hover:bg-white/5 hover:text-white"
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Video className="w-4 h-4" />
                <span>Photoshoot Uploads</span>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setSelectedCategory("Sarees")}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-all cursor-pointer ${
                isLight
                  ? "text-neutral-600 hover:bg-neutral-100 hover:text-black"
                  : "text-neutral-400 hover:bg-white/5 hover:text-white"
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Layers className="w-4 h-4" />
                <span>Fabric Catalogs</span>
              </div>
              <span className="text-[10px] opacity-60">Sarees</span>
            </button>

            <button
              type="button"
              onClick={onBackToLanding}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-all cursor-pointer ${
                isLight
                  ? "text-neutral-600 hover:bg-neutral-100 hover:text-black"
                  : "text-neutral-400 hover:bg-white/5 hover:text-white"
              }`}
            >
              <div className="flex items-center gap-2.5">
                <ArrowUpRight className="w-4 h-4" />
                <span>Landing Page</span>
              </div>
            </button>
          </nav>
        </div>

        {/* Sidebar Footer: Creator Identity & Logout */}
        <div
          className={`p-3 border-t flex items-center justify-between transition-colors ${
            isLight ? "border-[#E5DFD5]" : "border-white/8"
          }`}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-[#FF611A] to-[#FC731C] text-white flex items-center justify-center text-xs font-bold shrink-0 shadow-xs">
              {displayName.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold truncate leading-tight">
                {displayBrand}
              </p>
              <p className="text-[10px] font-mono opacity-60 truncate">
                {displayName}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              logout();
              onBackToLanding();
            }}
            className="p-1.5 rounded-lg text-neutral-400 hover:text-red-500 hover:bg-red-500/10 transition-colors cursor-pointer shrink-0"
            title="Sign Out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </aside>

      {/* ========================================================= */}
      {/* 2. MAIN WORKSPACE CONTENT AREA                            */}
      {/* ========================================================= */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Header Bar */}
        <header
          className={`sticky top-0 z-20 border-b px-4 sm:px-6 py-3 flex items-center justify-between backdrop-blur-md transition-colors ${
            isLight
              ? "bg-[#F7F6F3]/90 border-[#E5DFD5]"
              : "bg-[#0A0A0C]/90 border-white/8"
          }`}
        >
          {/* Left: Mobile Menu Trigger + Breadcrumb */}
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="p-1.5 rounded-lg lg:hidden border cursor-pointer"
            >
              <Menu className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-1.5 text-xs font-mono">
              <span className="opacity-50">Studio</span>
              <span className="opacity-30">/</span>
              <span className="font-semibold">{displayBrand}</span>
              <span className="opacity-30">/</span>
              <span className="text-[#FF611A] font-bold">
                {projects.length === 0 ? "Get Started" : "Reel Library"}
              </span>
            </div>
          </div>

          {/* Right: Quick Action Controls */}
          <div className="flex items-center gap-3">
            {/* Theme Toggle in Top Right Corner */}
            <div className="flex items-center gap-1.5 pr-1">
              <IOKnob size="sm" />
            </div>

            <button
              type="button"
              onClick={() => setNewReelModalOpen(true)}
              className={`px-4 py-1.5 rounded-full font-mono font-bold text-xs tracking-wider uppercase shadow-xs transition-all cursor-pointer flex items-center gap-1.5 ${
                isLight
                  ? "bg-gradient-to-r from-[#FF611A] to-[#FC731C] text-white hover:brightness-105 shadow-[0_3px_12px_rgba(252,115,28,0.3)]"
                  : "bg-white text-black hover:bg-neutral-200"
              }`}
            >
              <Plus className="w-3.5 h-3.5 stroke-[3]" />
              <span>New Reel</span>
            </button>
          </div>
        </header>

        {/* Dashboard Workspace */}
        <main className="flex-1 p-4 sm:p-6 lg:p-7 space-y-6 max-w-[1340px] w-full mx-auto">
          {/* Header row */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-inherit">
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight">
                  Previous Works
                </h1>
                <span
                  className={`text-xs font-mono font-bold px-2.5 py-0.5 rounded-full ${
                    isLight ? "bg-neutral-200 text-neutral-800" : "bg-white/10 text-neutral-300"
                  }`}
                >
                  {projects.length}
                </span>
              </div>
              <p className={`text-xs mt-0.5 ${isLight ? "text-neutral-500" : "text-neutral-400"}`}>
                Locally saved 9:16 vertical reels ready for Instagram, WhatsApp & social sharing.
              </p>
            </div>

            {/* If projects exist, show search and view controls */}
            {projects.length > 0 && (
              <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                {/* Category Filter Pills */}
                <div className="flex items-center gap-1 overflow-x-auto py-0.5">
                  {["All", "Sarees", "Bridal", "Kurtis"].map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setSelectedCategory(cat)}
                      className={`px-3 py-1 rounded-full text-xs font-mono uppercase font-semibold transition-all cursor-pointer ${
                        selectedCategory.toLowerCase() === cat.toLowerCase()
                          ? isLight
                            ? "bg-neutral-900 text-white shadow-xs"
                            : "bg-white text-black font-bold shadow-xs"
                          : isLight
                          ? "bg-white text-neutral-600 border border-neutral-200 hover:text-black"
                          : "bg-white/5 text-neutral-400 border border-white/8 hover:text-white"
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>

                {/* Search Input */}
                <div className="relative w-44 sm:w-52">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 opacity-50" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search reels..."
                    className={`w-full pl-8 pr-3 py-1.5 rounded-full text-xs border transition-colors outline-hidden ${
                      isLight
                        ? "bg-white border-neutral-300 text-neutral-900 focus:border-black"
                        : "bg-white/5 border-white/10 text-white focus:border-white"
                    }`}
                  />
                </div>

                {/* Grid / List Switcher */}
                <div
                  className={`flex items-center p-0.5 rounded-full border ${
                    isLight ? "bg-neutral-100 border-neutral-200" : "bg-white/5 border-white/10"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => setViewMode("grid")}
                    className={`p-1.5 rounded-full transition-colors cursor-pointer ${
                      viewMode === "grid"
                        ? isLight
                          ? "bg-white text-black shadow-xs"
                          : "bg-white/20 text-white shadow-xs"
                        : "opacity-60 hover:opacity-100"
                    }`}
                    title="Grid View"
                  >
                    <Grid className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode("list")}
                    className={`p-1.5 rounded-full transition-colors cursor-pointer ${
                      viewMode === "list"
                        ? isLight
                          ? "bg-white text-black shadow-xs"
                          : "bg-white/20 text-white shadow-xs"
                        : "opacity-60 hover:opacity-100"
                    }`}
                    title="List View"
                  >
                    <List className="w-3.5 h-3.5" />
                  </button>
                </div>

                <button
                  type="button"
                  onClick={handleClearLibrary}
                  className={`p-1.5 rounded-lg text-xs opacity-60 hover:opacity-100 border cursor-pointer ${
                    isLight ? "border-neutral-200 hover:bg-neutral-100" : "border-white/10 hover:bg-white/5"
                  }`}
                  title="Reset to Empty Library"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>

          {/* Body: High-End Creator Starter Canvas (when empty) vs Active Projects Grid */}
          {projects.length === 0 ? (
            <div
              className={`rounded-2xl p-8 sm:p-12 border transition-all ${
                isLight
                  ? "bg-white border-[#E5DFD5] shadow-xs"
                  : "bg-[#111115] border-white/8 shadow-xs"
              }`}
            >
              <div className="max-w-2xl mx-auto text-center space-y-6">
                {/* Badge & Title */}
                <div className="space-y-2">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-mono font-bold tracking-wider uppercase bg-[#FF611A]/10 text-[#FF611A] border border-[#FF611A]/20">
                    <Sparkles className="w-3 h-3 text-[#FF611A]" />
                    <span>Create Your First Reel</span>
                  </span>
                  <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">
                    Name your project & launch studio
                  </h2>
                  <p className={`text-xs sm:text-sm max-w-lg mx-auto ${isLight ? "text-neutral-600" : "text-neutral-400"}`}>
                    Enter your photoshoot or collection name below to begin. Kaladhar reframes raw takes into 1080×1920 vertical video with beat-synced transitions.
                  </p>
                </div>

                {/* Inline Project Creation Box */}
                <form
                  onSubmit={handleInlineCreate}
                  className={`p-3 rounded-2xl border space-y-3 transition-all ${
                    isLight
                      ? "bg-[#FAF8F5] border-[#E8DFD1]"
                      : "bg-white/4 border-white/10"
                  }`}
                >
                  <div className="flex flex-col sm:flex-row items-center gap-2">
                    <input
                      type="text"
                      value={inlineTitle}
                      onChange={(e) => setInlineTitle(e.target.value)}
                      placeholder="e.g. Banarasi Katan Silk Saree · Festive Drop"
                      className={`flex-1 w-full px-4 py-2.5 rounded-xl text-xs sm:text-sm border outline-hidden transition-all ${
                        isLight
                          ? "bg-white border-neutral-300 text-neutral-900 focus:border-[#FF611A]"
                          : "bg-white/5 border-white/10 text-white focus:border-[#FF611A]"
                      }`}
                    />

                    <button
                      type="submit"
                      className={`w-full sm:w-auto px-5 py-2.5 rounded-xl font-mono font-bold text-xs uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center gap-2 shrink-0 ${
                        isLight
                          ? "bg-gradient-to-r from-[#FF611A] to-[#FC731C] text-white hover:brightness-105 shadow-[0_2px_12px_rgba(252,115,28,0.3)]"
                          : "bg-white text-black hover:bg-neutral-200"
                      }`}
                    >
                      <span>Continue to Studio</span>
                      <span>→</span>
                    </button>
                  </div>

                  {/* Category Pills */}
                  <div className="flex items-center justify-between flex-wrap gap-2 pt-1 px-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] font-mono opacity-60 mr-1">Category:</span>
                      {(["Sarees", "Lehengas", "Kurtis", "Bridal"] as const).map((cat) => (
                        <button
                          key={cat}
                          type="button"
                          onClick={() => setInlineCategory(cat)}
                          className={`px-2.5 py-1 rounded-lg text-xs font-mono transition-all cursor-pointer border ${
                            inlineCategory === cat
                              ? isLight
                                ? "bg-neutral-900 text-white border-neutral-900 font-bold"
                                : "bg-white text-black border-white font-bold"
                              : isLight
                              ? "bg-white border-neutral-200 text-neutral-600 hover:text-black"
                              : "bg-white/5 border-white/10 text-neutral-400 hover:text-white"
                          }`}
                        >
                          {cat}
                        </button>
                      ))}
                    </div>

                    <button
                      type="button"
                      onClick={handleLoadSampleProjects}
                      className="text-[11px] font-mono text-[#FF611A] hover:underline cursor-pointer flex items-center gap-1"
                    >
                      <Sparkles className="w-3 h-3" />
                      <span>Load sample reels preview</span>
                    </button>
                  </div>
                </form>

                {/* 3 Value Pillars */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 text-left">
                  <div
                    className={`p-3.5 rounded-xl border ${
                      isLight ? "bg-white border-[#E5DFD5]" : "bg-white/3 border-white/8"
                    }`}
                  >
                    <p className="text-xs font-bold flex items-center gap-1.5">
                      <Film className="w-3.5 h-3.5 text-[#FF611A]" />
                      <span>1080×1920 Native</span>
                    </p>
                    <p className="text-[11px] opacity-70 mt-1 leading-relaxed">
                      9:16 vertical ratio optimized for Instagram Reels & WhatsApp Status.
                    </p>
                  </div>

                  <div
                    className={`p-3.5 rounded-xl border ${
                      isLight ? "bg-white border-[#E5DFD5]" : "bg-white/3 border-white/8"
                    }`}
                  >
                    <p className="text-xs font-bold flex items-center gap-1.5">
                      <Layers className="w-3.5 h-3.5 text-amber-500" />
                      <span>Beat-Synced Pacing</span>
                    </p>
                    <p className="text-[11px] opacity-70 mt-1 leading-relaxed">
                      AI highlights pallu drape, border zari, and detail embroidery to audio.
                    </p>
                  </div>

                  <div
                    className={`p-3.5 rounded-xl border ${
                      isLight ? "bg-white border-[#E5DFD5]" : "bg-white/3 border-white/8"
                    }`}
                  >
                    <p className="text-xs font-bold flex items-center gap-1.5">
                      <Download className="w-3.5 h-3.5 text-emerald-500" />
                      <span>1-Click MP4 Export</span>
                    </p>
                    <p className="text-[11px] opacity-70 mt-1 leading-relaxed">
                      $0 cloud storage fees. Files stay private and save directly to your device.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          ) : filteredProjects.length > 0 ? (
              viewMode === "grid" ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-5">
                  {filteredProjects.map((project) => (
                    <DashfolioReelCard
                      key={project.id}
                      project={project}
                      isLight={isLight}
                      isPlaying={playingCardId === project.id}
                      isMuted={isMuted}
                      onTogglePlay={() => {
                        setPlayingCardId(playingCardId === project.id ? null : project.id);
                      }}
                      onToggleMute={(e) => {
                        e.stopPropagation();
                        setIsMuted(!isMuted);
                      }}
                      onOpenCinema={() => {
                        setActiveCinemaReel(project);
                      }}
                      onDelete={(e) => handleDeleteProject(project.id, e)}
                      onShare={(e) => handleShare(project, e)}
                      isCopied={copiedId === project.id}
                    />
                  ))}
                </div>
              ) : (
                /* Compact List View */
                <div
                  className={`rounded-xl border overflow-hidden transition-all ${
                    isLight ? "bg-white border-[#E5DFD5]" : "bg-[#111115] border-white/8"
                  }`}
                >
                  <div className="divide-y divide-inherit">
                    {filteredProjects.map((project) => (
                      <div
                        key={project.id}
                        onClick={() => {
                          setPlayingCardId(playingCardId === project.id ? null : project.id);
                        }}
                        className={`p-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 transition-colors cursor-pointer ${
                          isLight ? "hover:bg-neutral-50" : "hover:bg-white/4"
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="relative w-11 h-14 rounded-lg overflow-hidden bg-neutral-900 shrink-0">
                            <img
                              src={project.thumbnailUrl}
                              alt={project.title}
                              className="w-full h-full object-cover"
                            />
                            <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                              {playingCardId === project.id ? (
                                <Pause className="w-3.5 h-3.5 text-white fill-current" />
                              ) : (
                                <Play className="w-3.5 h-3.5 text-white fill-current translate-x-0.5" />
                              )}
                            </div>
                          </div>

                          <div className="min-w-0">
                            <p className="text-xs sm:text-sm font-semibold truncate leading-snug">
                              {project.title}
                            </p>
                            <div className="flex items-center gap-2 text-[10px] font-mono opacity-65 mt-0.5">
                              <span className="text-[#FF611A] font-bold">{project.category}</span>
                              <span>·</span>
                              <span>{project.durationSeconds}s</span>
                              <span>·</span>
                              <span>{project.productPrice || "Ethnic Reel"}</span>
                            </div>
                          </div>
                        </div>

                        <div
                          className="flex items-center gap-2 self-end sm:self-center"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            type="button"
                            onClick={() => setActiveCinemaReel(project)}
                            className="p-1.5 rounded-lg text-xs font-mono border hover:bg-black/5 dark:hover:bg-white/10 cursor-pointer"
                            title="Expand Preview"
                          >
                            <Maximize2 className="w-3.5 h-3.5" />
                          </button>
                          <a
                            href={project.videoUrl}
                            download={`${project.title.toLowerCase().replace(/[^a-z0-9]+/g, "_")}.mp4`}
                            target="_blank"
                            rel="noreferrer"
                            className="p-1.5 rounded-lg text-xs font-mono border hover:bg-black/5 dark:hover:bg-white/10 cursor-pointer"
                            title="Download MP4 for Instagram / WhatsApp"
                          >
                            <Download className="w-3.5 h-3.5" />
                          </a>
                          <button
                            type="button"
                            onClick={(e) => handleShare(project, e)}
                            className="p-1.5 rounded-lg text-xs font-mono border hover:bg-black/5 dark:hover:bg-white/10 cursor-pointer"
                            title="Share or Copy Link"
                          >
                            {copiedId === project.id ? (
                              <Check className="w-3.5 h-3.5 text-emerald-500" />
                            ) : (
                              <Share2 className="w-3.5 h-3.5" />
                            )}
                          </button>
                          <button
                            type="button"
                            onClick={(e) => handleDeleteProject(project.id, e)}
                            className="p-1.5 rounded-lg text-xs font-mono text-red-500 hover:bg-red-500/10 cursor-pointer"
                            title="Remove"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )
            ) : (
              <div
                className={`rounded-2xl p-8 text-center border border-dashed flex flex-col items-center justify-center space-y-3 ${
                  isLight ? "border-neutral-300 bg-white" : "border-white/10 bg-[#111115]"
                }`}
              >
                <p className="text-sm font-semibold">No Reels match "{searchQuery}"</p>
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery("");
                    setSelectedCategory("All");
                  }}
                  className="text-xs font-mono text-[#FF611A] hover:underline cursor-pointer"
                >
                  Clear filter
                </button>
              </div>
            )}
        </main>
      </div>

      {/* ========================================================= */}
      {/* 4. MOBILE SIDEBAR DRAWER                                   */}
      {/* ========================================================= */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-xs"
            onClick={() => setMobileMenuOpen(false)}
          />
          <div
            className={`relative w-68 max-w-[80vw] h-full p-4 flex flex-col justify-between border-r shadow-xl z-10 ${
              isLight ? "bg-white border-[#E5DFD5]" : "bg-[#0E0E12] border-white/10"
            }`}
          >
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-[#FF611A] text-white flex items-center justify-center font-bold text-xs">
                    K
                  </div>
                  <span className="font-bold text-sm">KALADHAR</span>
                </div>
                <button
                  type="button"
                  onClick={() => setMobileMenuOpen(false)}
                  className="p-1 rounded-lg cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <nav className="space-y-1 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab("library");
                    setMobileMenuOpen(false);
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold bg-[#FF611A] text-white"
                >
                  <LayoutGrid className="w-4 h-4" />
                  <span>Reel Library ({projects.length})</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    setNewReelModalOpen(true);
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs"
                >
                  <Plus className="w-4 h-4 text-[#FF611A]" />
                  <span>Create New Reel</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    onBackToLanding();
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs"
                >
                  <ArrowUpRight className="w-4 h-4" />
                  <span>Back to Landing</span>
                </button>
              </nav>
            </div>

            <div className="pt-3 border-t border-inherit space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono">Theme</span>
                <IOKnob size="sm" />
              </div>
              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  logout();
                  onBackToLanding();
                }}
                className="w-full py-2 rounded-xl text-xs font-mono font-bold text-red-500 bg-red-500/10"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 5. CINEMA STUDIO VIDEO PLAYER LIGHTBOX                     */}
      {/* ========================================================= */}
      {activeCinemaReel && (
        <div
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4 sm:p-6"
          onClick={() => setActiveCinemaReel(null)}
        >
          <div
            className="relative max-w-md w-full flex flex-col items-center animate-in fade-in zoom-in duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Top Bar */}
            <div className="w-full flex items-center justify-between text-white pb-3 px-1">
              <div className="min-w-0 pr-4">
                <p className="text-sm font-semibold truncate">{activeCinemaReel.title}</p>
                <p className="text-[10px] font-mono opacity-70">
                  {activeCinemaReel.category} · {activeCinemaReel.durationSeconds}s · {activeCinemaReel.resolution}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setActiveCinemaReel(null)}
                className="p-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer shrink-0"
                title="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Video Container */}
            <div className="relative w-full max-w-[320px] aspect-[9/16] rounded-2xl overflow-hidden bg-black shadow-2xl border border-white/20">
              <video
                src={activeCinemaReel.videoUrl}
                controls
                autoPlay
                loop
                playsInline
                className="w-full h-full object-cover"
              />
            </div>

            {/* Bottom Controls */}
            <div className="w-full max-w-[320px] mt-3 flex items-center justify-between gap-2.5">
              <a
                href={activeCinemaReel.videoUrl}
                download={`kaladhar_${activeCinemaReel.id}.mp4`}
                target="_blank"
                rel="noreferrer"
                className="flex-1 py-2 px-3 rounded-xl bg-white text-black font-mono font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 hover:bg-neutral-200 transition-colors shadow-sm cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download MP4</span>
              </a>

              <button
                type="button"
                onClick={(e) => handleShare(activeCinemaReel, e)}
                className="py-2 px-3 rounded-xl bg-white/10 hover:bg-white/20 text-white font-mono text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer border border-white/15"
                title="Share to Instagram / WhatsApp or Copy Link"
              >
                {copiedId === activeCinemaReel.id ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-emerald-400 font-bold">Copied!</span>
                  </>
                ) : (
                  <>
                    <Share2 className="w-3.5 h-3.5" />
                    <span>Share</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 6. CREATE NEW REEL MODAL (NAME & CATEGORY INPUT)          */}
      {/* ========================================================= */}
      {newReelModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150"
          onClick={() => setNewReelModalOpen(false)}
        >
          <div
            className={`relative max-w-md w-full rounded-2xl p-6 border shadow-2xl transition-all ${
              isLight
                ? "bg-white border-[#E5DFD5] text-[#0A0A0C]"
                : "bg-[#141418] border-white/10 text-white"
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3.5 border-b border-inherit">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-[#FF611A]/10 text-[#FF611A] flex items-center justify-center font-bold">
                  <Film className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold tracking-tight">Create New Reel</h3>
                  <p className={`text-[11px] font-mono ${isLight ? "text-neutral-500" : "text-neutral-400"}`}>
                    Enter project details to configure video output
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setNewReelModalOpen(false)}
                className="p-1 rounded-lg text-neutral-400 hover:text-current hover:bg-neutral-100 dark:hover:bg-white/10 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleConfirmCreateReel} className="space-y-4 pt-4">
              {/* Project Name Field */}
              <div className="space-y-1.5">
                <label className="block text-xs font-mono font-bold uppercase tracking-wider">
                  Reel / Project Name <span className="text-[#FF611A]">*</span>
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  value={newReelTitle}
                  onChange={(e) => setNewReelTitle(e.target.value)}
                  placeholder="e.g. Banarasi Katan Silk Saree · Festive Drop"
                  className={`w-full px-3.5 py-2.5 rounded-xl text-xs border outline-hidden transition-all ${
                    isLight
                      ? "bg-neutral-50 border-neutral-300 focus:border-[#FF611A] focus:bg-white text-neutral-900"
                      : "bg-white/5 border-white/10 focus:border-[#FF611A] focus:bg-white/10 text-white"
                  }`}
                />
                <p className="text-[10px] opacity-60">
                  Used for video metadata, title overlays, and Instagram export filename.
                </p>
              </div>

              {/* Category Selector */}
              <div className="space-y-1.5">
                <label className="block text-xs font-mono font-bold uppercase tracking-wider">
                  Ethnic Catalog Category
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {(["Sarees", "Lehengas", "Kurtis", "Bridal"] as const).map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setNewReelCategory(cat)}
                      className={`py-2 px-1 rounded-xl text-xs font-medium font-mono text-center transition-all cursor-pointer border ${
                        newReelCategory === cat
                          ? isLight
                            ? "bg-[#18181B] text-white border-transparent font-bold shadow-xs"
                            : "bg-white text-black border-transparent font-bold shadow-xs"
                          : isLight
                          ? "bg-neutral-50 border-neutral-200 text-neutral-700 hover:bg-neutral-100"
                          : "bg-white/5 border-white/10 text-neutral-300 hover:bg-white/10"
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-inherit">
                <button
                  type="button"
                  onClick={() => setNewReelModalOpen(false)}
                  className={`px-4 py-2 rounded-xl text-xs font-mono transition-colors cursor-pointer border ${
                    isLight
                      ? "border-neutral-200 hover:bg-neutral-100 text-neutral-700"
                      : "border-white/10 hover:bg-white/5 text-neutral-300"
                  }`}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!newReelTitle.trim()}
                  className={`px-5 py-2 rounded-xl text-xs font-mono font-bold uppercase tracking-wider transition-all cursor-pointer flex items-center gap-1.5 shadow-sm ${
                    !newReelTitle.trim()
                      ? "opacity-50 cursor-not-allowed bg-neutral-300 dark:bg-white/10 text-neutral-500"
                      : "bg-gradient-to-r from-[#FF611A] to-[#FC731C] text-white hover:brightness-105 shadow-[0_2px_10px_rgba(252,115,28,0.3)]"
                  }`}
                >
                  <span>Continue to Studio</span>
                  <span>→</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// -------------------------------------------------------------
// DASHFOLIO REEL CARD: 9:16 In-Card Video Player & Quick Actions
// -------------------------------------------------------------
function DashfolioReelCard({
  project,
  isLight,
  isPlaying,
  isMuted,
  onTogglePlay,
  onToggleMute,
  onOpenCinema,
  onDelete,
  onShare,
  isCopied,
}: {
  project: ReelProject;
  isLight: boolean;
  isPlaying: boolean;
  isMuted: boolean;
  onTogglePlay: () => void;
  onToggleMute: (e: React.MouseEvent) => void;
  onOpenCinema: () => void;
  onDelete: (e: React.MouseEvent) => void;
  onShare: (e: React.MouseEvent) => void;
  isCopied: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.currentTime = 0;
        videoRef.current.play().catch(() => {});
      } else {
        videoRef.current.pause();
      }
    }
  }, [isPlaying]);

  return (
    <div
      onClick={onTogglePlay}
      className={`group rounded-2xl overflow-hidden border shadow-xs transition-all duration-200 hover:-translate-y-1 flex flex-col justify-between cursor-pointer ${
        isLight
          ? "bg-white border-[#E5DFD5] hover:border-black/30 shadow-[0_4px_16px_rgba(0,0,0,0.05)]"
          : "bg-[#111115] border-white/8 hover:border-white/25 shadow-[0_4px_16px_rgba(0,0,0,0.4)]"
      }`}
    >
      {/* 9:14 Video Container */}
      <div className="relative aspect-[9/14] w-full overflow-hidden bg-neutral-950">
        {/* Poster Image */}
        <img
          src={project.thumbnailUrl}
          alt={project.title}
          className={`w-full h-full object-cover object-center transition-opacity duration-200 ${
            isPlaying ? "opacity-0 pointer-events-none" : "opacity-100"
          }`}
        />

        {/* Video Element */}
        <video
          ref={videoRef}
          src={project.videoUrl}
          loop
          muted={isMuted}
          playsInline
          className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-200 ${
            isPlaying ? "opacity-100" : "opacity-0 pointer-events-none"
          }`}
        />

        {/* Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent pointer-events-none" />

        {/* Top Badges */}
        <div className="absolute top-2.5 inset-x-2.5 flex items-center justify-between z-10">
          <span className="px-2 py-0.5 rounded-full text-[10px] font-mono uppercase font-bold tracking-wider bg-black/60 backdrop-blur-md text-white border border-white/20">
            {project.category}
          </span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={onShare}
              className="p-1 rounded-full bg-black/60 backdrop-blur-md text-white border border-white/20 hover:bg-black/80 transition-colors cursor-pointer"
              title={isCopied ? "Link Copied!" : "Share / Copy Link"}
            >
              {isCopied ? <Check className="w-3 h-3 text-emerald-400" /> : <Share2 className="w-3 h-3" />}
            </button>
            {isPlaying && (
              <button
                type="button"
                onClick={onToggleMute}
                className="p-1 rounded-full bg-black/60 backdrop-blur-md text-white border border-white/20 hover:bg-black/80 transition-colors cursor-pointer"
                title={isMuted ? "Unmute audio" : "Mute audio"}
              >
                {isMuted ? <VolumeX className="w-3 h-3" /> : <Volume2 className="w-3 h-3 text-emerald-400" />}
              </button>
            )}
            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold tracking-wider bg-black/60 backdrop-blur-md text-white border border-white/20">
              {project.durationSeconds}s
            </span>
          </div>
        </div>

        {/* Center Play Indicator */}
        <div
          className={`absolute inset-0 flex items-center justify-center transition-opacity duration-150 pointer-events-none ${
            isPlaying ? "opacity-0" : "opacity-0 group-hover:opacity-100"
          }`}
        >
          <div className="w-10 h-10 rounded-full bg-white text-black flex items-center justify-center shadow-lg transform group-hover:scale-105 transition-transform">
            <Play className="w-4 h-4 fill-current translate-x-0.5" />
          </div>
        </div>

        {/* Bottom Metadata inside thumbnail */}
        <div className="absolute bottom-2.5 inset-x-2.5 z-10 text-white space-y-0.5 pointer-events-none">
          {project.productPrice && (
            <span className="text-[10px] font-mono text-[#FF8833] font-bold">
              {project.productPrice}
            </span>
          )}
          <p className="text-xs font-medium line-clamp-2 leading-snug">
            {project.title}
          </p>
        </div>
      </div>

      {/* Bottom Bar: Date & Quick Actions */}
      <div className="p-3 space-y-2" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between text-[10px] font-mono opacity-65">
          <div className="flex items-center gap-1">
            <Calendar className="w-3 h-3" />
            <span>{project.createdAt}</span>
          </div>
          {project.viewsCount && (
            <span className="text-emerald-500 font-bold">
              {project.viewsCount} views
            </span>
          )}
        </div>

        {/* Action Buttons Row */}
        <div className="grid grid-cols-4 gap-1 pt-1 border-t border-inherit">
          {/* Play/Pause */}
          <button
            type="button"
            onClick={onTogglePlay}
            className={`py-1 rounded-lg text-[10px] font-mono font-semibold flex items-center justify-center gap-1 transition-colors cursor-pointer ${
              isPlaying
                ? "bg-[#FF611A] text-white"
                : isLight
                ? "bg-neutral-100 hover:bg-neutral-200 text-neutral-900"
                : "bg-white/8 hover:bg-white/15 text-white"
            }`}
            title={isPlaying ? "Pause" : "Play"}
          >
            {isPlaying ? <Pause className="w-3 h-3 fill-current" /> : <Play className="w-3 h-3 fill-current" />}
            <span className="hidden sm:inline">{isPlaying ? "Pause" : "Play"}</span>
          </button>

          {/* Full Cinema Lightbox */}
          <button
            type="button"
            onClick={onOpenCinema}
            className={`py-1 rounded-lg text-[10px] font-mono font-semibold flex items-center justify-center gap-1 transition-colors cursor-pointer ${
              isLight
                ? "bg-neutral-100 hover:bg-neutral-200 text-neutral-900"
                : "bg-white/8 hover:bg-white/15 text-white"
            }`}
            title="Full Preview"
          >
            <Maximize2 className="w-3 h-3" />
            <span className="hidden sm:inline">View</span>
          </button>

          {/* Download MP4 */}
          <a
            href={project.videoUrl}
            download={`${project.title.toLowerCase().replace(/[^a-z0-9]+/g, "_")}.mp4`}
            target="_blank"
            rel="noreferrer"
            className={`py-1 rounded-lg text-[10px] font-mono font-semibold flex items-center justify-center gap-1 transition-colors cursor-pointer ${
              isLight
                ? "bg-neutral-100 hover:bg-neutral-200 text-neutral-900"
                : "bg-white/8 hover:bg-white/15 text-white"
            }`}
            title="Download MP4 for Instagram / WhatsApp"
          >
            <Download className="w-3 h-3" />
            <span className="hidden sm:inline">Save</span>
          </a>

          {/* Delete */}
          <button
            type="button"
            onClick={onDelete}
            className={`py-1 rounded-lg text-[10px] font-mono font-semibold flex items-center justify-center gap-1 transition-colors cursor-pointer text-red-500 ${
              isLight ? "hover:bg-red-50" : "hover:bg-red-950/40"
            }`}
            title="Remove"
          >
            <Trash2 className="w-3 h-3" />
            <span className="hidden sm:inline">Del</span>
          </button>
        </div>
      </div>
    </div>
  );
}
