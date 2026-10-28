import { useEffect, useRef, useState } from "react";
import { deleteTemplateImage, getTemplatePreview, listTemplates, uploadTemplateImage, type TemplateInfo } from "../api";
import { isSameTemplateImage } from "../templateSelection";
import type { BrandingInfo } from "../branding";
import type { ProductInfo } from "../types";
import { useAuth } from "../context/AuthContext";

interface UploadScreenProps {
  files: File[];
  onFilesChange: (files: File[]) => void;
  product: ProductInfo;
  onProductChange: (product: ProductInfo) => void;
  brandName: string;
  onBrandNameChange: (name: string) => void;
  branding: BrandingInfo;
  demoAvailable: boolean;
  onAnalyze: (
  useDemo: boolean,
  templateId?: string | null
) => void;
error: string | null;
onError: (message: string) => void;
}

const ACCEPTED_EXTENSIONS = [
  ".mp4",
  ".mov",
  ".avi",
  ".webm",
];

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) {
    return `${Math.round(bytes / 1024)} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}


/* =========================================================
   THEME-AWARE INPUT
   ========================================================= */

const inputClass =
  "w-full rounded-md bg-[var(--color-surface)] border border-[var(--color-border)] px-3 py-2 text-[var(--color-text-primary)] placeholder:text-[var(--color-text-primary)] placeholder:opacity-50 text-sm focus:outline-none focus:border-[var(--color-brand-primary)] transition-colors";


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
  onError,
}: UploadScreenProps) {
  const { preferences, updatePreferences } = useAuth();
  const [dragOver, setDragOver] =
    useState(false);

  const inputRef =
    useRef<HTMLInputElement>(null);

    const [templateImage, setTemplateImage] =
  useState<File | null>(null);

const [templateId, setTemplateId] =
  useState<string | null>(null);

const [templatePreview, setTemplatePreview] =
  useState<string | null>(null);

const [templateUploading, setTemplateUploading] =
  useState(false);
const [savedTemplates, setSavedTemplates] = useState<TemplateInfo[]>([]);
const [templatesLoading, setTemplatesLoading] = useState(true);
const [templateLibraryError, setTemplateLibraryError] = useState<string | null>(null);
const [previewingTemplateId, setPreviewingTemplateId] = useState<string | null>(null);

const templateInputRef =
  useRef<HTMLInputElement>(null);
const templatePreviewRef = useRef<string | null>(null);

useEffect(() => () => {
  if (templatePreviewRef.current) URL.revokeObjectURL(templatePreviewRef.current);
}, []);

useEffect(() => {
  const controller = new AbortController();
  void listTemplates(controller.signal).then((items) => { setSavedTemplates(items); setTemplateLibraryError(null); }).catch(() => { setSavedTemplates([]); setTemplateLibraryError("Saved templates are unavailable."); }).finally(() => setTemplatesLoading(false));
  return () => controller.abort();
}, []);


  /* =========================================================
     FILE HANDLING
     ========================================================= */

  const addFiles = (
    incoming: FileList | null
  ) => {
    if (!incoming) return;

    const next = [
      ...files,
      ...Array.from(incoming),
    ];

    onFilesChange(next);
  };


  const removeFile = (
    index: number
  ) => {
    onFilesChange(
      files.filter(
        (_, i) => i !== index
      )
    );
  };
  const handleTemplateImage = async (
  file: File | null
) => {
  if (!file) return;
  if (templateUploading || isSameTemplateImage(templateImage, file)) return;

  const allowedTypes = [
    "image/jpeg",
    "image/png",
    "image/webp",
  ];

  if (!allowedTypes.includes(file.type)) {
    onError("Please upload a JPG, PNG, or WEBP image.");
    return;
  }

  if (file.size > 20 * 1024 * 1024) {
    onError("Template image must be smaller than 20 MB.");
    return;
  }

  setTemplateImage(file);

  if (templatePreviewRef.current) URL.revokeObjectURL(templatePreviewRef.current);
  const previewUrl = URL.createObjectURL(file);
  templatePreviewRef.current = previewUrl;
  setTemplatePreview(previewUrl);

  try {
    setTemplateUploading(true);
    const data = await uploadTemplateImage(file);
    setTemplateId(data.template_id);
    void updatePreferences({ preferred_template_id: data.template_id }).catch(() => {});
    setSavedTemplates((items) => [data, ...items.filter((item) => item.template_id !== data.template_id)]);
    setTemplateLibraryError(null);
  } catch {
    URL.revokeObjectURL(previewUrl);
    templatePreviewRef.current = null;
    setTemplateImage(null);
    setTemplatePreview(null);
    setTemplateId(null);
    onError("Failed to upload template image. Please try again.");
  } finally {
    setTemplateUploading(false);
  }
};

const selectStoredTemplate = async (template: TemplateInfo) => {
  setPreviewingTemplateId(template.template_id);
  try {
    const previewUrl = URL.createObjectURL(await getTemplatePreview(template.template_id));
    if (templatePreviewRef.current) URL.revokeObjectURL(templatePreviewRef.current);
    templatePreviewRef.current = previewUrl;
    setTemplatePreview(previewUrl);
    setTemplateImage(null);
    setTemplateId(template.template_id);
    void updatePreferences({ preferred_template_id: template.template_id }).catch(() => {});
  } catch {
    onError("Could not load the selected template preview.");
  } finally {
    setPreviewingTemplateId(null);
  }
};

const removeStoredTemplate = async (template: TemplateInfo) => {
  try {
    await deleteTemplateImage(template.template_id);
    setSavedTemplates((items) => items.filter((item) => item.template_id !== template.template_id));
    if (templateId === template.template_id) {
      if (templatePreviewRef.current) URL.revokeObjectURL(templatePreviewRef.current);
      templatePreviewRef.current = null;
      setTemplatePreview(null);
      setTemplateImage(null);
      setTemplateId(null);
      void updatePreferences({ preferred_template_id: null }).catch(() => {});
    }
  } catch {
    onError("Could not delete the selected template.");
  }
};

useEffect(() => {
  if (templatesLoading || templateId || !preferences?.preferred_template_id) return;
  const preferred = savedTemplates.find((item) => item.template_id === preferences.preferred_template_id);
  if (preferred) void selectStoredTemplate(preferred);
}, [templatesLoading, templateId, preferences?.preferred_template_id, savedTemplates]);


  return (
    <div className="max-w-2xl w-full mx-auto px-4 py-10 space-y-8">

      {/* =====================================================
          HEADER
          ===================================================== */}

      <div className="text-center space-y-3">

        {branding.logo_url && (
          <img
            src={branding.logo_url}
            alt={branding.name}
            className="h-16 w-auto object-contain mx-auto"
          />
        )}

        <div>

          <h1 className="text-2xl font-semibold tracking-wide text-[var(--color-text-primary)]">
            {branding.name}
          </h1>

          {branding.tagline && (
            <p className="text-[var(--color-brand-primary)] font-medium mt-0.5">
              {branding.tagline}
            </p>
          )}

        </div>

        <p className="text-[var(--color-text-primary)] opacity-80 max-w-md mx-auto">
          Turn raw product footage into publish-ready social media Reels in minutes.
        </p>

      </div>


      {/* =====================================================
          VIDEO UPLOAD / DROP ZONE
          ===================================================== */}

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}

        onDragLeave={() =>
          setDragOver(false)
        }

        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          addFiles(
            e.dataTransfer.files
          );
        }}

        onClick={() =>
          inputRef.current?.click()
        }

        className={
          "cursor-pointer rounded-xl border-2 border-dashed p-10 text-center transition-all duration-200 bg-[var(--color-surface)] " +
          (
            dragOver
              ? "border-[var(--color-brand-primary)] bg-[var(--color-brand-primary)]/10"
              : "border-[var(--color-border)] hover:border-[var(--color-brand-primary)]"
          )
        }
      >

        <input
          ref={inputRef}
          type="file"
          multiple
          accept={ACCEPTED_EXTENSIONS.join(",")}
          className="hidden"
          onChange={(e) =>
            addFiles(
              e.target.files
            )
          }
        />

        <p className="text-[var(--color-text-primary)] font-semibold">
          Upload Product Videos
        </p>

        <p className="text-[var(--color-text-primary)] opacity-80 text-sm mt-1">
          Drag &amp; drop, or click to browse
        </p>

        <p className="text-[var(--color-text-primary)] opacity-65 text-xs mt-3">
          MP4 • MOV • Multiple clips supported • 9:16 output
        </p>

      </div>
           

      {/* =====================================================
    TEMPLATE IMAGE
    ===================================================== */}

<div className="space-y-3">

  <div>
    <h2 className="text-sm font-semibold text-[var(--color-text-primary)]">
      Template Image
    </h2>

    <p className="text-xs text-[var(--color-text-primary)] opacity-60 mt-1">
      Upload an image to use as a visual reference for the generated Reel.
    </p>
  </div>

  <input
    ref={templateInputRef}
    type="file"
    accept="image/jpeg,image/png,image/webp"
    disabled={templateUploading}
    className="hidden"
    onChange={(e) => {
      handleTemplateImage(e.target.files?.[0] || null);
      e.target.value = "";
    }}
  />

  {!templatePreview ? (
    <button
      type="button"
      onClick={() =>
        templateInputRef.current?.click()
      }
      className="
        w-full
        rounded-xl
        border-2
        border-dashed
        border-[var(--color-border)]
        bg-[var(--color-surface)]
        px-6
        py-8
        text-center
        transition-all
        hover:border-[var(--color-brand-primary)]
        hover:bg-[var(--color-brand-primary)]/5
      "
    >
      <div className="text-[var(--color-brand-primary)] text-2xl mb-2">
        +
      </div>

      <p className="text-sm font-semibold text-[var(--color-text-primary)]">
        Upload Template Image
      </p>

      <p className="text-xs text-[var(--color-text-primary)] opacity-60 mt-1">
        JPG, PNG or WEBP • Maximum 20 MB
      </p>
    </button>
  ) : (
    <div className="
      rounded-xl
      border
      border-[var(--color-border)]
      bg-[var(--color-surface)]
      p-4
    ">

      <div className="flex items-start gap-4">

        <img
          src={templatePreview}
          alt="Template preview"
          className="
            w-28
            h-28
            object-cover
            rounded-lg
            border
            border-[var(--color-border)]
          "
        />

        <div className="flex-1 min-w-0">

          <p className="text-sm font-medium text-[var(--color-text-primary)] truncate">
            {templateImage?.name}
          </p>

          <p className="text-xs text-[var(--color-text-primary)] opacity-60 mt-1">
            {templateImage
              ? formatBytes(templateImage.size)
              : ""}
          </p>

          {templateUploading ? (
            <p className="text-xs text-[var(--color-brand-primary)] mt-3">
              Uploading template...
            </p>
          ) : templateId ? (
            <p className="text-xs text-green-500 mt-3">
              ✓ Template uploaded
            </p>
          ) : null}

          <button
            type="button"
            disabled={templateUploading}
            onClick={() => {
              if (templateId) void deleteTemplateImage(templateId).catch(() => {});
              if (templatePreviewRef.current) URL.revokeObjectURL(templatePreviewRef.current);
              templatePreviewRef.current = null;
              setTemplateImage(null);
              setTemplatePreview(null);
              setTemplateId(null);

              if (templateInputRef.current) {
                templateInputRef.current.value = "";
              }
            }}
            className="
              text-xs
              text-[var(--color-error)]
              hover:opacity-80
              mt-3
            "
          >
            Remove template
          </button>

        </div>

      </div>

    </div>
  )}

</div>


      <div className="space-y-2 rounded-xl border border-[var(--color-border)] p-3">
        <p className="text-xs font-semibold text-[var(--color-text-primary)]">Your saved templates</p>
        {templatesLoading ? <p className="text-xs opacity-60">Loading templates…</p> : templateLibraryError ? <p role="alert" className="text-xs text-[var(--color-error)]">{templateLibraryError}</p> : savedTemplates.length === 0 ? (
          <p className="text-xs opacity-60">No saved templates yet.</p>
        ) : savedTemplates.map((template) => (
          <div key={template.template_id} className="flex items-center gap-2 text-xs">
            <span className="min-w-0 flex-1 truncate">{template.filename}</span>
            <button type="button" onClick={() => void selectStoredTemplate(template)} disabled={previewingTemplateId !== null} className="text-[var(--color-brand-primary)] disabled:opacity-50">
              {previewingTemplateId === template.template_id ? "Loading…" : templateId === template.template_id ? "Selected" : "Preview / Use"}
            </button>
            <button type="button" onClick={() => void removeStoredTemplate(template)} className="text-[var(--color-error)]">Delete</button>
          </div>
        ))}
      </div>


      {/* =====================================================
          PRODUCT INFORMATION
          ===================================================== */}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

        {/* BRAND NAME */}

        <div className="sm:col-span-2">

          <label className="block text-sm text-[var(--color-text-primary)] font-medium mb-1">
            Brand Name
          </label>

          <input
            value={brandName}
            onChange={(e) =>
              onBrandNameChange(
                e.target.value
              )
            }
            placeholder={branding.name}
            className={inputClass}
          />

        </div>


        {/* PRODUCT NAME */}

        <div>

          <label className="block text-sm text-[var(--color-text-primary)] font-medium mb-1">
            Product Name
          </label>

          <input
            value={product.product_name}
            onChange={(e) =>
              onProductChange({
                ...product,
                product_name:
                  e.target.value,
              })
            }
            placeholder="Banarasi Silk Saree"
            className={inputClass}
          />

        </div>


        {/* PRODUCT CODE */}

        <div>

          <label className="block text-sm text-[var(--color-text-primary)] font-medium mb-1">
            Product Code
          </label>

          <input
            value={product.product_code}
            onChange={(e) =>
              onProductChange({
                ...product,
                product_code:
                  e.target.value,
              })
            }
            placeholder="KR1024"
            className={inputClass}
          />

        </div>


        {/* PRICE */}

        <div>

          <label className="block text-sm text-[var(--color-text-primary)] font-medium mb-1">
            Price
          </label>

          <input
            value={product.price}
            onChange={(e) =>
              onProductChange({
                ...product,
                price:
                  e.target.value,
              })
            }
            placeholder="Rs 18,500"
            className={inputClass}
          />

        </div>


        {/* CATEGORY */}

        <div>

          <label className="block text-sm text-[var(--color-text-primary)] font-medium mb-1">
            Category
          </label>

          <input
            value={product.category}
            onChange={(e) =>
              onProductChange({
                ...product,
                category:
                  e.target.value,
              })
            }
            placeholder="Saree"
            className={inputClass}
          />

        </div>

      </div>


      {/* =====================================================
          ERROR
          ===================================================== */}

      {error && (
        <p role="alert" className="text-sm text-[var(--color-error)] bg-[var(--color-error)]/10 border border-[var(--color-error)]/30 rounded-md px-3 py-2">
          {error}
        </p>
      )}


      {/* =====================================================
          ACTION BUTTONS
          ===================================================== */}

      <div className="flex flex-col sm:flex-row gap-3">

        <button
          onClick={() =>
            onAnalyze(false,templateId)
          }
          disabled={
            files.length === 0
          }
          className="
            flex-1
            rounded-md
            bg-[var(--color-brand-primary)]
            disabled:bg-[var(--color-border)]
            disabled:text-[var(--color-text-primary)]
            disabled:opacity-40
            text-white
            font-medium
            py-2.5
            hover:opacity-90
            transition-opacity
          "
        >
          Analyze footage{" "}
          {files.length > 0
            ? `(${files.length} file${
                files.length > 1
                  ? "s"
                  : ""
              })`
            : ""}
        </button>


        {demoAvailable && (
          <button
            onClick={() =>
              onAnalyze(true,templateId)
            }
            className="
              rounded-md
              border
              border-[var(--color-border)]
              bg-[var(--color-surface)]
              text-[var(--color-text-primary)]
              font-medium
              py-2.5
              px-6
              hover:border-[var(--color-brand-primary)]
              hover:text-[var(--color-brand-primary)]
              transition-colors
            "
          >
            Try Demo
          </button>
        )}

      </div>

    </div>
  );
}
