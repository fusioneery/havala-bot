import type { Hand, Keypoint } from '@tensorflow-models/hand-pose-detection';
import type { HandObservation } from './gesture-recognizer';

interface FrameSize {
  width: number;
  height: number;
}

const PALM_INDICES = [0, 5, 9, 13, 17] as const;
const FINGER_JOINTS = [
  { pip: 6, tip: 8 },
  { pip: 10, tip: 12 },
  { pip: 14, tip: 16 },
  { pip: 18, tip: 20 },
] as const;

function distance(a: Keypoint, b: Keypoint): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function clamp(value: number): number {
  return Math.min(1, Math.max(0, value));
}

export function toHandObservation(hand: Hand, frame: FrameSize): HandObservation {
  const palmCenter = PALM_INDICES.reduce(
    (center, index) => ({
      x: center.x + hand.keypoints[index].x,
      y: center.y + hand.keypoints[index].y,
    }),
    { x: 0, y: 0 },
  );
  const wrist = hand.keypoints[0];
  const extendedFingers = FINGER_JOINTS.filter(({ pip, tip }) => (
    distance(hand.keypoints[tip], wrist) > distance(hand.keypoints[pip], wrist) * 1.18
  )).length;

  return {
    handedness: hand.handedness,
    center: {
      x: clamp(palmCenter.x / PALM_INDICES.length / frame.width),
      y: clamp(palmCenter.y / PALM_INDICES.length / frame.height),
    },
    isOpen: extendedFingers >= 3,
  };
}
