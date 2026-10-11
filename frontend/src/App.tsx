import { useEffect, useRef, useState } from "react";

import {
  generateReel,
  getAnalysis,
  getDemoStatus,
  listMusic,
  planReel,
  startAnalysis,
  uploadVideos,
} from "./api";

import {
  FALLBACK_BRANDING,
  fetchBranding,
  type BrandingInfo,
} from "./branding";

import EditorScreen from "./components/EditorScreen";
import Header from "./components/Header";
import PlanScreen from "./components/PlanScreen";
import ProgressScreen from "./components/ProgressScreen";
import ReviewScreen from "./components/ReviewScreen";
import UploadScreen from "./components/UploadScreen";
import LandingPage from "./components/landing/LandingPage";
import AuthPage from "./components/auth/AuthPage";

import { useTheme } from "./context/ThemeContext";
import DashboardScreen, {
  type ReelProject,
} from "./components/dashboard/DashboardScreen";

import { useAuth } from "./context/AuthContext";



import type {
  AnalysisSummary,
  ClipData,
  MusicTrack,
  PlannedReelClip,
  ProductInfo,
  ReelPlan,
  ReelResult,
} from "./types";


type Screen =
  | "landing"
  | "signin"
  | "signup"
  | "dashboard"
  | "upload"
  | "analyzing"
  | "review"
  | "plan"
  | "generating"
  | "editor";


const ANALYSIS_STAGES = [
  { key: "uploading", label: "Uploading" },
  { key: "analyzing", label: "Analyzing" },
  { key: "selecting_clips", label: "Selecting best clips" },
];


// The backend's initial/terminal stage names don't have their own visual
// step here (queued collapses into "uploading" just finished; completed
// navigates away immediately) - map them onto the nearest displayed stage.
function normalizeAnalysisStage(rawStage: string): string {
  if (rawStage === "queued") return "uploading";
  if (rawStage === "completed") return "selecting_clips";
  return rawStage;
}


const GENERATION_STAGES = [
  { key: "preparing", label: "Preparing Reel" },
  { key: "rendering", label: "Rendering" },
  { key: "complete", label: "Complete" },
];


const EMPTY_PRODUCT: ProductInfo = {
  product_name: "",
  material: "",
  color: "",
  product_code: "",
  price: "",
  category: "",
};


const POLL_INTERVAL_MS = 1000;
const DEFAULT_TARGET_DURATION = 15;


export default function App() {
  const { user } = useAuth();
  const { theme } = useTheme();

  const [screen, setScreen] = useState<Screen>("landing");

  const [files, setFiles] = useState<File[]>([]);
  const [product, setProduct] =
    useState<ProductInfo>(EMPTY_PRODUCT);

  const [branding, setBranding] =
    useState<BrandingInfo>(FALLBACK_BRANDING);

  const [brandName, setBrandName] = useState("");
  const [demoAvailable, setDemoAvailable] = useState(false);

  const [analysisJobId, setAnalysisJobId] =
    useState<string | null>(null);

  const [analysisStage, setAnalysisStage] =
    useState("queued");

  const [analysisSummary, setAnalysisSummary] =
    useState<AnalysisSummary | null>(null);

  const [clips, setClips] =
    useState<ClipData[]>([]);

  const [targetDuration, setTargetDuration] =
    useState(DEFAULT_TARGET_DURATION);

  const [reelPlan, setReelPlan] =
    useState<ReelPlan | null>(null);

  const [planClips, setPlanClips] =
    useState<PlannedReelClip[]>([]);

  const [selectedMusic, setSelectedMusic] =
  useState<MusicTrack | null>(null);

  const [planLoading, setPlanLoading] =
    useState(false);

  const [generationStage, setGenerationStage] =
    useState("preparing");

  const [reel, setReel] =
    useState<ReelResult | null>(null);

  const [generating, setGenerating] =
    useState(false);

  const [error, setError] =
    useState<string | null>(null);

  const pollTimer =
    useRef<number | null>(null);

  const planRequestId =
    useRef(0);


  /* =========================================================
     CURSOR / MOVING GRID EFFECT
     ========================================================= */

  useEffect(() => {
    const handleMouseMove = (event: MouseEvent) => {
      const root = document.querySelector(
        ".workflow-theme-shell"
      ) as HTMLElement | null;

      if (!root) return;

      const x = event.clientX;
      const y = event.clientY;

      const moveX =
        (x / window.innerWidth - 0.5) * 50;

      const moveY =
        (y / window.innerHeight - 0.5) * 50;

      root.style.setProperty(
        "--mouse-x",
        `${x}px`
      );

      root.style.setProperty(
        "--mouse-y",
        `${y}px`
      );

      root.style.setProperty(
        "--grid-move-x",
        `${moveX}px`
      );

      root.style.setProperty(
        "--grid-move-y",
        `${moveY}px`
      );
    };

    window.addEventListener(
      "mousemove",
      handleMouseMove
    );

    return () => {
      window.removeEventListener(
        "mousemove",
        handleMouseMove
      );
    };
  }, []);


  /* =========================================================
     DEMO STATUS
     ========================================================= */

  useEffect(() => {
    getDemoStatus()
      .then((res) =>
        setDemoAvailable(res.available)
      )
      .catch(() =>
        setDemoAvailable(false)
      );
  }, []);


  /* =========================================================
     BRANDING
     ========================================================= */

  useEffect(() => {
    fetchBranding()
      .then((info) => {
        setBranding(info);

        setBrandName(
          (prev) => prev || info.name
        );

        document.title =
          `${info.name} · Auto-Reel`;

        // Optional per-brand accent colors
        const root =
          document.documentElement.style;

        if (info.primary_color) {
          root.setProperty(
            "--color-brand-primary",
            info.primary_color
          );
        }

        if (info.secondary_color) {
          root.setProperty(
            "--color-brand-secondary",
            info.secondary_color
          );
        }
      })
      .catch(() => {
        // Backend unreachable or misconfigured -
        // keep fallback branding.
      });
  }, []);


  /* =========================================================
     CLEANUP POLLING
     ========================================================= */

  useEffect(() => {
    return () => {
      if (pollTimer.current) {
        window.clearTimeout(
          pollTimer.current
        );
      }
    };
  }, []);


  /* =========================================================
     HASH ROUTING
     ========================================================= */

  useEffect(() => {
    const handleRoute = () => {
      const hash =
        window.location.hash;

      if (
        hash === "#signin" ||
        hash === "#/signin"
      ) {
        setScreen("signin");
      } else if (
        hash === "#signup" ||
        hash === "#/signup"
      ) {
        setScreen("signup");
      } else if (
        hash === "#studio"
      ) {
        setScreen("upload");
      } else if (
        hash === "#dashboard" ||
        hash === "#/dashboard"
      ) {
        setScreen("dashboard");
      }
    };

    handleRoute();

    window.addEventListener(
      "hashchange",
      handleRoute
    );

    return () =>
      window.removeEventListener(
        "hashchange",
        handleRoute
      );
  }, []);


  /* =========================================================
     NAVIGATION
     ========================================================= */

  const navigateToAuth = (
    mode: "signin" | "signup"
  ) => {
    window.location.hash = `#${mode}`;

    setScreen(mode);

    window.scrollTo({
      top: 0,
      behavior: "instant",
    });
  };


  const navigateToDashboard = () => {
    window.location.hash =
      "#dashboard";

    setScreen("dashboard");

    window.scrollTo({
      top: 0,
      behavior: "instant",
    });
  };


  const backToHome = () => {
    window.history.pushState(
      null,
      "",
      window.location.pathname
    );

    setScreen("landing");

    window.scrollTo({
      top: 0,
      behavior: "instant",
    });
  };


  /* =========================================================
     REVIEW → PLAN
     ========================================================= */

  useEffect(() => {
    if (
      screen !== "review" ||
      !analysisJobId ||
      targetDuration <= 0
    ) {
      return;
    }

    const requestId =
      ++planRequestId.current;

    setPlanLoading(true);

    planReel({
      analysis_job_id:
        analysisJobId,

      target_duration:
        targetDuration,
    })
      .then((plan) => {
        if (
          planRequestId.current !==
          requestId
        ) {
          return;
        }

        setReelPlan(plan);
        setPlanLoading(false);
      })
      .catch(() => {
        if (
          planRequestId.current !==
          requestId
        ) {
          return;
        }

        setPlanLoading(false);
      });

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    screen,
    analysisJobId,
    targetDuration,
  ]);


  /* =========================================================
     RESET
     ========================================================= */

  const resetToUpload = () => {
    setScreen("upload");

    setFiles([]);

    setAnalysisJobId(null);

    setAnalysisSummary(null);

    setClips([]);

    setReelPlan(null);
    setSelectedMusic(null);

    setPlanClips([]);

    setTargetDuration(
      DEFAULT_TARGET_DURATION
    );

    setReel(null);

    setError(null);
  };


  /* =========================================================
     ANALYSIS POLLING
     ========================================================= */

  const pollAnalysis = (
    jobId: string
  ) => {
    getAnalysis(jobId)
      .then((result) => {
        setAnalysisStage(
          normalizeAnalysisStage(
            result.stage
          )
        );

        if (
          result.status ===
          "completed"
        ) {
          setAnalysisSummary(
            result
          );

          setClips(
            result.clips ?? []
          );

          setScreen("review");

          return;
        }

        if (
          result.status ===
          "failed"
        ) {
          setError(
            result.error ??
              "Analysis failed"
          );

          setScreen("upload");

          return;
        }

        pollTimer.current =
          window.setTimeout(
            () =>
              pollAnalysis(
                jobId
              ),
            POLL_INTERVAL_MS
          );
      })
      .catch(() => {
        setError(
          "Lost connection to the backend while analyzing."
        );

        setScreen("upload");
      });
  };


  /* =========================================================
     ANALYZE
     ========================================================= */

  const handleAnalyze = async (
  useDemo: boolean,
  templateId?: string | null
) => {
    setError(null);

    setScreen("analyzing");

    setAnalysisStage(
      "queued"
    );

    try {
      let jobId:
        | string
        | undefined;

      if (!useDemo) {
        setAnalysisStage(
          "uploading"
        );

        const uploadResult =
          await uploadVideos(
            files
          );

        jobId =
          uploadResult.job_id;
      }

    const {
  job_id,
} = await startAnalysis(
  useDemo
    ? {
        use_demo: true,
      }
    : {
        job_id: jobId,
        template_id: templateId || undefined,
      }
);

      setAnalysisJobId(
        job_id
      );

      pollAnalysis(job_id);
    } catch (err) {
      setError(
        axiosErrorMessage(err)
      );

      setScreen("upload");
    }
  };


  /* =========================================================
     CLIP SELECTION
     ========================================================= */

  const toggleClip = (
    index: number
  ) => {
    setClips((prev) =>
      prev.map((c, i) =>
        i === index
          ? {
              ...c,
              selected:
                !c.selected,
            }
          : c
      )
    );
  };


  const selectAllClips = () =>
    setClips((prev) =>
      prev.map((c) => ({
        ...c,
        selected: true,
      }))
    );


  const clearAllClips = () =>
    setClips((prev) =>
      prev.map((c) => ({
        ...c,
        selected: false,
      }))
    );


  /* =========================================================
     REVIEW → PLAN
     ========================================================= */

const handleContinueToPlan = () => {
  if (!reelPlan) return;

const selectedClips = clips.filter((clip) => clip.selected);

const selectedPlanClips = reelPlan.clips.filter((planClip) =>
  selectedClips.some(
    (selectedClip) =>
      selectedClip.source_file === planClip.source_file
  )
);

  setPlanClips(selectedPlanClips);

  setError(null);
  setScreen("plan");
};


  /* =========================================================
     PLAN CLIPS
     ========================================================= */

  const removePlanClip = (
    index: number
  ) => {
    setPlanClips((prev) =>
      prev.filter(
        (_, i) => i !== index
      )
    );
  };


  const movePlanClip = (
    index: number,
    direction: -1 | 1
  ) => {
    setPlanClips((prev) => {
      const next = [
        ...prev,
      ];

      const target =
        index + direction;

      if (
        target < 0 ||
        target >= next.length
      ) {
        return prev;
      }

      [
        next[index],
        next[target],
      ] = [
        next[target],
        next[index],
      ];

      return next;
    });
  };


  /* =========================================================
     GENERATE REEL
     ========================================================= */

  const handleGenerate =
    async () => {
      if (
        !analysisJobId ||
        !reelPlan ||
        planClips.length === 0
      ) {
        return;
      }

      setError(null);

      setScreen(
        "generating"
      );

      setGenerationStage(
        "preparing"
      );

      const estimatedDuration =
        planClips.reduce(
          (sum, c) =>
            sum +
            c.planned_duration,
          0
        );
        

      // Seed the plan's branding/product
      // from the upload form on this first
      // render only.
      const finalPlan: ReelPlan = {
  ...reelPlan,

  clips: planClips.map((clip, i) => ({
    ...clip,
    position: i + 1,
  })),

  estimated_duration: estimatedDuration,

  duration_difference:
    estimatedDuration - reelPlan.target_duration,

  content_duration: estimatedDuration,

  transition_overlap_duration: 0,

  estimated_final_duration: estimatedDuration,

  branding: {
    ...reelPlan.branding,

    brand_name:
      brandName ||
      reelPlan.branding.brand_name,
  },

  music: selectedMusic
    ? {
        track_id: selectedMusic.id,
        track_name: selectedMusic.display_name,
        source_path: selectedMusic.filename,
        source_duration: selectedMusic.duration,
        start_time: 0,
        end_time: null,
        volume: 1,
        loop_if_needed: true,
        preserve_original_audio: false,
      }
    : null,

  product: isProductEmpty(product)
    ? reelPlan.product
    : {
        ...reelPlan.product,
        ...product,
      },

  overlays: {
    ...reelPlan.overlays,
    product_placement: "end",
    material_placement: "end",
    price_placement: "end",
  },
};


      try {
        setGenerationStage(
          "rendering"
        );

        const result =
          await generateReel({
            reel_plan:
              finalPlan,

            analysis_job_id:
              analysisJobId,
          });

        setGenerationStage(
          "complete"
        );

        setReel(result);

        setReelPlan(
          finalPlan
        );


        /* =========================================
           SAVE GENERATED REEL
           ========================================= */

        try {
          const userId =
            user
              ? user.id
              : "guest";

          const storageKey =
            `kaladhar_reels_${userId}`;

          const rawSaved =
            localStorage.getItem(
              storageKey
            );

          const existing:
            ReelProject[] =
            rawSaved
              ? JSON.parse(
                  rawSaved
                )
              : [];


          const newProject:
            ReelProject = {
              id: `reel-${Date.now()}`,

              title:
                finalPlan
                  .product
                  .product_name ||
                `Ethnic Reel #${
                  existing.length +
                  1
                }`,

              category:
                (finalPlan
                  .product
                  .category as any) ||
                "Sarees",

              durationSeconds:
                Math.round(
                  result.duration ||
                    finalPlan.estimated_final_duration ||
                    15
                ),

              resolution:
                "1080x1920 (9:16)",

              videoUrl:
  result.download_url.startsWith("http")
    ? result.download_url
    : `${(import.meta.env.VITE_API_BASE_URL as string).replace(/\/api\/?$/, "")}${result.download_url}`,

              thumbnailUrl:
                planClips[0]
                  ?.thumbnail_url ||
                "/tv_model_1.jpg",

              createdAt:
                "Just now",

              viewsCount:
                "Ready",

              status:
                "ready",

              productPrice:
                finalPlan.product
                  .price ||
                undefined,
            };


          localStorage.setItem(
            storageKey,
            JSON.stringify([
              newProject,
              ...existing,
            ])
          );
        } catch (saveErr) {
          console.warn(
            "Could not save reel to previous works library:",
            saveErr
          );
        }


        setScreen("editor");
      } catch (err) {
        setError(
          axiosErrorMessage(err)
        );

        setScreen("plan");
      }
    };


  /* =========================================================
     RE-GENERATE AFTER EDITING
     ========================================================= */

  const handleGenerateUpdated =
    async () => {
      if (
        !analysisJobId ||
        !reelPlan ||
        reelPlan.clips.length === 0
      ) {
        return;
      }

      setError(null);

      setGenerating(true);

      try {
        const result =
          await generateReel({
            reel_plan:
              reelPlan,

            analysis_job_id:
              analysisJobId,
          });

        setReel(result);
      } catch (err) {
        setError(
          axiosErrorMessage(err)
        );
      } finally {
        setGenerating(false);
      }
    };


  /* =========================================================
     LANDING
     ========================================================= */

  if (
    screen === "landing"
  ) {
    return (
      <LandingPage
        onLaunchStudio={
          navigateToDashboard
        }
        onNavigateToSignIn={() =>
          navigateToAuth(
            "signin"
          )
        }
        onNavigateToSignUp={() =>
          navigateToAuth(
            "signup"
          )
        }
        branding={branding}
      />
    );
  }


  /* =========================================================
     AUTH
     ========================================================= */

  if (
    screen === "signin" ||
    screen === "signup"
  ) {
    return (
      <AuthPage
        initialMode={screen}

        onSuccess={() => {
          navigateToDashboard();
        }}

        onBackToHome={
          backToHome
        }

        onSwitchMode={(mode) =>
          navigateToAuth(mode)
        }
      />
    );
  }


  /* =========================================================
     DASHBOARD
     ========================================================= */

  if (
    screen === "dashboard"
  ) {
    return (
      <DashboardScreen
        onCreateNewReel={(
          projectName,
          category
        ) => {
          resetToUpload();

          if (
            projectName ||
            category
          ) {
            setProduct((prev) => ({
              ...prev,

              product_name:
                projectName ||
                "",

              category:
                category ||
                "Sarees",
            }));
          }

          window.location.hash =
            "#studio";

          setScreen("upload");
        }}

        onBackToLanding={
          backToHome
        }

        onLaunchDemo={
          demoAvailable
            ? async () => {
                resetToUpload();

                window.location.hash =
                  "#studio";

                setScreen(
                  "upload"
                );
              }
            : undefined
        }
      />
    );
  }


  /* =========================================================
     WORKFLOW
     ========================================================= */

  return (
    <div
      className={`workflow-theme-shell ${
        theme === "light"
          ? "light-mode"
          : "dark-mode"
      }`}
    >

      {/* =========================================
          BACKGROUND EFFECT
          ========================================= */}

      <div className="dashboard-background">
        <div className="tech-grid-animated" />

        <div className="dashboard-glow dashboard-glow-one" />

        <div className="dashboard-glow dashboard-glow-two" />
      </div>


      {/* =========================================
          WORKFLOW CONTENT
          ========================================= */}

      <div className="workflow-content">

        {/* HEADER */}

        <Header
          branding={branding}
        />


        {/* =====================================
            NAVIGATION
            ===================================== */}

        <div className="workflow-nav">

          <button
            onClick={
              navigateToDashboard
            }
            className="workflow-nav-button workflow-nav-dashboard"
          >
            ← Dashboard
          </button>


          <span className="workflow-nav-divider">
            |
          </span>


          <button
            onClick={
              backToHome
            }
            className="workflow-nav-button workflow-nav-landing"
          >
            Landing
          </button>

        </div>


        {/* =====================================
            MAIN WORKFLOW
            ===================================== */}

        <main className="workflow-main">

          {/* ===================================
              UPLOAD
              =================================== */}

          {screen === "upload" && (
            <UploadScreen
              files={files}

              onFilesChange={
                setFiles
              }

              product={product}

              onProductChange={
                setProduct
              }

              brandName={
                brandName
              }

              onBrandNameChange={
                setBrandName
              }

              branding={
                branding
              }

              demoAvailable={
                demoAvailable
              }

              onAnalyze={
                handleAnalyze
              }

              error={error}
            />
          )}


          {/* ===================================
              ANALYZING
              =================================== */}

          {screen === "analyzing" && (
            <ProgressScreen
              title="Analyzing your footage"

              stages={
                ANALYSIS_STAGES
              }

              currentStage={
                analysisStage
              }
            />
          )}


          {/* ===================================
              REVIEW
              =================================== */}

          {screen === "review" &&
            analysisSummary && (
              <ReviewScreen
                summary={
                  analysisSummary
                }

                clips={clips}
                files={files}

                onToggleClip={
                  toggleClip
                }

                onSelectAll={
                  selectAllClips
                }

                onClearAll={
                  clearAllClips
                }

                targetDuration={
                  targetDuration
                }

                onTargetDurationChange={
                  setTargetDuration
                }

                planPreview={
                  reelPlan
                    ? {
                        estimated_duration:
                          reelPlan.estimated_duration,

                        clip_count:
                          reelPlan
                            .clips
                            .length,
                      }
                    : null
                }

                planLoading={
                  planLoading
                }

                onContinue={
                  handleContinueToPlan
                }

                error={error}
              />
            )}


          {/* ===================================
              PLAN
              =================================== */}

          {screen === "plan" &&
            reelPlan && (
              <PlanScreen
  targetDuration={reelPlan.target_duration}
  introSeconds={reelPlan.intro_seconds}
  outroSeconds={reelPlan.outro_seconds}
  clips={planClips}
  files={files}
  onRemove={removePlanClip}
  onMoveUp={(i) => movePlanClip(i, -1)}
  onMoveDown={(i) => movePlanClip(i, 1)}
  onGenerate={handleGenerate}
  onBack={() => setScreen("review")}
  error={error}
  selectedMusic={selectedMusic}
  onMusicChange={setSelectedMusic}
/>
            )}


          {/* ===================================
              GENERATING
              =================================== */}

          {screen ===
            "generating" && (
            <ProgressScreen
              title="Generating your Reel"

              stages={
                GENERATION_STAGES
              }

              currentStage={
                generationStage
              }
            />
          )}


          {/* ===================================
              EDITOR
              =================================== */}

          {screen === "editor" &&
            reel &&
            reelPlan && (
              <div className="w-full">

                <EditorScreen
                  reel={reel}

                  plan={
                    reelPlan
                  }

                  onPlanChange={(
                    updater
                  ) =>
                    setReelPlan(
                      (prev) =>
                        prev
                          ? updater(
                              prev
                            )
                          : prev
                    )
                  }

                  onGenerateUpdated={
                    handleGenerateUpdated
                  }

                  generating={
                    generating
                  }

                  error={
                    error
                  }
                />


                <div className="text-center pb-8 flex items-center justify-center gap-4">

                  <button
                    onClick={
                      navigateToDashboard
                    }
                    className="text-sm font-semibold text-[var(--color-brand-primary)] hover:underline cursor-pointer"
                  >
                    ← Studio Dashboard
                  </button>


                  <span className="text-sm text-[var(--color-text-secondary)]">
                    •
                  </span>


                  <button
                    onClick={
                      resetToUpload
                    }
                    className="text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-brand-primary)] underline cursor-pointer"
                  >
                    Start a new Reel
                  </button>

                </div>

              </div>
            )}

        </main>

      </div>

    </div>
  );
}


/* =========================================================
   HELPERS
   ========================================================= */

function isProductEmpty(
  product: ProductInfo
): boolean {
  return (
    !product.product_name &&
    !product.material &&
    !product.color &&
    !product.product_code &&
    !product.price &&
    !product.category
  );
}


function axiosErrorMessage(
  err: unknown
): string {
  if (
    err &&
    typeof err === "object" &&
    "response" in err
  ) {
    const response =
      (
        err as {
          response?: {
            data?: {
              detail?: string;
            };
          };
        }
      ).response;

    if (
      response?.data?.detail
    ) {
      return response.data.detail;
    }
  }

  return "Something went wrong. Please check the backend is running and try again.";
}