import { describe, expect, test } from 'bun:test';
import type { Hand, Keypoint } from '@tensorflow-models/hand-pose-detection';
import { toHandObservation } from './hand-observation';

function makeHand(open: boolean): Hand {
  const keypoints: Keypoint[] = Array.from({ length: 21 }, () => ({ x: 50, y: 60 }));
  keypoints[0] = { x: 50, y: 90, name: 'wrist' };

  for (const [mcp, pip, tip, x] of [
    [5, 6, 8, 32],
    [9, 10, 12, 44],
    [13, 14, 16, 56],
    [17, 18, 20, 68],
  ] as const) {
    keypoints[mcp] = { x, y: 64 };
    keypoints[pip] = { x, y: 44 };
    keypoints[tip] = { x, y: open ? 12 : 66 };
  }

  return { keypoints, handedness: 'Right', score: 0.98 };
}

describe('toHandObservation', () => {
  test('normalizes the palm center and identifies an open hand', () => {
    const result = toHandObservation(makeHand(true), { width: 100, height: 100 });

    expect(result.handedness).toBe('Right');
    expect(result.center.x).toBeCloseTo(0.5, 2);
    expect(result.center.y).toBeCloseTo(0.69, 2);
    expect(result.isOpen).toBe(true);
  });

  test('rejects curled fingers as an open hand', () => {
    const result = toHandObservation(makeHand(false), { width: 100, height: 100 });

    expect(result.isOpen).toBe(false);
  });
});
