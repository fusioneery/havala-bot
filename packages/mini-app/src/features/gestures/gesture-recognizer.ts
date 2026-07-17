export interface NormalizedPoint {
  x: number;
  y: number;
}

export interface HandObservation {
  handedness: 'Left' | 'Right';
  center: NormalizedPoint;
  isOpen: boolean;
}

export interface GestureFrame {
  timestamp: number;
  hands: HandObservation[];
}

export type GestureType = '67' | 'swipe-left' | 'swipe-right';

export interface RecognizedGesture {
  type: GestureType;
  timestamp: number;
}

const HISTORY_MS = 1_000;
const COOLDOWN_MS = 900;
const SWIPE_WINDOW_MS = 450;

function range(values: number[]): number {
  return Math.max(...values) - Math.min(...values);
}

function detect67(frames: GestureFrame[]): boolean {
  const candidates: HandObservation[][] = [];
  for (let index = frames.length - 1; index >= 0; index -= 1) {
    const frame = frames[index];
    const hands = frame.hands
      .filter((hand) => hand.isOpen)
      .sort((a, b) => a.center.x - b.center.x);
    if (hands.length !== 2) break;
    candidates.unshift(hands);
  }

  if (candidates.length < 6) return false;

  const leftX = candidates.map((hands) => hands[0].center.x);
  const rightX = candidates.map((hands) => hands[1].center.x);
  const leftY = candidates.map((hands) => hands[0].center.y);
  const rightY = candidates.map((hands) => hands[1].center.y);
  const averageSeparation = candidates.reduce(
    (sum, hands) => sum + hands[1].center.x - hands[0].center.x,
    0,
  ) / candidates.length;

  if (averageSeparation < 0.18) return false;
  if (range(leftY) < 0.18 || range(rightY) < 0.18) return false;
  if (range(leftX) > 0.14 || range(rightX) > 0.14) return false;

  let opposedSteps = 0;
  let relativeMovedUp = false;
  let relativeMovedDown = false;

  for (let index = 1; index < candidates.length; index += 1) {
    const leftDelta = leftY[index] - leftY[index - 1];
    const rightDelta = rightY[index] - rightY[index - 1];
    if (Math.abs(leftDelta) >= 0.025 && Math.abs(rightDelta) >= 0.025 && leftDelta * rightDelta < 0) {
      opposedSteps += 1;
    }

    const previousRelativeY = leftY[index - 1] - rightY[index - 1];
    const relativeDelta = leftY[index] - rightY[index] - previousRelativeY;
    if (relativeDelta >= 0.08) relativeMovedDown = true;
    if (relativeDelta <= -0.08) relativeMovedUp = true;
  }

  return opposedSteps >= 4 && relativeMovedUp && relativeMovedDown;
}

function detectSwipe(frames: GestureFrame[]): GestureType | null {
  const latestFrame = frames.at(-1);
  if (!latestFrame) return null;

  const latestHands = latestFrame.hands.filter((hand) => hand.isOpen);
  if (latestHands.length !== 1) return null;

  const handedness = latestHands[0].handedness;
  const candidates: HandObservation[] = [];

  for (let index = frames.length - 1; index >= 0; index -= 1) {
    const frame = frames[index];
    if (latestFrame.timestamp - frame.timestamp > SWIPE_WINDOW_MS) break;

    const hands = frame.hands.filter((hand) => hand.isOpen);
    if (hands.length !== 1 || hands[0].handedness !== handedness) break;
    candidates.unshift(hands[0]);
  }

  if (candidates.length < 4) return null;

  const xPositions = candidates.map((hand) => hand.center.x);
  const yPositions = candidates.map((hand) => hand.center.y);
  const netX = xPositions.at(-1)! - xPositions[0];
  const horizontalRange = range(xPositions);
  const verticalRange = range(yPositions);

  if (Math.abs(netX) < 0.24 || horizontalRange < 0.26) return null;
  if (verticalRange > 0.12 || horizontalRange < verticalRange * 2.5) return null;

  let consistentSteps = 0;
  for (let index = 1; index < xPositions.length; index += 1) {
    const delta = xPositions[index] - xPositions[index - 1];
    if ((netX > 0 && delta > 0.015) || (netX < 0 && delta < -0.015)) {
      consistentSteps += 1;
    }
  }

  if (consistentSteps < candidates.length - 2) return null;
  return netX > 0 ? 'swipe-right' : 'swipe-left';
}

export class GestureRecognizer {
  private frames: GestureFrame[] = [];
  private lastEmissionAt = Number.NEGATIVE_INFINITY;

  addFrame(frame: GestureFrame): RecognizedGesture | null {
    this.frames.push(frame);
    this.frames = this.frames.filter(({ timestamp }) => frame.timestamp - timestamp <= HISTORY_MS);

    if (frame.timestamp - this.lastEmissionAt < COOLDOWN_MS) return null;

    if (detect67(this.frames)) {
      this.lastEmissionAt = frame.timestamp;
      this.frames = [];
      return { type: '67', timestamp: frame.timestamp };
    }

    const swipe = detectSwipe(this.frames);
    if (swipe) {
      this.lastEmissionAt = frame.timestamp;
      this.frames = [];
      return { type: swipe, timestamp: frame.timestamp };
    }

    return null;
  }

  reset(): void {
    this.frames = [];
    this.lastEmissionAt = Number.NEGATIVE_INFINITY;
  }
}
