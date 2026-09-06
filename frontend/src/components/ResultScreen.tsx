import { reelFileUrl } from "../api";
import type { ReelResult } from "../types";

interface ResultScreenProps {
  reel: ReelResult;
  onGenerateAnother: () => void;
}

export default function ResultScreen({ reel, onGenerateAnother }: ResultScreenProps) {
  const fileUrl = reelFileUrl(reel.reel_id);

  return (
    <div className="max-w-md w-full mx-auto px-4 py-10 space-y-6">
      <div className="text-center space-y-1">
        <h2 className="text-2xl font-semibold text-slate-100">Your Reel is Ready</h2>
        <p className="text-slate-500 text-sm">Publish-ready for Instagram, Facebook &amp; YouTube Shorts</p>
      </div>

      <div className="mx-auto w-full max-w-[280px] aspect-9/16 rounded-xl overflow-hidden border border-slate-800 bg-black">
        <video src={fileUrl} controls className="h-full w-full object-contain" />
      </div>

      <div className="grid grid-cols-2 gap-3 text-center">
        <div className="rounded-lg border border-slate-800 bg-slate-900/40 px-3 py-2">
          <p className="text-sm font-semibold text-slate-100">{reel.duration.toFixed(1)}s</p>
          <p className="text-xs text-slate-500">Duration</p>
        </div>
        <div className="rounded-lg border border-slate-800 bg-slate-900/40 px-3 py-2">
          <p className="text-sm font-semibold text-slate-100">
            {reel.width} × {reel.height}
          </p>
          <p className="text-xs text-slate-500">Resolution</p>
        </div>
        <div className="rounded-lg border border-slate-800 bg-slate-900/40 px-3 py-2">
          <p className="text-sm font-semibold text-slate-100">{reel.video_codec.toUpperCase()}</p>
          <p className="text-xs text-slate-500">Video codec</p>
        </div>
        <div className="rounded-lg border border-slate-800 bg-slate-900/40 px-3 py-2">
          <p className="text-sm font-semibold text-slate-100">{reel.audio_codec?.toUpperCase() ?? "None"}</p>
          <p className="text-xs text-slate-500">Audio codec</p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <a
          href={fileUrl}
          download={`reel_${reel.reel_id.slice(0, 8)}.mp4`}
          className="flex-1 text-center rounded-md bg-emerald-500 text-slate-950 font-medium py-2.5 hover:bg-emerald-400 transition-colors"
        >
          Download Reel
        </a>
        <button
          onClick={onGenerateAnother}
          className="flex-1 rounded-md border border-slate-700 text-slate-200 font-medium py-2.5 hover:border-slate-500 transition-colors"
        >
          Generate Another
        </button>
      </div>
    </div>
  );
}
