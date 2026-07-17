import type { HandDetector } from '@tensorflow-models/hand-pose-detection';

let detectorPromise: Promise<HandDetector> | null = null;

export function loadHandDetector(): Promise<HandDetector> {
  if (!detectorPromise) {
    detectorPromise = (async () => {
      const [handPoseDetection, tf] = await Promise.all([
        import('@tensorflow-models/hand-pose-detection'),
        import('@tensorflow/tfjs-core'),
        import('@tensorflow/tfjs-backend-webgl'),
      ]).then(([handPoseDetection, tf]) => [handPoseDetection, tf] as const);

      await tf.setBackend('webgl');
      await tf.ready();

      return handPoseDetection.createDetector(
        handPoseDetection.SupportedModels.MediaPipeHands,
        {
          runtime: 'tfjs',
          modelType: 'lite',
          maxHands: 2,
        },
      );
    })().catch((error) => {
      detectorPromise = null;
      throw error;
    });
  }

  return detectorPromise;
}
