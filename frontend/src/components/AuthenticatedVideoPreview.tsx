import React, { useCallback, useEffect, useRef, useState } from "react";
import { isAxiosError } from "axios";
import { api } from "../api";

export interface AuthenticatedVideoPreviewProps {
  videoUrl: string;
  title?: string;
  controls?: boolean;
  autoPlay?: boolean;
  loop?: boolean;
  muted?: boolean;
  playsInline?: boolean;
  className?: string;
  videoRef?: React.Ref<HTMLVideoElement>;
  onLoadStart?: () => void;
  onCanPlay?: () => void;
  onPlaying?: () => void;
  onError?: () => void;
  loadingFallback?: React.ReactNode;
  unavailableFallback?: React.ReactNode;
}

export function AuthenticatedVideoPreview({
  videoUrl,
  title = "Video preview",
  controls = false,
  autoPlay = false,
  loop = false,
  muted = true,
  playsInline = true,
  className,
  videoRef,
  onLoadStart,
  onCanPlay,
  onPlaying,
  onError,
  loadingFallback,
  unavailableFallback,
}: AuthenticatedVideoPreviewProps) {
  const [blobUrl, setBlobUrl] = useState<string>("");
  const [failed, setFailed] = useState<boolean>(false);
  const internalVideoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    let objectUrl: string | undefined;

    setBlobUrl("");
    setFailed(false);

    if (!videoUrl) {
      setFailed(true);
      onError?.();
      return () => controller.abort();
    }

    if (videoUrl.startsWith("blob:") || videoUrl.startsWith("data:")) {
      setBlobUrl(videoUrl);
      return () => controller.abort();
    }

    onLoadStart?.();

    api
      .get<Blob>(videoUrl, {
        responseType: "blob",
        signal: controller.signal,
      })
      .then((response) => {
        if (controller.signal.aborted) return;

        objectUrl = URL.createObjectURL(response.data);
        setBlobUrl(objectUrl);
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;

        if (isAxiosError(error) && error.response?.status === 401) {
          console.error(
            "Video preview unauthorized (401). Authentication token may be expired or missing."
          );
        } else {
          console.error("Failed to load authenticated video:", error);
        }
        setFailed(true);
        onError?.();
      });

    return () => {
      controller.abort();

      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [videoUrl]);

  useEffect(() => {
    if (internalVideoRef.current) {
      internalVideoRef.current.muted = muted;
    }
  }, [muted]);

  const setCombinedRef = useCallback(
    (el: HTMLVideoElement | null) => {
      internalVideoRef.current = el;
      if (typeof videoRef === "function") {
        videoRef(el);
      } else if (videoRef && typeof videoRef === "object" && "current" in videoRef) {
        (videoRef as React.MutableRefObject<HTMLVideoElement | null>).current = el;
      }
    },
    [videoRef]
  );

  if (failed) {
    return (
      unavailableFallback ?? (
        <span className="list-thumbnail-empty" role="status">
          Video unavailable
        </span>
      )
    );
  }

  if (!blobUrl) {
    return (
      loadingFallback ?? (
        <span className="list-thumbnail-empty" role="status">
          Loading video…
        </span>
      )
    );
  }

  return (
    <video
      ref={setCombinedRef}
      src={blobUrl}
      controls={controls}
      autoPlay={autoPlay}
      loop={loop}
      muted={muted}
      playsInline={playsInline}
      preload="metadata"
      className={className}
      aria-label={`${title} video`}
      onLoadStart={onLoadStart}
      onCanPlay={onCanPlay}
      onPlaying={onPlaying}
      onError={() => {
        setFailed(true);
        onError?.();
      }}
    />
  );
}

export default AuthenticatedVideoPreview;
