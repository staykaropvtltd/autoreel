import { useEffect, useRef, useState } from "react";

import {
  apiErrorMessage,
  generateReel,
  getAnalysis,
  getDemoStatus,
  planReel,
  startAnalysis,
  uploadVideos,
} from "./api";
import { pollAnalysisUntilTerminal } from "./analysisPolling";
import { assertPlanMatchesSelection } from "./clipSelection";
import { getCreditGate } from "./creditAvailability";
import { useCreditQuote } from "./hooks/useCreditQuote";
import {
  hashForScreen,
  canRestoreWorkflowRoute,
  isWorkflowRoute,
  parseAppHash,
  safeReturnDestination,
  signInDestinationFor,
  signInHash,
} from "./appRouting";

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


const DEFAULT_TARGET_DURATION = 15;
const WORKFLOW_RECOVERY_MESSAGE = "This workflow step is no longer available after navigation or refresh. Return to Studio to start or continue with current data.";


export default function App() {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const { theme } = useTheme();

  const [screen, setScreenState] = useState<Screen>("landing");
  const setScreen = (next: Screen, replace = false) => {
    const nextHash = hashForScreen(next);
    const currentUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    const nextUrl = `${window.location.pathname}${window.location.search}${nextHash}`;
    if (currentUrl !== nextUrl) {
      window.history[replace ? "replaceState" : "pushState"](null, "", nextUrl);
    }
    setScreenState(next);
  };

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

  const [planRetryCount, setPlanRetryCount] = useState(0);

  const [generationStage, setGenerationStage] =
    useState("preparing");

  const [reel, setReel] =
    useState<ReelResult | null>(null);

  const [generating, setGenerating] =
    useState(false);

  const [error, setError] =
    useState<string | null>(null);

  const creditQuote = useCreditQuote(["dashboard", "plan", "editor", "generating"].includes(screen));

  const analysisController = useRef<AbortController | null>(null);
  const analysisRunning = useRef(false);
  const generationRunning = useRef(false);

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
      analysisController.current?.abort();
    };
  }, []);

  useEffect(() => {
    if (screen !== "analyzing") analysisController.current?.abort();
  }, [screen]);


  /* =========================================================
     HASH ROUTING
     ========================================================= */

  useEffect(() => {
    const handleRoute = () => {
      const route = parseAppHash(window.location.hash);
      if (route.type === "landing") {
        setScreenState("landing");
        return;
      }
      if (route.type === "unknown") {
        window.history.replaceState(null, "", window.location.pathname + window.location.search);
        setScreenState("landing");
        setError("That page could not be found. You are back at the home page.");
        return;
      }
      if (authLoading) return;
      if (route.type === "auth") {
        if (isAuthenticated) {
          if (route.workflowRecovery) setError(WORKFLOW_RECOVERY_MESSAGE);
          setScreen(route.returnTo === "studio" ? "upload" : "dashboard", true);
        } else {
          setScreenState(route.mode);
        }
        return;
      }
      if (!isAuthenticated) {
        const destination = signInDestinationFor(route);
        if (!destination) return;
        window.history.replaceState(null, "", window.location.pathname + window.location.search + signInHash(destination, isWorkflowRoute(route.destination)));
        setScreenState("signin");
        return;
      }

      const requested = route.destination;
      if (requested === "generating" && reel && reelPlan) {
        setScreen("editor", true);
        return;
      }
      const workflowAvailable = !isWorkflowRoute(requested) || canRestoreWorkflowRoute(requested, {
        analysisRunning: analysisRunning.current,
        generationRunning: generationRunning.current,
        hasAnalysis: !!analysisJobId && !!analysisSummary,
        hasPlan: !!analysisJobId && !!reelPlan,
        hasGeneratedReel: !!reel,
      });
      if (isWorkflowRoute(requested) && !workflowAvailable) {
        setError(WORKFLOW_RECOVERY_MESSAGE);
        setScreen("upload", true);
        return;
      }
      setScreen(requested === "dashboard" ? "dashboard" : requested === "studio" ? "upload" : requested, true);
    };

    handleRoute();
    window.addEventListener("hashchange", handleRoute);
    window.addEventListener("popstate", handleRoute);
    return () => {
      window.removeEventListener("hashchange", handleRoute);
      window.removeEventListener("popstate", handleRoute);
    };
  }, [authLoading, isAuthenticated, analysisJobId, analysisSummary, reelPlan, reel]);


  /* =========================================================
     NAVIGATION
     ========================================================= */

  const navigateToAuth = (
    mode: "signin" | "signup",
    returnTo?: "dashboard" | "studio",
  ) => {
    const nextHash = returnTo && mode === "signin" ? signInHash(returnTo) : `#${mode}`;
    window.history.pushState(null, "", window.location.pathname + window.location.search + nextHash);
    setScreenState(mode);

    window.scrollTo({
      top: 0,
      behavior: "instant",
    });
  };


  const navigateToDashboard = () => {
    if (!isAuthenticated) {
      navigateToAuth("signin", "dashboard");
      return;
    }
    setScreen("dashboard");

    window.scrollTo({
      top: 0,
      behavior: "instant",
    });
  };


  const backToHome = () => {
    window.history.replaceState(null, "", window.location.pathname + window.location.search);
    setScreenState("landing");

    window.scrollTo({
      top: 0,
      behavior: "instant",
    });
  };


  /* =========================================================
     REVIEW → PLAN
     ========================================================= */

  useEffect(() => {
    let cancelled = false;

    if (
      screen !== "review" ||
      !analysisJobId ||
      targetDuration <= 0
    ) {
      return () => {
        cancelled = true;
      };
    }

    const requestId =
      ++planRequestId.current;

    setPlanLoading(true);
    setError(null);
    setReelPlan(null);

    const loadPlan = async () => {
      try {
        const plan = await planReel({
          analysis_job_id: analysisJobId,
          target_duration: targetDuration,
        });

        if (!cancelled && planRequestId.current === requestId) {
          setReelPlan(plan);
        }
      } catch (requestError) {
        if (!cancelled && planRequestId.current === requestId) {
          setError(
            apiErrorMessage(
              requestError,
              "Could not create a reel plan. Please try again."
            )
          );
        }
      } finally {
        if (!cancelled && planRequestId.current === requestId) {
          setPlanLoading(false);
        }
      }
    };

    void loadPlan();

    return () => {
      cancelled = true;
    };

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    screen,
    analysisJobId,
    targetDuration,
    planRetryCount,
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

  const pollAnalysis = async (jobId: string, controller: AbortController) => {
    try {
      const result = await pollAnalysisUntilTerminal(jobId, controller.signal, getAnalysis, {
        onProgress: (progress) => setAnalysisStage(normalizeAnalysisStage(progress.stage)),
      });
      setAnalysisSummary(result);
      setClips(result.clips);
      if (result.clips.length === 0) {
        setError("Analysis completed, but no usable clips were found. Try different footage and analyze again.");
      }
      setScreen("review");
    } catch (err) {
      if (controller.signal.aborted) return;
      const isAxiosError = typeof err === "object" && err !== null &&
        "isAxiosError" in err && err.isAxiosError === true;
      setError(isAxiosError
        ? axiosErrorMessage(err)
        : err instanceof Error
          ? err.message
          : apiErrorMessage(err, "Analysis failed or timed out. Please try again."));
      setScreen("upload");
    }
  };


  /* =========================================================
     ANALYZE
     ========================================================= */

  const handleAnalyze = async (
  useDemo: boolean,
  templateId?: string | null
) => {
    if (analysisRunning.current) return;
    analysisRunning.current = true;
    const controller = new AbortController();
    analysisController.current = controller;
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
            files,
            controller.signal,
          );

        jobId =
          uploadResult.job_id;
      }

      const startResult = await startAnalysis(
  useDemo
    ? {
        use_demo: true,
      }
    : {
        job_id: jobId,
        template_id: templateId || undefined,
      }, controller.signal);

      if (typeof startResult?.job_id !== "string" || !startResult.job_id.trim()) {
        throw new Error("The server did not return an analysis job ID. Please try again.");
      }
      setAnalysisJobId(startResult.job_id);
      await pollAnalysis(startResult.job_id, controller);
    } catch (err) {
      if (controller.signal.aborted) return;
      setError(
        axiosErrorMessage(err)
      );

      setScreen("upload");
    } finally {
      analysisRunning.current = false;
      if (analysisController.current === controller) analysisController.current = null;
    }
  };


  /* =========================================================
     CLIP SELECTION
     ========================================================= */

  const toggleClip = (clipId: string) => {
    setClips((prev) =>
      prev.map((clip) =>
        clip.clip_id === clipId
          ? {
              ...clip,
              selected: !clip.selected,
            }
          : clip
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

const handleContinueToPlan = async () => {
  if (!analysisJobId) return;
  const selectedClipIds = clips.filter((clip) => clip.selected).map((clip) => clip.clip_id);
  if (selectedClipIds.length === 0) {
    setError("Select at least one clip before continuing to the reel plan.");
    return;
  }

  const requestId = ++planRequestId.current;
  setPlanLoading(true);
  setError(null);
  try {
    const selectedPlan = await planReel({
      analysis_job_id: analysisJobId,
      selected_clip_ids: selectedClipIds,
      target_duration: targetDuration,
    });
    assertPlanMatchesSelection(selectedClipIds, selectedPlan.clips);
    if (planRequestId.current !== requestId) return;
    setReelPlan(selectedPlan);
    setPlanClips(selectedPlan.clips);
    setScreen("plan");
  } catch (requestError) {
    if (planRequestId.current === requestId) {
      setError(apiErrorMessage(requestError, "Could not plan the selected clips. Adjust your selection or target duration and try again."));
    }
  } finally {
    if (planRequestId.current === requestId) setPlanLoading(false);
  }
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

      if (generationRunning.current) return;
      const creditGate = getCreditGate(
        creditQuote.credits,
        creditQuote.cost,
        creditQuote.loading,
        creditQuote.error,
      );
      if (!creditGate.allowed) {
        setError(creditGate.message);
        return;
      }
      generationRunning.current = true;

      setError(null);
      setGenerating(true);

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

  content_duration: estimatedDuration,

  transition_overlap_duration: 0,

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
            selected_clip_ids: finalPlan.clips.map((clip) => clip.clip_id),
          }, (stage) => {
            setGenerationStage(
              stage === "queued" ? "preparing"
                : stage === "finalizing" || stage === "completed" ? "complete"
                  : stage,
            );
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
                `Reel #${
                  existing.length +
                  1
                }`,

              category:
                (finalPlan
                  .product
                  .category as any) ||
                "Product",

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
      } finally {
        await creditQuote.refresh();
        generationRunning.current = false;
        setGenerating(false);
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

      if (generationRunning.current) return;
      const creditGate = getCreditGate(
        creditQuote.credits,
        creditQuote.cost,
        creditQuote.loading,
        creditQuote.error,
      );
      if (!creditGate.allowed) {
        setError(creditGate.message);
        return;
      }
      generationRunning.current = true;

      setError(null);

      setGenerating(true);

      try {
        const result =
          await generateReel({
            reel_plan:
              reelPlan,

            analysis_job_id:
              analysisJobId,
            selected_clip_ids: reelPlan.clips.map((clip) => clip.clip_id),
          }, (stage) => {
            setGenerationStage(
              stage === "queued" ? "preparing"
                : stage === "finalizing" || stage === "completed" ? "complete"
                  : stage,
            );
          });

        setReel(result);
      } catch (err) {
        setError(
          axiosErrorMessage(err)
        );
      } finally {
        await creditQuote.refresh();
        generationRunning.current = false;
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
          const authRoute = parseAppHash(window.location.hash);
          const returnTo = authRoute.type === "auth" ? safeReturnDestination(new URLSearchParams(window.location.hash.split("?")[1] || "").get("returnTo")) : null;
          if (authRoute.type === "auth" && authRoute.workflowRecovery) setError(WORKFLOW_RECOVERY_MESSAGE);
          if (returnTo === "studio") setScreen("upload");
          else {
            setScreen("dashboard");
            window.scrollTo({ top: 0, behavior: "instant" });
          }
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
                "Product",
            }));
          }

          setScreen("upload");
        }}

        onBackToLanding={
          backToHome
        }

        onLaunchDemo={
          demoAvailable
            ? async () => {
                resetToUpload();

                setScreen("upload");
              }
            : undefined
        }
        creditQuote={creditQuote}
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

              onError={setError}
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
                        estimated_final_duration:
                          reelPlan.estimated_final_duration,

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

                onRetryPlan={() =>
                  setPlanRetryCount((count) => count + 1)
                }

                onDismissError={() => setError(null)}
              />
            )}


          {/* ===================================
              PLAN
              =================================== */}

          {screen === "plan" &&
            reelPlan && (
              <PlanScreen
  targetDuration={reelPlan.target_duration}
  estimatedFinalDuration={reelPlan.estimated_final_duration}
  templateSeconds={reelPlan.template_seconds}
  introSeconds={reelPlan.intro_seconds}
  outroSeconds={reelPlan.outro_seconds}
  endCardSeconds={reelPlan.end_card_seconds}
  durationStatus={reelPlan.duration_status}
  clips={planClips}
  files={files}
  credits={creditQuote.credits}
  reelCost={creditQuote.cost}
  creditsLoading={creditQuote.loading}
  creditsError={creditQuote.error}
  canGenerate={creditQuote.canGenerate}
  onRetryCredits={() => void creditQuote.refresh()}
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

                  credits={creditQuote.credits}
                  reelCost={creditQuote.cost}
                  creditsLoading={creditQuote.loading}
                  creditsError={creditQuote.error}
                  canGenerate={creditQuote.canGenerate}
                  onRetryCredits={() => void creditQuote.refresh()}

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
  return apiErrorMessage(
    err,
    "Something went wrong. Please check the backend is running and try again."
  );
}
