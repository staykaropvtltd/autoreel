import { useState, useEffect, useRef } from "react";
import BrandLogoPage from "./BrandLogoPage";
import ReelImageEditorWorkspace, {
  type ManualReelProject,
  type ImageSlide,
} from "./ReelImageEditorWorkspace";
import PhotoshootUploadsPage from "./PhotoshootUploadsPage";
import { useAuth } from "../../context/AuthContext";
import { useTheme } from "../../context/ThemeContext";
import IOKnob from "../landing/IOKnob";
import Magnetic from "../Magnetic";

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

/* =========================================================
   DASHBOARD
   ========================================================= */

export default function DashboardScreen({
  onCreateNewReel,
  onBackToLanding,
}: DashboardScreenProps) {
  const { user, logout } = useAuth();
  const { theme } = useTheme();

  const isLight = theme === "light";
  const [credits, setCredits] = useState<number | null>(null);

const fetchCredits = async () => {
  try {
    const API_BASE = import.meta.env.VITE_API_BASE_URL;

const response = await fetch(`${API_BASE}/credits`);

    if (!response.ok) {
      throw new Error("Failed to fetch credits");
    }

    const data = await response.json();

    setCredits(data.credits);
  } catch (error) {
    console.error("Failed to fetch credits:", error);
  }
};

useEffect(() => {
  fetchCredits();
}, []);

useEffect(() => {
  const handleCreditsUpdated = () => {
    fetchCredits();
  };

  window.addEventListener("credits-updated", handleCreditsUpdated);

  return () => {
    window.removeEventListener("credits-updated", handleCreditsUpdated);
  };
}, []);

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

          return parsed.map((p, idx) => {
            if (
              p.videoUrl?.includes(
                "commondatastorage.googleapis.com"
              ) ||
              !p.videoUrl
            ) {
              const fallbackIdx = (idx % 4) + 1;

              return {
                ...p,
                videoUrl: `/sample_reel_${fallbackIdx}.mp4`,
              };
            }

            return p;
          });
        }
      }
    } catch {
      // Ignore corrupted localStorage
    }

    return [];
  });

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(projects));
    } catch {
      // Ignore storage errors
    }
  }, [projects, storageKey]);

  /* =======================================================
     UI STATE
     ======================================================= */

  const [activeTab, setActiveTab] = useState<
  "library" | "upload" | "collections" | "previous" | "credits" | "settings"| "brand-logo"
>("library");

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

  const [playingCardId, setPlayingCardId] =
    useState<string | null>(null);

  const [isMuted, setIsMuted] = useState(true);

  const [copiedId, setCopiedId] =
    useState<string | null>(null);

  /* =======================================================
     MANUAL REEL WORKSPACE (PIPELINE 1)
     ======================================================= */
  const [isEditingManualReel, setIsEditingManualReel] = useState(false);
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
  category: "Sarees" | "Lehengas" | "Kurtis" | "Bridal";
} | null>(null);

  const [newReelTitle, setNewReelTitle] =
    useState("");

  const [newReelCategory, setNewReelCategory] =
    useState<
      "Sarees" | "Lehengas" | "Kurtis" | "Bridal"
    >("Sarees");

 const handleConfirmCreateReel = (
  e?: React.FormEvent
) => {
  e?.preventDefault();

  const finalTitle =
    newReelTitle.trim() || "Untitled Ethnic Reel";

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

  const [inlineCategory, setInlineCategory] =
    useState<
      "Sarees" | "Lehengas" | "Kurtis" | "Bridal"
    >("Sarees");

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
    title: inlineTitle.trim() || "Royal Banarasi Silk Reel",
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

      return (
        profile.brand ||
        user?.brandName ||
        "Boutique Studio"
      );
    }
  } catch {
    // Ignore invalid saved profile
  }

  return user?.brandName || "Boutique Studio";
});

const displayName = profileName;
const displayBrand = profileBrand;

const handleSaveProfile = (
  name: string,
  brand: string
) => {
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
};

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

    if (
      confirm(
        "Remove this Reel from your library?"
      )
    ) {
      setProjects((prev) =>
        prev.filter((p) => p.id !== id)
      );

      if (activeCinemaReel?.id === id) {
        setActiveCinemaReel(null);
      }

      if (playingCardId === id) {
        setPlayingCardId(null);
      }
    }
  };

  /* =======================================================
     CLEAR LIBRARY
     ======================================================= */

  const handleClearLibrary = () => {
    if (
      confirm(
        "Reset library to empty? (You can test the fresh new user state)"
      )
    ) {
      setProjects([]);

      localStorage.removeItem(storageKey);
    }
  };

  /* =======================================================
     LOAD SAMPLES
     ======================================================= */

   const handleLoadSampleProjects = () => {
  setActiveTab("previous");
};

  /* =======================================================
     LOGOUT
     ======================================================= */

  const handleLogout = () => {
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
        onSaveToLibrary={(savedReel) => {
          setProjects((prev) => [savedReel, ...prev]);
          setIsEditingManualReel(false);
          setManualEditorProject(null);
          setActiveTab("library");
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
      {projects.length || SAMPLE_PROJECTS_PRESET.length}
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
  {credits !== null ? credits : "..."}
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
    onContinue={(logoFile, logoPlacement) => {
      console.log("Logo:", logoFile);
      console.log("Placement:", logoPlacement);

      if (!pendingProject) return;

      onCreateNewReel(
        pendingProject.title,
        pendingProject.category
      );
    }}
  />

 ) : activeTab === "credits" ? (
  <CreditsPage credits={credits} />

  ) : activeTab === "previous" ? (
   <PreviousWorksPage
  projects={projects}
  isLight={isLight}
  onOpenLibrary={() => setActiveTab("library")}
  onOpenCinema={(project) => {
    setActiveCinemaReel(project);
  }}
/>

  ) : activeTab === "upload" ? (
    <PhotoshootUploadsPage
      onBackToLibrary={() => setActiveTab("library")}
      onAddToLibrary={(savedProject) => {
        setProjects((prev) => [savedProject, ...prev]);
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
                      placeholder="e.g. Banarasi Katan Silk Saree · Festive Drop"
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
                          "Sarees",
                          "Lehengas",
                          "Kurtis",
                          "Bridal",
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
                          <img
                            src={
                              project.thumbnailUrl
                            }
                            alt={project.title}
                          />

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
                                "Ethnic Reel"}
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
                          onClick={() =>
                            setActiveCinemaReel(
                              project
                            )
                          }
                          title="Preview"
                        >
                          <Maximize2 />
                        </button>

                        <a
                          href={
                            project.videoUrl
                          }
                          download={`${project.title
                            .toLowerCase()
                            .replace(
                              /[^a-z0-9]+/g,
                              "_"
                            )}.mp4`}
                          target="_blank"
                          rel="noreferrer"
                          title="Download"
                        >
                          <Download />
                        </a>

                        <button
                          type="button"
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
              {projects.length || SAMPLE_PROJECTS_PRESET.length}
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
  {credits !== null ? credits : "..."}
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
                onClick={() =>
                  setActiveCinemaReel(null)
                }
              >
                <X />
              </button>
            </div>

            <div className="cinema-video">
              <video
                src={
                  activeCinemaReel.videoUrl
                }
                controls
                autoPlay
                loop
                playsInline
              />
            </div>

            <div className="cinema-actions">
              <a
                href={
                  activeCinemaReel.videoUrl
                }
                download={`kaladhar_${activeCinemaReel.id}.mp4`}
                target="_blank"
                rel="noreferrer"
                className="cinema-download"
              >
                <Download />

                DOWNLOAD MP4
              </a>

              <button
                type="button"
                onClick={(e) =>
                  handleShare(
                    activeCinemaReel,
                    e
                  )
                }
                className="cinema-share"
              >
                {copiedId ===
                activeCinemaReel.id ? (
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
                  <p>
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
                  placeholder="e.g. Banarasi Katan Silk Saree"
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
                      "Sarees",
                      "Lehengas",
                      "Kurtis",
                      "Bridal",
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
      onClick={onTogglePlay}
      className={`dashboard-reel-card ${
        isLight ? "light-card" : ""
      }`}
    >
      {/* VIDEO */}
      <div className="reel-media">
        <img
          src={project.thumbnailUrl}
          alt={project.title}
          className={
            isPlaying
              ? "poster hidden"
              : "poster"
          }
        />

        <video
          ref={videoRef}
          src={project.videoUrl}
          loop
          muted={isMuted}
          playsInline
          className={
            isPlaying
              ? "reel-video playing"
              : "reel-video"
          }
        />

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

          <a
            href={project.videoUrl}
            download={`${project.title
              .toLowerCase()
              .replace(
                /[^a-z0-9]+/g,
                "_"
              )}.mp4`}
            target="_blank"
            rel="noreferrer"
          >
            <Download />

            <span>Save</span>
          </a>

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

        <img
          src={project.thumbnailUrl}
          alt={project.title}
        />

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

          <a
            href={project.videoUrl}
            download
          >
            <Download />
            <span>Save</span>
          </a>

        </div>

      </div>

    </article>
  );
}
function PreviousWorksPage({
  projects,
  isLight,
  onOpenLibrary,
  onOpenCinema,
}: {
  projects: ReelProject[];
  isLight: boolean;
  onOpenLibrary: () => void;
  onOpenCinema: (project: ReelProject) => void;
}) {
  const works =
    projects.length > 0
      ? projects
      : SAMPLE_PROJECTS_PRESET;

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


      {/* REEL CARDS */}

      <section className="reel-grid page-enter">

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
}: {
  credits: number | null;
}) {
  return (
    <section className="credits-page">
      {/* HEADER */}
      <div className="dashboard-page-header credits-header">
        <div>
          <span className="credits-eyebrow">ACCOUNT</span>
          <h1>Credits</h1>
          <p>Manage your reel generation credits and subscription.</p>
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
      CURRENT PLAN: FREE
    </span>
  </div>

  {/* CARD CONTENT */}
  <div className="credits-balance-content">

    {/* LEFT */}
    <div className="credits-balance-main">
      <div className="credits-number">
  {credits !== null ? credits : "..."}
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
    {credits !== null ? credits : "..."}
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
          <h3>Renews monthly</h3>

          <p>
            Credits refresh automatically every month
            based on your subscription plan.
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
      <strong>1 credit</strong> = 1 successfully generated reel
    </span>

    
  </div>
</div>

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
      name: "Sarees",
      count: "24 Fabrics",
      description:
        "Silk, cotton, handloom and traditional saree fabrics.",
      tags: ["Silk", "Cotton", "Handloom"],
    },
    {
      name: "Lehengas",
      count: "18 Fabrics",
      description:
        "Premium fabrics for bridal and festive lehenga collections.",
      tags: ["Velvet", "Silk", "Brocade"],
    },
    {
      name: "Kurtis",
      count: "16 Fabrics",
      description:
        "Comfortable and premium fabrics for everyday ethnic wear.",
      tags: ["Cotton", "Rayon", "Linen"],
    },
    {
      name: "Bridal",
      count: "21 Fabrics",
      description:
        "Luxury fabrics curated for bridal and wedding collections.",
      tags: ["Zari", "Brocade", "Velvet"],
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

          <h1>Fabric Catalogs</h1>

          <p>
            Browse your fabric collections and product materials.
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
            CATALOG COLLECTIONS
          </span>

          <strong>79</strong>

          <p>Total fabrics available</p>
        </div>

        <div className="fabric-summary-line" />

        <div>
          <span className="fabric-summary-label">
            CATEGORIES
          </span>

          <strong>04</strong>

          <p>Product categories</p>
        </div>
      </div>


      {/* CATALOGS */}
      <div className="fabric-section-heading">
        <div>
          <h2>Collections</h2>

          <p>
            Select a catalog to explore its fabrics.
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
                FABRIC
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
  onSelectCategory(catalog.name);
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
          <h3>Build your fabric library</h3>

          <p>
            Organize your fabrics by category and use them
            when creating your next reel.
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
  onLogout,
}: {
  displayName: string;
  displayBrand: string;
  onSaveProfile: (
    name: string,
    brand: string
  ) => void;
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

  const openEditProfile = () => {
    setEditName(displayName);
    setEditBrand(displayBrand);
    setEditProfileOpen(true);
  };

  const saveProfile = () => {
    const name =
      editName.trim() || "Creator";

    const brand =
      editBrand.trim() || "Boutique Studio";

    onSaveProfile(name, brand);

    setEditProfileOpen(false);
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
                onClick={() =>
                  setAutoSave(!autoSave)
                }
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
                onClick={() =>
                  setNotifications(!notifications)
                }
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
                onClick={() =>
                  setCompactLayout(!compactLayout)
                }
                aria-label="Toggle compact layout"
              >
                <span />
              </button>

            </div>

          </div>

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
            className="w-full max-w-md rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 shadow-2xl"
            onClick={(event) =>
              event.stopPropagation()
            }
          >

            {/* HEADER */}

            <div className="flex items-start justify-between gap-4 mb-6">

              <div>

                <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">
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