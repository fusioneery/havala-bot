import type { Hand } from '@tensorflow-models/hand-pose-detection';

const HAND_CONNECTIONS = [
  [0, 1], [1, 2], [2, 3], [3, 4],
  [0, 5], [5, 6], [6, 7], [7, 8],
  [5, 9], [9, 10], [10, 11], [11, 12],
  [9, 13], [13, 14], [14, 15], [15, 16],
  [13, 17], [17, 18], [18, 19], [19, 20],
  [0, 17],
] as const;

export function drawHands(
  canvas: HTMLCanvasElement,
  hands: Hand[],
  frame: { width: number; height: number },
): void {
  if (canvas.width !== frame.width || canvas.height !== frame.height) {
    canvas.width = frame.width;
    canvas.height = frame.height;
  }

  const context = canvas.getContext('2d');
  if (!context) return;

  context.clearRect(0, 0, canvas.width, canvas.height);
  context.lineCap = 'round';
  context.lineJoin = 'round';
  context.lineWidth = Math.max(3, frame.width / 180);
  context.strokeStyle = '#C8F135';
  context.shadowColor = 'rgba(200, 241, 53, 0.5)';
  context.shadowBlur = 10;

  for (const hand of hands) {
    for (const [from, to] of HAND_CONNECTIONS) {
      const start = hand.keypoints[from];
      const end = hand.keypoints[to];
      context.beginPath();
      context.moveTo(start.x, start.y);
      context.lineTo(end.x, end.y);
      context.stroke();
    }

    context.fillStyle = '#FFFFFF';
    for (const keypoint of hand.keypoints) {
      context.beginPath();
      context.arc(keypoint.x, keypoint.y, Math.max(3, frame.width / 150), 0, Math.PI * 2);
      context.fill();
    }
  }

  context.shadowBlur = 0;
}
