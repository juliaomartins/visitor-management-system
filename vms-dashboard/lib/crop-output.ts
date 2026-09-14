/**
 * The size a free crop is exported at.
 *
 * PURE, AND IMPORTS NOTHING, so `node --test` loads it without a bundler. The
 * limits are passed in: the caller owns them in `lib/badge-geometry.ts`.
 */

export interface CropLimits {
  /** The canonical stored width -- a crop is never exported wider. */
  maxWidth: number;
  /** The canonical stored height, the 3:4 box's long side. */
  maxHeight: number;
  /** The shortest side the server accepts: `MIN_SIDE` in apps/registrations/photos.py. */
  minSide: number;
}

/**
 * Fit the crop inside maxWidth x maxHeight, keeping its shape, never upscaling.
 * Scaling a small crop up invents detail that is not there and prints softer.
 */
export function cropOutputSize(
  sourceWidth: number,
  sourceHeight: number,
  limits: CropLimits,
): { width: number; height: number } {
  if (sourceWidth <= 0 || sourceHeight <= 0) return { width: 0, height: 0 };
  const scale = Math.min(limits.maxWidth / sourceWidth, limits.maxHeight / sourceHeight, 1);
  return {
    width: Math.round(sourceWidth * scale),
    height: Math.round(sourceHeight * scale),
  };
}

/**
 * Whether the exported photo would be refused as too small.
 *
 * Judged on the OUTPUT, not the selection: a free crop can be wide enough and
 * still come out under the floor once fitting squashes it -- a 3000x600 strip is
 * exported as 600x120, and the server rejects the 120.
 */
export function isCropTooSmall(
  sourceWidth: number,
  sourceHeight: number,
  limits: CropLimits,
): boolean {
  const { width, height } = cropOutputSize(sourceWidth, sourceHeight, limits);
  return Math.min(width, height) < limits.minSide;
}
