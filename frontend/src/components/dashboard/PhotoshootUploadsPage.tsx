/**
 * PhotoshootUploadsPage.tsx  —  Kaladhar Studio · Pipeline 2
 *
 * Upgraded with:
 *  - Spotify Trending Reels Music Hub (curated catalog, search, mood tags, artwork)
 *  - Interactive AudioWaveformCutter for precise hook selection
 *  - Custom audio upload + Spotify link import
 *  - start_time / end_time wired into generation payload
 */

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Download,
  Edit3,
  ExternalLink,
  Film,
  Image as ImageIcon,
  Link2,
  Music,
  Pause,
  Play,
  Search,
  Upload,
  Video,
  X,
} from "lucide-react";
import {
  apiErrorMessage,
  deleteTemplateImage,
  generateReel,
  getAnalysis,
  getDemoStatus,
  listMusic,
  musicPreviewUrl,
  planReel,
  startAnalysis,
  uploadTemplateImage,
  uploadMusic,
  uploadVideos,
} from "../../api";
import { pollAnalysisUntilTerminal } from "../../analysisPolling";
import { getCreditGate } from "../../creditAvailability";
import { buildAnalysisStartPayload, isSameTemplateImage, validateTemplateImage } from "../../templateSelection";
import { createSavedReelProject, type SavedReelProject } from "../../savedReels";
import { assertPlanMatchesSelection, selectedClipsById } from "../../clipSelection";
import CreditQuoteNotice from "../CreditQuoteNotice";
import "./PhotoshootUploadsPage.css";
import type {
  ClipData,
  MusicTrack,
  ReelPlan,
  ReelResult,
} from "../../types";
import AudioWaveformCutter from "./AudioWaveformCutter";

const formatInrPrice = (value: string): string | null => {
  const trimmed = value.trim();
  if (!trimmed) return null;

  const match = trimmed.match(
    /^(?:(?:₹|rs\.?\s*)\s*)?((?:\d{1,3}(?:,\d{3})+|\d{1,2}(?:,\d{2})*,\d{3}|\d+)(?:\.\d{1,2})?)$/i
  );
  if (!match) return null;

  const amount = Number(match[1].replace(/,/g, ""));
  if (!Number.isFinite(amount) || amount > Number.MAX_SAFE_INTEGER) return null;

  return `₹${amount.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
};

const hasCurrencyPrefix = (value: string): boolean =>
  /^(?:₹|rs\.?\s*)/i.test(value.trim());

/* ─────────────────────────────────────────────────────────────────────────── */
/*  Local curated Spotify-catalogue metadata                                   */
/* ─────────────────────────────────────────────────────────────────────────── */

interface CuratedTrackMeta {
  id: string;           // matches MusicTrack.id from backend
  displayName: string;
  artist: string;
  album: string;
  mood: string[];       // e.g. ["Festive", "Royal"]
  bpm: number;
  color: string;        // dominant artwork colour for placeholder gradient
  artGradient: string;  // CSS gradient for album art placeholder
  isCustom?: boolean;
}

const CURATED_CATALOGUE: CuratedTrackMeta[] = [
  {
    id: "ghoomar_padmaavat_128_kbps",
    displayName: "Ghoomar (Full Classic)",
    artist: "Shreya Ghoshal · Sanjay Leela Bhansali",
    album: "Padmaavat OST",
    mood: ["Bollywood Trending", "Royal", "Festive"],
    bpm: 112,
    color: "#c9a227",
    artGradient: "linear-gradient(135deg,#4a2e0a 0%,#c9a227 60%,#f3c766 100%)",
  },
  {
    id: "ghoomar_royal_intro",
    displayName: "Ghoomar (Royal Shehnai Intro)",
    artist: "Swaroop Khan & Traditional Shehnai",
    album: "Rajputana Heritage",
    mood: ["Royal", "Bridal", "Bollywood Trending"],
    bpm: 90,
    color: "#e85d3a",
    artGradient: "linear-gradient(135deg,#3d0f0f 0%,#e85d3a 55%,#f5a58c 100%)",
  },
  {
    id: "ghoomar_festive_dholak",
    displayName: "Ghoomar (Festive Dholak Beat)",
    artist: "Shreya Ghoshal & Dholak Beats",
    album: "Navratri & Festive Special",
    mood: ["Festive", "High Energy", "Bollywood Trending"],
    bpm: 120,
    color: "#c94b27",
    artGradient: "linear-gradient(135deg,#451508 0%,#c94b27 60%,#fca47c 100%)",
  },
  {
    id: "ghoomar_energy_hook",
    displayName: "Ghoomar (Trending Reels Drop)",
    artist: "Viral Bollywood Audio Track",
    album: "Trending Reels 2026",
    mood: ["High Energy", "Bollywood Trending", "Festive"],
    bpm: 126,
    color: "#d97706",
    artGradient: "linear-gradient(135deg,#451a03 0%,#d97706 60%,#fde68a 100%)",
  },
  {
    id: "kalyani_128k_djmaza",
    displayName: "Kalyani (Carnatic Heritage)",
    artist: "Classical Carnatic Fusion Collective",
    album: "Heritage Sessions",
    mood: ["Ambient", "Elegant", "Classical"],
    bpm: 88,
    color: "#7c5cbf",
    artGradient: "linear-gradient(135deg,#1a0a2e 0%,#7c5cbf 55%,#c4a8ef 100%)",
  },
  {
    id: "kalyani_fusion_hook",
    displayName: "Kalyani (Modern Sitar Fusion)",
    artist: "Fusion Beats & Sitar Groove",
    album: "Modern Ethnic Runway",
    mood: ["High Energy", "Bollywood Trending", "Elegant"],
    bpm: 118,
    color: "#9333ea",
    artGradient: "linear-gradient(135deg,#2e0854 0%,#9333ea 55%,#d8b4fe 100%)",
  },
  {
    id: "kalyani_sitar_melody",
    displayName: "Kalyani (Sitar & Swara Melody)",
    artist: "Artisanal Weaver's Raag",
    album: "Varanasi Silk Diaries",
    mood: ["Elegant", "Ambient", "Classical"],
    bpm: 84,
    color: "#6366f1",
    artGradient: "linear-gradient(135deg,#1e1b4b 0%,#6366f1 55%,#a5b4fc 100%)",
  },
  {
    id: "kalyani_bridal_ambient",
    displayName: "Kalyani (Bridal Pheras Rhythm)",
    artist: "Wedding & Bridal Couture Sound",
    album: "The Royal Wedding",
    mood: ["Bridal", "Royal", "Ambient"],
    bpm: 78,
    color: "#be185d",
    artGradient: "linear-gradient(135deg,#4c0519 0%,#be185d 55%,#fbcfe8 100%)",
  },
  {
    id: "bridal_shehnai_vivaah",
    displayName: "Vivaah Heritage Shehnai",
    artist: "Ustad Bismillah Heritage Tribute",
    album: "Shaadi & Vivaah Special",
    mood: ["Bridal", "Royal", "Festive", "Classical"],
    bpm: 82,
    color: "#b91c1c",
    artGradient: "linear-gradient(135deg,#450a0a 0%,#b91c1c 55%,#fecaca 100%)",
  },
  {
    id: "royal_darbar_santoor",
    displayName: "Royal Darbar Santoor & Tabla",
    artist: "Maharani Court Acoustics",
    album: "Imperial Textiles",
    mood: ["Royal", "Elegant", "Festive"],
    bpm: 102,
    color: "#047857",
    artGradient: "linear-gradient(135deg,#022c22 0%,#047857 55%,#a7f3d0 100%)",
  },
  {
    id: "festive_silk",
    displayName: "Festive Silk (Boutique Reel)",
    artist: "Sitar Collective",
    album: "Boutique Reels Vol.1",
    mood: ["Festive", "High Energy", "Elegant"],
    bpm: 128,
    color: "#e85d3a",
    artGradient: "linear-gradient(135deg,#3d0f0f 0%,#e85d3a 55%,#f5a58c 100%)",
  },
  {
    id: "graceful_heritage",
    displayName: "Graceful Heritage",
    artist: "Shehnai & Ambient Flute",
    album: "Handloom Diaries",
    mood: ["Ambient", "Royal", "Classical"],
    bpm: 76,
    color: "#2e8a7e",
    artGradient: "linear-gradient(135deg,#0a1e1c 0%,#2e8a7e 55%,#7ed8d0 100%)",
  },
  {
    id: "traditional_elegance",
    displayName: "Traditional Elegance",
    artist: "Tabla & Santoor Classical",
    album: "Weaver's Court",
    mood: ["Elegant", "Ambient", "Classical"],
    bpm: 84,
    color: "#5a8a3a",
    artGradient: "linear-gradient(135deg,#0f1e0a 0%,#5a8a3a 55%,#a8d878 100%)",
  },
];

const MOOD_FILTERS = [
  "All",
  "My Uploads",
  "Bollywood Trending",
  "Bridal",
  "Royal",
  "Festive",
  "Ambient",
  "High Energy",
  "Classical",
] as const;
type MoodFilter = (typeof MOOD_FILTERS)[number];

/* ─────────────────────────────────────────────────────────────────────────── */
/*  Props                                                                      */
/* ─────────────────────────────────────────────────────────────────────────── */

interface PhotoshootUploadsPageProps {
  credits: number | null;
  reelCost: number | null;
  creditsLoading: boolean;
  creditsError: string | null;
  canGenerate: boolean;
  onRefreshCredits: () => Promise<void>;
  onBackToLibrary: () => void;
  onOpenInEditor?: (projectData: {
    title: string;
    category: string;
    slides?: any[];
    overlays?: any;
    audio?: any;
  }) => void;
  onAddToLibrary?: (savedProject: SavedReelProject) => void;
}

/* ─────────────────────────────────────────────────────────────────────────── */
/*  Component                                                                  */
/* ─────────────────────────────────────────────────────────────────────────── */

export default function PhotoshootUploadsPage({
  credits,
  reelCost,
  creditsLoading,
  creditsError,
  canGenerate,
  onRefreshCredits,
  onBackToLibrary: _onBackToLibrary,
  onOpenInEditor,
  onAddToLibrary,
}: PhotoshootUploadsPageProps) {

  /* ── Multi-stage flow: Step 1 (Upload) -> Step 2 (Soundtrack & Reel Studio) ── */
  const [flowStage, setFlowStage] = useState<"upload" | "studio">("upload");

  /* ── Uploaded video/photo assets ── */
  const [files, setFiles] = useState<File[]>([]);
  const [templateFile, setTemplateFile] = useState<File | null>(null);
  const [templatePreviewUrl, setTemplatePreviewUrl] = useState<string | null>(null);
  const [templateId, setTemplateId] = useState<string | null>(null);
  const [isUploadingTemplate, setIsUploadingTemplate] = useState(false);
  const templateInputRef = useRef<HTMLInputElement | null>(null);
  const templatePreviewUrlRef = useRef<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [previewVideoUrl, setPreviewVideoUrl] = useState<string | null>(null);
  const [analyzedClips, setAnalyzedClips] = useState<ClipData[]>([]);
  const [previewClipIndex, setPreviewClipIndex] = useState<number | null>(null);
const clipPreviewRef = useRef<HTMLVideoElement | null>(null);
  const [selectedClipIds, setSelectedClipIds] = useState<string[]>([]);
  const [analysisJobId, setAnalysisJobId] = useState<string | null>(null);
  const analysisControllerRef = useRef<AbortController | null>(null);
  const analysisRunningRef = useRef(false);
  const generationRunningRef = useRef(false);
  const generationRequestIdRef = useRef<string | null>(null);

  useEffect(() => () => analysisControllerRef.current?.abort(), []);

  useEffect(() => () => {
    if (templatePreviewUrlRef.current) URL.revokeObjectURL(templatePreviewUrlRef.current);
  }, []);

  const selectTemplateImage = (file: File | null) => {
    if (analysisRunningRef.current || generationRunningRef.current) return;
    if (isSameTemplateImage(templateFile, file)) return;
    if (file) {
      const validationMessage = validateTemplateImage(file);
      if (validationMessage) {
        setError(validationMessage);
        return;
      }
    }
    if (templateId) void deleteTemplateImage(templateId).catch(() => {});
    if (templatePreviewUrlRef.current) URL.revokeObjectURL(templatePreviewUrlRef.current);
    const nextPreviewUrl = file ? URL.createObjectURL(file) : null;
    templatePreviewUrlRef.current = nextPreviewUrl;
    setTemplatePreviewUrl(nextPreviewUrl);
    setTemplateFile(file);
    setTemplateId(null);
    if (analysisJobId) {
      setAnalysisJobId(null);
      setAnalyzedClips([]);
      setSelectedClipIds([]);
      setGeneratedResult(null);
      setGeneratedReelId(null);
      setIsSavedToLibrary(false);
      setCurrentStep(1);
      generationRequestIdRef.current = null;
    }
    setError(null);
  };

  /* ── Generate preview URL for staged video ── */
  useEffect(() => {
    if (files.length > 0 && files[0].type.startsWith("video/")) {
      const url = URL.createObjectURL(files[0]);
      setPreviewVideoUrl(url);
      return () => URL.revokeObjectURL(url);
    } else {
      setPreviewVideoUrl(null);
    }
  }, [files]);

  /* ── Collection metadata ── */
  const [collectionTitle, setCollectionTitle] = useState("");
  const [category, setCategory] = useState("Product");
  const [price, setPrice] = useState("");
  const [targetDuration, setTargetDuration] = useState<15 | 30 | 45>(15);

  /* ── Music catalogue from backend ── */
  const [backendTracks, setBackendTracks] = useState<MusicTrack[]>([]);
  const [selectedTrack, setSelectedTrack] = useState<MusicTrack | null>(null);

  /* ── Spotify Hub UI state ── */
  const [searchQuery, setSearchQuery] = useState("");
  const [activeMood, setActiveMood] = useState<MoodFilter>("All");
  const [musicTab, setMusicTab] = useState<"hub" | "upload" | "link">("hub");
  const [customLinkInput, setCustomLinkInput] = useState("");
  const [quickPreviewId, setQuickPreviewId] = useState<string | null>(null);
  const quickPreviewRef = useRef<HTMLAudioElement | null>(null);

  /* ── Audio cutter state ── */
  const [audioCutStart, setAudioCutStart] = useState(0);
  const [audioCutEnd, setAudioCutEnd] = useState<number>(targetDuration);
  const [showCutter, setShowCutter] = useState(false);

  /* ── Custom audio upload ── */
  const [customAudioFile, setCustomAudioFile] = useState<File | null>(null);
  const [customAudioUrl, setCustomAudioUrl] = useState<string | null>(null);
  const [isUploadingAudio, setIsUploadingAudio] = useState(false);

  /* ── Staged photos for direct handoff to Pipeline 1 ── */
  const [stagedPhotos, setStagedPhotos] = useState<File[]>([]);

  /* ── Branding logo & watermark placement ── */
const [brandPlacement, setBrandPlacement] = useState<
  "start" | "entire"
>("start");

const [brandLogo, setBrandLogo] = useState<File | null>(null);
const [brandLogoPreview, setBrandLogoPreview] = useState<string | null>(null);
const [isUploadingBrandLogo, setIsUploadingBrandLogo] = useState(false);

const brandLogoInputRef = useRef<HTMLInputElement | null>(null);
const handleBrandLogoUpload = async (
  file: File | null,
  placement: "start" | "entire" = brandPlacement
) => {
  if (!file) return;

  const allowedTypes = [
    "image/jpeg",
    "image/png",
    "image/webp",
  ];

  if (!allowedTypes.includes(file.type)) {
    setError("Please upload a JPG, PNG, or WEBP image.");
    return;
  }

  if (file.size > 20 * 1024 * 1024) {
    setError("Logo image must be smaller than 20 MB.");
    return;
  }

  setBrandLogo(file);

  const previewUrl = URL.createObjectURL(file);
  setBrandLogoPreview(previewUrl);

  const formData = new FormData();
  formData.append("file", file);
  formData.append("placement", placement);

  try {
    setIsUploadingBrandLogo(true);

    const response = await fetch(
      `${import.meta.env.VITE_API_BASE_URL}/branding/logo`,
      {
        method: "POST",
        body: formData,
      }
    );

    if (!response.ok) {
      throw new Error("Failed to upload brand logo. Please try again.");
    }
  } catch {
    setBrandLogo(null);
    setBrandLogoPreview(null);
    setError("Failed to upload brand logo. Please try again.");
  } finally {
    setIsUploadingBrandLogo(false);
  }
};

  /* ── Generation pipeline ── */
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const [stepLabel, setStepLabel] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [generatedResult, setGeneratedResult] = useState<ReelResult | null>(null);
  const [generatedReelId, setGeneratedReelId] = useState<string | null>(null);
  const [reelPlaybackError, setReelPlaybackError] = useState(false);
  const [isSavedToLibrary, setIsSavedToLibrary] = useState(false);
  /* ─────────────────────────────────────────────── */
  /*  Load backend track catalogue                   */
  /* ─────────────────────────────────────────────── */
  useEffect(() => {
    listMusic()
      .then((tracks) => {
        setBackendTracks(tracks);
        if (tracks.length > 0) {
          setSelectedTrack(tracks[0]);
        }
      })
      .catch(() => setBackendTracks([]));
  }, []);

  /* ─────────────────────────────────────────────── */
  /*  Sync cut window end when target duration changes*/
  /* ─────────────────────────────────────────────── */
  useEffect(() => {
    setAudioCutEnd(audioCutStart + targetDuration);
  }, [targetDuration, audioCutStart]);

  /* ─────────────────────────────────────────────── */
  /*  Transfer photos to Manual Reel Image Editor     */
  /* ─────────────────────────────────────────────── */
  const handleTransferPhotosToEditor = () => {
    if (stagedPhotos.length === 0) return;
    const motionCycle: ("zoom_in" | "pan_right" | "zoom_out" | "pan_left")[] = [
      "zoom_in",
      "pan_right",
      "zoom_out",
      "pan_left",
    ];
    const customSlides = stagedPhotos.map((photo, idx) => ({
      id: `slide-photo-${Date.now()}-${idx}`,
      imageUrl: URL.createObjectURL(photo),
      name: photo.name.replace(/\.[^.]+$/, ""),
      duration: 2.5,
      motion: motionCycle[idx % motionCycle.length],
      transition: "crossfade",
      fitMode: "cover",
    }));
    onOpenInEditor?.({
      title: collectionTitle || "Untitled Reel",
      category,
      slides: customSlides,
    });
  };

  /* ─────────────────────────────────────────────── */
  /*  File handling (Videos staged; Photos handoff)   */
  /* ─────────────────────────────────────────────── */
  const handleFiles = (selectedFiles: FileList | null) => {
    if (!selectedFiles) return;
    const incomingVideos: File[] = [];
    const incomingPhotos: File[] = [];

    Array.from(selectedFiles).forEach((f) => {
      if (
        f.type.startsWith("video/") ||
        /\.(mp4|mov|webm|m4v|avi|mkv)$/i.test(f.name)
      ) {
        incomingVideos.push(f);
      } else if (
        f.type.startsWith("image/") ||
        /\.(jpe?g|png|webp|avif|gif|bmp|tiff)$/i.test(f.name)
      ) {
        incomingPhotos.push(f);
      }
    });

    if (incomingPhotos.length > 0) {
      setStagedPhotos((prev) => [...prev, ...incomingPhotos]);
    }
    if (incomingVideos.length > 0) {
      setFiles((c) => [...c, ...incomingVideos]);
      // Seamlessly take the user to the studio where they can add and edit songs
      setFlowStage("studio");
    }
  };

  const removeFile = (index: number) => {
    setFiles((c) => {
      const updated = c.filter((_, i) => i !== index);
      if (updated.length === 0) {
        setFlowStage("upload");
      }
      return updated;
    });
  };

  /* ─────────────────────────────────────────────── */
  /*  Custom audio upload                            */
  /* ─────────────────────────────────────────────── */
  const handleCustomAudioUpload = async (audioFile: File) => {
    setIsUploadingAudio(true);
    setError(null);
    try {
      // Optimistic local preview
      const blobUrl = URL.createObjectURL(audioFile);
      setCustomAudioFile(audioFile);
      setCustomAudioUrl(blobUrl);

      // Upload to backend
      await uploadMusic(audioFile);

      // Reload tracks and select the new one
      const freshTracks = await listMusic();
      setBackendTracks(freshTracks);
      const cleanStem = audioFile.name.replace(/\.[^.]+$/, "").toLowerCase().replace(/[^a-z0-9]/g, "");
      const match = freshTracks.find(
        (t) =>
          t.filename.toLowerCase().replace(/[^a-z0-9]/g, "").includes(cleanStem) ||
          t.id.toLowerCase().replace(/[^a-z0-9]/g, "").includes(cleanStem)
      );
      if (match) {
        pickTrack(match);
      } else if (freshTracks.length > 0) {
        pickTrack(freshTracks[freshTracks.length - 1]);
      }
      setMusicTab("hub");
      setActiveMood("My Uploads");
    } catch {
      setError("Audio upload failed. Check format (MP3 / WAV / M4A / AAC) and try again.");
    } finally {
      setIsUploadingAudio(false);
    }
  };

  /* ─────────────────────────────────────────────── */
  /*  Quick in-place preview (not the cutter)        */
  /* ─────────────────────────────────────────────── */
  const toggleQuickPreview = (trackId: string, src: string) => {
    if (quickPreviewId === trackId) {
      quickPreviewRef.current?.pause();
      setQuickPreviewId(null);
    } else {
      if (!quickPreviewRef.current) quickPreviewRef.current = new Audio();
      quickPreviewRef.current.src = src;
      quickPreviewRef.current.play();
      setQuickPreviewId(trackId);
    }
  };

  /* ─────────────────────────────────────────────── */
  /*  Select a track from the hub                    */
  /* ─────────────────────────────────────────────── */
  const pickTrack = (backendTrack: MusicTrack) => {
    quickPreviewRef.current?.pause();
    setQuickPreviewId(null);
    setSelectedTrack(backendTrack);
    setAudioCutStart(0);
    setAudioCutEnd(targetDuration);
    setShowCutter(true);
  };

  /* ─────────────────────────────────────────────── */
  /*  Dynamic full catalogue with auto-discovery     */
  /* ─────────────────────────────────────────────── */
  const allCatalogueTracks = useMemo(() => {
    const list: CuratedTrackMeta[] = [...CURATED_CATALOGUE];

    // Discover any custom or additional tracks from backend
    backendTracks.forEach((bt) => {
      const alreadyKnown = list.some(
        (c) =>
          c.id === bt.id ||
          bt.filename.toLowerCase().replace(/[\s_-]+/g, "").includes(c.displayName.toLowerCase().replace(/\s+/g, ""))
      );
      if (!alreadyKnown) {
        list.unshift({
          id: bt.id,
          displayName: bt.display_name || bt.filename,
          artist: "Your Upload · Custom Audio",
          album: "My Soundtracks",
          mood: ["My Uploads", "Custom"],
          bpm: 115,
          color: "#ff681b",
          artGradient: "linear-gradient(135deg,#2e1204 0%,#ff681b 60%,#ffa066 100%)",
          isCustom: true,
        });
      }
    });
    return list;
  }, [backendTracks]);

  /* ─────────────────────────────────────────────── */
  /*  Filtered catalogue                             */
  /* ─────────────────────────────────────────────── */
  const filteredCatalogue = allCatalogueTracks.filter((meta) => {
    const matchesMood =
      activeMood === "All"
        ? true
        : activeMood === "My Uploads"
        ? meta.isCustom || meta.mood.includes("My Uploads")
        : meta.mood.includes(activeMood);
    const query = searchQuery.toLowerCase();
    const matchesQuery =
      !query ||
      meta.displayName.toLowerCase().includes(query) ||
      meta.artist.toLowerCase().includes(query) ||
      meta.album.toLowerCase().includes(query) ||
      meta.mood.some((m) => m.toLowerCase().includes(query));
    return matchesMood && matchesQuery;
  });

  /** Match a curated meta entry to a backend track */
  const resolveBackendTrack = (meta: CuratedTrackMeta): MusicTrack | null => {
    return (
      backendTracks.find(
        (t) =>
          t.id === meta.id ||
          t.filename
            .toLowerCase()
            .replace(/[\s_-]+/g, "")
            .includes(meta.displayName.toLowerCase().replace(/\s+/g, ""))
      ) ?? null
    );
  };
  const toggleClipSelection = (clipId: string) => {
  setSelectedClipIds((current) =>
    current.includes(clipId)
      ? current.filter((item) => item !== clipId)
      : [...current, clipId]
  );
};
const playClipPreview = (index: number) => {
  const video = clipPreviewRef.current;
  const clip = analyzedClips[index];

  if (!video || !clip) return;

  if (previewClipIndex === index && !video.paused) {
    video.pause();
    setPreviewClipIndex(null);
    return;
  }

  setPreviewClipIndex(index);

  const startPreview = () => {
    video.currentTime = clip.start_time;

    video.play().catch((err) => {
      console.error("Clip preview failed:", err);
    });
  };

  if (video.readyState >= 1) {
    startPreview();
  } else {
    video.addEventListener("loadedmetadata", startPreview, {
      once: true,
    });
  }
};


  /* ─────────────────────────────────────────────── */
  /*  Generation pipeline                            */
  /* ─────────────────────────────────────────────── */
  const handleGenerateReel = async () => {
    if (analysisRunningRef.current) return;
    analysisRunningRef.current = true;
    const controller = new AbortController();
    analysisControllerRef.current = controller;
    setError(null);
    setIsGenerating(true);
    setCurrentStep(1);
    setStepLabel("Ingesting media assets into studio engine...");
    let activeTemplateId = templateId;
    let analysisStarted = false;

    try {
      const videoFiles = files.filter((f) => f.type.startsWith("video/"));
      let jobId: string | null = null;

      if (videoFiles.length > 0) {
        setStepLabel("Uploading raw photoshoot videos...");
        const uploadRes = await uploadVideos(videoFiles, controller.signal);
        jobId = uploadRes.job_id;
      } else {
        const demo = await getDemoStatus().catch(() => ({ available: false }));
        if (!demo.available) {
          throw new Error(
            "Please upload at least 1 video file (.mp4, .mov) or use demo footage."
          );
        }
        setStepLabel("Loading studio demo footage...");
      }

      if (templateFile && !activeTemplateId) {
        setIsUploadingTemplate(true);
        setStepLabel("Uploading selected template image...");
        const templateResponse = await uploadTemplateImage(templateFile, controller.signal);
        if (typeof templateResponse.template_id !== "string" || !templateResponse.template_id.trim()) {
          throw new Error("The server did not return a template reference. Please try again.");
        }
        activeTemplateId = templateResponse.template_id;
        setTemplateId(activeTemplateId);
        setIsUploadingTemplate(false);
      }

      setCurrentStep(2);
      setStepLabel("Scoring visual quality, motion stability & 9:16 framing...");
      const analysisInit = await startAnalysis(
        buildAnalysisStartPayload(jobId, activeTemplateId),
        controller.signal,
      );
      analysisStarted = true;
      const activeJobId = analysisInit.job_id;
      if (typeof activeJobId !== "string" || !activeJobId.trim()) {
        throw new Error("The server did not return an analysis job ID. Please try again.");
      }
      setAnalysisJobId(activeJobId);
      const summary = await pollAnalysisUntilTerminal(activeJobId, controller.signal, getAnalysis, {
        onProgress: (progress) => {
          if (progress.stage) setStepLabel(`Analyzing footage: ${progress.stage.replaceAll("_", " ")}`);
        },
      });
      const clips = summary.clips;
      setAnalyzedClips(clips);
      setSelectedClipIds(clips.filter((clip) => clip.selected).map((clip) => clip.clip_id));
      if (clips.length === 0) {
        setError("Analysis completed, but no usable clips were found. Try different footage and analyze again.");
      }
      setIsGenerating(false);
      setCurrentStep(3);
      setStepLabel(clips.length ? "Select the clips you want to include in your reel." : "Analysis completed with no usable clips.");

    } catch (err: any) {
      if (activeTemplateId && !analysisStarted) {
        try {
          await deleteTemplateImage(activeTemplateId);
          setTemplateId(null);
        } catch {
          // The server keeps the template when an analysis job was created or deletion is unsafe.
        }
      }
      if (controller.signal.aborted) return;
      console.error("Reel generation error:", err);
      setError(err instanceof Error && !("isAxiosError" in err)
        ? err.message
        : apiErrorMessage(err, "Unable to analyze footage. Check your connection and try again."));
      setIsGenerating(false);
    } finally {
      setIsUploadingTemplate(false);
      analysisRunningRef.current = false;
      if (analysisControllerRef.current === controller) analysisControllerRef.current = null;
    }
  };

  const handleGenerateSelectedReel = async () => {
  if (generationRunningRef.current) return;
  const creditGate = getCreditGate(credits, reelCost, creditsLoading, creditsError);
  if (!creditGate.allowed) {
    setError(creditGate.message || "Generation is unavailable until credit information loads.");
    return;
  }
  if (!analysisJobId) {
    setError("Please analyze the footage first.");
    return;
  }

  const selectedClips = selectedClipsById(analyzedClips, selectedClipIds);

  if (selectedClips.length === 0) {
    setError("Please select at least one clip.");
    return;
  }

  setError(null);
  generationRunningRef.current = true;
  setIsGenerating(true);
  setCurrentStep(3);
  setStepLabel("Sequencing selected clips...");

  try {
    const initialPlan = await planReel({
      analysis_job_id: analysisJobId,
      selected_clip_ids: selectedClips.map((clip) => clip.clip_id),
      target_duration: targetDuration,
    });
    assertPlanMatchesSelection(selectedClips.map((clip) => clip.clip_id), initialPlan.clips);

const finalClips = initialPlan.clips;

    const planToGenerate: ReelPlan = {
      ...initialPlan,
      clips: finalClips,
      target_duration: targetDuration,
      product: {
        product_name: collectionTitle,
        price: formatInrPrice(price) ?? "",
        category,
        material: "",
        color: "",
        product_code: "",
      },
      overlays: {
  ...initialPlan.overlays,
  brand_placement:
    brandPlacement === "entire"
      ? "watermark"
      : "beginning",
},
      music: selectedTrack
        ? {
            track_id: selectedTrack.id,
            track_name:
              selectedTrack.display_name || selectedTrack.filename,
            source_path: selectedTrack.filename,
            source_duration:
              selectedTrack.duration || targetDuration,
            start_time: audioCutStart,
            end_time: audioCutStart + targetDuration,
            volume: 0.85,
            loop_if_needed: true,
            preserve_original_audio: false,
          }
        : null,
    };

    setCurrentStep(4);
    setStepLabel("Rendering final commercial reel...");

    if (!generationRequestIdRef.current) {
      generationRequestIdRef.current = crypto.randomUUID();
    }

    const result = await generateReel({
  reel_plan: planToGenerate,
  analysis_job_id: analysisJobId,
  selected_clip_ids: planToGenerate.clips.map((clip) => clip.clip_id),
}, (stage) => {
  const stageLabels = {
    queued: "Reel queued for rendering...",
    preparing: "Preparing reel assets...",
    rendering: "Rendering clips and assembling the reel...",
    finalizing: "Finalizing the rendered reel...",
    completed: "Reel rendering complete.",
    failed: "Reel rendering failed.",
  } as const;
  setStepLabel(stageLabels[stage]);
}, generationRequestIdRef.current);

generationRequestIdRef.current = null;

if (!result.reel_id || !result.download_url) {
  throw new Error("The server did not return the final reel file. Please retry generation.");
}
const savedProject = createSavedReelProject(result, {
  title: collectionTitle,
  category,
  productPrice: formatInrPrice(price) ?? "",
});
if (!savedProject) {
  throw new Error("The server did not return a playable saved reel.");
}
onAddToLibrary?.(savedProject);
setIsSavedToLibrary(true);
setGeneratedResult(result);
setGeneratedReelId(result.reel_id);
setReelPlaybackError(false);

    setTimeout(() => {
      const el = document.getElementById("ready-reel-section");
      if (el) {
        el.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
      }
    }, 250);
  } catch (err: unknown) {
    setError(
      apiErrorMessage(err, "Failed to generate reel. Please try again.")
    );
  } finally {
    void onRefreshCredits().catch(() => undefined);
    generationRunningRef.current = false;
    setIsGenerating(false);
  }
};

  /* ─────────────────────────────────────────────── */
  /*  Save / handoff                                 */
  /* ─────────────────────────────────────────────── */
  const handleOpenInEditor = () =>
    onOpenInEditor?.({
      title: collectionTitle,
      category,
      overlays: { title: collectionTitle, price: formatInrPrice(price) ?? "" },
    });

  /* ═══════════════════════════════════════════════ */
  /*  RENDER                                         */
  /* ═══════════════════════════════════════════════ */
  return (
    <section className="photoshoot-page page-enter">

      {/* ─── STAGE 1: UPLOAD HEADER ─── */}
      {flowStage === "upload" ? (
        <div className="dashboard-page-header photoshoot-header">
          <div>
            <span className="photoshoot-eyebrow">PIPELINE 2 · AI REEL ENGINE</span>
            <h1>Photoshoot Video Upload</h1>
            <p>
              Upload raw photoshoot videos (.mp4, .mov, .webm) and define your collection details.
              Once uploaded, you'll enter the studio to select your soundtrack and trim audio hooks.
            </p>
          </div>
        </div>
      ) : (
        /* ─── STAGE 2: STUDIO HEADER ─── */
        <div className="dashboard-page-header photoshoot-header">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <button
                type="button"
                onClick={() => setFlowStage("upload")}
                className="inline-flex items-center gap-1 text-xs text-[var(--db-muted)] hover:text-white transition-colors"
              >
                <ArrowLeft className="w-3.5 h-3.5" /> Back to Upload
              </button>
              <span className="text-[var(--db-dim)]">·</span>
              <span className="photoshoot-eyebrow mb-0">STEP 2 · STUDIO WORKSPACE</span>
            </div>
            <h1>Soundtrack &amp; Reel Studio</h1>
            <p>
              Choose a Bollywood or Indian classical soundtrack, trim the audio hook with the waveform cutter,
              and generate your commercial 9:16 reel.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setFlowStage("upload")}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-white/80 text-xs font-semibold transition-all"
            >
              <Video className="w-3.5 h-3.5 text-[#ff681b]" />
              <span>Manage Footage ({files.length})</span>
            </button>
          </div>
        </div>
      )}

      {/* ─── STEP BREADCRUMBS ─── */}
      <div className="flex items-center gap-3 mb-8">
        <button
          type="button"
          onClick={() => setFlowStage("upload")}
          className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold mono transition-all cursor-pointer ${
            flowStage === "upload"
              ? "bg-[#ff681b]/15 border border-[#ff681b]/40 text-[#ff681b]"
              : files.length > 0
              ? "bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20"
              : "bg-white/5 border border-white/10 text-[var(--db-dim)]"
          }`}
        >
          {files.length > 0 && flowStage !== "upload" ? (
            <Check className="w-3.5 h-3.5" />
          ) : (
            <span className="w-4 h-4 rounded-full bg-current/20 flex items-center justify-center text-[10px]">1</span>
          )}
          <span>1. UPLOAD FOOTAGE</span>
          {files.length > 0 && (
            <span className="opacity-70 text-[10px]">({files.length})</span>
          )}
        </button>

        <span className="text-[var(--db-dim)]">→</span>

        <button
          type="button"
          onClick={() => {
            if (files.length > 0) setFlowStage("studio");
          }}
          disabled={files.length === 0}
          className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold mono transition-all ${
            flowStage === "studio"
              ? "bg-[#1DB954]/15 border border-[#1DB954]/40 text-[#1DB954]"
              : files.length > 0
              ? "bg-white/5 border border-white/10 text-white/80 hover:border-white/20 cursor-pointer"
              : "bg-white/5 border border-white/10 text-[var(--db-dim)] opacity-40 cursor-not-allowed"
          }`}
        >
          <span className="w-4 h-4 rounded-full bg-current/20 flex items-center justify-center text-[10px]">2</span>
          <span>2. SOUNDTRACK &amp; REEL STUDIO</span>
        </button>
      </div>

      {/* ─── ERROR BANNER ─── */}
      {error && (
        <div role="alert" className="p-4 mb-6 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm flex items-center justify-between">
          <span>{error}</span>
          <button type="button" onClick={() => setError(null)}>
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ─── GENERATION PROGRESS ─── */}
      {isGenerating && (
        <div className="p-8 mb-8 rounded-xl bg-[#111115] border border-[#ff681b]/30 shadow-2xl flex flex-col items-center text-center">
          <Film className="w-10 h-10 text-[#ff681b] animate-pulse mb-4" />
          <h2 className="text-xl font-bold font-display text-[#faf7f2] mb-1">
            Generating Your Commercial Reel
          </h2>
          <p role="status" aria-live="polite" aria-atomic="true" className="text-sm text-[var(--db-muted)] mb-6">{stepLabel}</p>
          <div className="w-full max-w-md bg-white/5 h-2 rounded-full overflow-hidden mb-6">
            <div
              className="bg-[#ff681b] h-full transition-all duration-500 rounded-full"
              style={{ width: `${currentStep * 25}%` }}
            />
          </div>
          <div className="grid grid-cols-4 gap-4 w-full max-w-lg text-xs mono text-[var(--db-muted)]">
            {["Ingesting", "9:16 Framing", "Beat Syncing", "Rendering"].map(
              (label, i) => (
                <div
                  key={label}
                  className={
                    currentStep >= i + 1
                      ? "text-[#ff681b] font-bold"
                      : ""
                  }
                >
                  {i + 1}. {label}
                </div>
              )
            )}
          </div>
        </div>
      )}

      {/* ─── COMPLETED RESULT ─── */}
      {generatedResult && generatedReelId && !isGenerating && (
        <div id="ready-reel-section" className="p-8 mb-8 rounded-xl bg-[#111116] border border-emerald-500/30 shadow-2xl flex flex-col lg:flex-row gap-8 items-center">
          <p className="sr-only" role="status" aria-live="polite">
            Reel generation complete. Your reel is ready to preview or download.
          </p>
          <div className="w-64 h-[440px] rounded-2xl overflow-hidden bg-black border-2 border-emerald-500/40 shadow-xl shrink-0">
            <video
              src={generatedResult.download_url}
              controls
              autoPlay
              loop
              playsInline
              onError={() => setReelPlaybackError(true)}
              className="w-full h-full object-contain bg-black"
            />
          </div>
          <div className="flex-1 text-left space-y-4">
            
            <h2 className="text-2xl font-bold font-display text-[#faf7f2]">
              {collectionTitle}
            </h2>
            {reelPlaybackError && (
              <p className="text-sm text-amber-300" role="alert">
                The saved reel could not be previewed. Try downloading the MP4 or check your connection.
              </p>
            )}
            <div className="flex flex-wrap gap-2 text-xs mono">
              <span className="px-2.5 py-1 rounded bg-white/5 border border-white/10 text-[#faf7f2]">
                ⏱ {Math.round(generatedResult.duration)}s
              </span>
              <span className="px-2.5 py-1 rounded bg-white/5 border border-white/10 text-[#faf7f2]">
                📐 1080×1920 (9:16)
              </span>
              {formatInrPrice(price) && (
                <span className="px-2.5 py-1 rounded bg-white/5 border border-white/10 text-[#ff681b]">
                  {formatInrPrice(price)}
                </span>
              )}
              {selectedTrack && (
                <span className="px-2.5 py-1 rounded bg-[#1DB954]/10 border border-[#1DB954]/30 text-[#1DB954]">
                  🎵 {selectedTrack.display_name || selectedTrack.filename}{" "}
                  <span className="opacity-60">
                    · cut {audioCutStart.toFixed(1)}s–
                    {(audioCutStart + targetDuration).toFixed(1)}s
                  </span>
                </span>
              )}
            </div>
            <div className="flex flex-wrap gap-3 pt-2">
              <a
                href={generatedResult.download_url}
                download={`${collectionTitle.toLowerCase().replace(/\s+/g, "_")}.mp4`}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#ff681b] hover:bg-[#ff7d3b] text-white font-bold text-sm transition-all shadow-lg shadow-[#ff681b]/20"
              >
                <Download className="w-4 h-4" /> DOWNLOAD REEL
              </a>
              <button
                type="button"
                disabled
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-white/10 hover:bg-white/15 border border-white/15 text-white font-semibold text-sm transition-all"
              >
                <Check className="w-4 h-4 text-emerald-400" />
                {isSavedToLibrary ? "ADDED TO PREVIOUS WORKS" : "SAVING REEL"}
              </button>
              <button
                type="button"
                onClick={handleOpenInEditor}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#c9a227]/20 hover:bg-[#c9a227]/30 border border-[#c9a227]/40 text-[#f3c766] font-semibold text-sm transition-all"
              >
                <Edit3 className="w-4 h-4" /> OPEN IN EDITOR
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════════ */}
      {/*  STAGE 1 VIEW: PURE VIDEO UPLOAD (ZERO MUSIC CLUTTER)                     */}
      {/* ════════════════════════════════════════════════════════════════════════ */}
      {flowStage === "upload" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* LEFT: DROPZONE + ASSET LIST */}
          <div className="lg:col-span-2 space-y-6">
            {/* Photo Handoff Banner if user drops photos */}
            {stagedPhotos.length > 0 && (
              <div className="p-4 rounded-xl bg-gradient-to-r from-amber-500/15 via-orange-500/10 to-[#111115] border border-amber-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-lg shadow-amber-500/5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
                    <ImageIcon className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white">
                      {stagedPhotos.length} Photo{stagedPhotos.length > 1 ? "s" : ""} Detected
                    </p>
                    <p className="text-xs text-white/60">
                      Looking to build an animated image reel? Switch directly to the Photo Reel Editor (Pipeline 1).
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                  <button
                    type="button"
                    onClick={handleTransferPhotosToEditor}
                    className="px-4 py-2 rounded-lg bg-[#ff681b] hover:bg-[#ff7d3b] text-white text-xs font-bold transition-all shadow-md shadow-[#ff681b]/20 flex items-center gap-1.5 shrink-0"
                  >
                    <span>Open in Photo Reel Editor</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setStagedPhotos([])}
                    className="p-2 rounded-lg text-white/40 hover:text-white hover:bg-white/10 transition-colors"
                    title="Dismiss"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            <div
              className={`photoshoot-upload-area ${dragActive ? "drag-active" : ""}`}
              onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
              onDragLeave={() => setDragActive(false)}
              onDrop={(e) => { e.preventDefault(); setDragActive(false); handleFiles(e.dataTransfer.files); }}
            >
              <div className="photoshoot-upload-icon">
                <Video className="w-8 h-8 text-[#ff681b]" />
              </div>
              <h2>Upload Photoshoot Videos</h2>
              <p>Drag and drop raw model footage and video takes (.mp4, .mov, .webm).</p>
              <label className="photoshoot-select-button cursor-pointer">
                SELECT VIDEOS FROM DEVICE
                <input
                  type="file"
                  accept="video/*,.mp4,.mov,.webm,.m4v,.avi,.mkv,image/*"
                  multiple
                  hidden
                  onChange={(e) => { handleFiles(e.target.files); e.target.value = ""; }}
                />
              </label>
              <span className="photoshoot-upload-hint">
                Supports MP4, MOV, WEBM · Photos can be opened directly in Photo Reel Editor
              </span>
            </div>

            {/* Asset list */}
            {files.length > 0 && (
              <div className="photoshoot-files-section">
                <div className="photoshoot-files-header">
                  <div>
                    <h2>Selected Video Takes</h2>
                    <p>{files.length} file{files.length !== 1 ? "s" : ""} staged for reel generation</p>
                  </div>
                  <button type="button" className="photoshoot-clear-button" onClick={() => setFiles([])}>
                    CLEAR ALL
                  </button>
                </div>
                <div className="photoshoot-files-grid">
                  {files.map((file, index) => {
                    const isVideo = file.type.startsWith("video/");
                    return (
                      <article className="photoshoot-file-card" key={`${file.name}-${index}`}>
                        <div className="photoshoot-file-preview relative">
                          {isVideo ? (
                            <div className="w-full h-full flex items-center justify-center bg-black/60">
                              <Film className="w-6 h-6 text-[#ff681b]" />
                            </div>
                          ) : (
                            <img src={URL.createObjectURL(file)} alt={file.name} />
                          )}
                          <span className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded text-[9px] font-bold mono bg-black/70 text-white">
                            {isVideo ? "VIDEO" : "PHOTO"}
                          </span>
                          <button
                            type="button"
                            className="photoshoot-remove-button"
                            onClick={() => removeFile(index)}
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <div className="photoshoot-file-info">
                          <strong>{file.name}</strong>
                          <span>{(file.size / (1024 * 1024)).toFixed(2)} MB</span>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* RIGHT: COLLECTION DETAILS + PROCEED CTA */}
          <div className="space-y-6">
            <div className="p-5 rounded-xl bg-[#111115] border border-white/10 space-y-4">
              <h3 className="text-xs font-bold font-display tracking-wider text-white/50 uppercase">
                1. Collection Details
              </h3>
              <div>
                <label className="text-xs text-[var(--db-muted)] block mb-1">
                  Project / Collection Name
                </label>
                <input
                  type="text"
                  value={collectionTitle}
                  onChange={(e) => setCollectionTitle(e.target.value)}
                  className="w-full p-2.5 rounded-lg bg-black/50 border border-white/10 text-white text-sm focus:border-[#ff681b] outline-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-[var(--db-muted)] block mb-1">Category</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as any)}
                    className="w-full p-2.5 rounded-lg bg-black/50 border border-white/10 text-white text-sm outline-none cursor-pointer"
                  >
                    <option value="Product">Product</option>
                    <option value="Apparel">Apparel</option>
                    <option value="Accessories">Accessories</option>
                    <option value="Beauty">Beauty</option>
                    <option value="Home">Home</option>
                    <option value="Other">Other</option>
                    <option value="Sarees">Sarees</option>
                    <option value="Lehengas">Lehengas</option>
                    <option value="Kurtis">Kurtis</option>
                    <option value="Bridal">Bridal</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-[var(--db-muted)] block mb-1">Price (₹)</label>
                  <div className="relative">
                    {!hasCurrencyPrefix(price) && (
                      <span className="absolute left-3 top-2.5 text-[#ff681b] font-bold text-sm">₹</span>
                    )}
                    <input
                      type="text"
                      value={price}
                      onChange={(e) => setPrice(e.target.value)}
                      placeholder="e.g. 1500"
                      className="w-full p-2.5 pl-7 rounded-lg bg-black/50 border border-white/10 text-white text-sm mono outline-none focus:border-[#ff681b]"
                    />
                  </div>
                </div>
              </div>
              <div>
                <label className="text-xs text-[var(--db-muted)] block mb-1">
                  Target Reel Duration
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {([15, 30, 45] as const).map((dur) => (
                    <button
                      key={dur}
                      type="button"
                      onClick={() => setTargetDuration(dur)}
                      className={`py-2 px-3 rounded-lg border text-xs mono font-bold transition-all ${
                        targetDuration === dur
                          ? "border-[#ff681b] bg-[#ff681b]/15 text-[#ff681b]"
                          : "border-white/10 text-white/60 hover:bg-white/5"
                      }`}
                    >
                      {dur}s Reel
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Staged status summary */}
            <div className="p-4 rounded-xl bg-[#111115] border border-white/10 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-[var(--db-muted)]">Staged Footage</span>
                <span className="text-xs mono font-bold text-white">
                  {files.length} {files.length === 1 ? "video" : "videos"}
                </span>
              </div>
              {files.length > 0 ? (
                <div className="flex items-center gap-2 text-xs text-emerald-400">
                  <Check className="w-3.5 h-3.5" />
                  <span>Footage ready. Next step: add songs &amp; edit.</span>
                </div>
              ) : (
                <p className="text-xs text-[var(--db-dim)]">
                  Select or drop your photoshoot video above to unlock the studio workspace.
                </p>
              )}
            </div>

            {/* Primary Action to Proceed */}
            <button
              type="button"
              onClick={() => setFlowStage("studio")}
              disabled={files.length === 0}
              className="w-full py-4 px-6 rounded-xl bg-[#ff681b] hover:bg-[#ff7d3b] text-white font-bold font-display text-sm tracking-wider uppercase transition-all shadow-xl shadow-[#ff681b]/25 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              <span>PROCEED TO SOUNDTRACK &amp; STUDIO</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            {files.length === 0 && (
              <p className="text-center text-xs text-[var(--db-dim)]">
                Upload at least one video to proceed to audio selection.
              </p>
            )}
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════════ */}
      {/*  STAGE 2 VIEW: SOUNDTRACK & REEL STUDIO WORKSPACE                        */}
      {/* ════════════════════════════════════════════════════════════════════════ */}
      {flowStage === "studio" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

          {/* ══ LEFT: VIDEO INSPECTOR + SPOTIFY HUB + AUDIO CUTTER ══ */}
          <div className="lg:col-span-2 space-y-6">

            {/* Staged Video Footage Inspector */}
            {previewVideoUrl && (
              <div className="p-4 rounded-xl bg-[#111115] border border-white/10 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Film className="w-4 h-4 text-[#ff681b]" />
                    <h3 className="text-xs font-bold font-display tracking-wider text-white/70 uppercase">
                      Staged Video Footage
                    </h3>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold mono bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                      {files.length} video{files.length > 1 ? "s" : ""}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setFlowStage("upload")}
                    className="text-xs text-[var(--db-muted)] hover:text-[#ff681b] font-semibold transition-colors flex items-center gap-1"
                  >
                    Change / Add Footage →
                  </button>
                </div>
                <div className="flex flex-col sm:flex-row gap-4 items-center">
                  <div className="w-full sm:w-48 h-32 rounded-lg overflow-hidden bg-black border border-white/10 shrink-0">
                    <video
                      src={previewVideoUrl}
                      controls
                      playsInline
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="flex-1 min-w-0 space-y-1.5 text-left w-full">
                    <p className="text-sm font-semibold text-white truncate">
                      {files[0]?.name}
                    </p>
                    <div className="flex flex-wrap gap-2 text-xs mono text-[var(--db-muted)]">
                      <span className="px-2 py-0.5 rounded bg-white/5 border border-white/10">
                        {(files[0]?.size / (1024 * 1024)).toFixed(2)} MB
                      </span>
                      <span className="px-2 py-0.5 rounded bg-white/5 border border-white/10 text-emerald-400">
                        Video Footage Ready
                      </span>
                    </div>
                    <p className="text-xs text-[var(--db-dim)]">
                      Select your favorite soundtrack below, then scrub the waveform to trim the perfect hook for your {targetDuration}s reel.
                    </p>
                  </div>
                </div>
              </div>
            )}
            {/* ══ AI ANALYZED CLIPS ══ */}
{analyzedClips.length > 0 && (
  <div className="p-5 rounded-xl bg-[#111115] border border-white/10 space-y-4">
    <div className="flex items-center justify-between">
  <div>
    <h3 className="text-sm font-bold font-display text-white">
      AI Analyzed Clips
    </h3>

    <p className="text-xs text-[var(--db-muted)] mt-1">
  {selectedClipIds.length} of {analyzedClips.length} clips selected · Content budget: {Math.max(0, targetDuration - (templateId ? 10 : 9))}s of {targetDuration}s total
</p>
  </div>

  <div className="flex items-center gap-2">
    <button
      type="button"
      onClick={() =>
        setSelectedClipIds(
          analyzedClips.map((clip) => clip.clip_id)
        )
      }
      className="px-2.5 py-1 rounded-md border border-white/10 text-[10px] text-white hover:bg-white/5"
    >
      Select All
    </button>

    <button
      type="button"
      onClick={() => setSelectedClipIds([])}
      className="px-2.5 py-1 rounded-md border border-white/10 text-[10px] text-[var(--db-muted)] hover:bg-white/5"
    >
      Clear
    </button>

    <span className="px-2.5 py-1 rounded-lg bg-[#ff681b]/10 border border-[#ff681b]/30 text-[#ff681b] text-[10px] font-bold mono">
      AI SCORED
    </span>
  </div>
</div>
{previewVideoUrl && (
  <div className="rounded-xl overflow-hidden border border-white/10 bg-black">
    <video
      ref={clipPreviewRef}
      src={previewVideoUrl}
      controls
      playsInline
      className="w-full max-h-[360px] object-contain"
      onTimeUpdate={(event) => {
        if (previewClipIndex === null) return;

        const clip = analyzedClips[previewClipIndex];

        if (clip && event.currentTarget.currentTime >= clip.end_time) {
          event.currentTarget.pause();
          event.currentTarget.currentTime = clip.start_time;
          setPreviewClipIndex(null);
        }
      }}
      onEnded={() => setPreviewClipIndex(null)}
    />

    {previewClipIndex !== null && analyzedClips[previewClipIndex] && (
      <div className="px-3 py-2 text-xs text-[var(--db-muted)]">
        Previewing Clip {previewClipIndex + 1}:{" "}
        {analyzedClips[previewClipIndex].start_time.toFixed(1)}s →{" "}
        {analyzedClips[previewClipIndex].end_time.toFixed(1)}s
      </div>
    )}
  </div>
)}

    <div className="space-y-2 max-h-[400px] overflow-y-auto">
      {analyzedClips.map((clip, index) => (
        <div
  key={clip.clip_id}
  role="group"
  aria-label={`Clip ${index + 1}: ${clip.source_file}`}
  onClick={() => toggleClipSelection(clip.clip_id)}
  className={`flex items-center justify-between gap-4 p-3 rounded-lg border cursor-pointer transition-all ${
  previewClipIndex === index
    ? "bg-[#ff681b]/20 border-[#ff681b]"
    : selectedClipIds.includes(clip.clip_id)
      ? "bg-[#ff681b]/10 border-[#ff681b]/50"
      : "bg-black/40 border-white/10 opacity-60"
}`}
>
  <div className="shrink-0 flex items-center gap-2">
  <button
    type="button"
    onClick={(event) => {
      event.stopPropagation();
      playClipPreview(index);
    }}
    className="w-8 h-8 rounded-full bg-white/10 border border-white/10 hover:bg-[#ff681b] flex items-center justify-center transition-all"
    title={`Preview Clip ${index + 1}`}
  >
    {previewClipIndex === index ? (
      <span className="text-white text-xs">Ⅱ</span>
    ) : (
      <span className="text-white text-xs ml-0.5">▶</span>
    )}
  </button>

  <button
    type="button"
    aria-pressed={selectedClipIds.includes(clip.clip_id)}
    aria-label={`${selectedClipIds.includes(clip.clip_id) ? "Deselect" : "Select"} clip ${index + 1}`}
    onClick={(event) => {
      event.stopPropagation();
      toggleClipSelection(clip.clip_id);
    }}
    className={`w-5 h-5 rounded border flex items-center justify-center ${
      selectedClipIds.includes(clip.clip_id)
        ? "bg-[#ff681b] border-[#ff681b]"
        : "border-white/30"
    }`}
  >
    {selectedClipIds.includes(clip.clip_id) && (
      <span className="text-white text-xs font-bold">✓</span>
    )}
  </button>
</div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-white">
                Clip {index + 1}
              </span>

              <span className="text-[10px] text-[var(--db-muted)] mono">
                {clip.start_time.toFixed(1)}s →{" "}
                {clip.end_time.toFixed(1)}s
              </span>
            </div>

            <p className="text-xs text-[var(--db-muted)] truncate mt-1">
              {clip.source_file}
            </p>

            <p className="text-[10px] text-[var(--db-dim)] mt-1">
              Duration: {clip.duration.toFixed(1)}s
            </p>
          </div>

          <div className="shrink-0 text-center">
            <span className="block text-[9px] text-[var(--db-muted)] uppercase">
              Score
            </span>

            <span
              className={`text-xl font-bold ${
                clip.score >= 80
                  ? "text-emerald-400"
                  : clip.score >= 60
                    ? "text-yellow-400"
                    : "text-red-400"
              }`}
            >
              {clip.score}
            </span>
          </div>
        </div>
      ))}
    </div>
  </div>
)}

            {/* ══ SPOTIFY MUSIC HUB ══ */}
            <div className="spotify-hub">

              {/* Hub header */}
              <div className="spotify-hub-header">
                <div className="spotify-hub-title-row">
                  <div className="spotify-hub-logo">
                    <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                      <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="spotify-hub-title">Spotify Trending Reels</h3>
                    <p className="spotify-hub-subtitle">Bollywood &amp; Indian Ethnic Fashion Soundtracks</p>
                  </div>
                  <span className="spotify-powered-badge">POWERED BY SPOTIFY</span>
                </div>

                {/* Tab switcher */}
                <div className="spotify-tab-bar">
                  {(["hub", "upload", "link"] as const).map((tab) => (
                    <button
                      key={tab}
                      type="button"
                      className={`spotify-tab ${musicTab === tab ? "spotify-tab-active" : ""}`}
                      onClick={() => setMusicTab(tab)}
                    >
                      {tab === "hub" && <Music className="w-3.5 h-3.5" />}
                      {tab === "upload" && <Upload className="w-3.5 h-3.5" />}
                      {tab === "link" && <Link2 className="w-3.5 h-3.5" />}
                      {tab === "hub" ? "Catalog" : tab === "upload" ? "Upload" : "Import Link"}
                    </button>
                  ))}
                </div>
              </div>

              {/* ── TAB: Hub Catalog ── */}
              {musicTab === "hub" && (
                <div className="spotify-catalog-body">
                  {/* Search + mood filter + quick upload */}
                  <div className="spotify-search-row flex-wrap gap-3">
                    <div className="spotify-search-input-wrap flex-1 min-w-[220px]">
                      <Search className="spotify-search-icon w-3.5 h-3.5" />
                      <input
                        type="text"
                        placeholder="Search Bollywood, classical, trending tracks…"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="spotify-search-input"
                      />
                      {searchQuery && (
                        <button type="button" onClick={() => setSearchQuery("")} className="spotify-search-clear">
                          <X className="w-3 h-3" />
                        </button>
                      )}
                    </div>

                    <label className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#ff681b]/15 hover:bg-[#ff681b]/25 border border-[#ff681b]/40 text-[#ff681b] text-xs font-bold transition-all cursor-pointer shrink-0 shadow-sm">
                      <Upload className="w-3.5 h-3.5" />
                      <span>+ Upload Favorite Song</span>
                      <input
                        type="file"
                        accept="audio/*"
                        hidden
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) handleCustomAudioUpload(f);
                          e.target.value = "";
                        }}
                      />
                    </label>

                    <div className="spotify-mood-pills w-full">
                      {MOOD_FILTERS.map((mood) => (
                        <button
                          key={mood}
                          type="button"
                          onClick={() => setActiveMood(mood)}
                          className={`spotify-mood-pill ${activeMood === mood ? "spotify-mood-pill-active" : ""}`}
                        >
                          {mood === "My Uploads" ? "★ My Uploads" : mood}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Track list */}
                  <div className="spotify-track-list">
                    {filteredCatalogue.length === 0 && (
                      <div className="py-12 text-center text-[var(--db-muted)] text-sm space-y-3">
                        <p>
                          {activeMood === "My Uploads"
                            ? "You haven't uploaded any custom tracks yet."
                            : "No tracks match your search. Try a different mood or keyword."}
                        </p>
                        <label className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#ff681b] hover:bg-[#ff7d3b] text-white text-xs font-bold transition-all cursor-pointer">
                          <Upload className="w-4 h-4" />
                          <span>Upload Your Favorite Song (MP3 / WAV / M4A)</span>
                          <input
                            type="file"
                            accept="audio/*"
                            hidden
                            onChange={(e) => {
                              const f = e.target.files?.[0];
                              if (f) handleCustomAudioUpload(f);
                              e.target.value = "";
                            }}
                          />
                        </label>
                      </div>
                    )}
                    {filteredCatalogue.map((meta) => {
                      const backendTrack = resolveBackendTrack(meta);
                      const isSelected = selectedTrack?.id === backendTrack?.id;
                      const isPlaying = quickPreviewId === meta.id;

                      return (
                        <div
                          key={meta.id}
                          className={`spotify-track-card ${isSelected ? "spotify-track-card-selected" : ""}`}
                          onClick={() => backendTrack && pickTrack(backendTrack)}
                          role="group"
                          tabIndex={0}
                          aria-keyshortcuts="Enter Space"
                          aria-label={`Music track ${meta.displayName}${meta.artist ? ` by ${meta.artist}` : ""}. ${isSelected ? "Selected." : "Not selected."} Press Enter or Space to select.`}
                          onKeyDown={(e) => {
                            if (e.target !== e.currentTarget || !backendTrack) return;
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              pickTrack(backendTrack);
                            }
                          }}
                        >
                          {/* Album artwork */}
                          <div
                            className="spotify-album-art"
                            style={{ background: meta.artGradient }}
                          >
                            <Music className="w-4 h-4 text-white/40" />
                            {/* Quick preview button */}
                            {backendTrack && (
                              <button
                                type="button"
                                className="spotify-album-play-btn"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleQuickPreview(
                                    meta.id,
                                    musicPreviewUrl(backendTrack.id)
                                  );
                                }}
                              >
                                {isPlaying ? (
                                  <Pause className="w-4 h-4" />
                                ) : (
                                  <Play className="w-4 h-4 ml-0.5" />
                                )}
                              </button>
                            )}
                          </div>

                          {/* Metadata */}
                          <div className="spotify-track-meta">
                            <div className="flex items-center gap-2">
                              <span className="spotify-track-name">{meta.displayName}</span>
                              {meta.isCustom && (
                                <span className="px-1.5 py-0.5 rounded text-[9px] font-extrabold mono bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">
                                  ★ YOUR UPLOAD
                                </span>
                              )}
                            </div>
                            <div className="spotify-track-artist">{meta.artist}</div>
                            <div className="spotify-mood-tags">
                              {meta.mood.map((m) => (
                                <span key={m} className="spotify-mood-tag">
                                  {m}
                                </span>
                              ))}
                              <span className="spotify-bpm-tag mono">{meta.bpm} BPM</span>
                            </div>
                          </div>

                          {/* Duration + select indicator */}
                          <div className="spotify-track-right">
                            <span className="spotify-track-duration mono">
                              {backendTrack?.duration
                                ? `${Math.floor(backendTrack.duration / 60)}:${String(
                                    Math.round(backendTrack.duration % 60)
                                  ).padStart(2, "0")}`
                                : "—"}
                            </span>
                            {isSelected ? (
                              <div className="spotify-selected-indicator">
                                <Check className="w-3 h-3" />
                              </div>
                            ) : !backendTrack ? (
                              <span className="spotify-unavailable-badge">unavailable</span>
                            ) : null}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* ── TAB: Custom Upload ── */}
              {musicTab === "upload" && (
                <div className="spotify-upload-tab">
                  <label
                    className={`spotify-audio-dropzone ${isUploadingAudio ? "opacity-50 pointer-events-none" : ""}`}
                  >
                    {isUploadingAudio ? (
                      <div className="flex flex-col items-center gap-3">
                        <div className="w-8 h-8 border-2 border-[#1DB954] border-t-transparent rounded-full animate-spin" />
                        <span className="text-sm text-[var(--db-muted)]">Uploading audio…</span>
                      </div>
                    ) : customAudioFile ? (
                      <div className="flex flex-col items-center gap-2">
                        <Music className="w-8 h-8 text-[#1DB954]" />
                        <span className="text-sm font-semibold text-white">{customAudioFile.name}</span>
                        <span className="text-xs text-[var(--db-muted)]">
                          {(customAudioFile.size / (1024 * 1024)).toFixed(2)} MB · Click to replace
                        </span>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-3">
                        <Upload className="w-8 h-8 text-[#1DB954]" />
                        <span className="text-sm text-white font-semibold">Upload custom audio</span>
                        <span className="text-xs text-[var(--db-muted)]">MP3, WAV, M4A · Up to 50MB</span>
                      </div>
                    )}
                    <input
                      type="file"
                      accept="audio/*"
                      hidden
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) handleCustomAudioUpload(f);
                        e.target.value = "";
                      }}
                    />
                  </label>
                  {customAudioUrl && customAudioFile && !isUploadingAudio && (
                    <p className="text-xs text-[#1DB954] mt-2 flex items-center gap-1">
                      <Check className="w-3 h-3" /> Uploaded. Select from catalog to use in trim.
                    </p>
                  )}
                </div>
              )}

              {/* ── TAB: Spotify Link Import ── */}
              {musicTab === "link" && (
                <div className="spotify-link-tab">
                  <p className="text-sm text-[var(--db-muted)] mb-3">
                    Paste a Spotify track link or any direct audio URL to import a custom soundtrack.
                  </p>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <ExternalLink className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--db-dim)]" />
                      <input
                        type="text"
                        placeholder="https://open.spotify.com/track/…"
                        value={customLinkInput}
                        onChange={(e) => setCustomLinkInput(e.target.value)}
                        className="w-full pl-9 pr-4 py-2.5 rounded-lg bg-black/50 border border-white/10 text-white text-sm mono outline-none focus:border-[#1DB954]"
                      />
                    </div>
                    <button
                      type="button"
                      className="px-4 py-2.5 rounded-lg bg-[#1DB954] hover:bg-[#1ed760] text-black font-bold text-sm transition-all"
                      onClick={() => {
                        if (customLinkInput.trim()) {
                          setError(null);
                        }
                      }}
                    >
                      Import
                    </button>
                  </div>
                  <p className="text-[10px] text-[var(--db-dim)] mt-3">
                    Note: Spotify link previews play 30s clips per Spotify's public API policy.
                    For full-length custom audio, use the Upload tab.
                  </p>
                </div>
              )}

              {/* ── AUDIO WAVEFORM CUTTER ── */}
              {selectedTrack && showCutter && (
                <div className="spotify-cutter-section">
                  <div className="spotify-cutter-header">
                    <div>
                      <h4 className="text-sm font-bold text-white font-display">
                        Audio Trimmer
                      </h4>
                      <p className="text-xs text-[var(--db-muted)]">
                        Drag the green window to pick the exact hook for your {targetDuration}s reel
                      </p>
                    </div>
                    <button
                      type="button"
                      className="text-[var(--db-dim)] hover:text-white transition-colors"
                      onClick={() => setShowCutter(false)}
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <AudioWaveformCutter
                    key={selectedTrack.id + targetDuration}
                    audioSrc={musicPreviewUrl(selectedTrack.id)}
                    sourceDuration={selectedTrack.duration || 120}
                    targetDuration={targetDuration}
                    initialStartTime={audioCutStart}
                    onChange={({ startTime, endTime }) => {
                      setAudioCutStart(startTime);
                      setAudioCutEnd(endTime);
                    }}
                  />

                  <div className="spotify-cut-summary">
                    <span className="text-[var(--db-dim)] text-xs">Selected cut</span>
                    <span className="mono text-[#1DB954] text-sm font-bold">
                      {audioCutStart.toFixed(1)}s → {audioCutEnd.toFixed(1)}s
                      &nbsp;·&nbsp;{targetDuration}s window
                    </span>
                  </div>
                </div>
              )}

              {/* Show cutter toggle when a track is selected but cutter is hidden */}
              {selectedTrack && !showCutter && (
                <div className="spotify-cutter-collapsed">
                  <div className="flex items-center gap-3">
                    <Music className="w-4 h-4 text-[#1DB954]" />
                    <div>
                      <span className="text-sm text-white font-semibold">
                        {selectedTrack.display_name || selectedTrack.filename}
                      </span>
                      <span className="text-xs text-[var(--db-muted)] ml-2 mono">
                        cut {audioCutStart.toFixed(1)}s–{audioCutEnd.toFixed(1)}s
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="text-xs text-[#1DB954] hover:text-[#1ed760] font-semibold transition-colors"
                    onClick={() => setShowCutter(true)}
                  >
                    Edit Trim →
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* ══ RIGHT: COLLECTION DETAILS + GENERATE ══ */}
          <div className="space-y-6">

            <div className="p-5 rounded-xl bg-[#111115] border border-white/10 space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="text-xs font-bold font-display tracking-wider text-white/70 uppercase">
                    Opening Template
                  </h3>
                  <p className="mt-1 text-xs leading-relaxed text-[var(--db-muted)]">
                    Optional image shown at the start of the final reel for up to 1 second.
                  </p>
                </div>
                {templateFile && (
                  <span className="shrink-0 rounded-md border border-[#ff681b]/30 bg-[#ff681b]/10 px-2 py-1 text-[10px] font-semibold text-[#ff681b]">
                    {analysisJobId ? "ATTACHED" : "SELECTED"}
                  </span>
                )}
              </div>
              {templatePreviewUrl ? (
                <div className="overflow-hidden rounded-lg border border-white/10 bg-black/40">
                  <img
                    src={templatePreviewUrl}
                    alt="Selected opening template preview"
                    className="max-h-48 w-full object-contain"
                  />
                </div>
              ) : (
                <div className="flex min-h-24 items-center justify-center rounded-lg border border-dashed border-white/15 bg-black/20 px-4 text-center text-xs text-[var(--db-dim)]">
                  No template selected. Your reel will start with its regular video content.
                </div>
              )}
              <input
                ref={templateInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={(event) => {
                  selectTemplateImage(event.target.files?.[0] ?? null);
                  event.target.value = "";
                }}
              />
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => templateInputRef.current?.click()}
                  disabled={isGenerating || isUploadingTemplate}
                  className="min-h-10 flex-1 rounded-lg border border-[#ff681b]/40 bg-[#ff681b]/10 px-3 py-2 text-xs font-semibold text-[#ff681b] transition-colors hover:bg-[#ff681b]/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ff681b] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isUploadingTemplate ? "Uploading template…" : templateFile ? "Change image" : "Choose image"}
                </button>
                {templateFile && (
                  <button
                    type="button"
                    onClick={() => selectTemplateImage(null)}
                    disabled={isGenerating || isUploadingTemplate}
                    className="min-h-10 rounded-lg border border-white/10 px-3 py-2 text-xs text-white/70 transition-colors hover:bg-white/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Remove
                  </button>
                )}
              </div>
              <p className="text-[11px] text-[var(--db-dim)]">
                JPG, PNG, or WEBP · 20 MB maximum · You can continue without one.
              </p>
            </div>

            {/* Selected track summary */}
            {selectedTrack && (
              <div className="p-4 rounded-xl bg-[#0d1a10] border border-[#1DB954]/25 flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-[#1DB954]/20 flex items-center justify-center shrink-0">
                  <Music className="w-4 h-4 text-[#1DB954]" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-white truncate">
                    {selectedTrack.display_name || selectedTrack.filename}
                  </div>
                  <div className="text-xs mono text-[#1DB954]">
                    {audioCutStart.toFixed(1)}s – {audioCutEnd.toFixed(1)}s &nbsp;·&nbsp; {targetDuration}s cut
                  </div>
                </div>
                <Check className="w-4 h-4 text-[#1DB954] shrink-0" />
              </div>
            )}

            {/* Brand Watermark Overlay Card */}
            <div className="p-5 rounded-xl bg-[#111115] border border-white/10 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold font-display tracking-wider text-white/50 uppercase">
                  Brand Watermark Overlay
                </h3>
                <span className="text-[10px] font-bold mono px-2 py-0.5 rounded bg-[#ff681b]/15 text-[#ff681b] border border-[#ff681b]/30">
                  FFMPEG WATERMARK
                </span>
              </div>
              
              {/* Brand Watermark Overlay Card */}
<div className="p-5 rounded-xl bg-[#111115] border border-white/10 space-y-4">

  

  {/* Logo Upload */}
  <div className="p-3 rounded-lg bg-black/40 border border-white/5">

    <div className="flex items-center gap-3">

      {/* Logo Preview */}
      <div className="w-14 h-14 rounded-lg overflow-hidden bg-black/80 border border-white/10 flex items-center justify-center shrink-0">

        {brandLogoPreview ? (
          <img
            src={brandLogoPreview}
            alt="Brand Logo"
            className="w-full h-full object-contain"
          />
        ) : (
          <span className="text-[10px] text-white/30">
            LOGO
          </span>
        )}

      </div>

      {/* Upload button */}
      <div className="flex-1">

        <p className="text-xs font-semibold text-white">
          Brand Logo
        </p>

        <p className="text-[11px] text-[var(--db-muted)] mt-1">
          JPG, PNG or WEBP · Max 20 MB
        </p>

        <button
          type="button"
          onClick={() => brandLogoInputRef.current?.click()}
          disabled={isUploadingBrandLogo}
          className="mt-2 px-3 py-1.5 rounded-lg border border-[#ff681b]/40 bg-[#ff681b]/10 text-[#ff681b] text-xs font-semibold hover:bg-[#ff681b]/20 transition-all disabled:opacity-50"
        >
          {isUploadingBrandLogo
            ? "Uploading..."
            : brandLogo
              ? "Change Logo"
              : "Choose Image"}
        </button>

        <input
          ref={brandLogoInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0] || null;
            handleBrandLogoUpload(file);
            event.target.value = "";
          }}
        />

      </div>
    </div>
  </div>

  {/* Logo Placement */}
  <div>
    <label className="text-xs text-[var(--db-muted)] block mb-1.5">
      Logo Placement
    </label>

    <div className="grid grid-cols-2 gap-2">

      <button
        type="button"
        onClick={async () => {
  setBrandPlacement("start");

  try {
    await fetch(
      `${import.meta.env.VITE_API_BASE_URL}/branding/logo`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          placement: "start",
        }),
      }
    );
  } catch (error) {
    console.error("Failed to update logo placement:", error);
  }
}}
        className={`py-2.5 px-3 rounded-lg border text-xs text-left transition-all ${
          brandPlacement === "start"
            ? "border-[#ff681b] bg-[#ff681b]/15 text-[#ff681b] font-semibold"
            : "border-white/10 text-white/60 hover:bg-white/5"
        }`}
      >
        Starting of Reel
      </button>

      <button
        type="button"
      onClick={async () => {
  setBrandPlacement("entire");

  try {
    await fetch(
      `${import.meta.env.VITE_API_BASE_URL}/branding/logo/placement`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          placement: "entire",
        }),
      }
    );
  } catch (error) {
    console.error("Failed to update logo placement:", error);
  }
}}
        className={`py-2.5 px-3 rounded-lg border text-xs text-left transition-all ${
          brandPlacement === "entire"
            ? "border-[#ff681b] bg-[#ff681b]/15 text-[#ff681b] font-semibold"
            : "border-white/10 text-white/60 hover:bg-white/5"
        }`}
      >
        Entire Reel
      </button>

    </div>
  </div>

</div>
            </div>

            {/* Reel Settings & Duration */}
            <div className="p-5 rounded-xl bg-[#111115] border border-white/10 space-y-4">
              <h3 className="text-xs font-bold font-display tracking-wider text-white/50 uppercase">
                Reel Settings
              </h3>
              <div>
                <label className="text-xs text-[var(--db-muted)] block mb-1">
                  Collection Title
                </label>
                <input
                  type="text"
                  value={collectionTitle}
                  onChange={(e) => setCollectionTitle(e.target.value)}
                  className="w-full p-2.5 rounded-lg bg-black/50 border border-white/10 text-white text-sm focus:border-[#ff681b] outline-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-[var(--db-muted)] block mb-1">Category</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as any)}
                    className="w-full p-2.5 rounded-lg bg-black/50 border border-white/10 text-white text-sm outline-none cursor-pointer"
                  >
                    <option value="Product">Product</option>
                    <option value="Apparel">Apparel</option>
                    <option value="Accessories">Accessories</option>
                    <option value="Beauty">Beauty</option>
                    <option value="Home">Home</option>
                    <option value="Other">Other</option>
                    <option value="Sarees">Sarees</option>
                    <option value="Lehengas">Lehengas</option>
                    <option value="Kurtis">Kurtis</option>
                    <option value="Bridal">Bridal</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-[var(--db-muted)] block mb-1">Price (₹)</label>
                  <div className="relative">
                    {!hasCurrencyPrefix(price) && (
                      <span className="absolute left-3 top-2.5 text-[#ff681b] font-bold text-sm">₹</span>
                    )}
                    <input
                      type="text"
                      value={price}
                      onChange={(e) => setPrice(e.target.value)}
                      placeholder="e.g. 1500"
                      className="w-full p-2.5 pl-7 rounded-lg bg-black/50 border border-white/10 text-white text-sm mono outline-none focus:border-[#ff681b]"
                    />
                  </div>
                </div>
              </div>
              <div>
                <label className="text-xs text-[var(--db-muted)] block mb-1">
                  Target Reel Duration
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {([15, 30, 45] as const).map((dur) => (
                    <button
                      key={dur}
                      type="button"
                      onClick={() => setTargetDuration(dur)}
                      className={`py-2 px-3 rounded-lg border text-xs mono font-bold transition-all ${
                        targetDuration === dur
                          ? "border-[#ff681b] bg-[#ff681b]/15 text-[#ff681b]"
                          : "border-white/10 text-white/60 hover:bg-white/5"
                      }`}
                    >
                      {dur}s Reel
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Generate button */}
            {analyzedClips.length > 0 && (
              <CreditQuoteNotice
                credits={credits}
                cost={reelCost}
                loading={creditsLoading}
                error={creditsError}
                canGenerate={canGenerate}
                onRetry={() => void onRefreshCredits()}
              />
            )}
            <button
              type="button"
              onClick={
  analyzedClips.length > 0
    ? handleGenerateSelectedReel
    : handleGenerateReel
}
              disabled={
  isGenerating ||
  files.length === 0 ||
  (analyzedClips.length > 0 && !canGenerate) ||
  (analyzedClips.length > 0 && selectedClipIds.length === 0)
}
              className="w-full py-4 px-6 rounded-xl bg-[#ff681b] hover:bg-[#ff7d3b] text-white font-bold font-display text-sm tracking-wider uppercase transition-all shadow-xl shadow-[#ff681b]/25 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              <Film className="w-4 h-4" />
              <span>
  {analyzedClips.length > 0
    ? "GENERATE SELECTED REEL"
    : "ANALYZE FOOTAGE"}
</span>
            </button>

            {files.length === 0 && (
              <p className="text-center text-xs text-[var(--db-dim)]">
                Upload at least one video footage take to generate a reel.
              </p>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
