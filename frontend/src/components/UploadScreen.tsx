import { useRef, useState } from "react";
import type { BrandingInfo } from "../branding";
import type { ProductInfo } from "../types";

interface UploadScreenProps {
  files: File[];
  onFilesChange: (files: File[]) => void;
  product: ProductInfo;
  onProductChange: (product: ProductInfo) => void;
  brandName: string;
  onBrandNameChange: (name: string) => void;
  branding: BrandingInfo;
  demoAvailable: boolean;
  onAnalyze: (useDemo: boolean) => void;
  error: string | null;
}

const ACCEPTED_EXTENSIONS = [".mp4", ".mov", ".avi", ".webm"];

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const inputClass =
  "w-full rounded-md bg-white border border-[var(--color-border)] px-3 py-2 text-[var(--color-text-primary)] text-sm focus:outline-none focus:border-[var(--color-brand-primary)]";

export default function UploadScreen({
  files,
  onFilesChange,
  product,
  onProductChange,
  brandName,
  onBrandNameChange,
  branding,
  demoAvailable,
  onAnalyze,
  error,
}: UploadScreenProps) {
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const addFiles = (incoming: FileList | null) => {
    if (!incoming) return;
    const next = [...files, ...Array.from(incoming)];
    onFilesChange(next);
  };

  const removeFile = (index: number) => {
    onFilesChange(files.filter((_, i) => i !== index));
  };

  return (
    <div className="max-w-2xl w-full mx-auto px-4 py-10 space-y-8">
      <div className="text-center space-y-3">
        <img src={branding.logo_url} alt={branding.name} className="h-16 w-auto object-contain mx-auto" />
        <div>
          <h1 className="text-2xl font-semibold tracking-wide text-[var(--color-text-primary)]">{branding.name}</h1>
          {branding.tagline && (
            <p className="text-[var(--color-brand-primary)] font-medium mt-0.5">{branding.tagline}</p>
          )}
        </div>
        <p className="text-[var(--color-text-secondary)] max-w-md mx-auto">
          Turn raw product footage into publish-ready social media Reels in minutes.
        </p>
      </div>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          addFiles(e.dataTransfer.files);
        }}
        onClick={() => inputRef.current?.click()}
        className={
          "cursor-pointer rounded-xl border-2 border-dashed p-10 text-center transition-colors bg-[var(--color-surface)] " +
          (dragOver
            ? "border-[var(--color-brand-primary)] bg-[var(--color-brand-primary)]/5"
            : "border-[var(--color-border)] hover:border-[var(--color-brand-secondary)]")
        }
      >
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={ACCEPTED_EXTENSIONS.join(",")}
          className="hidden"
          onChange={(e) => addFiles(e.target.files)}
        />
        <p className="text-[var(--color-text-primary)] font-medium">Upload Product Videos</p>
        <p className="text-[var(--color-text-secondary)] text-sm mt-1">Drag &amp; drop, or click to browse</p>
        <p className="text-[var(--color-text-secondary)] text-xs mt-3">
          MP4 • MOV • Multiple clips supported • 9:16 output
        </p>
      </div>

      {files.length > 0 && (
        <ul className="divide-y divide-[var(--color-border)] rounded-lg border border-[var(--color-border)] overflow-hidden bg-[var(--color-surface)]">
          {files.map((file, i) => (
            <li key={`${file.name}-${i}`} className="flex items-center justify-between px-4 py-2.5">
              <div className="min-w-0">
                <p className="text-sm text-[var(--color-text-primary)] truncate">{file.name}</p>
                <p className="text-xs text-[var(--color-text-secondary)]">{formatBytes(file.size)}</p>
              </div>
              <button
                onClick={() => removeFile(i)}
                className="text-[var(--color-text-secondary)] hover:text-[var(--color-error)] text-sm px-2"
                aria-label={`Remove ${file.name}`}
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="sm:col-span-2">
          <label className="block text-sm text-[var(--color-text-secondary)] mb-1">Brand Name</label>
          <input
            value={brandName}
            onChange={(e) => onBrandNameChange(e.target.value)}
            placeholder={branding.name}
            className={inputClass}
          />
        </div>
        <div>
          <label className="block text-sm text-[var(--color-text-secondary)] mb-1">Product Name</label>
          <input
            value={product.product_name}
            onChange={(e) => onProductChange({ ...product, product_name: e.target.value })}
            placeholder="Banarasi Silk Saree"
            className={inputClass}
          />
        </div>
        <div>
          <label className="block text-sm text-[var(--color-text-secondary)] mb-1">Product Code</label>
          <input
            value={product.product_code}
            onChange={(e) => onProductChange({ ...product, product_code: e.target.value })}
            placeholder="KR1024"
            className={inputClass}
          />
        </div>
        <div>
          <label className="block text-sm text-[var(--color-text-secondary)] mb-1">Price</label>
          <input
            value={product.price}
            onChange={(e) => onProductChange({ ...product, price: e.target.value })}
            placeholder="Rs 18,500"
            className={inputClass}
          />
        </div>
        <div>
          <label className="block text-sm text-[var(--color-text-secondary)] mb-1">Category</label>
          <input
            value={product.category}
            onChange={(e) => onProductChange({ ...product, category: e.target.value })}
            placeholder="Saree"
            className={inputClass}
          />
        </div>
      </div>

      {error && (
        <p className="text-sm text-[var(--color-error)] bg-[var(--color-error)]/10 border border-[var(--color-error)]/30 rounded-md px-3 py-2">
          {error}
        </p>
      )}

      <div className="flex flex-col sm:flex-row gap-3">
        <button
          onClick={() => onAnalyze(false)}
          disabled={files.length === 0}
          className="flex-1 rounded-md bg-[var(--color-brand-primary)] disabled:bg-[var(--color-border)] disabled:text-[var(--color-text-secondary)] text-white font-medium py-2.5 hover:opacity-90 transition-opacity"
        >
          Upload Product Videos {files.length > 0 ? `(${files.length} file${files.length > 1 ? "s" : ""})` : ""}
        </button>
        {demoAvailable && (
          <button
            onClick={() => onAnalyze(true)}
            className="rounded-md border border-[var(--color-border)] text-[var(--color-text-primary)] font-medium py-2.5 px-6 hover:border-[var(--color-brand-primary)] transition-colors"
          >
            Try Demo
          </button>
        )}
      </div>
    </div>
  );
}
