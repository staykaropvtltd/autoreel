/** Final photo-reel export stays disabled until photos can be rendered and
 * charged through the authoritative server-side reel pipeline. */
export const photoReelExportStatus = Object.freeze({
  enabled: false,
  reason:
    "Final Photo Reel export is temporarily unavailable. Editing and preview still work; credit-accounted server rendering for photo slides is not available yet.",
});
