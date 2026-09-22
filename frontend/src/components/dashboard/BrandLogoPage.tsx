import { useRef, useState } from "react";
import axios from "axios";
import "./BrandLogoPage.css";

type LogoPlacement = "start" | "entire";

interface BrandLogoPageProps {
  project: {
    title: string;
    category: "Sarees" | "Lehengas" | "Kurtis" | "Bridal";
  } | null;

  onBack: () => void;

  onContinue: (
    logoFile: File | null,
    logoPlacement: LogoPlacement
  ) => void;
}

const API_BASE = "http://127.0.0.1:8000/api";

export default function BrandLogoPage({
  project,
  onBack,
  onContinue,
}: BrandLogoPageProps) {
  const [logoFile, setLogoFile] =
    useState<File | null>(null);

  const [logoPreview, setLogoPreview] =
    useState<string | null>(null);

  const [logoPlacement, setLogoPlacement] =
    useState<LogoPlacement>("start");

  const [uploading, setUploading] =
    useState(false);

  const [error, setError] =
    useState<string | null>(null);

  const fileInputRef =
    useRef<HTMLInputElement | null>(null);

  /* =====================================================
     LOGO FILE SELECTION
     ===================================================== */

  const handleLogoChange = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];

    if (!file) return;

    const allowedTypes = [
      "image/png",
      "image/jpeg",
      "image/webp",
    ];

    if (!allowedTypes.includes(file.type)) {
      setError(
        "Please upload a PNG, JPG, JPEG, or WEBP image."
      );

      event.target.value = "";
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setError(
        "Logo must be smaller than 10 MB."
      );

      event.target.value = "";
      return;
    }

    setError(null);

    if (logoPreview) {
      URL.revokeObjectURL(logoPreview);
    }

    const previewUrl =
      URL.createObjectURL(file);

    setLogoFile(file);
    setLogoPreview(previewUrl);
  };

  /* =====================================================
     REMOVE LOGO
     ===================================================== */

  const removeLogo = () => {
    if (logoPreview) {
      URL.revokeObjectURL(logoPreview);
    }

    setLogoFile(null);
    setLogoPreview(null);
    setError(null);

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  /* =====================================================
     UPLOAD LOGO TO BACKEND
     ===================================================== */

  const handleContinue = async () => {
    setError(null);

    /*
     * Logo is optional.
     *
     * If the user doesn't want to upload a logo,
     * allow them to continue to the studio.
     */
    if (!logoFile) {
      onContinue(
        null,
        logoPlacement
      );

      return;
    }

    setUploading(true);

    try {
      const formData = new FormData();

      formData.append(
        "file",
        logoFile
      );

      formData.append(
        "placement",
        logoPlacement
      );

      const response = await axios.post(
        `${API_BASE}/branding/logo`,
        formData
      );

      console.log(
        "Brand logo uploaded successfully:",
        response.data
      );

      /*
       * Backend upload succeeded.
       * Continue to the existing studio.
       */
      onContinue(
        logoFile,
        logoPlacement
      );

    } catch (err) {
      console.error(
        "Brand logo upload failed:",
        err
      );

      if (axios.isAxiosError(err)) {
        const backendMessage =
          err.response?.data?.detail;

        setError(
          backendMessage ||
            "Failed to upload logo. Please try again."
        );
      } else {
        setError(
          "Failed to upload logo. Please try again."
        );
      }

    } finally {
      setUploading(false);
    }
  };

  return (
    <section className="brand-logo-page">

      {/* =================================================
          HEADER
          ================================================= */}

      <div className="dashboard-page-header brand-logo-header">

        <div>
          <span className="brand-logo-eyebrow">
            BRAND IDENTITY
          </span>

          <h1>
            Brand your reel
          </h1>

          <p>
            Add your logo and choose how it should
            appear in your generated reel.
          </p>
        </div>

        <button
          type="button"
          className="brand-logo-back-button"
          onClick={onBack}
          disabled={uploading}
        >
          ← Back
        </button>

      </div>


      {/* =================================================
          PROJECT INFORMATION
          ================================================= */}

      {project && (
        <div className="brand-project-info">

          <span>
            PROJECT
          </span>

          <strong>
            {project.title}
          </strong>

          <small>
            {project.category}
          </small>

        </div>
      )}


      {/* =================================================
          LOGO UPLOAD
          ================================================= */}

      <section className="brand-logo-card">

        <div className="brand-logo-card-heading">

          <div>

            <span>
              01
            </span>

            <div>

              <h2>
                Upload your logo
              </h2>

              <p>
                Your logo will be added to the
                generated reel automatically.
              </p>

            </div>

          </div>

        </div>


        {!logoPreview ? (

          <button
            type="button"
            className="brand-logo-upload-area"
            onClick={() =>
              fileInputRef.current?.click()
            }
            disabled={uploading}
          >

            <div className="brand-logo-upload-icon">
              +
            </div>

            <strong>
              Upload brand logo
            </strong>

            <span>
              PNG, JPG or WEBP
            </span>

            <small>
              Transparent PNG is recommended
            </small>

          </button>

        ) : (

          <div className="brand-logo-preview-area">

            <div className="brand-logo-preview">

              <img
                src={logoPreview}
                alt="Brand logo preview"
              />

            </div>


            <div className="brand-logo-file-info">

              <strong>
                {logoFile?.name}
              </strong>

              {logoFile && (
                <span>
                  {(
                    logoFile.size /
                    (1024 * 1024)
                  ).toFixed(2)} MB
                </span>
              )}

              <button
                type="button"
                onClick={removeLogo}
                className="brand-logo-remove"
                disabled={uploading}
              >
                Remove logo
              </button>

            </div>

          </div>

        )}


        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          hidden
          onChange={handleLogoChange}
          disabled={uploading}
        />

      </section>


      {/* =================================================
          LOGO PLACEMENT
          ================================================= */}

      <section className="brand-logo-card">

        <div className="brand-logo-card-heading">

          <div>

            <span>
              02
            </span>

            <div>

              <h2>
                Logo placement
              </h2>

              <p>
                Choose when your logo should appear.
              </p>

            </div>

          </div>

        </div>


        <div className="brand-placement-grid">

          {/* =============================================
              START OF REEL
              ============================================= */}

          <button
            type="button"
            className={`brand-placement-option ${
              logoPlacement === "start"
                ? "active"
                : ""
            }`}
            onClick={() =>
              setLogoPlacement("start")
            }
            disabled={uploading}
          >

            <div className="brand-placement-preview">

              <div className="fake-reel">

                <div className="fake-logo">
                  LOGO
                </div>

                <span>
                  YOUR REEL
                </span>

              </div>

            </div>


            <div className="brand-placement-copy">

              <strong>
                Starting of Reel
              </strong>

              <span>
                Show the logo at the beginning
                before the product content.
              </span>

            </div>


            <div className="brand-placement-radio">

              {logoPlacement === "start" && "✓"}

            </div>

          </button>


          {/* =============================================
              ENTIRE REEL
              ============================================= */}

          <button
            type="button"
            className={`brand-placement-option ${
              logoPlacement === "entire"
                ? "active"
                : ""
            }`}
            onClick={() =>
              setLogoPlacement("entire")
            }
            disabled={uploading}
          >

            <div className="brand-placement-preview">

              <div className="fake-reel">

                <span>
                  YOUR REEL
                </span>

                <div className="fake-watermark">
                  LOGO
                </div>

              </div>

            </div>


            <div className="brand-placement-copy">

              <strong>
                Entire Reel
              </strong>

              <span>
                Keep the logo visible as a subtle
                watermark throughout the reel.
              </span>

            </div>


            <div className="brand-placement-radio">

              {logoPlacement === "entire" && "✓"}

            </div>

          </button>

        </div>

      </section>


      {/* =================================================
          ERROR
          ================================================= */}

      {error && (
        <div className="brand-logo-error">
          {error}
        </div>
      )}


      {/* =================================================
          ACTIONS
          ================================================= */}

      <div className="brand-logo-actions">

        <button
          type="button"
          className="brand-logo-cancel"
          onClick={onBack}
          disabled={uploading}
        >
          BACK
        </button>


        <button
          type="button"
          className="brand-logo-continue"
          onClick={handleContinue}
          disabled={uploading}
        >

          {uploading ? (
            <>
              UPLOADING...
            </>
          ) : (
            <>
              CONTINUE TO STUDIO
              <span>→</span>
            </>
          )}

        </button>

      </div>

    </section>
  );
}