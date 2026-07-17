import { describe, expect, test } from 'bun:test';
import {
  GestureRecognizer,
  type HandObservation,
  type RecognizedGesture,
} from './gesture-recognizer';

function hand(
  handedness: HandObservation['handedness'],
  x: number,
  y: number,
  isOpen = true,
): HandObservation {
  return { handedness, center: { x, y }, isOpen };
}

function feed(
  recognizer: GestureRecognizer,
  frames: Array<{ timestamp: number; hands: HandObservation[] }>,
): RecognizedGesture | null {
  let result: RecognizedGesture | null = null;
  for (const frame of frames) {
    result = recognizer.addFrame(frame) ?? result;
  }
  return result;
}

describe('GestureRecognizer', () => {
  test('recognizes the 67 seesaw motion from two open hands', () => {
    const recognizer = new GestureRecognizer();
    const leftY = [0.62, 0.54, 0.44, 0.34, 0.42, 0.52, 0.62];
    const rightY = [0.34, 0.42, 0.52, 0.62, 0.54, 0.44, 0.34];

    const result = feed(
      recognizer,
      leftY.map((y, index) => ({
        timestamp: index * 100,
        hands: [
          hand('Left', 0.3, y),
          hand('Right', 0.7, rightY[index]),
        ],
      })),
    );

    expect(result?.type).toBe('67');
  });

  test('recognizes a right swipe from fast horizontal hand movement', () => {
    const recognizer = new GestureRecognizer();
    const xPositions = [0.18, 0.27, 0.39, 0.54, 0.72];

    const result = feed(
      recognizer,
      xPositions.map((x, index) => ({
        timestamp: index * 80,
        hands: [hand('Right', x, 0.5)],
      })),
    );

    expect(result?.type).toBe('swipe-right');
  });

  test('recognizes a left swipe from fast horizontal hand movement', () => {
    const recognizer = new GestureRecognizer();
    const xPositions = [0.8, 0.69, 0.56, 0.41, 0.24];

    const result = feed(
      recognizer,
      xPositions.map((x, index) => ({
        timestamp: index * 80,
        hands: [hand('Left', x, 0.48)],
      })),
    );

    expect(result?.type).toBe('swipe-left');
  });

  test('rejects static open hands as a 67 gesture', () => {
    const recognizer = new GestureRecognizer();
    const result = feed(
      recognizer,
      Array.from({ length: 8 }, (_, index) => ({
        timestamp: index * 100,
        hands: [hand('Left', 0.3, 0.5), hand('Right', 0.7, 0.5)],
      })),
    );

    expect(result).toBeNull();
  });

  test('rejects two hands moving vertically in the same direction', () => {
    const recognizer = new GestureRecognizer();
    const yPositions = [0.65, 0.56, 0.45, 0.34, 0.42, 0.53, 0.64];
    const result = feed(
      recognizer,
      yPositions.map((y, index) => ({
        timestamp: index * 100,
        hands: [hand('Left', 0.3, y), hand('Right', 0.7, y - 0.08)],
      })),
    );

    expect(result).toBeNull();
  });

  test('resets a 67 candidate when hand tracking is lost', () => {
    const recognizer = new GestureRecognizer();
    const result = feed(recognizer, [
      { timestamp: 0, hands: [hand('Left', 0.3, 0.62), hand('Right', 0.7, 0.34)] },
      { timestamp: 100, hands: [hand('Left', 0.3, 0.52), hand('Right', 0.7, 0.44)] },
      { timestamp: 200, hands: [hand('Left', 0.3, 0.34), hand('Right', 0.7, 0.62)] },
      { timestamp: 300, hands: [] },
      { timestamp: 400, hands: [hand('Left', 0.3, 0.62), hand('Right', 0.7, 0.34)] },
      { timestamp: 500, hands: [hand('Left', 0.3, 0.52), hand('Right', 0.7, 0.44)] },
      { timestamp: 600, hands: [hand('Left', 0.3, 0.34), hand('Right', 0.7, 0.62)] },
    ]);

    expect(result).toBeNull();
  });

  test('rejects slow horizontal hand movement as a swipe', () => {
    const recognizer = new GestureRecognizer();
    const xPositions = [0.18, 0.3, 0.43, 0.57, 0.72];
    const result = feed(
      recognizer,
      xPositions.map((x, index) => ({
        timestamp: index * 250,
        hands: [hand('Right', x, 0.5)],
      })),
    );

    expect(result).toBeNull();
  });

  test('rejects predominantly vertical movement as a swipe', () => {
    const recognizer = new GestureRecognizer();
    const result = feed(recognizer, [
      { timestamp: 0, hands: [hand('Right', 0.2, 0.2)] },
      { timestamp: 80, hands: [hand('Right', 0.3, 0.35)] },
      { timestamp: 160, hands: [hand('Right', 0.42, 0.5)] },
      { timestamp: 240, hands: [hand('Right', 0.55, 0.66)] },
    ]);

    expect(result).toBeNull();
  });

  test('suppresses repeated detections during the cooldown', () => {
    const recognizer = new GestureRecognizer();
    const emitted: RecognizedGesture[] = [];
    const swipe = [0.18, 0.27, 0.39, 0.54, 0.72];

    for (const start of [0, 500]) {
      for (const [index, x] of swipe.entries()) {
        const result = recognizer.addFrame({
          timestamp: start + index * 80,
          hands: [hand('Right', x, 0.5)],
        });
        if (result) emitted.push(result);
      }
    }

    expect(emitted.map(({ type }) => type)).toEqual(['swipe-right']);
  });
});
