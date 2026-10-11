import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  ArrowLeft,
  Check,
  Clock,
  Copy,
  Download,
  FileAudio,
  Film,
  Globe,
  Image as ImageIcon,
  Layers,
  Maximize2,
  MoveLeft,
  MoveRight,
  Music,
  Pause,
  Play,
  Plus,
  RotateCcw,
  Search,
  Sliders,
  Trash2,
  Type,
  Upload,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import { listMusic, musicPreviewUrl } from "../../api";
import type { MusicTrack } from "../../types";
import "./ReelImageEditorWorkspace.css";

/* =========================================================
   TYPES
   ========================================================= */

export type MotionEffect =
  | "zoom_in"
  | "zoom_out"
  | "pan_left"
  | "pan_right"
  | "static";

export type SlideTransition = "cut" | "crossfade" | "slide";

export interface ImageSlide {
  id: string;
  imageUrl: string;
  name: string;
  duration: number; // Duration in seconds (e.g., 1.5)
  motion: MotionEffect;
  transition: SlideTransition;
  fitMode: "cover" | "contain";
}

export type LogoPosition =
  | "top-left"
  | "top"
  | "top-right"
  | "left"
  | "center"
  | "right"
  | "bottom-left"
  | "down"
  | "bottom-right";

export interface OverlayConfig {
  title: string;
  titleFont: "Space Grotesk" | "Sora";
  titlePosition: "top" | "center" | "bottom";
  titleSize: number;
  subtitle: string;
  price: string;
  showPriceTag: boolean;
  priceBadgeStyle: "gold" | "obsidian" | "minimal";
  brandName: string;
  brandWatermarkPosition: "top-right" | "top-left" | "bottom-center" | "none";
  // LOGO WATERMARK
  logoUrl?: string | null;
  logoFileName?: string;
  logoPosition: LogoPosition;
  logoSize: number; // width in canvas pixels (60 - 260px)
  logoOpacity: number; // 0.2 to 1.0
  showLogo: boolean;
  ctaText: string;
  showCtaBadge: boolean;
  showEndCard: boolean;
  endCardText: string;
  endCardSubtext: string;
}

export interface AudioConfig {
  trackId: string | null;
  trackTitle: string;
  trackUrl: string | null;
  volume: number; // 0.0 to 1.0
  offset: number; // in seconds
}

export interface ManualReelProject {
  id: string;
  title: string;
  category: "Sarees" | "Lehengas" | "Kurtis" | "Bridal";
  slides: ImageSlide[];
  overlays: OverlayConfig;
  audio: AudioConfig;
}

interface ReelImageEditorWorkspaceProps {
  initialProject?: Partial<ManualReelProject>;
  onClose: () => void;
  onSaveToLibrary: (savedReel: {
    id: string;
    title: string;
    category: "Sarees" | "Lehengas" | "Kurtis" | "Bridal";
    durationSeconds: number;
    resolution: string;
    videoUrl: string;
    thumbnailUrl: string;
    createdAt: string;
    viewsCount: string;
    status: "ready";
    productPrice: string;
  }) => void;
}

const fallbackEmptySlide: ImageSlide = {
  id: "fallback-empty",
  imageUrl: "",
  name: "Upload Image",
  duration: 2.0,
  motion: "zoom_in",
  transition: "crossfade",
  fitMode: "cover",
};

const DURATION_PRESETS = [0.8, 1.2, 1.5, 1.8, 2.0, 2.5, 3.0, 3.5];

const SAMPLE_VAISHKALA_LOGO =
  'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160" fill="none"><circle cx="80" cy="80" r="72" stroke="%23c9a227" stroke-width="3" stroke-dasharray="4 2" fill="rgba(20,18,14,0.75)"/><circle cx="80" cy="80" r="62" stroke="%23f3c766" stroke-width="1.5"/><path d="M80 34 L84 46 L96 48 L87 56 L89 68 L80 61 L71 68 L73 56 L64 48 L76 46 Z" fill="%23f3c766"/><text x="80" y="100" font-family="Space Grotesk,sans-serif" font-weight="800" font-size="30" fill="%23f3c766" text-anchor="middle" letter-spacing="3">V</text><text x="80" y="120" font-family="Space Grotesk,sans-serif" font-weight="700" font-size="8.5" fill="%23faf7f2" text-anchor="middle" letter-spacing="4">VAISHKALA</text></svg>';

export default function ReelImageEditorWorkspace({
  initialProject,
  onClose,
  onSaveToLibrary,
}: ReelImageEditorWorkspaceProps) {
  /* =======================================================
     PROJECT STATE
     ======================================================= */
  const [projectTitle, setProjectTitle] = useState(
    initialProject?.title || "Royal Ethnic Silk Reel"
  );
  const [category, setCategory] = useState<
    "Sarees" | "Lehengas" | "Kurtis" | "Bridal"
  >(initialProject?.category || "Sarees");

  // Strictly initialize slides with user-provided images only — NO phantom or dummy fallback!
  const [slides, setSlides] = useState<ImageSlide[]>(
    initialProject?.slides && initialProject.slides.length > 0
      ? initialProject.slides
      : []
  );

  const [selectedSlideIndex, setSelectedSlideIndex] = useState<number>(0);
  const [activeInspectorTab, setActiveInspectorTab] = useState<
    "timing" | "overlays" | "audio"
  >("timing");
  const [mobileTab, setMobileTab] = useState<"canvas" | "filmstrip" | "inspector">("canvas");

  const [overlays, setOverlays] = useState<OverlayConfig>(
    initialProject?.overlays || {
      title: "Varanasi Heritage Brocade",
      titleFont: "Space Grotesk",
      titlePosition: "bottom",
      titleSize: 38,
      subtitle: "Pure Mulberry Silk · Handloom Zari",
      price: "18500",
      showPriceTag: true,
      priceBadgeStyle: "gold",
      brandName: "VAISHKALA COUTURE",
      brandWatermarkPosition: "none",
      logoUrl: null,
      logoFileName: "",
      logoPosition: "top-right",
      logoSize: 130,
      logoOpacity: 0.95,
      showLogo: true,
      ctaText: "EXCLUSIVE BRIDAL DROP",
      showCtaBadge: true,
      showEndCard: true,
      endCardText: "Book Your Bridal Consultation",
      endCardSubtext: "DM on Instagram or Visit Our Flagship Atelier",
    }
  );

  /* =======================================================
     SOUNDTRACK STATE ("ANY SONG IN THE WORLD")
     ======================================================= */
  const [audioConfig, setAudioConfig] = useState<AudioConfig>(
    initialProject?.audio || {
      trackId: null,
      trackTitle: "No audio selected",
      trackUrl: null,
      volume: 0.85,
      offset: 0,
    }
  );

  const [audioSourceTab, setAudioSourceTab] = useState<
    "upload" | "url" | "catalog"
  >("upload");
  const [customAudioUrlInput, setCustomAudioUrlInput] = useState("");
  const [customAudioUrlError, setCustomAudioUrlError] = useState<string | null>(
    null
  );
  const [customAudioFileMeta, setCustomAudioFileMeta] = useState<{
    name: string;
    size: string;
    duration?: number;
  } | null>(null);

  const [availableTracks, setAvailableTracks] = useState<MusicTrack[]>([]);
  const [catalogSearchQuery, setCatalogSearchQuery] = useState("");
  const [playingAudioPreviewId, setPlayingAudioPreviewId] = useState<
    string | null
  >(null);

  const previewAudioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    listMusic()
      .then((tracks) => {
        setAvailableTracks(tracks);
      })
      .catch(() => {
        // Fallback or offline
      });
  }, []);

  /* =======================================================
     PLAYBACK & TIMELINE ENGINE
     ======================================================= */
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [isLooping, setIsLooping] = useState(true);
  const [isMuted, setIsMuted] = useState(false);

  // Loaded HTMLImageElements cache
  const imageCacheRef = useRef<Map<string, HTMLImageElement>>(new Map());
  const [imagesLoadedVersion, setImagesLoadedVersion] = useState(0);

  // Audio element for timeline sync
  const timelineAudioRef = useRef<HTMLAudioElement | null>(null);

  // Preload all slide images without cors taint on blob URLs
  useEffect(() => {
    slides.forEach((slide) => {
      if (!slide.imageUrl) return;
      if (!imageCacheRef.current.has(slide.imageUrl)) {
        const img = new Image();
        if (slide.imageUrl.startsWith("http")) {
          img.crossOrigin = "anonymous";
        }
        img.src = slide.imageUrl;
        img.onload = () => {
          imageCacheRef.current.set(slide.imageUrl, img);
          setImagesLoadedVersion((v) => v + 1);
        };
        img.onerror = () => {
          console.warn("Could not load slide image:", slide.imageUrl);
        };
      }
    });
  }, [slides]);

  // Preload logo image if set, or auto-fetch backend brand logo if empty
  useEffect(() => {
    if (!overlays.logoUrl) {
      const defaultLogoUrl = `${import.meta.env.VITE_API_BASE_URL}/branding/logo`;
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        imageCacheRef.current.set(defaultLogoUrl, img);
        setOverlays((prev) => {
          if (prev.logoUrl) return prev;
          return {
            ...prev,
            logoUrl: defaultLogoUrl,
            logoFileName: "Kaladhar_Brand_Logo.jpeg",
            showLogo: true,
          };
        });
        setImagesLoadedVersion((v) => v + 1);
      };
      img.src = defaultLogoUrl;
      return;
    }

    if (overlays.logoUrl && !imageCacheRef.current.has(overlays.logoUrl)) {
      const img = new Image();
      if (overlays.logoUrl.startsWith("http")) {
        img.crossOrigin = "anonymous";
      }
      img.src = overlays.logoUrl;
      img.onload = () => {
        imageCacheRef.current.set(overlays.logoUrl!, img);
        setImagesLoadedVersion((v) => v + 1);
      };
      img.onerror = () => {
        console.warn("Could not load logo image:", overlays.logoUrl);
      };
    }
  }, [overlays.logoUrl]);

  // Total duration in seconds
  const totalDuration =
    slides.length > 0
      ? slides.reduce((acc, s) => acc + s.duration, 0)
      : 1;

  // Format time in 00:00.0 (JetBrains Mono)
  const formatTimecode = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const tenths = Math.floor((seconds % 1) * 10);
    return `${mins.toString().padStart(2, "0")}:${secs
      .toString()
      .padStart(2, "0")}.${tenths}`;
  };

  // Find active slide and local progress for a given timestamp
  const getSlideAtTime = useCallback(
    (time: number) => {
      if (slides.length === 0) {
        return {
          slideIndex: 0,
          slide: null,
          localTime: 0,
          progress: 0,
          nextSlide: null,
        };
      }

      let accumulated = 0;
      for (let i = 0; i < slides.length; i++) {
        const slide = slides[i];
        if (time >= accumulated && time < accumulated + slide.duration) {
          const localTime = time - accumulated;
          const progress = localTime / slide.duration;
          return {
            slideIndex: i,
            slide,
            localTime,
            progress: Math.min(Math.max(progress, 0), 1),
            nextSlide: i < slides.length - 1 ? slides[i + 1] : null,
          };
        }
        accumulated += slide.duration;
      }
      // If at end
      const lastIdx = slides.length - 1;
      return {
        slideIndex: lastIdx,
        slide: slides[lastIdx],
        localTime: slides[lastIdx]?.duration || 0,
        progress: 1,
        nextSlide: null,
      };
    },
    [slides]
  );

  // Render a specific frame on the 9:16 Canvas (1080x1920 logical)
  const drawFrame = useCallback(
    (time: number) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const CW = 1080;
      const CH = 1920;

      if (canvas.width !== CW || canvas.height !== CH) {
        canvas.width = CW;
        canvas.height = CH;
      }

      const { slide, progress, nextSlide } = getSlideAtTime(time);

      // Empty State on Canvas if no images are loaded
      if (!slide || !slide.imageUrl) {
        ctx.fillStyle = "#09090b";
        ctx.fillRect(0, 0, CW, CH);

        ctx.strokeStyle = "rgba(255, 104, 27, 0.3)";
        ctx.lineWidth = 3;
        ctx.strokeRect(30, 30, CW - 60, CH - 60);

        ctx.fillStyle = "#faf7f2";
        ctx.font = '700 38px "Space Grotesk", sans-serif';
        ctx.textAlign = "center";
        ctx.fillText("STUDIO READY · NO IMAGES", CW / 2, CH / 2 - 30);

        ctx.font = '400 24px "Inter", sans-serif';
        ctx.fillStyle = "rgba(250, 247, 242, 0.6)";
        ctx.fillText(
          "Upload your ethnic collection photos to start",
          CW / 2,
          CH / 2 + 25
        );
        return;
      }

      // 1. Background Fill
      ctx.fillStyle = "#09090b";
      ctx.fillRect(0, 0, CW, CH);

      // Helper to draw single slide with motion
      const drawSlideImage = (
        s: ImageSlide,
        p: number,
        opacity: number = 1.0
      ) => {
        let img = imageCacheRef.current.get(s.imageUrl);

        // Fail-safe: if image is not yet cached, trigger loading
        if (!img && s.imageUrl) {
          img = new Image();
          if (s.imageUrl.startsWith("http")) {
            img.crossOrigin = "anonymous";
          }
          img.src = s.imageUrl;
          img.onload = () => {
            imageCacheRef.current.set(s.imageUrl, img!);
            setImagesLoadedVersion((v) => v + 1);
          };
          return;
        }

        ctx.save();
        ctx.globalAlpha = opacity;

        if (img && img.complete && img.naturalWidth > 0) {
          const iw = img.naturalWidth;
          const ih = img.naturalHeight;

          // Compute aspect ratio fit
          const scaleCover = Math.max(CW / iw, CH / ih);
          const scaleContain = Math.min(CW / iw, CH / ih);
          const baseScale = s.fitMode === "cover" ? scaleCover : scaleContain;

          // Compute motion transformations (Ken Burns)
          let currentScale = baseScale;
          let transX = 0;
          let transY = 0;

          if (s.motion === "zoom_in") {
            currentScale = baseScale * (1.0 + 0.12 * p);
          } else if (s.motion === "zoom_out") {
            currentScale = baseScale * (1.12 - 0.12 * p);
          } else if (s.motion === "pan_right") {
            currentScale = baseScale * 1.06;
            transX = -(CW * 0.05) + CW * 0.1 * p;
          } else if (s.motion === "pan_left") {
            currentScale = baseScale * 1.06;
            transX = CW * 0.05 - CW * 0.1 * p;
          }

          const drawW = iw * currentScale;
          const drawH = ih * currentScale;
          const posX = (CW - drawW) / 2 + transX;
          const posY = (CH - drawH) / 2 + transY;

          // Blurred ambient backdrop if fitMode is contain
          if (s.fitMode === "contain") {
            ctx.save();
            ctx.filter = "blur(40px) brightness(0.5)";
            const bgScale = scaleCover * 1.05;
            const bgW = iw * bgScale;
            const bgH = ih * bgScale;
            ctx.drawImage(
              img,
              (CW - bgW) / 2,
              (CH - bgH) / 2,
              bgW,
              bgH
            );
            ctx.restore();
          }

          ctx.drawImage(img, posX, posY, drawW, drawH);
        } else {
          // Loading placeholder
          ctx.fillStyle = "#18181b";
          ctx.fillRect(0, 0, CW, CH);
        }

        ctx.restore();
      };

      // 2. Draw Current Slide
      drawSlideImage(slide, progress, 1.0);

      // 3. Crossfade Transition into Next Slide
      const transitionDuration = 0.3; // 300ms crossfade
      const timeLeft = slide.duration * (1 - progress);
      if (
        slide.transition === "crossfade" &&
        nextSlide &&
        timeLeft <= transitionDuration
      ) {
        const transProgress = 1 - timeLeft / transitionDuration;
        drawSlideImage(nextSlide, 0, transProgress);
      }

      // 4. Subtle Vignette & Lighting
      const vignette = ctx.createRadialGradient(
        CW / 2,
        CH / 2,
        CH * 0.3,
        CW / 2,
        CH / 2,
        CH * 0.75
      );
      vignette.addColorStop(0, "rgba(0,0,0,0)");
      vignette.addColorStop(1, "rgba(0,0,0,0.55)");
      ctx.fillStyle = vignette;
      ctx.fillRect(0, 0, CW, CH);

      // Bottom gradient to make text ultra-legible
      const bottomGrad = ctx.createLinearGradient(0, CH * 0.55, 0, CH);
      bottomGrad.addColorStop(0, "rgba(0,0,0,0)");
      bottomGrad.addColorStop(0.7, "rgba(9,9,11,0.75)");
      bottomGrad.addColorStop(1, "rgba(9,9,11,0.95)");
      ctx.fillStyle = bottomGrad;
      ctx.fillRect(0, CH * 0.55, CW, CH * 0.45);

      // Top gradient for watermark
      const topGrad = ctx.createLinearGradient(0, 0, 0, 240);
      topGrad.addColorStop(0, "rgba(9,9,11,0.85)");
      topGrad.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = topGrad;
      ctx.fillRect(0, 0, CW, 240);

      // 5. Typography & Commercial Overlays

      // A. Brand Logo Watermark (Image)
      if (overlays.showLogo && overlays.logoUrl) {
        let logoImg = imageCacheRef.current.get(overlays.logoUrl);
        if (!logoImg) {
          logoImg = new Image();
          if (overlays.logoUrl.startsWith("http")) {
            logoImg.crossOrigin = "anonymous";
          }
          logoImg.src = overlays.logoUrl;
          logoImg.onload = () => {
            imageCacheRef.current.set(overlays.logoUrl!, logoImg!);
            setImagesLoadedVersion((v) => v + 1);
          };
        }

        if (logoImg && logoImg.complete && logoImg.naturalWidth > 0) {
          ctx.save();
          ctx.globalAlpha = overlays.logoOpacity ?? 0.95;

          const targetWidth = overlays.logoSize ?? 130;
          const aspect = logoImg.naturalHeight / logoImg.naturalWidth;
          const targetHeight = targetWidth * aspect;

          const marginX = 64;
          const marginTop = 76;
          const marginBottom = 230; // Safe area above product title & bottom controls

          let lx = marginX;
          let ly = marginTop;

          switch (overlays.logoPosition) {
            case "top-left":
              lx = marginX;
              ly = marginTop;
              break;
            case "top":
              lx = (CW - targetWidth) / 2;
              ly = marginTop;
              break;
            case "top-right":
              lx = CW - marginX - targetWidth;
              ly = marginTop;
              break;
            case "left":
              lx = marginX;
              ly = (CH - targetHeight) / 2;
              break;
            case "center":
              lx = (CW - targetWidth) / 2;
              ly = (CH - targetHeight) / 2;
              break;
            case "right":
              lx = CW - marginX - targetWidth;
              ly = (CH - targetHeight) / 2;
              break;
            case "bottom-left":
              lx = marginX;
              ly = CH - marginBottom - targetHeight;
              break;
            case "down":
              lx = (CW - targetWidth) / 2;
              ly = CH - marginBottom - targetHeight;
              break;
            case "bottom-right":
              lx = CW - marginX - targetWidth;
              ly = CH - marginBottom - targetHeight;
              break;
            default:
              lx = CW - marginX - targetWidth;
              ly = marginTop;
          }

          ctx.shadowColor = "rgba(0, 0, 0, 0.65)";
          ctx.shadowBlur = 12;
          ctx.shadowOffsetX = 0;
          ctx.shadowOffsetY = 2;

          ctx.drawImage(logoImg, lx, ly, targetWidth, targetHeight);
          ctx.restore();
        }
      }

      // B. Brand Watermark (Text)
      if (overlays.brandWatermarkPosition !== "none" && overlays.brandName) {
        ctx.save();
        ctx.font = '600 24px "Space Grotesk", sans-serif';
        ctx.letterSpacing = "0.18em";
        ctx.fillStyle = "rgba(255, 255, 255, 0.85)";
        if (overlays.brandWatermarkPosition === "top-right") {
          ctx.textAlign = "right";
          ctx.fillText(overlays.brandName.toUpperCase(), CW - 64, 88);
        } else if (overlays.brandWatermarkPosition === "top-left") {
          ctx.textAlign = "left";
          ctx.fillText(overlays.brandName.toUpperCase(), 64, 88);
        } else {
          ctx.textAlign = "center";
          ctx.fillText(overlays.brandName.toUpperCase(), CW / 2, 88);
        }
        ctx.restore();
      }

      // B. Category / CTA Badge
      if (overlays.showCtaBadge && overlays.ctaText) {
        ctx.save();
        const badgeY =
          overlays.titlePosition === "top"
            ? 170
            : overlays.titlePosition === "center"
            ? CH / 2 - 120
            : CH - 360;

        ctx.font = '700 19px "Space Grotesk", sans-serif';
        ctx.letterSpacing = "0.22em";
        const textMetrics = ctx.measureText(overlays.ctaText.toUpperCase());
        const badgeWidth = textMetrics.width + 48;
        const badgeHeight = 44;
        const badgeX = 64;

        // Pill container
        ctx.fillStyle = "rgba(255, 104, 27, 0.15)";
        ctx.strokeStyle = "#ff681b";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.roundRect(badgeX, badgeY, badgeWidth, badgeHeight, 22);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = "#ff681b";
        ctx.textAlign = "left";
        ctx.fillText(overlays.ctaText.toUpperCase(), badgeX + 24, badgeY + 29);
        ctx.restore();
      }

      // C. Product Headline & Subtitle
      ctx.save();
      let titleY = CH - 250;
      if (overlays.titlePosition === "top") titleY = 320;
      if (overlays.titlePosition === "center") titleY = CH / 2;

      ctx.font = `700 ${overlays.titleSize * 1.5}px "${
        overlays.titleFont
      }", sans-serif`;
      ctx.letterSpacing = "-0.02em";
      ctx.fillStyle = "#faf7f2";
      ctx.textAlign = "left";
      ctx.fillText(overlays.title, 64, titleY);

      if (overlays.subtitle) {
        ctx.font = '400 28px "Inter", sans-serif';
        ctx.fillStyle = "rgba(250, 247, 242, 0.75)";
        ctx.fillText(overlays.subtitle, 64, titleY + 48);
      }
      ctx.restore();

      // D. Price Tag Badge (Indian Rupee ₹)
      if (overlays.showPriceTag && overlays.price) {
        ctx.save();
        const formattedPrice = `₹${Number(
          overlays.price.replace(/[^0-9]/g, "") || 0
        ).toLocaleString("en-IN")}`;

        const priceY =
          overlays.titlePosition === "top"
            ? 440
            : overlays.titlePosition === "center"
            ? CH / 2 + 110
            : CH - 140;

        ctx.font = '700 36px "JetBrains Mono", monospace';
        const pMetrics = ctx.measureText(formattedPrice);
        const pWidth = pMetrics.width + 56;
        const pHeight = 62;
        const pX = 64;

        if (overlays.priceBadgeStyle === "gold") {
          ctx.fillStyle = "rgba(20, 18, 14, 0.85)";
          ctx.strokeStyle = "#c9a227";
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          ctx.roundRect(pX, priceY, pWidth, pHeight, 14);
          ctx.fill();
          ctx.stroke();

          ctx.fillStyle = "#f3c766";
          ctx.fillText(formattedPrice, pX + 28, priceY + 44);
        } else if (overlays.priceBadgeStyle === "obsidian") {
          ctx.fillStyle = "rgba(22, 22, 25, 0.9)";
          ctx.strokeStyle = "rgba(255, 255, 255, 0.2)";
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.roundRect(pX, priceY, pWidth, pHeight, 14);
          ctx.fill();
          ctx.stroke();

          ctx.fillStyle = "#ffffff";
          ctx.fillText(formattedPrice, pX + 28, priceY + 44);
        } else {
          ctx.fillStyle = "#ffffff";
          ctx.beginPath();
          ctx.roundRect(pX, priceY, pWidth, pHeight, 12);
          ctx.fill();

          ctx.fillStyle = "#09090b";
          ctx.fillText(formattedPrice, pX + 28, priceY + 44);
        }
        ctx.restore();
      }

      // E. Subtle Gold Border Edge
      ctx.save();
      ctx.strokeStyle = "rgba(201, 162, 39, 0.25)";
      ctx.lineWidth = 4;
      ctx.strokeRect(20, 20, CW - 40, CH - 40);
      ctx.restore();
    },
    [slides, getSlideAtTime, overlays]
  );

  // Redraw when currentTime, slides, overlays, or imagesLoadedVersion change
  useEffect(() => {
    drawFrame(currentTime);
  }, [currentTime, drawFrame, imagesLoadedVersion]);

  // Synchronized Animation Loop
  const animationFrameIdRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number | null>(null);

  useEffect(() => {
    if (!isPlaying) {
      if (animationFrameIdRef.current) {
        cancelAnimationFrame(animationFrameIdRef.current);
      }
      lastTimeRef.current = null;
      if (timelineAudioRef.current) {
        timelineAudioRef.current.pause();
      }
      return;
    }

    if (timelineAudioRef.current && audioConfig.trackUrl && !isMuted) {
      const audioEl = timelineAudioRef.current;
      const audioDuration = audioEl.duration || totalDuration;
      audioEl.currentTime =
        (currentTime + (audioConfig.offset || 0)) % audioDuration;
      audioEl.volume = audioConfig.volume;
      audioEl.play().catch(() => {});
    }

    const loop = (timestamp: number) => {
      if (lastTimeRef.current === null) {
        lastTimeRef.current = timestamp;
      }
      const delta = (timestamp - lastTimeRef.current) / 1000;
      lastTimeRef.current = timestamp;

      setCurrentTime((prev) => {
        let next = prev + delta;
        if (next >= totalDuration) {
          if (isLooping) {
            next = 0;
            if (timelineAudioRef.current) {
              timelineAudioRef.current.currentTime = audioConfig.offset || 0;
            }
          } else {
            setIsPlaying(false);
            return totalDuration;
          }
        }
        return next;
      });

      animationFrameIdRef.current = requestAnimationFrame(loop);
    };

    animationFrameIdRef.current = requestAnimationFrame(loop);

    return () => {
      if (animationFrameIdRef.current) {
        cancelAnimationFrame(animationFrameIdRef.current);
      }
    };
  }, [isPlaying, isLooping, totalDuration, audioConfig, isMuted]);

  /* =======================================================
     SLIDE ACTIONS
     ======================================================= */
  const handleAddPhotos = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const newSlides: ImageSlide[] = [];
    let hasNonImage = false;

    Array.from(files).forEach((file, index) => {
      if (
        file.type.startsWith("image/") ||
        /\.(jpe?g|png|webp|avif|bmp|tiff)$/i.test(file.name)
      ) {
        const url = URL.createObjectURL(file);
        newSlides.push({
          id: `slide-${Date.now()}-${index}`,
          imageUrl: url,
          name: file.name.replace(/\.[^/.]+$/, ""),
          duration: 1.8,
          motion: (slides.length + index) % 2 === 0 ? "zoom_in" : "pan_right",
          transition: "crossfade",
          fitMode: "cover",
        });
      } else {
        hasNonImage = true;
      }
    });

    if (hasNonImage) {
      alert(
        "Only image files (.jpg, .jpeg, .png, .webp) can be added as slides. Videos are not supported in the image reel editor. Please use Photoshoot Uploads for video footage."
      );
    }

    if (newSlides.length > 0) {
      setSlides((prev) => [...prev, ...newSlides]);
    }
    e.target.value = "";
  };

  const handleRemoveSlide = (idx: number) => {
    if (slides.length <= 1) {
      alert("A reel must have at least 1 slide.");
      return;
    }
    setSlides((prev) => prev.filter((_, i) => i !== idx));
    if (selectedSlideIndex >= idx && selectedSlideIndex > 0) {
      setSelectedSlideIndex((prev) => prev - 1);
    }
  };

  const handleMoveSlide = (idx: number, dir: -1 | 1) => {
    const target = idx + dir;
    if (target < 0 || target >= slides.length) return;
    setSlides((prev) => {
      const copy = [...prev];
      const temp = copy[idx];
      copy[idx] = copy[target];
      copy[target] = temp;
      return copy;
    });
    setSelectedSlideIndex(target);
  };

  const handleDuplicateSlide = (idx: number) => {
    const target = slides[idx];
    const clone: ImageSlide = {
      ...target,
      id: `slide-${Date.now()}`,
      name: `${target.name} (Copy)`,
    };
    setSlides((prev) => [
      ...prev.slice(0, idx + 1),
      clone,
      ...prev.slice(idx + 1),
    ]);
  };

  const updateSelectedSlide = (updates: Partial<ImageSlide>) => {
    if (slides.length === 0) return;
    setSlides((prev) =>
      prev.map((s, idx) =>
        idx === selectedSlideIndex ? { ...s, ...updates } : s
      )
    );
  };

  const handleApplyDurationToAll = (dur: number) => {
    setSlides((prev) => prev.map((s) => ({ ...s, duration: dur })));
  };

  /* =======================================================
     BRAND LOGO HANDLERS
     ======================================================= */
  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      if (!dataUrl) return;

      const img = new Image();
      img.onload = () => {
        imageCacheRef.current.set(dataUrl, img);
        setOverlays((prev) => ({
          ...prev,
          logoUrl: dataUrl,
          logoFileName: file.name,
          showLogo: true,
        }));
        setImagesLoadedVersion((v) => v + 1);
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const handleUseSampleLogo = () => {
    const img = new Image();
    img.onload = () => {
      imageCacheRef.current.set(SAMPLE_VAISHKALA_LOGO, img);
      setOverlays((prev) => ({
        ...prev,
        logoUrl: SAMPLE_VAISHKALA_LOGO,
        logoFileName: "Vaishkala_Gold_Crest.svg",
        showLogo: true,
      }));
      setImagesLoadedVersion((v) => v + 1);
    };
    img.src = SAMPLE_VAISHKALA_LOGO;
  };

  /* =======================================================
     PACING PRESETS FOR BATCH REEL TIMING
     ======================================================= */
  const PACING_MODES = [
    { id: "snappy", label: "Snappy", perSlide: 1.2, desc: "Fast cuts for energetic reels" },
    { id: "balanced", label: "Balanced", perSlide: 1.8, desc: "Standard viewing rhythm" },
    { id: "cinematic", label: "Cinematic", perSlide: 2.8, desc: "Graceful luxury flow" },
  ];

  /* =======================================================
     SOUNDTRACK HANDLERS ("CHOOSE ANY SONG IN THE WORLD")
     ======================================================= */
  const handleDeviceAudioUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const url = URL.createObjectURL(file);
    const sizeMb = (file.size / (1024 * 1024)).toFixed(1);

    const tempAudio = new Audio(url);
    tempAudio.onloadedmetadata = () => {
      setCustomAudioFileMeta({
        name: file.name,
        size: `${sizeMb} MB`,
        duration: tempAudio.duration,
      });
    };

    setAudioConfig({
      trackId: `custom-device-${Date.now()}`,
      trackTitle: file.name,
      trackUrl: url,
      volume: audioConfig.volume,
      offset: 0,
    });
  };

  const handleApplyWebAudioUrl = () => {
    setCustomAudioUrlError(null);
    const trimmed = customAudioUrlInput.trim();
    if (!trimmed) {
      setCustomAudioUrlError("Please enter an audio stream or file URL.");
      return;
    }

    try {
      const parsed = new URL(trimmed);
      const testAudio = new Audio(parsed.href);
      testAudio.crossOrigin = "anonymous";

      testAudio.oncanplaythrough = () => {
        const title =
          parsed.pathname.split("/").pop() || "Custom Web Audio Track";
        setAudioConfig({
          trackId: `web-url-${Date.now()}`,
          trackTitle: decodeURIComponent(title),
          trackUrl: parsed.href,
          volume: audioConfig.volume,
          offset: 0,
        });
        setCustomAudioFileMeta({
          name: decodeURIComponent(title),
          size: "Web Stream",
          duration: testAudio.duration,
        });
      };

      testAudio.onerror = () => {
        setCustomAudioUrlError(
          "Could not stream this audio URL. Please check the link or upload a local file."
        );
      };
    } catch {
      setCustomAudioUrlError("Invalid URL. Please enter a valid web link.");
    }
  };

  /* =======================================================
     EXPORT ENGINE (Real Video Recording & Audio Mixing)
     ======================================================= */
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);

  const handleExportReel = async () => {
    const canvas = canvasRef.current;
    if (!canvas || slides.length === 0) {
      alert("Please ensure you have at least 1 photo slide to export.");
      return;
    }

    setIsExporting(true);
    setIsPlaying(false);
    setExportProgress(10);

    try {
      // 1. Capture Canvas Video Stream
      const canvasStream = canvas.captureStream(30);

      // 2. Mix Audio Track if soundtrack is active and unmuted
      let mixedStream: MediaStream = canvasStream;
      let exportAudioEl: HTMLAudioElement | null = null;
      let audioCtx: AudioContext | null = null;

      if (audioConfig.trackUrl && !isMuted && audioConfig.volume > 0) {
        try {
          const AudioContextClass =
            window.AudioContext || (window as any).webkitAudioContext;
          if (AudioContextClass) {
            audioCtx = new AudioContextClass();
            if (audioCtx.state === "suspended") {
              await audioCtx.resume();
            }
            const destination = audioCtx.createMediaStreamDestination();

            exportAudioEl = new Audio();
            if (audioConfig.trackUrl.startsWith("http")) {
              exportAudioEl.crossOrigin = "anonymous";
            }
            exportAudioEl.src = audioConfig.trackUrl;
            exportAudioEl.currentTime = audioConfig.offset || 0;
            exportAudioEl.volume = audioConfig.volume;

            const sourceNode = audioCtx.createMediaElementSource(exportAudioEl);
            sourceNode.connect(destination);

            const audioTracks = destination.stream.getAudioTracks();
            if (audioTracks.length > 0) {
              mixedStream = new MediaStream([
                ...canvasStream.getVideoTracks(),
                audioTracks[0],
              ]);
            }
          }
        } catch (audioErr) {
          console.warn("Audio mixing warning (continuing video export):", audioErr);
        }
      }

      // 3. Setup MediaRecorder with best supported mime
      let mimeType = "video/webm";
      let fileExt = "webm";
      if (typeof MediaRecorder !== "undefined") {
        if (MediaRecorder.isTypeSupported("video/mp4;codecs=avc1,mp4a.40.2")) {
          mimeType = "video/mp4;codecs=avc1,mp4a.40.2";
          fileExt = "mp4";
        } else if (MediaRecorder.isTypeSupported("video/mp4")) {
          mimeType = "video/mp4";
          fileExt = "mp4";
        } else if (MediaRecorder.isTypeSupported("video/webm;codecs=vp9,opus")) {
          mimeType = "video/webm;codecs=vp9,opus";
          fileExt = "webm";
        } else if (MediaRecorder.isTypeSupported("video/webm;codecs=vp9")) {
          mimeType = "video/webm;codecs=vp9";
          fileExt = "webm";
        } else if (MediaRecorder.isTypeSupported("video/webm")) {
          mimeType = "video/webm";
          fileExt = "webm";
        }
      }

      const mediaRecorder = new MediaRecorder(mixedStream, {
        mimeType,
        videoBitsPerSecond: 8000000,
      });

      const recordedChunks: Blob[] = [];
      mediaRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          recordedChunks.push(e.data);
        }
      };

      const recordPromise = new Promise<Blob>((resolve) => {
        mediaRecorder.onstop = () => {
          const blob = new Blob(recordedChunks, {
            type: mimeType.includes("mp4") ? "video/mp4" : "video/webm",
          });
          resolve(blob);
        };
      });

      if (audioCtx && audioCtx.state === "suspended") {
        await audioCtx.resume();
      }

      if (exportAudioEl) {
        try {
          await exportAudioEl.play();
        } catch {}
      }

      mediaRecorder.start();

      const fps = 30;
      const totalFrames = Math.ceil(totalDuration * fps);
      for (let f = 0; f <= totalFrames; f++) {
        const renderTime = f / fps;
        drawFrame(renderTime);
        setExportProgress(Math.round((f / totalFrames) * 85));
        await new Promise((res) => setTimeout(res, 1000 / fps));
      }

      mediaRecorder.stop();
      if (exportAudioEl) {
        exportAudioEl.pause();
      }
      if (audioCtx) {
        audioCtx.close().catch(() => {});
      }

      const finalBlob = await recordPromise;
      setExportProgress(95);

      const videoUrl = URL.createObjectURL(finalBlob);

      // 4. Capture first slide as high-res thumbnail
      drawFrame(0.1);
      const thumbUrl = canvas.toDataURL("image/jpeg", 0.85);

      // 5. Trigger instant download
      const dlLink = document.createElement("a");
      dlLink.href = videoUrl;
      dlLink.download = `${projectTitle.toLowerCase().replace(/\s+/g, "_")}.${fileExt}`;
      document.body.appendChild(dlLink);
      dlLink.click();
      document.body.removeChild(dlLink);

      // 6. Save to Reel Library state
      const savedReel = {
        id: `reel-${Date.now()}`,
        title: projectTitle,
        category,
        durationSeconds: Math.round(totalDuration),
        resolution: "1080x1920 (9:16)",
        videoUrl,
        thumbnailUrl: thumbUrl,
        createdAt: "Just now",
        viewsCount: "1",
        status: "ready" as const,
        productPrice: `₹${Number(
          overlays.price.replace(/[^0-9]/g, "") || 0
        ).toLocaleString("en-IN")}`,
      };

      onSaveToLibrary(savedReel);
      setIsExporting(false);
    } catch (err) {
      console.error("Export error:", err);
      alert("Export failed. Please try again.");
      setIsExporting(false);
    }
  };

  const selectedSlide: ImageSlide =
    slides.length > 0
      ? slides[Math.min(selectedSlideIndex, slides.length - 1)] || slides[0]
      : fallbackEmptySlide;

  const filteredCatalogTracks = availableTracks.filter((t) => {
    const titleMatch = (t.display_name || t.filename)
      .toLowerCase()
      .includes(catalogSearchQuery.toLowerCase());
    return titleMatch;
  });

  return (
    <div className="reel-editor-workspace">
      {/* ===================================================
          TOP NAVIGATION & STUDIO BAR
          =================================================== */}
      <header className="workspace-header">
        <div className="workspace-header-left">
          <button
            type="button"
            className="workspace-back-button"
            onClick={onClose}
            title="Return to Reel Library"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="back-btn-text">Reel Library</span>
          </button>

          <div className="workspace-title-block">
            <input
              type="text"
              value={projectTitle}
              onChange={(e) => setProjectTitle(e.target.value)}
              className="workspace-title-input"
              placeholder="Untitled Ethnic Reel..."
            />

            <div className="workspace-meta-row">
              <select
                value={category}
                onChange={(e) =>
                  setCategory(
                    e.target.value as
                      | "Sarees"
                      | "Lehengas"
                      | "Kurtis"
                      | "Bridal"
                  )
                }
                className="workspace-category-select"
              >
                <option value="Sarees">Sarees</option>
                <option value="Lehengas">Lehengas</option>
                <option value="Kurtis">Kurtis</option>
                <option value="Bridal">Bridal</option>
              </select>

              <span className="workspace-badge">9:16 VERTICAL REEL</span>
              <span className="workspace-badge mono">1080×1920</span>
              <span className="workspace-badge mono">30 FPS</span>
            </div>
          </div>
        </div>

        <div className="workspace-header-right">
          {/* TIMECODE CHIP */}
          <div className="workspace-timecode-chip">
            <Clock className="w-3.5 h-3.5 text-[#ff681b]" />
            <span className="current-time">{formatTimecode(currentTime)}</span>
            <span className="divider">/</span>
            <span className="total-time">{formatTimecode(totalDuration)}</span>
          </div>

          {/* EXPORT ACTION */}
          <button
            type="button"
            className="workspace-export-btn"
            onClick={handleExportReel}
            disabled={isExporting || slides.length === 0}
            title="Export 9:16 MP4 Reel"
          >
            {isExporting ? (
              <>
                <Film className="w-4 h-4 animate-spin text-[#ff681b]" />
                <span className="btn-label-desktop">RENDERING ({exportProgress}%)...</span>
                <span className="btn-label-mobile">{exportProgress}%</span>
              </>
            ) : (
              <>
                <Download className="w-4 h-4" />
                <span className="btn-label-desktop">EXPORT REEL (MP4)</span>
                <span className="btn-label-mobile">EXPORT</span>
              </>
            )}
          </button>
        </div>
      </header>

      {/* MOBILE SEGMENTED VIEW BAR (<768px) */}
      <nav className="workspace-mobile-tab-bar" aria-label="Editor Panels">
        <button
          type="button"
          className={`workspace-mobile-tab-btn ${
            mobileTab === "canvas" ? "active" : ""
          }`}
          onClick={() => setMobileTab("canvas")}
        >
          <Play className="w-3.5 h-3.5" />
          <span>Canvas</span>
        </button>

        <button
          type="button"
          className={`workspace-mobile-tab-btn ${
            mobileTab === "filmstrip" ? "active" : ""
          }`}
          onClick={() => setMobileTab("filmstrip")}
        >
          <Layers className="w-3.5 h-3.5" />
          <span>Slides ({slides.length})</span>
        </button>

        <button
          type="button"
          className={`workspace-mobile-tab-btn ${
            mobileTab === "inspector" ? "active" : ""
          }`}
          onClick={() => setMobileTab("inspector")}
        >
          <Sliders className="w-3.5 h-3.5" />
          <span>Tools &amp; Logo</span>
        </button>
      </nav>

      {/* ===================================================
          MAIN WORKSPACE BODY
          =================================================== */}
      <div className="workspace-body">
        {/* =================================================
            LEFT: SLIDE FILMSTRIP & MEDIA MANAGER
            ================================================= */}
        <aside
          className={`workspace-filmstrip-panel ${
            mobileTab === "filmstrip" ? "mobile-active" : ""
          }`}
        >
          <div className="filmstrip-panel-header">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-[#ff681b]" />
              <h3>SLIDE TIMELINE</h3>
              <span className="slide-count mono">{slides.length}</span>
            </div>

            <label className="filmstrip-add-btn" title="Add More Photos">
              <Plus className="w-3.5 h-3.5" />
              <span>ADD</span>
              <input
                type="file"
                multiple
                accept="image/jpeg,image/png,image/webp,image/avif,image/jpg"
                hidden
                onChange={handleAddPhotos}
              />
            </label>
          </div>

          <p className="filmstrip-hint">
            Reorder, trim, or assign Ken Burns motion to each photo slide.
          </p>

          <div className="filmstrip-cards-list">
            {slides.length === 0 ? (
              <div className="empty-filmstrip-box">
                <AlertCircle className="w-8 h-8 text-[var(--db-muted)] mb-2" />
                <p className="text-xs text-[var(--db-muted)] text-center mb-3">
                  No photos staged yet. Add photos to start crafting your reel.
                </p>
                <label className="filmstrip-empty-upload-btn">
                  <Upload className="w-3.5 h-3.5" />
                  <span>UPLOAD PHOTOS</span>
                  <input
                    type="file"
                    multiple
                    accept="image/jpeg,image/png,image/webp,image/avif,image/jpg"
                    hidden
                    onChange={handleAddPhotos}
                  />
                </label>
              </div>
            ) : (
              slides.map((slide, idx) => (
                <div
                  key={slide.id}
                  onClick={() => setSelectedSlideIndex(idx)}
                  className={`filmstrip-slide-card ${
                    idx === selectedSlideIndex ? "active" : ""
                  }`}
                >
                  <div className="slide-index-pill mono">#{idx + 1}</div>

                  <div className="slide-card-thumb">
                    <img src={slide.imageUrl} alt={slide.name} />
                  </div>

                  <div className="slide-card-meta">
                    <span className="slide-name" title={slide.name}>
                      {slide.name}
                    </span>

                    <div className="slide-tags">
                      <span className="tag-pill mono">{slide.duration}s</span>
                      <span className="tag-pill uppercase">
                        {slide.motion.replace("_", " ")}
                      </span>
                    </div>
                  </div>

                  <div className="slide-card-actions">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleMoveSlide(idx, -1);
                      }}
                      disabled={idx === 0}
                      title="Move Up"
                    >
                      <MoveLeft className="w-3 h-3 rotate-90" />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleMoveSlide(idx, 1);
                      }}
                      disabled={idx === slides.length - 1}
                      title="Move Down"
                    >
                      <MoveRight className="w-3 h-3 rotate-90" />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDuplicateSlide(idx);
                      }}
                      title="Duplicate Slide"
                    >
                      <Copy className="w-3 h-3" />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRemoveSlide(idx);
                      }}
                      className="delete"
                      title="Delete Slide"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </aside>

        {/* =================================================
            CENTER: 9:16 LIVE INTERACTIVE CANVAS PLAYER
            ================================================= */}
        <section
          className={`workspace-canvas-viewport ${
            mobileTab === "canvas" ? "mobile-active" : ""
          }`}
        >
          <div className="canvas-frame-container">
            {/* CANVAS ASPECT FRAME */}
            <div className="canvas-phone-mockup">
              <canvas
                ref={canvasRef}
                className="workspace-render-canvas"
                width={1080}
                height={1920}
              />
            </div>

            {/* FLOATING CONTROLS & TIMELINE SCRUBBER */}
            <div className="canvas-timeline-controls">
              {/* INTERACTIVE PLAYHEAD SCRUBBER */}
              <div
                className="timeline-scrub-bar"
                onClick={(e) => {
                  if (totalDuration <= 0) return;
                  const rect = e.currentTarget.getBoundingClientRect();
                  const clickX = e.clientX - rect.left;
                  const ratio = Math.max(0, Math.min(1, clickX / rect.width));
                  setCurrentTime(ratio * totalDuration);
                }}
              >
                <div
                  className="timeline-progress-fill"
                  style={{
                    width: `${(currentTime / totalDuration) * 100}%`,
                  }}
                />

                {/* Slide boundary markers */}
                {slides.map((s, i) => {
                  const pastTime = slides
                    .slice(0, i + 1)
                    .reduce((a, b) => a + b.duration, 0);
                  const pct = (pastTime / totalDuration) * 100;
                  return (
                    <div
                      key={s.id}
                      className="timeline-marker"
                      style={{ left: `${pct}%` }}
                    />
                  );
                })}

                {/* Playhead thumb */}
                <div
                  className="timeline-playhead-needle"
                  style={{
                    left: `${(currentTime / totalDuration) * 100}%`,
                  }}
                />
              </div>

              {/* ACTION BUTTONS ROW */}
              <div className="timeline-buttons-row">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className="timeline-btn"
                    onClick={() =>
                      setCurrentTime((prev) => Math.max(0, prev - 0.5))
                    }
                    title="Back 0.5s"
                  >
                    -0.5s
                  </button>

                  <button
                    type="button"
                    className="timeline-play-btn"
                    onClick={() => setIsPlaying(!isPlaying)}
                  >
                    {isPlaying ? (
                      <Pause className="w-5 h-5" />
                    ) : (
                      <Play className="w-5 h-5 ml-0.5" />
                    )}
                  </button>

                  <button
                    type="button"
                    className="timeline-btn"
                    onClick={() =>
                      setCurrentTime((prev) =>
                        Math.min(totalDuration, prev + 0.5)
                      )
                    }
                    title="Forward 0.5s"
                  >
                    +0.5s
                  </button>

                  <button
                    type="button"
                    className="timeline-btn"
                    onClick={() => {
                      setCurrentTime(0);
                      if (timelineAudioRef.current) {
                        timelineAudioRef.current.currentTime =
                          audioConfig.offset || 0;
                      }
                    }}
                    title="Restart"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="timeline-meta-center mono">
                  <span>{formatTimecode(currentTime)}</span>
                  <span className="text-[rgba(255,255,255,0.3)]">/</span>
                  <span className="text-[rgba(255,255,255,0.6)]">
                    {formatTimecode(totalDuration)}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className={`timeline-btn ${isLooping ? "active" : ""}`}
                    onClick={() => setIsLooping(!isLooping)}
                    title="Toggle Loop"
                  >
                    LOOP
                  </button>

                  <button
                    type="button"
                    className={`timeline-btn ${isMuted ? "muted" : ""}`}
                    onClick={() => setIsMuted(!isMuted)}
                    title="Mute / Unmute"
                  >
                    {isMuted ? (
                      <VolumeX className="w-4 h-4 text-red-400" />
                    ) : (
                      <Volume2 className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* =================================================
            RIGHT: INSPECTOR WORKSTATION TABS
            ================================================= */}
        <aside
          className={`workspace-inspector-panel ${
            mobileTab === "inspector" ? "mobile-active" : ""
          }`}
        >
          {/* TAB HEADER */}
          <div className="inspector-tabs-header">
            <button
              type="button"
              className={`inspector-tab ${
                activeInspectorTab === "timing" ? "active" : ""
              }`}
              onClick={() => setActiveInspectorTab("timing")}
            >
              <Clock className="w-4 h-4" />
              <span>TIMING &amp; MOTION</span>
            </button>

            <button
              type="button"
              className={`inspector-tab ${
                activeInspectorTab === "overlays" ? "active" : ""
              }`}
              onClick={() => setActiveInspectorTab("overlays")}
            >
              <ImageIcon className="w-4 h-4" />
              <span>LOGO &amp; OVERLAYS</span>
            </button>

            <button
              type="button"
              className={`inspector-tab ${
                activeInspectorTab === "audio" ? "active" : ""
              }`}
              onClick={() => setActiveInspectorTab("audio")}
            >
              <Music className="w-4 h-4" />
              <span>SOUNDTRACK</span>
            </button>
          </div>

          {/* TAB 1: TIMING & MOTION */}
          {activeInspectorTab === "timing" && (
            <div className="inspector-tab-content">
              {/* CONSOLIDATED SLIDE TIMING & PACING */}
              {slides.length > 0 && selectedSlide && (
                <div className="inspector-card">
                  <div className="flex items-center justify-between mb-2.5">
                    <div className="flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-[#ff681b]" />
                      <span className="inspector-card-title text-[#faf7f2] mb-0">
                        SLIDE TIMING &amp; PACING
                      </span>
                    </div>
                    <span className="text-[11px] mono text-[rgba(255,255,255,0.7)] font-semibold">
                      Total: {totalDuration.toFixed(1)}s
                    </span>
                  </div>

                  <div className="flex items-center justify-between py-2 px-3 bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.07)] rounded-lg mb-3">
                    <div className="min-w-0">
                      <span className="text-[10px] uppercase font-bold text-[var(--db-muted)] tracking-wider block">
                        Slide #{selectedSlideIndex + 1}
                      </span>
                      <strong className="text-xs text-[#faf7f2] truncate block font-medium">
                        {selectedSlide.name}
                      </strong>
                    </div>
                    <span className="text-xs mono font-bold text-[#ff681b] px-2.5 py-1 bg-[rgba(255,104,27,0.12)] border border-[rgba(255,104,27,0.3)] rounded">
                      {selectedSlide.duration.toFixed(1)}s
                    </span>
                  </div>

                  {/* SLIDER */}
                  <div className="mb-3">
                    <div className="flex justify-between items-center mb-1">
                      <label className="text-xs text-[var(--db-muted)]">
                        Slide Duration
                      </label>
                      <span className="text-[10px] text-[rgba(255,255,255,0.4)] mono">
                        0.5s – 6.0s
                      </span>
                    </div>
                    <input
                      type="range"
                      min="0.5"
                      max="6.0"
                      step="0.1"
                      value={selectedSlide.duration}
                      onChange={(e) =>
                        updateSelectedSlide({
                          duration: parseFloat(e.target.value),
                        })
                      }
                      className="w-full accent-[#ff681b]"
                    />
                  </div>

                  {/* PRESET CHIPS */}
                  <div className="mb-3">
                    <label className="text-[11px] text-[var(--db-muted)] block mb-1.5 font-medium">
                      Duration Presets
                    </label>
                    <div className="grid grid-cols-4 gap-1.5">
                      {DURATION_PRESETS.map((dur) => (
                        <button
                          key={dur}
                          type="button"
                          onClick={() => updateSelectedSlide({ duration: dur })}
                          className={`preset-btn mono ${
                            selectedSlide.duration === dur ? "active" : ""
                          }`}
                        >
                          {dur}s
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* APPLY TO ALL SLIDES */}
                  <button
                    type="button"
                    onClick={() =>
                      handleApplyDurationToAll(selectedSlide.duration)
                    }
                    className="apply-all-btn mb-4"
                  >
                    APPLY {selectedSlide.duration.toFixed(1)}s TO ALL {slides.length} SLIDES
                  </button>

                  {/* BATCH PACING PRESETS */}
                  <div className="pt-3 border-t border-[rgba(255,255,255,0.08)]">
                    <span className="text-[10px] font-bold text-[rgba(255,255,255,0.5)] uppercase tracking-wider block mb-2">
                      Batch Pacing Presets (All Slides)
                    </span>
                    <div className="grid grid-cols-3 gap-1.5">
                      {PACING_MODES.map((mode) => (
                        <button
                          key={mode.id}
                          type="button"
                          onClick={() => handleApplyDurationToAll(mode.perSlide)}
                          className="p-2 bg-[rgba(255,255,255,0.03)] hover:bg-[rgba(255,255,255,0.07)] border border-[rgba(255,255,255,0.08)] hover:border-[rgba(255,104,27,0.4)] rounded-lg text-left transition-all"
                          title={mode.desc}
                        >
                          <strong className="block text-[11px] text-[#faf7f2] font-semibold truncate">
                            {mode.label}
                          </strong>
                          <span className="block text-[10px] text-[var(--db-muted)] mono mt-0.5">
                            {mode.perSlide}s / slide
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* MOTION EFFECT */}
              {slides.length > 0 && (
                <div className="inspector-card">
                  <span className="inspector-card-title">
                    CINEMATIC MOTION (KEN BURNS)
                  </span>
                  <p className="text-xs text-[var(--db-muted)] mb-3">
                    Applies dynamic camera movement across this slide frame.
                  </p>

                  <div className="grid grid-cols-2 gap-2">
                    {(
                      [
                        { id: "zoom_in", label: "Zoom In", desc: "Hero Focus" },
                        {
                          id: "zoom_out",
                          label: "Zoom Out",
                          desc: "Reveal Drape",
                        },
                        {
                          id: "pan_right",
                          label: "Pan Right",
                          desc: "Border Flow",
                        },
                        {
                          id: "pan_left",
                          label: "Pan Left",
                          desc: "Embroidery",
                        },
                        { id: "static", label: "Static", desc: "Still Portrait" },
                      ] as const
                    ).map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => updateSelectedSlide({ motion: m.id })}
                        className={`motion-select-btn ${
                          selectedSlide.motion === m.id ? "active" : ""
                        }`}
                      >
                        <strong>{m.label}</strong>
                        <span>{m.desc}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* TRANSITION TO NEXT */}
              {slides.length > 0 && (
                <div className="inspector-card">
                  <span className="inspector-card-title">
                    TRANSITION TO NEXT
                  </span>
                  <div className="grid grid-cols-3 gap-2 mt-2">
                    {(
                      [
                        { id: "cut", label: "Cut" },
                        { id: "crossfade", label: "Crossfade" },
                        { id: "slide", label: "Slide" },
                      ] as const
                    ).map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => updateSelectedSlide({ transition: t.id })}
                        className={`transition-select-btn ${
                          selectedSlide.transition === t.id ? "active" : ""
                        }`}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* FIT MODE */}
              {slides.length > 0 && (
                <div className="inspector-card">
                  <span className="inspector-card-title">ASPECT FRAMING</span>
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    <button
                      type="button"
                      onClick={() => updateSelectedSlide({ fitMode: "cover" })}
                      className={`transition-select-btn ${
                        selectedSlide.fitMode === "cover" ? "active" : ""
                      }`}
                    >
                      Fill (Cover 9:16)
                    </button>
                    <button
                      type="button"
                      onClick={() => updateSelectedSlide({ fitMode: "contain" })}
                      className={`transition-select-btn ${
                        selectedSlide.fitMode === "contain" ? "active" : ""
                      }`}
                    >
                      Fit (Blurred Ambient)
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: OVERLAYS & TYPOGRAPHY */}
          {activeInspectorTab === "overlays" && (
            <div className="inspector-tab-content">
              {/* BRAND LOGO WATERMARK SECTION */}
              <div className="inspector-card">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-1.5">
                    <ImageIcon className="w-3.5 h-3.5 text-[#ff681b]" />
                    <span className="inspector-card-title text-[#faf7f2] mb-0">
                      BRAND LOGO ON REEL
                    </span>
                  </div>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={overlays.showLogo}
                      onChange={(e) =>
                        setOverlays({
                          ...overlays,
                          showLogo: e.target.checked,
                        })
                      }
                      className="accent-[#ff681b]"
                    />
                    <span className="text-xs text-[var(--db-muted)] font-medium">Show</span>
                  </label>
                </div>

                <p className="text-xs text-[var(--db-muted)] mb-3">
                  Upload your boutique logo from your computer and position it anywhere on the reel.
                </p>

                {/* UPLOAD & PREVIEW AREA */}
                {overlays.logoUrl ? (
                  <div className="space-y-2 mb-3">
                    <div className="logo-preview-card">
                      <div className="logo-thumbnail-box">
                        <img
                          src={overlays.logoUrl}
                          alt="Brand Logo"
                        />
                      </div>
                      <div className="logo-meta-details">
                        <strong>
                          {overlays.logoFileName || "Custom Brand Logo"}
                        </strong>
                        <span>
                          {Math.round(overlays.logoSize)}px ·{" "}
                          {Math.round(overlays.logoOpacity * 100)}% opacity
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <label
                          className="text-xs text-[#ff681b] hover:text-[#ff7d3b] font-semibold px-2 py-1 cursor-pointer"
                          title="Replace Logo"
                        >
                          Change
                          <input
                            type="file"
                            accept="image/png,image/jpeg,image/svg+xml,image/webp"
                            hidden
                            onChange={handleLogoUpload}
                          />
                        </label>
                        <button
                          type="button"
                          className="text-xs text-red-400 hover:text-red-300 font-semibold px-2 py-1"
                          onClick={() =>
                            setOverlays({
                              ...overlays,
                              logoUrl: null,
                              logoFileName: "",
                            })
                          }
                          title="Remove Logo"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2 mb-3">
                    <label className="logo-dropzone">
                      <Upload className="w-5 h-5 text-[#ff681b] mb-1" />
                      <strong>Upload Logo from Computer</strong>
                      <span>PNG (transparent recommended), SVG, JPG, WEBP</span>
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/svg+xml,image/webp"
                        hidden
                        onChange={handleLogoUpload}
                      />
                    </label>

                    <div className="flex items-center justify-between pt-1">
                      <span className="text-[11px] text-[var(--db-muted)]">
                        Want a quick test?
                      </span>
                      <button
                        type="button"
                        onClick={handleUseSampleLogo}
                        className="sample-logo-btn"
                      >
                        Use Sample Luxury Logo
                      </button>
                    </div>
                  </div>
                )}

                {/* POSITION SELECTOR MATRIX: Top, Left, Right, Down */}
                {overlays.showLogo && (
                  <div className="space-y-3">
                    <div>
                      <div className="flex justify-between items-center mb-1.5">
                        <label className="text-xs text-[var(--db-muted)] font-medium">
                          Logo Position on Reel
                        </label>
                        <span className="text-[11px] mono text-[#ff681b] font-semibold capitalize">
                          {overlays.logoPosition.replace("-", " ")}
                        </span>
                      </div>

                      <div className="logo-position-matrix">
                        {[
                          { id: "top-left", arrow: "↖", label: "Top Left" },
                          { id: "top", arrow: "↑", label: "Top" },
                          { id: "top-right", arrow: "↗", label: "Top Right" },
                          { id: "left", arrow: "←", label: "Left" },
                          { id: "center", arrow: "⊙", label: "Center" },
                          { id: "right", arrow: "→", label: "Right" },
                          { id: "bottom-left", arrow: "↙", label: "Bottom Left" },
                          { id: "down", arrow: "↓", label: "Down" },
                          { id: "bottom-right", arrow: "↘", label: "Bottom Right" },
                        ].map((pos) => (
                          <button
                            key={pos.id}
                            type="button"
                            onClick={() =>
                              setOverlays({
                                ...overlays,
                                logoPosition: pos.id as LogoPosition,
                              })
                            }
                            className={`logo-pos-btn ${
                              overlays.logoPosition === pos.id ? "active" : ""
                            }`}
                          >
                            <span className="pos-arrow">{pos.arrow}</span>
                            <span className="pos-label">{pos.label}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* SIZE SLIDER */}
                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <label className="text-xs text-[var(--db-muted)]">
                          Logo Size
                        </label>
                        <span className="text-xs mono font-bold text-[#ff681b]">
                          {Math.round(overlays.logoSize)}px
                        </span>
                      </div>
                      <input
                        type="range"
                        min="60"
                        max="260"
                        step="5"
                        value={overlays.logoSize}
                        onChange={(e) =>
                          setOverlays({
                            ...overlays,
                            logoSize: parseFloat(e.target.value),
                          })
                        }
                        className="w-full accent-[#ff681b]"
                      />
                      <div className="grid grid-cols-3 gap-1.5 mt-1.5">
                        {[
                          { label: "Small", size: 85 },
                          { label: "Medium", size: 130 },
                          { label: "Large", size: 190 },
                        ].map((preset) => (
                          <button
                            key={preset.size}
                            type="button"
                            onClick={() =>
                              setOverlays({
                                ...overlays,
                                logoSize: preset.size,
                              })
                            }
                            className={`preset-btn mono ${
                              Math.round(overlays.logoSize) === preset.size
                                ? "active"
                                : ""
                            }`}
                          >
                            {preset.label} ({preset.size}px)
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* OPACITY SLIDER */}
                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <label className="text-xs text-[var(--db-muted)]">
                          Logo Opacity / Transparency
                        </label>
                        <span className="text-xs mono font-bold text-[#ff681b]">
                          {Math.round(overlays.logoOpacity * 100)}%
                        </span>
                      </div>
                      <input
                        type="range"
                        min="0.2"
                        max="1.0"
                        step="0.05"
                        value={overlays.logoOpacity}
                        onChange={(e) =>
                          setOverlays({
                            ...overlays,
                            logoOpacity: parseFloat(e.target.value),
                          })
                        }
                        className="w-full accent-[#ff681b]"
                      />
                      <div className="grid grid-cols-4 gap-1.5 mt-1.5">
                        {[0.5, 0.75, 0.9, 1.0].map((op) => (
                          <button
                            key={op}
                            type="button"
                            onClick={() =>
                              setOverlays({
                                ...overlays,
                                logoOpacity: op,
                              })
                            }
                            className={`preset-btn mono ${
                              overlays.logoOpacity === op ? "active" : ""
                            }`}
                          >
                            {Math.round(op * 100)}%
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* HEADLINE */}
              <div className="inspector-card">
                <span className="inspector-card-title">
                  PRODUCT HEADLINE &amp; DETAILS
                </span>

                <div className="space-y-3 mt-2">
                  <div>
                    <label className="text-xs text-[var(--db-muted)]">
                      Main Title
                    </label>
                    <input
                      type="text"
                      value={overlays.title}
                      onChange={(e) =>
                        setOverlays({ ...overlays, title: e.target.value })
                      }
                      className="inspector-input"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-xs text-[var(--db-muted)]">
                        Typography
                      </label>
                      <select
                        value={overlays.titleFont}
                        onChange={(e) =>
                          setOverlays({
                            ...overlays,
                            titleFont: e.target.value as "Space Grotesk" | "Sora",
                          })
                        }
                        className="inspector-select"
                      >
                        <option value="Space Grotesk">Space Grotesk</option>
                        <option value="Sora">Sora</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-xs text-[var(--db-muted)]">
                        Position
                      </label>
                      <select
                        value={overlays.titlePosition}
                        onChange={(e) =>
                          setOverlays({
                            ...overlays,
                            titlePosition: e.target.value as
                              | "top"
                              | "center"
                              | "bottom",
                          })
                        }
                        className="inspector-select"
                      >
                        <option value="bottom">Bottom Third</option>
                        <option value="center">Center</option>
                        <option value="top">Top Header</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="text-xs text-[var(--db-muted)]">
                      Fabric &amp; Artisan Notes (Subtitle)
                    </label>
                    <input
                      type="text"
                      value={overlays.subtitle}
                      onChange={(e) =>
                        setOverlays({ ...overlays, subtitle: e.target.value })
                      }
                      className="inspector-input"
                    />
                  </div>
                </div>
              </div>

              {/* INDIAN RUPEE PRICE TAG */}
              <div className="inspector-card">
                <div className="flex justify-between items-center mb-2">
                  <span className="inspector-card-title">
                    PRICE TAG BADGE (₹)
                  </span>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={overlays.showPriceTag}
                      onChange={(e) =>
                        setOverlays({
                          ...overlays,
                          showPriceTag: e.target.checked,
                        })
                      }
                      className="accent-[#ff681b]"
                    />
                    <span className="text-xs text-[var(--db-muted)]">Show</span>
                  </label>
                </div>

                {overlays.showPriceTag && (
                  <div className="space-y-3 mt-2">
                    <div>
                      <label className="text-xs text-[var(--db-muted)]">
                        Price in Rupees (₹)
                      </label>
                      <div className="relative">
                        <span className="absolute left-3 top-2 text-[#ff681b] font-bold">
                          ₹
                        </span>
                        <input
                          type="text"
                          value={overlays.price}
                          onChange={(e) =>
                            setOverlays({
                              ...overlays,
                              price: e.target.value.replace(/[^0-9]/g, ""),
                            })
                          }
                          placeholder="18500"
                          className="inspector-input pl-8 mono"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-xs text-[var(--db-muted)]">
                        Badge Style
                      </label>
                      <div className="grid grid-cols-3 gap-1.5 mt-1">
                        {(
                          [
                            { id: "gold", label: "Gold Zari" },
                            { id: "obsidian", label: "Obsidian" },
                            { id: "minimal", label: "White Pill" },
                          ] as const
                        ).map((s) => (
                          <button
                            key={s.id}
                            type="button"
                            onClick={() =>
                              setOverlays({ ...overlays, priceBadgeStyle: s.id })
                            }
                            className={`transition-select-btn ${
                              overlays.priceBadgeStyle === s.id ? "active" : ""
                            }`}
                          >
                            {s.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* BOUTIQUE WATERMARK & CTA */}
              <div className="inspector-card">
                <span className="inspector-card-title">
                  BOUTIQUE BRANDING &amp; BADGE
                </span>

                <div className="space-y-3 mt-2">
                  <div>
                    <label className="text-xs text-[var(--db-muted)]">
                      Brand Name
                    </label>
                    <input
                      type="text"
                      value={overlays.brandName}
                      onChange={(e) =>
                        setOverlays({ ...overlays, brandName: e.target.value })
                      }
                      className="inspector-input uppercase tracking-wider"
                    />
                  </div>

                  <div>
                    <label className="text-xs text-[var(--db-muted)]">
                      Text Watermark Position
                    </label>
                    <select
                      value={overlays.brandWatermarkPosition}
                      onChange={(e) =>
                        setOverlays({
                          ...overlays,
                          brandWatermarkPosition: e.target.value as any,
                        })
                      }
                      className="inspector-select"
                    >
                      <option value="top-right">Top Right</option>
                      <option value="top-left">Top Left</option>
                      <option value="bottom-center">Bottom Center</option>
                      <option value="none">Hidden</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-xs text-[var(--db-muted)]">
                      Callout Badge Text
                    </label>
                    <input
                      type="text"
                      value={overlays.ctaText}
                      onChange={(e) =>
                        setOverlays({ ...overlays, ctaText: e.target.value })
                      }
                      className="inspector-input"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: SOUNDTRACK & AUDIO ("CHOOSE ANY SONG IN THE WORLD") */}
          {activeInspectorTab === "audio" && (
            <div className="inspector-tab-content">
              {/* ACTIVE SOUNDTRACK STATUS & HOOK OFFSET */}
              <div className="inspector-card">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-1.5">
                    <Music className="w-3.5 h-3.5 text-[#ff681b]" />
                    <span className="inspector-card-title text-[#faf7f2] mb-0">
                      ACTIVE SOUNDTRACK
                    </span>
                  </div>
                  {audioConfig.trackUrl && (
                    <span className="text-[10px] mono text-emerald-400 font-semibold px-2 py-0.5 bg-[rgba(52,211,153,0.1)] border border-[rgba(52,211,153,0.25)] rounded">
                      SYNCED
                    </span>
                  )}
                </div>

                {audioConfig.trackUrl ? (
                  <>
                    <div className="flex items-center justify-between p-2.5 bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.07)] rounded-lg mb-3">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-8 h-8 rounded-lg bg-[rgba(255,104,27,0.12)] border border-[rgba(255,104,27,0.25)] flex items-center justify-center text-[#ff681b] shrink-0">
                          <Music className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <strong className="block text-xs text-[#faf7f2] truncate font-medium">
                            {audioConfig.trackTitle || "Selected Soundtrack"}
                          </strong>
                          <span className="text-[10px] text-[var(--db-muted)] mono block mt-0.5">
                            {customAudioFileMeta?.size || "Active Audio Stream"}
                          </span>
                        </div>
                      </div>

                      <button
                        type="button"
                        className="text-xs text-red-400 hover:text-red-300 font-semibold px-2 py-1 transition-colors"
                        onClick={() =>
                          setAudioConfig({
                            trackId: null,
                            trackTitle: "No audio selected",
                            trackUrl: null,
                            volume: 0.85,
                            offset: 0,
                          })
                        }
                      >
                        Remove
                      </button>
                    </div>

                    {/* VOLUME & HOOK OFFSET */}
                    <div className="space-y-3">
                      <div>
                        <div className="flex justify-between items-center mb-1">
                          <label className="text-xs text-[var(--db-muted)]">
                            Soundtrack Volume
                          </label>
                          <span className="text-xs mono font-bold text-[#ff681b]">
                            {Math.round(audioConfig.volume * 100)}%
                          </span>
                        </div>
                        <input
                          type="range"
                          min="0"
                          max="1"
                          step="0.05"
                          value={audioConfig.volume}
                          onChange={(e) =>
                            setAudioConfig({
                              ...audioConfig,
                              volume: parseFloat(e.target.value),
                            })
                          }
                          className="w-full accent-[#ff681b]"
                        />
                      </div>

                      <div>
                        <div className="flex justify-between items-center mb-1">
                          <label className="text-xs text-[var(--db-muted)]">
                            Start Hook (Cue Offset)
                          </label>
                          <span className="text-xs mono font-bold text-[#ff681b]">
                            {audioConfig.offset.toFixed(1)}s ({formatTimecode(audioConfig.offset)})
                          </span>
                        </div>
                        <input
                          type="range"
                          min="0"
                          max="120"
                          step="0.5"
                          value={audioConfig.offset}
                          onChange={(e) =>
                            setAudioConfig({
                              ...audioConfig,
                              offset: parseFloat(e.target.value),
                            })
                          }
                          className="w-full accent-[#ff681b]"
                        />

                        {/* HOOK OFFSET QUICK PRESETS */}
                        <div className="grid grid-cols-4 gap-1.5 mt-2">
                          {[
                            { label: "0:00 Intro", sec: 0 },
                            { label: "0:15 Hook", sec: 15 },
                            { label: "0:30 Chorus", sec: 30 },
                            { label: "0:45 Drop", sec: 45 },
                          ].map((cue) => (
                            <button
                              key={cue.sec}
                              type="button"
                              onClick={() =>
                                setAudioConfig({
                                  ...audioConfig,
                                  offset: cue.sec,
                                })
                              }
                              className={`preset-btn mono ${
                                Math.round(audioConfig.offset) === cue.sec
                                  ? "active"
                                  : ""
                              }`}
                            >
                              {cue.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="p-4 bg-[rgba(255,255,255,0.02)] border border-dashed border-[rgba(255,255,255,0.08)] rounded-lg text-center mt-1">
                    <Music className="w-5 h-5 text-[var(--db-muted)] mx-auto mb-1.5 opacity-50" />
                    <span className="text-xs text-[#faf7f2] font-medium block">
                      No Soundtrack Selected
                    </span>
                    <span className="text-[11px] text-[var(--db-muted)] block mt-0.5">
                      Pick a track below to sync audio to your reel
                    </span>
                  </div>
                )}
              </div>

              {/* SOUNDTRACK LIBRARY & AUDIO INGESTION */}
              <div className="inspector-card">
                <span className="inspector-card-title">
                  SOUNDTRACK LIBRARY &amp; AUDIO INGESTION
                </span>
                <p className="text-xs text-[var(--db-muted)] mb-3">
                  Select from curated fusion tracks, upload a local audio file, or stream from a direct URL.
                </p>

                {/* Sub-tabs */}
                <div className="audio-subtabs-nav">
                  <button
                    type="button"
                    className={`audio-subtab-btn ${
                      audioSourceTab === "catalog" ? "active" : ""
                    }`}
                    onClick={() => setAudioSourceTab("catalog")}
                  >
                    <Music className="w-3.5 h-3.5" />
                    <span>Curated Catalog</span>
                  </button>
                  <button
                    type="button"
                    className={`audio-subtab-btn ${
                      audioSourceTab === "upload" ? "active" : ""
                    }`}
                    onClick={() => setAudioSourceTab("upload")}
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>My Device</span>
                  </button>
                  <button
                    type="button"
                    className={`audio-subtab-btn ${
                      audioSourceTab === "url" ? "active" : ""
                    }`}
                    onClick={() => setAudioSourceTab("url")}
                  >
                    <Globe className="w-3.5 h-3.5" />
                    <span>Audio Link</span>
                  </button>
                </div>

                {/* OPTION 1: CURATED CATALOG */}
                {audioSourceTab === "catalog" && (
                  <div>
                    {/* Search Bar with dedicated no-overlap styling */}
                    <div className="inspector-search-wrap">
                      <Search className="inspector-search-icon w-3.5 h-3.5" />
                      <input
                        type="text"
                        value={catalogSearchQuery}
                        onChange={(e) => setCatalogSearchQuery(e.target.value)}
                        placeholder="Search curated ethnic tracks..."
                        className="inspector-search-input"
                      />
                    </div>

                    <div className="soundtrack-catalog-scroll">
                      {filteredCatalogTracks.length === 0 ? (
                        <p className="text-xs text-[var(--db-muted)] text-center py-6">
                          No matching tracks found.
                        </p>
                      ) : (
                        filteredCatalogTracks.map((track) => {
                          const isSelected = audioConfig.trackId === track.id;
                          const isPreviewing =
                            playingAudioPreviewId === track.id;

                          return (
                            <div
                              key={track.id}
                              onClick={() =>
                                setAudioConfig({
                                  ...audioConfig,
                                  trackId: track.id,
                                  trackTitle:
                                    track.display_name || track.filename,
                                  trackUrl: musicPreviewUrl(track.id),
                                  offset: 0,
                                })
                              }
                              className={`soundtrack-item ${
                                isSelected ? "active" : ""
                              }`}
                            >
                              <button
                                type="button"
                                className="soundtrack-preview-btn"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (isPreviewing) {
                                    previewAudioRef.current?.pause();
                                    setPlayingAudioPreviewId(null);
                                  } else {
                                    if (!previewAudioRef.current) {
                                      previewAudioRef.current = new Audio();
                                    }
                                    previewAudioRef.current.src =
                                      musicPreviewUrl(track.id);
                                    previewAudioRef.current.play();
                                    setPlayingAudioPreviewId(track.id);
                                  }
                                }}
                              >
                                {isPreviewing ? (
                                  <Pause className="w-3.5 h-3.5 text-[#ff681b]" />
                                ) : (
                                  <Play className="w-3.5 h-3.5" />
                                )}
                              </button>

                              <div className="soundtrack-info">
                                <strong>
                                  {track.display_name || track.filename}
                                </strong>
                                <span className="mono">
                                  {track.duration
                                    ? `${Math.round(track.duration)}s`
                                    : "Ethnic Fusion"}
                                </span>
                              </div>

                              {isSelected && (
                                <div className="soundtrack-check">
                                  <Check className="w-4 h-4 text-[#ff681b]" />
                                </div>
                              )}
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                )}

                {/* OPTION 2: UPLOAD ANY SONG FROM DEVICE */}
                {audioSourceTab === "upload" && (
                  <div className="space-y-2">
                    <label className="any-audio-dropzone">
                      <FileAudio className="w-6 h-6 text-[#ff681b] mb-1" />
                      <strong>Upload Any Audio File</strong>
                      <span>
                        Supports MP3, WAV, M4A, AAC, FLAC, OGG &amp; OPUS
                      </span>
                      <input
                        type="file"
                        accept="audio/*,.mp3,.wav,.m4a,.aac,.flac,.ogg,.weba,.opus"
                        hidden
                        onChange={handleDeviceAudioUpload}
                      />
                    </label>

                    {customAudioFileMeta && (
                      <div className="uploaded-meta-chip">
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        <span className="truncate">
                          {customAudioFileMeta.name} ({customAudioFileMeta.size})
                        </span>
                      </div>
                    )}
                  </div>
                )}

                {/* OPTION 3: DIRECT AUDIO LINK */}
                {audioSourceTab === "url" && (
                  <div className="space-y-2">
                    <label className="text-xs text-[var(--db-muted)]">
                      Paste Direct Audio URL
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="url"
                        value={customAudioUrlInput}
                        onChange={(e) => setCustomAudioUrlInput(e.target.value)}
                        placeholder="https://example.com/soundtrack.mp3"
                        className="inspector-input text-xs"
                      />
                      <button
                        type="button"
                        onClick={handleApplyWebAudioUrl}
                        className="load-audio-url-btn"
                      >
                        LOAD
                      </button>
                    </div>

                    {customAudioUrlError && (
                      <p className="text-xs text-red-400 flex items-center gap-1 mt-1">
                        <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                        <span>{customAudioUrlError}</span>
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </aside>
      </div>

      {/* HIDDEN SYNC AUDIO ELEMENT */}
      {audioConfig.trackUrl && (
        <audio
          ref={timelineAudioRef}
          src={audioConfig.trackUrl}
          preload="auto"
          loop={isLooping}
        />
      )}
    </div>
  );
}
