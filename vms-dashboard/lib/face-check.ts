/**
 * One face, before upload -- on the phone, with no network.
 *
 * GUIDANCE, NOT SECURITY. The endpoint accepts a photo without this having run,
 * so nothing here is a boundary. It exists so a visitor who sends the ceiling,
 * their shoes or a group selfie finds out now, in the queue, rather than at the
 * kiosk desk later.
 *
 * THE MODEL IS SHIPPED WITH THE DASHBOARD. The event LAN has no internet, and
 * blazeface's own default fetches its weights from tfhub.dev. The two files live
 * in `public/models/blazeface/` (model.json + one 402 KB shard), downloaded once
 * from that same tfhub URL, and `load({ modelUrl })` points at them. The
 * TensorFlow.js code itself is bundled from node_modules. Nothing here reaches
 * off the LAN.
 *
 * LOADED ONLY WHEN A PHOTO IS CHOSEN. tfjs is several hundred KB of JavaScript;
 * a phone opening the form should not pay for it before it needs it.
 *
 * WHAT COUNTS AS A FACE: probability >= 0.90 AND a box at least 12% of the
 * image's width. The size rule is what stops a stranger in the background of a
 * lobby selfie from rejecting an otherwise good photo -- a face that small would
 * not survive the 19 mm badge circle anyway. The badge cropper exports a 3:4
 * portrait, so 12% of its width is a face far smaller than any real subject.
 */
import type { BlazeFaceModel } from "@tensorflow-models/blazeface";

export const BLAZEFACE_MODEL_URL = "/models/blazeface/model.json";
export const FACE_MIN_PROBABILITY = 0.9;
export const FACE_MIN_WIDTH_SHARE = 0.12;

export type FaceCheck =
  | { outcome: "one" }
  | { outcome: "none" }
  | { outcome: "many"; count: number }
  /** The model could not run on this phone. The photo is not blocked. */
  | { outcome: "unavailable" };

let model: Promise<BlazeFaceModel> | null = null;

function loadModel(): Promise<BlazeFaceModel> {
  model ??= (async () => {
    const tf = await import("@tensorflow/tfjs-core");
    // Importing a backend registers it. WebGL first; the CPU backend is the
    // fallback for a phone whose browser will not create a WebGL context.
    await import("@tensorflow/tfjs-backend-webgl");
    await import("@tensorflow/tfjs-backend-cpu");
    await import("@tensorflow/tfjs-converter");
    if (!(await tf.setBackend("webgl").catch(() => false))) {
      await tf.setBackend("cpu");
    }
    await tf.ready();

    const blazeface = await import("@tensorflow-models/blazeface");
    return blazeface.load({
      modelUrl: BLAZEFACE_MODEL_URL,
      maxFaces: 10,
      // Low on purpose: the stricter 0.90 is applied below, where the count is
      // taken, so a second face at 0.6 is not silently dropped by the model.
      scoreThreshold: 0.5,
    });
  })();

  // A failed load must not be cached for the life of the page.
  model.catch(() => {
    model = null;
  });
  return model;
}

/** Start fetching the model early -- when the photo step opens, not on submit. */
export function warmFaceCheck(): void {
  void loadModel().catch(() => {});
}

export async function checkFaces(image: HTMLImageElement): Promise<FaceCheck> {
  let detector: BlazeFaceModel;
  try {
    detector = await loadModel();
  } catch {
    return { outcome: "unavailable" };
  }

  try {
    const predictions = await detector.estimateFaces(image, false);
    const width = image.naturalWidth || image.width;

    const faces = predictions.filter((prediction) => {
      const probability = Array.isArray(prediction.probability)
        ? prediction.probability[0]
        : Number(prediction.probability);
      const [left] = prediction.topLeft as [number, number];
      const [right] = prediction.bottomRight as [number, number];
      return (
        probability >= FACE_MIN_PROBABILITY &&
        right - left >= width * FACE_MIN_WIDTH_SHARE
      );
    });

    if (faces.length === 1) return { outcome: "one" };
    if (faces.length === 0) return { outcome: "none" };
    return { outcome: "many", count: faces.length };
  } catch {
    return { outcome: "unavailable" };
  }
}
