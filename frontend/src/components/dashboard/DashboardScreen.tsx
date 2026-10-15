import { useState, useEffect, useRef } from "react";
import BrandLogoPage from "./BrandLogoPage";
import ReelImageEditorWorkspace, {
  type ManualReelProject,
  type ImageSlide,
} from "./ReelImageEditorWorkspace";
import PhotoshootUploadsPage from "./PhotoshootUploadsPage";
import { upsertSavedReel, type SavedReelProject } from "../../savedReels";
import { useAuth } from "../../context/AuthContext";
import { useTheme } from "../../context/ThemeContext";
import { useDialogFocus } from "../../hooks/useDialogFocus";
import IOKnob from "../landing/IOKnob";
import Magnetic from "../Magnetic";
import {
  downloadAuthenticatedVideo as apiDownloadAuthenticatedVideo,
  getReelHistory,
  reelFileUrl,
} from "../../api";
import type { AxiosResponse } from "axios";
import { api } from "../../api";
import type { UserPreferences, UserPreferencesUpdate } from "../../api";
import AuthenticatedVideoPreview from "../AuthenticatedVideoPreview";
import {
  LayoutGrid,
  Film,
  Plus,
  Video,
  Layers,
  Settings,
  Search,
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
  RotateCcw,
  Share2,
  CreditCard,
  History,
  ArrowUpRight,
  ArrowLeft,
  Image as ImageIcon,
} from "lucide-react";

import "./Dashboard.css";


/* =========================================================
   TYPES
   ========================================================= */

export type ReelProject = SavedReelProject;

interface DashboardScreenProps {
  onCreateNewReel: (projectName?: string, category?: string) => void;
  onLaunchDemo?: () => void;
  onBackToLanding: () => void;
  creditQuote: {
    credits: number | null;
    cost: number | null;
    loading: boolean;
    error: string | null;
    canGenerate: boolean;
    refresh: () => Promise<void>;
  };
}

/* =========================================================
   SAMPLE PROJECTS
   ========================================================= */

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

async function downloadAuthenticatedVideo(
  videoUrl: string,
  filename: string,
): Promise<void> {
  try {
    await apiDownloadAuthenticatedVideo(videoUrl, filename);
  } catch (error) {
    console.error("Authenticated video download failed:", error);
    alert("Unable to download the reel. Please sign in again and retry.");
  }
}

/* =========================================================
   DASHBOARD
   ========================================================= */

export default function DashboardScreen({
  onCreateNewReel,
  onBackToLanding,
  creditQuote,
}: DashboardScreenProps) {
  const { user, logout, saveProfile, preferences, preferencesLoading, updatePreferences } = useAuth();
  const { theme } = useTheme();

  const isLight = theme === "light";
  const { credits, cost, loading: creditsLoading, error: creditsError, canGenerate, refresh: refreshCredits } = creditQuote;

  const storageKey = user
    ? `kaladhar_reels_${user.id}`
    : "kaladhar_reels_guest";


  /* =======================================================
     PROJECT STATE
     ======================================================= */

  const [projects, setProjects] = useState<ReelProject[]>(() => {
    try {
      const saved = localStorage.getItem(storageKey);

      if (saved) {
        const parsed: ReelProject[] = JSON.parse(saved);

        if (Array.isArray(parsed)) {
          const isOnlyPreset =
            parsed.length === 4 &&
            parsed.every((p) => p.id.startsWith("reel-00"));

          if (isOnlyPreset) {
            return [];
          }

          return parsed.map((p) => ({
            ...p,
            // Older builds substituted sample videos for unavailable reels.
            // Clear those known demo URLs instead of showing unrelated footage.
            videoUrl: /^\/?sample_reel_\d+\.mp4(?:[?#].*)?$/i.test(p.videoUrl || "") ||
              /^blob:/i.test(p.videoUrl || "")
              ? ""
              : p.videoUrl || "",
          }));
        }
      }
    } catch {
      // Ignore corrupted localStorage
    }

    return [];
  });

  const [isEditingManualReel, setIsEditingManualReel] = useState(() =>
    typeof localStorage !== "undefined" && Boolean(localStorage.getItem("reelkaro_active_editor_project"))
  );

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(projects));
    } catch {
      // Ignore storage errors
    }
  }, [projects, storageKey]);

useEffect(() => {
  if (isEditingManualReel) return;
  const controller = new AbortController();

  const loadReelHistory = async () => {
    try {
      const history = await getReelHistory(controller.signal);

      const savedProjects: ReelProject[] = history.items
        .filter((item) => item.status === "completed")
        .map((item) => ({
          id: item.reel_id,
          title: item.title || "Untitled Reel",
          category: item.source === "image_to_reel" ? "Image-to-Reel" : "Other",
          durationSeconds: 0,
          resolution: "Video",
          videoUrl: reelFileUrl(item.reel_id),
          thumbnailUrl: "",
          createdAt: item.created_at
            ? new Date(item.created_at).toLocaleDateString()
            : "Previously generated",
          status: "ready",
          productPrice: "",
        }));

      setProjects((current) => {
        const merged = [...current];

        // Add database records without duplicating existing reel IDs.
        for (const saved of [...savedProjects].reverse()) {
          const existingIndex = merged.findIndex(
            (project) => project.id === saved.id,
          );

          if (existingIndex >= 0) {
            merged[existingIndex] = {
              ...merged[existingIndex],
              title: saved.title,
              category: saved.category,
              createdAt: saved.createdAt,
              videoUrl: saved.videoUrl,
              status: "ready",
            };
          } else {
            merged.unshift(saved);
          }
        }

        return merged;
      });
    } catch (error) {
      if (!controller.signal.aborted) {
        console.error("Failed to load reel history:", error);
      }
    }
  };

  void loadReelHistory();

  return () => controller.abort();
}, [isEditingManualReel]);


  /* =======================================================
     UI STATE
     ======================================================= */

  const [activeTab, setActiveTab] = useState<
  "library" | "upload" | "collections" | "previous" | "credits" | "settings"| "brand-logo"
>("library");

  const [showSamplePreview, setShowSamplePreview] = useState(false);

  const [selectedCategory, setSelectedCategory] =
    useState<string>("All");

  const [searchQuery, setSearchQuery] = useState("");

  const [viewMode, setViewMode] =
    useState<"grid" | "list">("grid");

  const [mobileMenuOpen, setMobileMenuOpen] =
    useState(false);

  const [sidebarCollapsed, setSidebarCollapsed] =
  useState(false);

  const [activeCinemaReel, setActiveCinemaReel] =
    useState<ReelProject | null>(null);
  const [cinemaVideoUnavailable, setCinemaVideoUnavailable] = useState(false);
  const [cinemaVideoLoading, setCinemaVideoLoading] = useState(false);
  const cinemaDialogRef = useDialogFocus<HTMLDivElement>(!!activeCinemaReel, () => setActiveCinemaReel(null));

  useEffect(() => {
    setCinemaVideoUnavailable(false);
    setCinemaVideoLoading(Boolean(activeCinemaReel?.videoUrl));
  }, [activeCinemaReel?.videoUrl]);

  const [playingCardId, setPlayingCardId] =
    useState<string | null>(null);

  const [isMuted, setIsMuted] = useState(true);

  const [copiedId, setCopiedId] =
    useState<string | null>(null);

  /* =======================================================
     MANUAL REEL WORKSPACE (PIPELINE 1)
     ======================================================= */
  const [manualEditorProject, setManualEditorProject] =
    useState<Partial<ManualReelProject> | null>(null);

  const handleOpenManualEditor = (project?: Partial<ManualReelProject> & { thumbnailUrl?: string }) => {
    let slidesToUse = project?.slides ? [...project.slides] : [];
    if (slidesToUse.length === 0 && project?.thumbnailUrl) {
      slidesToUse = [
        {
          id: `slide-${Date.now()}`,
          imageUrl: project.thumbnailUrl,
          name: project.title || "Slide 1",
          duration: 2.5,
          motion: "zoom_in",
          transition: "crossfade",
          fitMode: "cover",
        },
      ];
    }

    // Strictly block entering studio without at least 1 image
    if (slidesToUse.length === 0) {
      setLauncherError(
        "Please select at least 1 photo to launch the studio editor."
      );
      const inputEl = document.getElementById("launcher-photo-file-input");
      if (inputEl) {
        inputEl.click();
      }
      return;
    }
    setManualEditorProject({
      ...project,
      slides: slidesToUse,
    });
    setIsEditingManualReel(true);
  };

  /* =======================================================
     NEW REEL MODAL
     ======================================================= */

  const [newReelModalOpen, setNewReelModalOpen] =
    useState(false);
  const [pendingProject, setPendingProject] = useState<{
  title: string;
  category: string;
} | null>(null);
  const [pendingConfirmation, setPendingConfirmation] = useState<{
    message: string;
    onConfirm: () => void;
  } | null>(null);
  const createReelDialogRef = useDialogFocus<HTMLDivElement>(newReelModalOpen, () => setNewReelModalOpen(false));
  const confirmationDialogRef = useDialogFocus<HTMLDivElement>(!!pendingConfirmation, () => setPendingConfirmation(null));

  const [newReelTitle, setNewReelTitle] =
    useState("");

  const [newReelCategory, setNewReelCategory] = useState("Product");

 const handleConfirmCreateReel = (
  e?: React.FormEvent
) => {
  e?.preventDefault();

  const finalTitle =
    newReelTitle.trim() || "Untitled Reel";

  setPendingProject({
    title: finalTitle,
    category: newReelCategory,
  });

  setNewReelModalOpen(false);
  setNewReelTitle("");

  // Open brand logo page first
  setActiveTab("brand-logo");
};
  /* =======================================================
     INLINE CREATOR
     ======================================================= */

  const [inlineTitle, setInlineTitle] = useState("");

  const [inlineCategory, setInlineCategory] = useState("Product");

  /* =======================================================
     REEL STUDIO LAUNCHER: IMAGE UPLOADER (IMAGES ONLY)
     ======================================================= */
  const [launcherImages, setLauncherImages] = useState<File[]>([]);
  const [launcherError, setLauncherError] = useState<string | null>(null);

  const handleLauncherFiles = (incomingList: FileList | null) => {
    if (!incomingList) return;
    setLauncherError(null);
    const validImages: File[] = [];
    let hasVideo = false;

    Array.from(incomingList).forEach((f) => {
      if (
        f.type.startsWith("image/") ||
        /\.(jpe?g|png|webp|avif|bmp|tiff)$/i.test(f.name)
      ) {
        validImages.push(f);
      } else if (
        f.type.startsWith("video/") ||
        /\.(mp4|mov|webm|m4v|avi|mkv)$/i.test(f.name)
      ) {
        hasVideo = true;
      }
    });

    if (hasVideo) {
      setLauncherError(
        "Only photo/image files (.jpg, .png, .webp) can be used in the Reel Library editor. For video reels, please head to Photoshoot Uploads."
      );
    }
    if (validImages.length > 0) {
      setLauncherImages((prev) => [...prev, ...validImages]);
    }
  };

  const removeLauncherImage = (idx: number) => {
    setLauncherImages((prev) => prev.filter((_, i) => i !== idx));
  };

 const handleInlineCreate = (
  e?: React.FormEvent
) => {
  e?.preventDefault();

  if (launcherImages.length === 0) {
    setLauncherError(
      "Please select at least 1 photo to launch the studio editor."
    );
    const inputEl = document.getElementById("launcher-photo-file-input");
    if (inputEl) {
      inputEl.click();
    }
    return;
  }

  // Auto suggestion for reel time according to number of images:
  const count = launcherImages.length;
  const suggestedPerSlide =
    count === 1 ? 3.5 : count <= 3 ? 2.5 : count <= 6 ? 2.0 : 1.6;

  const motionCycle: ImageSlide["motion"][] = [
    "zoom_in",
    "pan_right",
    "zoom_out",
    "pan_left",
  ];

  const customSlides: ImageSlide[] = launcherImages.map((file, idx) => ({
    id: `slide-user-${Date.now()}-${idx}`,
    imageUrl: URL.createObjectURL(file),
    name: file.name.replace(/\.[^.]+$/, ""),
    duration: suggestedPerSlide,
    motion: motionCycle[idx % motionCycle.length],
    transition: "crossfade",
    fitMode: "cover",
  }));

  handleOpenManualEditor({
    title: inlineTitle.trim() || "Untitled Reel",
    category: inlineCategory,
    slides: customSlides,
  });
};

  /* =======================================================
     DISPLAY INFO
     ======================================================= */
const profileStorageKey = user
  ? `kaladhar_profile_${user.id}`
  : "kaladhar_profile_guest";

const [profileName, setProfileName] = useState(() => {
  try {
    const saved = localStorage.getItem(profileStorageKey);

    if (saved) {
      const profile = JSON.parse(saved);

      return profile.name || user?.name || "Creator";
    }
  } catch {
    // Ignore invalid saved profile
  }

  return user?.name || "Creator";
});

const [profileBrand, setProfileBrand] = useState(() => {
  try {
    const saved = localStorage.getItem(profileStorageKey);

    if (saved) {
      const profile = JSON.parse(saved);
      const savedBrand = profile.brand?.trim();

      return (
        (savedBrand && !["Boutique Studio", "Ethnic Studio"].includes(savedBrand)
          ? savedBrand
          : "") ||
        (user?.brandName === "Ethnic Studio" ? "" : user?.brandName) ||
        "Your Studio"
      );
    }
  } catch {
    // Ignore invalid saved profile
  }

  return (user?.brandName === "Ethnic Studio" ? "" : user?.brandName) || "Your Studio";
});

const displayName = profileName;
const displayBrand = profileBrand;

const handleSaveProfile = (
  name: string,
  brand: string
) => {
  return saveProfile(name, brand).then(() => {
  const updatedProfile = {
    name,
    brand,
  };

  setProfileName(name);
  setProfileBrand(brand);

  try {
    localStorage.setItem(
      profileStorageKey,
      JSON.stringify(updatedProfile)
    );
  } catch {
    // Ignore storage errors
  }
  });
};

useEffect(() => {
  if (!user) return;
  setProfileName(user.name || "Creator");
  void api.get<{ name?: string }>("/branding").then(({ data }) => {
    if (typeof data.name === "string" && data.name.trim()) setProfileBrand(data.name);
  }).catch(() => {
    setProfileBrand(user.brandName || "Your Studio");
  });
}, [user?.id]);

  /* =======================================================
     FILTER PROJECTS
     ======================================================= */

  const filteredProjects = projects.filter((p) => {
  let matchesFilter = true;

  switch (selectedCategory) {
    case "Drafts":
      matchesFilter = p.status === "draft";
      break;

    case "Rendering":
      matchesFilter = p.status === "rendering";
      break;

    case "Ready":
      matchesFilter = p.status === "ready";
      break;

    case "Recent":
      matchesFilter = true;
      break;

    case "All":
    default:
      matchesFilter = true;
      break;
  }

  const matchesSearch =
    !searchQuery.trim() ||
    p.title
      .toLowerCase()
      .includes(searchQuery.toLowerCase()) ||
    p.category
      .toLowerCase()
      .includes(searchQuery.toLowerCase());

  return matchesFilter && matchesSearch;
});

  /* =======================================================
     SHARE
     ======================================================= */

  const handleCopyLink = (
    id: string,
    e?: React.MouseEvent
  ) => {
    e?.stopPropagation();

    navigator.clipboard.writeText(
      `${window.location.origin}/#reel-${id}`
    );

    setCopiedId(id);

    setTimeout(() => {
      setCopiedId(null);
    }, 2000);
  };

  const handleShare = async (
    project: ReelProject,
    e?: React.MouseEvent
  ) => {
    e?.stopPropagation();

    if (
      typeof navigator !== "undefined" &&
      navigator.share
    ) {
      try {
        await navigator.share({
          title: project.title,
          text: `Watch this 9:16 reel by ${displayBrand}: ${project.title}`,
          url:
            window.location.origin +
            project.videoUrl,
        });

        return;
      } catch {
        // User cancelled or share failed
      }
    }

    handleCopyLink(project.id, e);
  };

  /* =======================================================
     DELETE
     ======================================================= */

  const handleDeleteProject = (
    id: string,
    e?: React.MouseEvent
  ) => {
    e?.stopPropagation();

    setPendingConfirmation({
      message: "Remove this Reel from your library?",
      onConfirm: () => {
      setProjects((prev) =>
        prev.filter((p) => p.id !== id)
      );

      if (activeCinemaReel?.id === id) {
        setActiveCinemaReel(null);
      }

      if (playingCardId === id) {
        setPlayingCardId(null);
      }
      },
    });
  };

  /* =======================================================
     CLEAR LIBRARY
     ======================================================= */

  const handleClearLibrary = () => {
    setPendingConfirmation({
      message: "Reset library to empty? (You can test the fresh new user state)",
      onConfirm: () => {
      setProjects([]);

      localStorage.removeItem(storageKey);
      },
    });
  };

  /* =======================================================
     LOAD SAMPLES
     ======================================================= */

   const handleLoadSampleProjects = () => {
  setShowSamplePreview(true);
  setActiveTab("previous");
};

  /* =======================================================
     LOGOUT
     ======================================================= */

  const handleLogout = () => {
    localStorage.removeItem("reelkaro_active_editor_project");
    logout();
    onBackToLanding();
  };

  /* =======================================================
     RENDER MANUAL WORKSPACE (PIPELINE 1)
     ======================================================= */
  if (isEditingManualReel) {
    return (
      <ReelImageEditorWorkspace
        initialProject={manualEditorProject || undefined}
        onClose={() => {
          setIsEditingManualReel(false);
          setManualEditorProject(null);
        }}
      />
    );
  }

  /* =======================================================
     RENDER DASHBOARD
     ======================================================= */

  return (
    <div
      className={`dashboard-root ${
        isLight ? "light-mode" : "dark-mode"
      }`}
    >

      {/* ===================================================
          SIDEBAR
          =================================================== */}

      <aside
  className={`dashboard-sidebar hidden lg:flex ${
    sidebarCollapsed ? "sidebar-collapsed" : ""
  }`}
>
        {/* BRAND */}
        <div className="sidebar-brand">
          {/* BACK ARROW TO LANDING PAGE */}
          <button
            type="button"
            onClick={onBackToLanding}
            className="sidebar-back-landing-btn"
            title="Back to Landing Page"
            aria-label="Back to Landing Page"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Landing Page</span>
          </button>

          <button
            type="button"
            onClick={onBackToLanding}
            className="sidebar-brand-button"
            title="Return to VaishKala Landing Page"
          >
            <div className="brand-mark">
              K
            </div>

            <div className="brand-copy">
              <p className="brand-name">
                KALADHAR
              </p>

              <p className="brand-studio">
                STUDIO
              </p>
            </div>
          </button>

          <span className="active-badge">
            ACTIVE
          </span>
        </div>

        {/* NAVIGATION */}
<nav className="sidebar-nav">

  {/* REEL LIBRARY */}
  <button
    type="button"
    onClick={() => setActiveTab("library")}
    className={`dashboard-nav-item ${
      activeTab === "library" ? "active" : ""
    }`}
  >
    <LayoutGrid />

    <span>Reel Library</span>

    <span className="nav-count">
      {projects.length}
    </span>
  </button>



  {/* PHOTOSHOOT UPLOADS */}
  <button
  type="button"
  onClick={() => setActiveTab("upload")}
  className={`dashboard-nav-item ${
    activeTab === "upload" ? "active" : ""
  }`}
>
  <Video />

  <span>Photoshoot Uploads</span>
</button>



  {/* PREVIOUS WORKS */}
  <button
    type="button"
    onClick={() => setActiveTab("previous")}
    className={`dashboard-nav-item ${
      activeTab === "previous" ? "active" : ""
    }`}
  >
    <History />

    <span>Previous Works</span>

    <span className="nav-count">
      {projects.length}
    </span>
  </button>

  {/* CREDITS */}
  <button
    type="button"
    onClick={() => setActiveTab("credits")}
    className={`dashboard-nav-item ${
      activeTab === "credits" ? "active" : ""
    }`}
  >
    <CreditCard />

    <span>Credits</span>

    <span className="nav-small-label">
  {creditsLoading ? "…" : credits ?? "—"}
</span>
  </button>
  {/* SETTINGS */}
<button
  type="button"
  onClick={() => setActiveTab("settings")}
  className={`dashboard-nav-item ${
    activeTab === "settings" ? "active" : ""
  }`}
>
  <Settings />

  <span>Settings</span>
</button>

</nav>

        {/* SIDEBAR FOOTER */}
        <div className="sidebar-footer">
          <div className="creator-avatar">
            {displayName
              .charAt(0)
              .toUpperCase()}
          </div>

          <div className="creator-info">
            <p>{displayBrand}</p>

            <span>{displayName}</span>
          </div>

          <button
            type="button"
            onClick={handleLogout}
            className="logout-button"
            title="Sign Out"
          >
            <LogOut />
          </button>
        </div>
      </aside>

      {/* ===================================================
          MAIN WORKSPACE
          =================================================== */}

      <div
  className={`dashboard-workspace ${
    sidebarCollapsed ? "workspace-expanded" : ""
  }`}
>
        {/* =================================================
            TOP HEADER
            ================================================= */}

        <header className="dashboard-header">
          {/* Mobile menu toggle only on mobile viewports */}
          <div className="header-mobile-only lg:hidden">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="mobile-menu-button"
              aria-label="Toggle navigation"
            >
              <Menu />
            </button>
          </div>

          <div className="header-actions">
            <div className="theme-control">
              <IOKnob size="sm" />
            </div>

            <Magnetic strength={0.18} distance={100}>
  <button
    type="button"
    onClick={() => setNewReelModalOpen(true)}
    className="header-new-reel"
  >
    <Plus />
    <span>NEW REEL</span>
  </button>
</Magnetic>
          </div>
        </header>

        {/* =================================================
            MAIN CONTENT
            ================================================= */}

       <main className="dashboard-main">

{activeTab === "brand-logo" ? (
  <BrandLogoPage
    project={pendingProject}
    onBack={() => {
      setActiveTab("library");
      setPendingProject(null);
    }}
    onContinue={() => {
      if (!pendingProject) return;

      onCreateNewReel(
        pendingProject.title,
        pendingProject.category
      );
    }}
  />

 ) : activeTab === "credits" ? (
  <CreditsPage credits={credits} cost={cost} loading={creditsLoading} error={creditsError} onRetry={() => void refreshCredits()} />

  ) : activeTab === "previous" ? (
   <PreviousWorksPage
  projects={projects}
  showSamplePreview={showSamplePreview}
  isLight={isLight}
  onOpenLibrary={() => setActiveTab("library")}
  onOpenCinema={(project) => {
    setActiveCinemaReel(project);
    setCinemaVideoLoading(Boolean(project.videoUrl));
  }}
/>

  ) : activeTab === "upload" ? (
    <PhotoshootUploadsPage
      credits={credits}
      reelCost={cost}
      creditsLoading={creditsLoading}
      creditsError={creditsError}
      canGenerate={canGenerate}
      onRefreshCredits={refreshCredits}
      onBackToLibrary={() => setActiveTab("library")}
      onAddToLibrary={(savedProject) => {
        setProjects((prev) => upsertSavedReel(prev, savedProject));
      }}
      onOpenInEditor={(projData) => {
        handleOpenManualEditor(projData);
      }}
    />

  ) : activeTab === "collections" ? (
    <FabricCatalogsPage
  onBackToLibrary={() => setActiveTab("library")}
  onSelectCategory={setSelectedCategory}
/>

  ) : activeTab === "settings" ? (
    <SettingsPage
      displayName={displayName}
      displayBrand={displayBrand}
      onSaveProfile={handleSaveProfile}
      preferences={preferences}
      preferencesLoading={preferencesLoading}
      onUpdatePreferences={updatePreferences}
      onLogout={handleLogout}
    />

  ) : (
    <>

          {/* PAGE HEADER (Shown when user has created reels) */}
          {projects.length > 0 && (
            <section className="dashboard-page-header page-enter">
              <div>
                <div className="page-title-row">
                  <h1>Create your next reel</h1>

                  <span className="project-count">
                    {projects.length}
                  </span>
                </div>

                <p>
                  Transform your fashion collection into cinematic social content.
                </p>
              </div>

              <div className="library-controls">
                {/* FILTER */}
                <div className="category-filters">
                  {[
                    "All",
                    "Recent",
                    "Drafts",
                    "Rendering",
                    "Ready",
                  ].map((filter) => (
                    <button
                      key={filter}
                      type="button"
                      onClick={() => setSelectedCategory(filter)}
                      className={
                        selectedCategory.toLowerCase() ===
                        filter.toLowerCase()
                          ? "filter-pill active"
                          : "filter-pill"
                      }
                    >
                      {filter}
                    </button>
                  ))}
                </div>

                {/* SEARCH */}
                <div className="dashboard-search">
                  <Search />

                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) =>
                      setSearchQuery(
                        e.target.value
                      )
                    }
                    placeholder="Search reels..."
                  />
                </div>

                {/* VIEW MODE */}
                <div className="view-switcher">
                  <button
                    type="button"
                    onClick={() =>
                      setViewMode("grid")
                    }
                    className={
                      viewMode === "grid"
                        ? "active"
                        : ""
                    }
                  >
                    <Grid />
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      setViewMode("list")
                    }
                    className={
                      viewMode === "list"
                        ? "active"
                        : ""
                    }
                  >
                    <List />
                  </button>
                </div>

                <button
                  type="button"
                  onClick={handleClearLibrary}
                  className="reset-button"
                  title="Reset Library"
                >
                  <RotateCcw />
                </button>
              </div>
            </section>
          )}

          {/* =================================================
              EMPTY STATE / STUDIO LAUNCHER
              ================================================= */}

          <section className="launcher-section page-enter">
            <div className="launcher-panel">
              {/* MAIN CONTENT */}
              <div className="launcher-content">
              <div className="launcher-badge">
                  REEL STUDIO
                </div>

                <h1 className="launcher-title">
                  <span className="title-line">
                    Your creative studio{" "}
                  </span>
                  <span className="title-highlight">
                    starts here.
                  </span>
                </h1>

                <p className="launcher-description">
                  Name your collection, select photos, and launch the editor to craft your 9:16 vertical reel.
                </p>

                {/* PROJECT CREATOR (IMAGES ONLY) */}
                <form
                  onSubmit={handleInlineCreate}
                  className="project-launcher"
                >
                  {/* ERROR BANNER FOR DISALLOWED FORMATS */}
                  {launcherError && (
                    <div className="launcher-photo-error-banner">
                      <span>{launcherError}</span>
                      <button
                        type="button"
                        onClick={() => setLauncherError(null)}
                        className="launcher-error-close"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}

                  {/* PHOTO PICKER / DROPZONE */}
                  <div className="launcher-photo-dropzone">
                    <div className="launcher-photo-dropzone-inner">
                      <label className="launcher-photo-upload-btn cursor-pointer">
                        <ImageIcon className="w-4 h-4 text-[#ff681b]" />
                        <span>SELECT PHOTOS</span>
                        <input
                          id="launcher-photo-file-input"
                          type="file"
                          accept="image/jpeg,image/png,image/webp,image/avif,image/jpg"
                          multiple
                          hidden
                          onChange={(e) => {
                            handleLauncherFiles(e.target.files);
                            e.target.value = "";
                          }}
                        />
                      </label>
                      <span className="launcher-photo-dropzone-hint">
                        {launcherImages.length === 0
                          ? "Select JPG, PNG or WEBP photos to start from scratch"
                          : `${launcherImages.length} photo${
                              launcherImages.length > 1 ? "s" : ""
                            } staged · Auto-suggested reel time: ${(
                              launcherImages.length * 1.8
                            ).toFixed(1)}s (1.8s/slide beat-synced)`}
                      </span>
                    </div>

                    {/* PREVIEW STRIP OF SELECTED PHOTOS */}
                    {launcherImages.length > 0 && (
                      <div className="launcher-photo-preview-strip">
                        {launcherImages.map((file, idx) => (
                          <div
                            key={`${file.name}-${idx}`}
                            className="launcher-photo-chip"
                          >
                            <img
                              src={URL.createObjectURL(file)}
                              alt={file.name}
                              className="launcher-photo-chip-thumb"
                            />
                            <div className="launcher-photo-chip-meta">
                              <span className="launcher-photo-chip-num">
                                Slide {idx + 1}
                              </span>
                              <span className="launcher-photo-chip-name">
                                {file.name}
                              </span>
                            </div>
                            <button
                              type="button"
                              className="launcher-photo-chip-remove"
                              onClick={() => removeLauncherImage(idx)}
                              title="Remove photo"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        ))}

                        <button
                          type="button"
                          className="launcher-photo-clear-btn"
                          onClick={() => setLauncherImages([])}
                        >
                          Clear all
                        </button>
                      </div>
                    )}
                  </div>

                  {/* TITLE INPUT & LAUNCH BUTTON */}
                  <div className="project-input-row flex-wrap sm:flex-nowrap gap-3">
                    <input
                      type="text"
                      value={inlineTitle}
                      onChange={(e) =>
                        setInlineTitle(e.target.value)
                      }
                      placeholder="Enter a reel title"
                      className="project-input"
                    />

                    <button
                      type="submit"
                      className="continue-button"
                      style={{ whiteSpace: "nowrap" }}
                    >
                      <span>
                        {launcherImages.length > 0
                          ? `LAUNCH STUDIO (${launcherImages.length})`
                          : "LAUNCH STUDIO"}
                      </span>
                      <span>→</span>
                    </button>
                  </div>

                  {/* CATEGORY */}
                  <div className="category-row">
                    <div className="category-group">
                      <span className="category-label">
                        Category
                      </span>

                      {(
                        [
                          "Product",
                          "Apparel",
                          "Accessories",
                          "Beauty",
                          "Home",
                          "Other",
                        ] as const
                      ).map((cat) => (
                        <button
                          key={cat}
                          type="button"
                          onClick={() =>
                            setInlineCategory(cat)
                          }
                          className={
                            inlineCategory === cat
                              ? "category-pill active"
                              : "category-pill"
                          }
                        >
                          {cat}
                        </button>
                      ))}
                    </div>

                    <button
                      type="button"
                      onClick={handleLoadSampleProjects}
                      className="sample-link"
                    >
                      Preview sample reels
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </section>
          {filteredProjects.length > 0 ? (
            <div className="created-reels-section">

    <div className="created-reels-header">
      <div>
        <span className="created-reels-eyebrow">
          YOUR CREATIONS
        </span>

        <h2>Reels Created by You</h2>

        <p>
          Your generated reels, ready to preview and share.
        </p>
      </div>

      <span className="created-reels-count">
        {filteredProjects.length} REELS
      </span>
    </div>
            {/* =================================================
               PROJECT LIBRARY
               ================================================= */}

            {viewMode === "grid" ? (
              <section className="reel-grid page-enter">
                {filteredProjects.map(
                  (project) => (
                    <DashfolioReelCard
                      key={project.id}
                      project={project}
                      isLight={isLight}
                      isPlaying={
                        playingCardId ===
                        project.id
                      }
                      isMuted={isMuted}
                      onOpenInEditor={() =>
                        handleOpenManualEditor({
                          title: project.title,
                          category: project.category,
                        })
                      }
                      onTogglePlay={() => {
                        setPlayingCardId(
                          playingCardId ===
                            project.id
                            ? null
                            : project.id
                        );
                      }}
                      onToggleMute={(e) => {
                        e.stopPropagation();
                        setIsMuted(!isMuted);
                      }}
                      onOpenCinema={() => {
                        setActiveCinemaReel(
                          project
                        );
                        setCinemaVideoLoading(Boolean(project.videoUrl));
                      }}
                      onDelete={(e) =>
                        handleDeleteProject(
                          project.id,
                          e
                        )
                      }
                      onShare={(e) =>
                        handleShare(
                          project,
                          e
                        )
                      }
                      isCopied={
                        copiedId === project.id
                      }
                    />
                  )
                )}
              </section>
            ) : (
              /* =================================================
                 LIST VIEW
                 ================================================= */

              <section
  className="reel-list page-enter"
  style={{
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: "14px",
  }}
>
                {filteredProjects.map(
                  (project) => (
                    <div
                      key={project.id}
                      className="reel-list-item"
                      onClick={() =>
                        setPlayingCardId(
                          playingCardId ===
                            project.id
                            ? null
                            : project.id
                        )
                      }
                    >
                      <div className="list-project-info">
                        <div className="list-thumbnail">

{project.thumbnailUrl ? (
  <img
    src={project.thumbnailUrl}
    alt={project.title}
  />
) : project.videoUrl ? (
  <AuthenticatedVideoPreview
    videoUrl={project.videoUrl}
    title={project.title}
  />
) : (
  <span className="list-thumbnail-empty" role="status">
    Video unavailable
  </span>
)}


                          <div className="list-play-overlay">
                            {playingCardId ===
                            project.id ? (
                              <Pause />
                            ) : (
                              <Play />
                            )}
                          </div>
                        </div>

                        <div className="list-copy">
                          <p className="list-title">
                            {project.title}
                          </p>

                          <div className="list-meta">
                            <span>
                              {project.category}
                            </span>

                            <b>·</b>

                            <span>
                              {
                                project.durationSeconds
                              }
                              s
                            </span>

                            <b>·</b>

                            <span>
                              {project.productPrice ||
                                "Reel"}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div
                        className="list-actions"
                        onClick={(e) =>
                          e.stopPropagation()
                        }
                      >
                        <button
                          type="button"
                          onClick={() => {
                            setActiveCinemaReel(project);
                            setCinemaVideoLoading(Boolean(project.videoUrl));
                          }}
                          title="Preview"
                        >
                          <Maximize2 />
                        </button>

                        {project.videoUrl ? (
                          <button
                            type="button"
                            onClick={() =>
                              void downloadAuthenticatedVideo(
                                project.videoUrl!,
                                `${project.title
                                  .toLowerCase()
                                  .replace(
                                    /[^a-z0-9]+/g,
                                    "_"
                                  )}.mp4`
                              )
                            }
                            title="Download"
                          >
                            <Download />
                          </button>
                        ) : (
                          <button type="button" disabled title="Video unavailable">
                            <Download />
                          </button>
                        )}

                        <button
                          type="button"
                          disabled={!project.videoUrl}
                          onClick={(e) =>
                            handleShare(
                              project,
                              e
                            )
                          }
                          title="Share"
                        >
                          {copiedId ===
                          project.id ? (
                            <Check className="success-icon" />
                          ) : (
                            <Share2 />
                          )}
                        </button>

                        <button
                          type="button"
                          onClick={(e) =>
                            handleDeleteProject(
                              project.id,
                              e
                            )
                          }
                          className="danger"
                          title="Delete"
                        >
                          <Trash2 />
                        </button>
                      </div>
                    </div>
                  )
                )}
              </section>
              )}
            </div>
          ) : (
            /* =================================================
               NO SEARCH RESULTS
               ================================================= */

            <div className="no-results page-enter">
              <Search />

              <p>
                No Reels match "{searchQuery}"
              </p>

              <button
                type="button"
                onClick={() => {
                  setSearchQuery("");
                  setSelectedCategory("All");
                }}
              >
                Clear filters
              </button>
            </div>
          )}
          </>
         )}
        </main>
      </div>

      {/* =====================================================
    MOBILE DRAWER
    ===================================================== */}

{mobileMenuOpen && (
  <div className="mobile-drawer-wrapper">

    {/* OVERLAY */}
    <div
      className="mobile-drawer-overlay"
      onClick={() => setMobileMenuOpen(false)}
    />

    {/* DRAWER */}
    <aside className="mobile-drawer">

      {/* MOBILE BRAND */}
      <div>
        {/* BACK TO LANDING PAGE */}
        <button
          type="button"
          onClick={() => {
            setMobileMenuOpen(false);
            onBackToLanding();
          }}
          className="sidebar-back-landing-btn mb-2"
          title="Back to Landing Page"
          aria-label="Back to Landing Page"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Landing Page</span>
        </button>

        <div className="mobile-brand-row">

          <div className="mobile-brand">
            <div className="brand-mark">
              K
            </div>

            <div>
              <p className="brand-name">
                KALADHAR
              </p>

              <p className="brand-studio">
                STUDIO
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setMobileMenuOpen(false)}
            className="drawer-close"
          >
            <X />
          </button>

        </div>

        {/* MOBILE NAV */}
        <nav className="mobile-nav">

          {/* REEL LIBRARY */}
          <button
            type="button"
            className={`mobile-nav-item ${
              activeTab === "library" ? "active" : ""
            }`}
            onClick={() => {
              setActiveTab("library");
              setMobileMenuOpen(false);
            }}
          >
            <LayoutGrid />
            <span>Reel Library</span>
            <span>{projects.length}</span>
          </button>


          {/* CREATE NEW REEL */}
          <button
            type="button"
            className="mobile-nav-item"
            onClick={() => {
              setMobileMenuOpen(false);
              setNewReelModalOpen(true);
            }}
          >
            <Plus />
            <span>Create New Reel</span>
          </button>


          {/* PHOTOSHOOT UPLOADS */}
          <button
            type="button"
            className={`mobile-nav-item ${
              activeTab === "upload" ? "active" : ""
            }`}
            onClick={() => {
              setActiveTab("upload");
              setMobileMenuOpen(false);
            }}
          >
            <Video />
            <span>Photoshoot Uploads</span>
          </button>


          {/* FABRIC CATALOGS */}
          <button
            type="button"
            className={`mobile-nav-item ${
              activeTab === "collections" ? "active" : ""
            }`}
            onClick={() => {
              setActiveTab("collections");
              setMobileMenuOpen(false);
            }}
          >
            <Layers />
            <span>Collections</span>
          </button>


          {/* PREVIOUS WORKS */}
          <button
            type="button"
            className={`mobile-nav-item ${
              activeTab === "previous" ? "active" : ""
            }`}
            onClick={() => {
              setActiveTab("previous");
              setMobileMenuOpen(false);
            }}
          >
            <History />
            <span>Previous Works</span>
            <span>
              {projects.length}
            </span>
          </button>


          {/* CREDITS */}
          <button
            type="button"
            className={`mobile-nav-item ${
              activeTab === "credits" ? "active" : ""
            }`}
            onClick={() => {
              setActiveTab("credits");
              setMobileMenuOpen(false);
            }}
          >
            <CreditCard />
            <span>Credits</span>
            <span>
  {creditsLoading ? "…" : credits ?? "—"}
</span>
          </button>


          {/* SETTINGS */}
          <button
            type="button"
            className={`mobile-nav-item ${
              activeTab === "settings" ? "active" : ""
            }`}
            onClick={() => {
              setActiveTab("settings");
              setMobileMenuOpen(false);
            }}
          >
            <Settings />
            <span>Settings</span>
          </button>


          {/* BACK TO LANDING */}
          <button
            type="button"
            className="mobile-nav-item"
            onClick={() => {
              setMobileMenuOpen(false);
              onBackToLanding();
            }}
          >
            <ArrowUpRight />
            <span>Back to Landing</span>
          </button>

        </nav>
      </div>


      {/* MOBILE FOOTER */}
      <div className="mobile-drawer-footer">

        <div className="mobile-theme-row">
          <span>Theme</span>
          <IOKnob size="sm" />
        </div>

        <button
          type="button"
          onClick={() => {
            setMobileMenuOpen(false);
            handleLogout();
          }}
          className="mobile-signout"
        >
          <LogOut />
          <span>SIGN OUT</span>
        </button>

      </div>

    </aside>
  </div>
)}

      {/* =====================================================
          CINEMA PREVIEW
          ===================================================== */}

      {activeCinemaReel && (
        <div
          className="cinema-overlay"
          onClick={() =>
            setActiveCinemaReel(null)
          }
        >
          <div
            ref={cinemaDialogRef}
            role="dialog"
            aria-modal="true"
            aria-label={`Reel preview: ${activeCinemaReel.title}`}
            tabIndex={-1}
            className="cinema-container"
            onClick={(e) =>
              e.stopPropagation()
            }
          >
            <div className="cinema-header">
              <div>
                <p>
                  {activeCinemaReel.title}
                </p>

                <span>
                  {activeCinemaReel.category}
                  {" · "}
                  {
                    activeCinemaReel.durationSeconds
                  }
                  s
                  {" · "}
                  {activeCinemaReel.resolution}
                </span>
              </div>

              <button
                type="button"
                aria-label="Close reel preview"
                onClick={() =>
                  setActiveCinemaReel(null)
                }
              >
                <X />
              </button>
            </div>

            <div className="cinema-video">
              {activeCinemaReel.videoUrl && !cinemaVideoUnavailable ? (
                <>
                  {cinemaVideoLoading && <p className="cinema-video-loading" role="status">Loading reel…</p>}
                  <AuthenticatedVideoPreview
  videoUrl={activeCinemaReel.videoUrl}
  title={activeCinemaReel.title}
  controls
  autoPlay
  loop
  muted={false}
  onLoadStart={() => setCinemaVideoLoading(true)}
  onCanPlay={() => setCinemaVideoLoading(false)}
  onPlaying={() => setCinemaVideoLoading(false)}
  onError={() => {
    setCinemaVideoLoading(false);
    setCinemaVideoUnavailable(true);
  }}
/>
                </>
              ) : (
                <p role="status">Video unavailable</p>
              )}
            </div>


<div className="cinema-actions">
  {activeCinemaReel.videoUrl && !cinemaVideoUnavailable ? (
    <button
      type="button"
      onClick={() =>
        void downloadAuthenticatedVideo(
          activeCinemaReel.videoUrl!,
          `kaladhar_${activeCinemaReel.id}.mp4`
        )
      }
      className="cinema-download"
    >
      <Download />
      DOWNLOAD MP4
    </button>
  ) : (
    <span role="status">Download unavailable</span>
  )}

  <button
    type="button"
    onClick={(e) => handleShare(activeCinemaReel, e)}
    disabled={!activeCinemaReel.videoUrl || cinemaVideoUnavailable}
    className="cinema-share"
  >
    {copiedId === activeCinemaReel.id ? (
      <>
        <Check />
        COPIED
      </>
    ) : (
      <>
        <Share2 />
        SHARE
      </>
    )}
  </button>
</div>

          </div>
        </div>
      )}

      {/* =====================================================
          CREATE NEW REEL MODAL
          ===================================================== */}

      {newReelModalOpen && (
        <div
          className="dashboard-modal-overlay"
          onClick={() =>
            setNewReelModalOpen(false)
          }
        >
          <div
            ref={createReelDialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="create-reel-dialog-title"
            tabIndex={-1}
            className="dashboard-modal"
            onClick={(e) =>
              e.stopPropagation()
            }
          >
            {/* MODAL TOP */}
            <div className="modal-top">
              <div className="modal-heading">
                <div className="modal-icon">
                  <Film />
                </div>

                <div>
                  <p id="create-reel-dialog-title">
                    CREATE A NEW REEL
                  </p>

                  <span>
                    Name your project & launch
                    studio
                  </span>
                </div>
              </div>

              <button
                type="button"
                aria-label="Close create reel dialog"
                onClick={() =>
                  setNewReelModalOpen(false)
                }
                className="modal-close"
              >
                <X />
              </button>
            </div>

            {/* FORM */}
            <form
              onSubmit={
                handleConfirmCreateReel
              }
              className="modal-form"
            >
              <div className="modal-field">
                <label>
                  PROJECT NAME
                </label>

                <input
                  type="text"
                  required
                  autoFocus
                  value={newReelTitle}
                  onChange={(e) =>
                    setNewReelTitle(
                      e.target.value
                    )
                  }
                  placeholder="Enter a project name"
                />

                <span>
                  Used for your reel metadata
                  and exported filename.
                </span>
              </div>

              <div className="modal-field">
                <label>
                  COLLECTION CATEGORY
                </label>

                <div className="modal-category-grid">
                  {(
                    [
                      "Product",
                      "Apparel",
                      "Accessories",
                      "Beauty",
                      "Home",
                      "Other",
                    ] as const
                  ).map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() =>
                        setNewReelCategory(
                          cat
                        )
                      }
                      className={
                        newReelCategory === cat
                          ? "modal-category active"
                          : "modal-category"
                      }
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>

              <div className="modal-actions">
                <button
                  type="button"
                  onClick={() =>
                    setNewReelModalOpen(false)
                  }
                  className="modal-cancel"
                >
                  CANCEL
                </button>

                <button
                  type="submit"
                  disabled={
                    !newReelTitle.trim()
                  }
                  className="modal-continue"
                >
                  CONTINUE TO STUDIO

                  <span>→</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {pendingConfirmation && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4">
          <div
            ref={confirmationDialogRef}
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="dashboard-confirmation-title"
            className="w-full max-w-md rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 shadow-2xl"
          >
            <h2
              id="dashboard-confirmation-title"
              className="text-lg font-semibold text-[var(--color-text-primary)]"
            >
              Please confirm
            </h2>
            <p className="mt-3 text-sm text-[var(--color-text-secondary)]">
              {pendingConfirmation.message}
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setPendingConfirmation(null)}
                className="rounded-md border border-[var(--color-border)] px-4 py-2 text-sm text-[var(--color-text-primary)]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  const confirmAction = pendingConfirmation.onConfirm;
                  setPendingConfirmation(null);
                  confirmAction();
                }}
                className="rounded-md bg-[var(--color-brand-primary)] px-4 py-2 text-sm font-medium text-white"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* =========================================================
   REEL CARD
   ========================================================= */

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
  onOpenInEditor,
}: {
  project: ReelProject;
  isLight: boolean;
  isPlaying: boolean;
  isMuted: boolean;
  onTogglePlay: () => void;
  onToggleMute: (
    e: React.MouseEvent
  ) => void;
  onOpenCinema: () => void;
  onDelete: (
    e: React.MouseEvent
  ) => void;
  onShare: (
    e: React.MouseEvent
  ) => void;
  isCopied: boolean;
  onOpenInEditor?: () => void;
}) {
  const videoRef =
    useRef<HTMLVideoElement | null>(
      null
    );
  const [videoUnavailable, setVideoUnavailable] = useState(false);

  useEffect(() => {
    setVideoUnavailable(false);
  }, [project.videoUrl]);

  useEffect(() => {
    if (!videoRef.current) return;

    if (isPlaying) {
      videoRef.current.currentTime = 0;

      videoRef.current
        .play()
        .catch(() => {});
    } else {
      videoRef.current.pause();
    }
  }, [isPlaying]);

  return (
    <article
      role="group"
      tabIndex={0}
      aria-label={`${project.title}. Press Enter or Space to play or pause the reel.`}
      onClick={() => project.videoUrl && !videoUnavailable && onTogglePlay()}
      onKeyDown={(event) => {
        if (event.target !== event.currentTarget || !project.videoUrl || videoUnavailable) return;
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onTogglePlay();
        }
      }}
      className={`dashboard-reel-card ${
        isLight ? "light-card" : ""
      }`}
    >
      {/* VIDEO */}
      <div className="reel-media">
        {project.videoUrl && !videoUnavailable ? (
          <AuthenticatedVideoPreview
            videoRef={videoRef}
            videoUrl={project.videoUrl}
            title={project.title}
            loop
            muted={isMuted}
            playsInline
            className="reel-video playing"
            onCanPlay={() => {
              if (isPlaying && videoRef.current) {
                videoRef.current.play().catch(() => {});
              }
            }}
            onError={() => setVideoUnavailable(true)}
            unavailableFallback={
              <div className="reel-video-unavailable flex h-full w-full items-center justify-center bg-neutral-900 text-sm text-neutral-400" role="status">
                Video unavailable
              </div>
            }
            loadingFallback={
              <div className="reel-video-loading flex h-full w-full items-center justify-center bg-neutral-900 text-sm text-neutral-400" role="status">
                Loading reel…
              </div>
            }
          />
        ) : (
          <div className="reel-video-unavailable flex h-full w-full items-center justify-center bg-neutral-900 text-sm text-neutral-400" role="status">
            Video unavailable
          </div>
        )}

        <div className="reel-gradient" />

        {/* TOP */}
        <div className="reel-top">
          <span className="reel-category">
            {project.category}
          </span>

          <div className="reel-top-actions">
            <button
              type="button"
              onClick={onShare}
              disabled={!project.videoUrl || videoUnavailable}
              aria-label={project.videoUrl && !videoUnavailable ? "Share reel" : "Reel video unavailable"}
              title={
                isCopied
                  ? "Link copied"
                  : "Share"
              }
            >
              {isCopied ? (
                <Check className="success-icon" />
              ) : (
                <Share2 />
              )}
            </button>

            {isPlaying && (
              <button
                type="button"
                onClick={onToggleMute}
                title={
                  isMuted
                    ? "Unmute"
                    : "Mute"
                }
              >
                {isMuted ? (
                  <VolumeX />
                ) : (
                  <Volume2 className="success-icon" />
                )}
              </button>
            )}

            <span className="reel-duration">
              {project.durationSeconds}s
            </span>
          </div>
        </div>

        {/* PLAY */}
        <div
          className={
            isPlaying
              ? "reel-play hidden"
              : "reel-play"
          }
        >
          <div>
            <Play />
          </div>
        </div>

        {/* INFO */}
        <div className="reel-overlay-info">
          {project.productPrice && (
            <span className="reel-price">
              {project.productPrice}
            </span>
          )}

          <h3>{project.title}</h3>
        </div>
      </div>

      {/* CARD FOOTER */}
      <div className="reel-card-footer">
        <div className="reel-meta">
          <span>
            <Calendar />

            {project.createdAt}
          </span>

          {project.viewsCount && (
            <strong>
              {project.viewsCount} views
            </strong>
          )}
        </div>

        <div className="reel-card-actions">
          <button
            type="button"
            onClick={onTogglePlay}
            disabled={!project.videoUrl || videoUnavailable}
            className={
              isPlaying ? "primary" : ""
            }
          >
            {isPlaying ? (
              <Pause />
            ) : (
              <Play />
            )}

            <span>
              {isPlaying
                ? "Pause"
                : "Play"}
            </span>
          </button>

          <button
            type="button"
            onClick={onOpenCinema}
          >
            <Maximize2 />

            <span>View</span>
          </button>

          {onOpenInEditor && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onOpenInEditor();
              }}
              title="Edit in Reel Workspace"
            >
              <Film style={{ width: 14, height: 14, color: "#ff681b" }} />
              <span>Edit</span>
            </button>
          )}

          {project.videoUrl && !videoUnavailable ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                void downloadAuthenticatedVideo(
                  project.videoUrl!,
                  `${project.title.toLowerCase().replace(/[^a-z0-9]+/g, "_")}.mp4`
                );
              }}
              title="Save"
            >
              <Download />
              <span>Save</span>
            </button>
          ) : (
            <button type="button" disabled title="Video unavailable">
              <Download />
              <span>Unavailable</span>
            </button>
          )}

          <button
            type="button"
            onClick={onDelete}
            className="danger"
          >
            <Trash2 />

            <span>Del</span>
          </button>
        </div>
      </div>
    </article>
  );
}
function PreviousWorkCard({
  project,
}: {
  project: ReelProject;
}) {
  return (
    <article className="dashboard-reel-card">

      {/* PREVIEW */}
      <div className="reel-preview">

        {project.thumbnailUrl ? (
          <img
            src={project.thumbnailUrl}
            alt={project.title}
          />
        ) : project.videoUrl ? (
          <AuthenticatedVideoPreview
            videoUrl={project.videoUrl}
            title={project.title}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-neutral-900 text-sm text-neutral-400" role="status">
            Video unavailable
          </div>
        )}

        <div className="reel-gradient" />

        {/* TOP */}
        <div className="reel-top">

          <span className="reel-category">
            {project.category}
          </span>

          <span className="reel-duration">
            {project.durationSeconds}s
          </span>

        </div>


        {/* PLAY */}
        <div className="reel-play">
          <div>
            <Play />
          </div>
        </div>


        {/* INFO */}
        <div className="reel-overlay-info">

          {project.productPrice && (
            <span className="reel-price">
              {project.productPrice}
            </span>
          )}

          <h3>
            {project.title}
          </h3>

        </div>

      </div>


      {/* FOOTER */}
      <div className="reel-card-footer">

        <div className="reel-meta">

          <span>
            <Calendar />

            {project.createdAt}
          </span>

          {project.viewsCount && (
            <strong>
              {project.viewsCount} views
            </strong>
          )}

        </div>


        <div className="reel-card-actions">

          <button type="button">
            <Play />
            <span>Play</span>
          </button>

          <button type="button">
            <Maximize2 />
            <span>View</span>
          </button>

          {project.videoUrl ? (
            <button
              type="button"
              onClick={() =>
                void downloadAuthenticatedVideo(
                  project.videoUrl!,
                  `${project.title.toLowerCase().replace(/[^a-z0-9]+/g, "_")}.mp4`
                )
              }
              title="Save"
            >
              <Download />
              <span>Save</span>
            </button>
          ) : (
            <button type="button" disabled title="Video unavailable">
              <Download />
              <span>Unavailable</span>
            </button>
          )}

        </div>

      </div>

    </article>
  );
}
function PreviousWorksPage({
  projects,
  showSamplePreview,
  isLight,
  onOpenLibrary,
  onOpenCinema,
}: {
  projects: ReelProject[];
  showSamplePreview: boolean;
  isLight: boolean;
  onOpenLibrary: () => void;
  onOpenCinema: (project: ReelProject) => void;
}) {
  const works =
    projects.length > 0
      ? projects
      : showSamplePreview
        ? SAMPLE_PROJECTS_PRESET
        : [];

  return (
    <section className="previous-works-page">

      {/* HEADER */}

      <div className="dashboard-page-header">

        <div>
          <h1>Previous Works</h1>

          <p>
            Browse your previously created reels.
          </p>
        </div>

        <button
          type="button"
          className="dashboard-primary-button"
          onClick={onOpenLibrary}
        >
          Back to Reel Library
        </button>

      </div>

      {showSamplePreview && projects.length === 0 && (
        <p className="text-sm text-neutral-500" role="status">
          Sample preview — these demo reels are not part of your projects.
        </p>
      )}


      {/* REEL CARDS */}

      <section className="reel-grid page-enter">
        {works.length === 0 && (
          <p className="col-span-full py-12 text-center text-neutral-500" role="status">
            No reels yet. Create a reel to see it here.
          </p>
        )}
        {works.map((project) => (

          <DashfolioReelCard
            key={project.id}
            project={project}
            isLight={isLight}
            isPlaying={false}
            isMuted={true}
            onTogglePlay={() => {}}
            onToggleMute={() => {}}
            onOpenCinema={() =>
              onOpenCinema(project)
            }
            onDelete={() => {}}
            onShare={() => {}}
            isCopied={false}
          />

        ))}

      </section>

    </section>
  );
}
function CreditsPage({
  credits,
  cost,
  loading,
  error,
  onRetry,
}: {
  credits: number | null;
  cost: number | null;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
}) {
  return (
    <section className="credits-page">
      {/* HEADER */}
      <div className="dashboard-page-header credits-header">
        <div>
          <span className="credits-eyebrow">ACCOUNT</span>
          <h1>Credits</h1>
          <p>Live balance for the shared demo account.</p>
        </div>
      </div>
      

{/* BALANCE */}
<div className="credits-balance-card">
  {/* CARD HEADER */}
  <div className="credits-balance-header">
    <div className="credits-balance-title">
      <span className="credits-orange-dot" />
      <span>AVAILABLE CREDITS</span>
    </div>

    <span className="credits-current-plan">
      DEMO BALANCE
    </span>
  </div>

  {/* CARD CONTENT */}
  <div className="credits-balance-content">

    {/* LEFT */}
    <div className="credits-balance-main">
      <div className="credits-number">
  {loading ? "Loading…" : credits !== null ? credits : "Unavailable"}
</div>

      <p className="credits-remaining">
        credits remaining
      </p>
    </div>

    {/* VERTICAL DIVIDER */}
    <div className="credits-balance-divider" />

    {/* RIGHT */}
    <div className="credits-balance-details">

      {/* BALANCE */}
      <div className="credits-progress-header">
        <span>Credit Balance</span>

        <span className="credits-progress-value">
  <strong>
            {loading ? "Loading…" : credits !== null ? credits : "Unavailable"}
  </strong>{" "}
  / 50
</span>
      </div>

      <div className="credits-progress-track">
        <div
  className="credits-progress-fill"
  style={{
    width: `${Math.min(
      100,
      Math.max(
        0,
        ((credits ?? 0) / 50) * 100
      )
    )}%`,
  }}
/>
      </div>

      {/* RENEWAL INFO */}
      <div className="credits-renewal-card">
        <div className="credits-renewal-icon">
          ↻
        </div>

        <div className="credits-renewal-content">
          <h3>Shared demo account</h3>

          <p>
            Demo account balance
            is returned by the backend credits service.
          </p>
        </div>
      </div>

    </div>
  </div>

  {/* BOTTOM DIVIDER */}
  <div className="credits-card-bottom-divider" />

  {/* USAGE INFO */}
  <div className="credits-usage-info">
    <span className="credits-usage-label">USAGE</span>

    <span>
      <strong>{cost !== null ? `${cost} credits` : "Cost unavailable"}</strong> per reel generation
    </span>

    
  </div>
</div>

{error && (
  <div role="alert" className="mt-4 flex flex-wrap items-center gap-3 text-sm text-[var(--color-error)]">
    <span>{error}</span>
    <button type="button" onClick={onRetry} className="underline">Retry</button>
  </div>
)}

      {/* PLANS */}
      <div className="credits-section-title">
        <div>
          <h2>Choose your plan</h2>
          <p>Get more credits and create more reels.</p>
        </div>
      </div>

      <div className="credits-plans">

        {/* FREE */}
        <article className="credit-plan-card">
          <div className="credit-plan-top">
            <span className="credit-plan-name">Free</span>
            <span className="credit-plan-badge current">
              CURRENT
            </span>
          </div>

          <div className="credit-plan-price">
            <strong>₹0</strong>
            <span>/ month</span>
          </div>

          <div className="credit-plan-credits">
            50 credits / month
          </div>

          <div className="credit-plan-divider" />

          <ul>
            <li>✓ 50 reel generation credits</li>
            <li>✓ Basic reel generation</li>
            <li>✓ Standard processing</li>
          </ul>

          <button
            type="button"
            className="credit-plan-button secondary"
          >
            Current Plan
          </button>
        </article>

        {/* CREATOR */}
        <article className="credit-plan-card featured">
          <div className="featured-label">
            MOST POPULAR
          </div>

          <div className="credit-plan-top">
            <span className="credit-plan-name">Creator</span>
          </div>

          <div className="credit-plan-price">
            <strong>₹799</strong>
            <span>/ month</span>
          </div>

          <div className="credit-plan-credits">
            200 credits / month
          </div>

          <div className="credit-plan-divider" />

          <ul>
            <li>✓ 200 reel generation credits</li>
            <li>✓ HD reel generation</li>
            <li>✓ Faster processing</li>
            <li>✓ Priority generation</li>
          </ul>

          <button
            type="button"
            className="credit-plan-button primary"
          >
            Upgrade to Creator
          </button>
        </article>

        {/* PRO */}
        <article className="credit-plan-card">
          <div className="credit-plan-top">
            <span className="credit-plan-name">Pro</span>
          </div>

          <div className="credit-plan-price">
            <strong>₹1,999</strong>
            <span>/ month</span>
          </div>

          <div className="credit-plan-credits">
            600 credits / month
          </div>

          <div className="credit-plan-divider" />

          <ul>
            <li>✓ 600 reel generation credits</li>
            <li>✓ Premium reel generation</li>
            <li>✓ Fast processing</li>
            <li>✓ Priority support</li>
          </ul>

          <button
            type="button"
            className="credit-plan-button primary"
          >
            Upgrade to Pro
          </button>
        </article>

      </div>
    </section>
  );
}

function FabricCatalogsPage({
  onBackToLibrary,
  onSelectCategory,
}: {
  onBackToLibrary: () => void;
  onSelectCategory: (category: string) => void;
}) {
  const catalogs = [
    {
      name: "Product catalog",
      count: "All products",
      description:
        "Browse and organize products for your next reel.",
      tags: ["Catalog", "Products", "Collections"],
    },
    {
      name: "Apparel",
      count: "Product category",
      description: "Browse reels tagged with apparel products.",
      tags: ["Clothing", "Fashion", "Apparel"],
    },
    {
      name: "Accessories",
      count: "Product category",
      description: "Browse reels tagged with accessories.",
      tags: ["Bags", "Jewelry", "Accessories"],
    },
    {
      name: "Other",
      count: "Product category",
      description: "Browse reels tagged with other products.",
      tags: ["Beauty", "Food", "Home"],
    },
  ];

  return (
    <section className="fabric-catalogs-page">

      {/* HEADER */}
      <div className="dashboard-page-header fabric-header">
        <div>
          <span className="fabric-eyebrow">
            PRODUCT LIBRARY
          </span>

          <h1>Product Catalogs</h1>

          <p>
            Browse the product categories used in your reels.
          </p>
        </div>

        <button
          type="button"
          className="fabric-back-button"
          onClick={onBackToLibrary}
        >
          ← Reel Library
        </button>
      </div>


      {/* SEARCH / SUMMARY */}
      <div className="fabric-summary">
        <div>
          <span className="fabric-summary-label">
            YOUR LIBRARY
          </span>

          <strong>Reels</strong>

          <p>Filter your saved reel projects</p>
        </div>

        <div className="fabric-summary-line" />

        <div>
          <span className="fabric-summary-label">
            CATEGORIES
          </span>

          <strong>Product types</strong>

          <p>Choose a category below</p>
        </div>
      </div>


      {/* CATALOGS */}
      <div className="fabric-section-heading">
        <div>
          <h2>Product categories</h2>

          <p>
            Select a category to filter the reel library.
          </p>
        </div>
      </div>


      <div className="fabric-catalog-grid">
        {catalogs.map((catalog) => (
          <article
            key={catalog.name}
            className="fabric-catalog-card"
          >
            <div className="fabric-card-visual">
              <div className="fabric-pattern">
                <span />
                <span />
                <span />
                <span />
              </div>

              <div className="fabric-card-category">
                PRODUCT
              </div>
            </div>

            <div className="fabric-card-content">

              <div className="fabric-card-title-row">
                <div>
                  <h3>{catalog.name}</h3>

                  <span>
                    {catalog.count}
                  </span>
                </div>

                <span className="fabric-arrow">
                  →
                </span>
              </div>

              <p>
                {catalog.description}
              </p>

              <div className="fabric-tags">
                {catalog.tags.map((tag) => (
                  <span key={tag}>
                    {tag}
                  </span>
                ))}
              </div>

              <button
                type="button"
                className="fabric-view-button"
                onClick={() => {
                  onSelectCategory(
                    catalog.name === "Product catalog" ? "All" : catalog.name
                  );
  onBackToLibrary();
}}
              >
                VIEW COLLECTION
              </button>

            </div>
          </article>
        ))}
      </div>


      {/* INFO */}
      <div className="fabric-info-card">
        <div className="fabric-info-icon">
          <Layers />
        </div>

        <div>
          <h3>Organize your product reels</h3>

          <p>
            Add product details while creating a reel to keep your library organized.
          </p>
        </div>
      </div>

    </section>
  );
}
function SettingsPage({
  displayName,
  displayBrand,
  onSaveProfile,
  preferences,
  preferencesLoading,
  onUpdatePreferences,
  onLogout,
}: {
  displayName: string;
  displayBrand: string;
  onSaveProfile: (
    name: string,
    brand: string
  ) => Promise<void>;
  preferences: UserPreferences | null;
  preferencesLoading: boolean;
  onUpdatePreferences: (changes: UserPreferencesUpdate) => Promise<void>;
  onLogout: () => void;
}) {
  const [reelFormat, setReelFormat] =
    useState("1080 × 1920");

  const [aspectRatio, setAspectRatio] =
    useState("9:16");

  const [exportFormat, setExportFormat] =
    useState("MP4");

  const [autoSave, setAutoSave] =
    useState(true);

  const [notifications, setNotifications] =
    useState(true);

  const [compactLayout, setCompactLayout] =
    useState(false);
  const [preferenceError, setPreferenceError] = useState<string | null>(null);

  useEffect(() => {
    if (!preferences) return;
    setAutoSave(preferences.auto_save);
    setNotifications(preferences.notifications);
    setCompactLayout(preferences.compact_layout);
    setReelFormat(preferences.default_resolution);
    setAspectRatio(preferences.default_aspect_ratio);
  }, [preferences?.user_id, preferences?.updated_at]);

  const persistPreference = (change: UserPreferencesUpdate) => {
    setPreferenceError(null);
    void onUpdatePreferences(change).catch(() => setPreferenceError("Could not save this preference. Please retry."));
  };

  const [showFormatMenu, setShowFormatMenu] =
    useState(false);

  const [showAspectMenu, setShowAspectMenu] =
    useState(false);

  const [showExportMenu, setShowExportMenu] =
    useState(false);

  /* =====================================================
     EDIT NAME / BRAND
     ===================================================== */

  const [editProfileOpen, setEditProfileOpen] =
    useState(false);

  const [editName, setEditName] =
    useState(displayName);

  const [editBrand, setEditBrand] =
    useState(displayBrand);
  const editProfileDialogRef = useDialogFocus<HTMLDivElement>(editProfileOpen, () => setEditProfileOpen(false));

  const openEditProfile = () => {
    setEditName(displayName);
    setEditBrand(displayBrand);
    setEditProfileOpen(true);
  };

  const saveProfile = async () => {
    const name =
      editName.trim() || "Creator";

    const brand =
      editBrand.trim() || "Your Studio";

    try {
      await onSaveProfile(name, brand);
      setEditProfileOpen(false);
    } catch {
      setPreferenceError("Could not save your profile. Please retry.");
    }
  };

  return (
    <>
      <section className="settings-page">

        {/* =====================================================
            PAGE HEADER
            ===================================================== */}

        <div className="settings-page-header">
          <div>
            <span className="settings-eyebrow">
              ACCOUNT
            </span>

            <h1>Settings</h1>

            <p>
              Manage your studio preferences and account settings.
            </p>
          </div>
        </div>


        {/* =====================================================
            PROFILE
            ===================================================== */}

        <section className="settings-section">

          <div className="settings-section-heading">
            <span>PROFILE</span>

            <h2>Studio Profile</h2>

            <p>
              Your account and studio information.
            </p>
          </div>

          <div className="settings-profile-card">

            {/* AVATAR */}

            <div className="settings-avatar">
              {displayName
                .charAt(0)
                .toUpperCase()}
            </div>


            {/* CREATOR NAME */}

            <div className="settings-profile-info">
              <span>CREATOR NAME</span>

              <strong>
                {displayName}
              </strong>
            </div>


            {/* STUDIO / BRAND */}

            <div className="settings-profile-info">
              <span>STUDIO / BRAND</span>

              <strong>
                {displayBrand}
              </strong>
            </div>


            {/* EDIT BUTTON */}

            <button
              type="button"
              className="settings-outline-button"
              onClick={openEditProfile}
            >
              <Plus />
              EDIT NAME / BRAND
            </button>

          </div>

        </section>


        {/* =====================================================
            APPEARANCE
            ===================================================== */}

        <section className="settings-section">

          <div className="settings-section-heading">
            <span>APPEARANCE</span>

            <h2>Theme</h2>

            <p>
              Choose how Kaladhar Studio appears.
            </p>
          </div>

          <div className="settings-option-card">

            <div>
              <strong>
                Interface Theme
              </strong>

              <p>
                Switch between light and dark appearance.
              </p>
            </div>

            <div className="settings-theme-control">
              <IOKnob size="sm" />
            </div>

          </div>

        </section>


        {/* =====================================================
            GENERAL
            ===================================================== */}

        <section className="settings-section">

          <div className="settings-section-heading">
            <span>GENERAL</span>

            <h2>General Settings</h2>

            <p>
              Configure how your studio workspace behaves.
            </p>
          </div>


          <div className="settings-list-card">

            <div className="settings-list-row">
              <div><strong>Default reel format</strong><p>Choose the settings used when preparing a new reel.</p></div>
              <select aria-label="Default reel resolution" value={reelFormat} onChange={(event) => {
                const value = event.target.value as UserPreferences["default_resolution"];
                setReelFormat(value);
                persistPreference({ default_resolution: value });
              }}>
                <option value="1080x1920">1080 × 1920</option>
                <option value="1080x1080">1080 × 1080</option>
                <option value="1920x1080">1920 × 1080</option>
                <option value="1080x1350">1080 × 1350</option>
              </select>
              <select aria-label="Default reel aspect ratio" value={aspectRatio} onChange={(event) => {
                const value = event.target.value as UserPreferences["default_aspect_ratio"];
                setAspectRatio(value);
                persistPreference({ default_aspect_ratio: value });
              }}>
                <option value="9:16">9:16</option><option value="1:1">1:1</option>
                <option value="16:9">16:9</option><option value="4:5">4:5</option>
              </select>
              <select aria-label="Default frame rate" value={preferences?.default_frame_rate ?? 30} onChange={(event) => {
                persistPreference({ default_frame_rate: Number(event.target.value) as UserPreferences["default_frame_rate"] });
              }}>
                {[24, 25, 30, 50, 60].map((fps) => <option key={fps} value={fps}>{fps} FPS</option>)}
              </select>
              <select aria-label="Default reel duration" value={preferences?.default_target_duration ?? 15} onChange={(event) => {
                const value = Number(event.target.value);
                persistPreference({ default_target_duration: value });
              }}>
                {[15, 30, 45].map((duration) => <option key={duration} value={duration}>{duration} seconds</option>)}
              </select>
            </div>

            {/* AUTO SAVE */}

            <div className="settings-list-row">

              <div>
                <strong>
                  Auto-save projects
                </strong>

                <p>
                  Automatically save reel projects while you work.
                </p>
              </div>

              <button
                type="button"
                className={`settings-toggle ${
                  autoSave ? "active" : ""
                }`}
                onClick={() => {
                  setAutoSave(!autoSave);
                  persistPreference({ auto_save: !autoSave });
                }}
                aria-label="Toggle auto-save"
              >
                <span />
              </button>

            </div>


            {/* NOTIFICATIONS */}

            <div className="settings-list-row">

              <div>
                <strong>
                  Generation notifications
                </strong>

                <p>
                  Get notified when your reel finishes rendering.
                </p>
              </div>

              <button
                type="button"
                className={`settings-toggle ${
                  notifications ? "active" : ""
                }`}
                onClick={() => {
                  setNotifications(!notifications);
                  persistPreference({ notifications: !notifications });
                }}
                aria-label="Toggle notifications"
              >
                <span />
              </button>

            </div>


            {/* COMPACT LAYOUT */}

            <div className="settings-list-row">

              <div>
                <strong>
                  Compact workspace
                </strong>

                <p>
                  Reduce spacing to show more content on screen.
                </p>
              </div>

              <button
                type="button"
                className={`settings-toggle ${
                  compactLayout ? "active" : ""
                }`}
                onClick={() => {
                  setCompactLayout(!compactLayout);
                  persistPreference({ compact_layout: !compactLayout });
                }}
                aria-label="Toggle compact layout"
              >
                <span />
              </button>

            </div>

          </div>

          {(preferencesLoading || preferenceError) && (
            <p role="status" className="mt-3 text-sm text-[var(--color-text-secondary)]">
              {preferenceError || "Loading saved preferences…"}
            </p>
          )}

        </section>


        {/* =====================================================
            ACCOUNT ACTIONS
            ===================================================== */}

        <section className="settings-section">

          <div className="settings-section-heading">

            <span>ACCOUNT</span>

            <h2>Account Actions</h2>

            <p>
              Manage your Kaladhar Studio account.
            </p>

          </div>


          <div className="settings-actions-card">

            <div className="settings-action-divider" />

            <button
              type="button"
              className="settings-action-button danger"
              onClick={onLogout}
            >

              <LogOut />

              <div>

                <strong>
                  Sign out
                </strong>

                <span>
                  Sign out of this Kaladhar Studio account.
                </span>

              </div>

              <span className="settings-action-arrow">
                →
              </span>

            </button>

          </div>

        </section>


        {/* =====================================================
            FOOTER
            ===================================================== */}

        <div className="settings-footer">

          <span>
            KALADHAR STUDIO
          </span>

          <span>
            Settings & Preferences
          </span>

        </div>

      </section>


      {/* =====================================================
          EDIT NAME / BRAND MODAL
          ===================================================== */}

      {editProfileOpen && (

        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
          onClick={() =>
            setEditProfileOpen(false)
          }
        >

          <div
            ref={editProfileDialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="edit-profile-dialog-title"
            tabIndex={-1}
            className="w-full max-w-md rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 shadow-2xl"
            onClick={(event) =>
              event.stopPropagation()
            }
          >

            {/* HEADER */}

            <div className="flex items-start justify-between gap-4 mb-6">

              <div>

                <h2 id="edit-profile-dialog-title" className="text-lg font-semibold text-[var(--color-text-primary)]">
                  Edit Studio Profile
                </h2>

                <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                  Update your creator name and studio brand.
                </p>

              </div>


              <button
                type="button"
                onClick={() =>
                  setEditProfileOpen(false)
                }
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-[var(--color-text-secondary)] hover:bg-[var(--color-background)] hover:text-[var(--color-text-primary)]"
                aria-label="Close"
              >
                ✕
              </button>

            </div>


            {/* CREATOR NAME */}

            <div className="mb-4 space-y-2">

              <label className="text-xs font-medium uppercase tracking-wider text-[var(--color-text-secondary)]">
                Creator Name
              </label>

              <input
                type="text"
                value={editName}
                onChange={(event) =>
                  setEditName(
                    event.target.value
                  )
                }
                placeholder="Enter creator name"
                className="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-2.5 text-sm text-[var(--color-text-primary)] outline-none focus:border-[var(--color-brand-primary)]"
                autoFocus
              />

            </div>


            {/* STUDIO / BRAND */}

            <div className="mb-6 space-y-2">

              <label className="text-xs font-medium uppercase tracking-wider text-[var(--color-text-secondary)]">
                Studio / Brand
              </label>

              <input
                type="text"
                value={editBrand}
                onChange={(event) =>
                  setEditBrand(
                    event.target.value
                  )
                }
                placeholder="Enter studio or brand name"
                className="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-2.5 text-sm text-[var(--color-text-primary)] outline-none focus:border-[var(--color-brand-primary)]"
              />

            </div>


            {/* BUTTONS */}

            <div className="flex justify-end gap-3">

              <button
                type="button"
                onClick={() =>
                  setEditProfileOpen(false)
                }
                className="rounded-md border border-[var(--color-border)] px-4 py-2 text-sm font-medium text-[var(--color-text-primary)] hover:bg-[var(--color-background)]"
              >
                Cancel
              </button>


              <button
                type="button"
                onClick={saveProfile}
                className="rounded-md bg-[var(--color-brand-primary)] px-5 py-2 text-sm font-medium text-white hover:opacity-90"
              >
                Save Changes
              </button>

            </div>

          </div>

        </div>

      )}

    </>
  );
}
