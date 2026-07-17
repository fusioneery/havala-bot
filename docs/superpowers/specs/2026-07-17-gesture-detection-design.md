# Webcam Gesture Detection Design

## Goal

Add an on-device gesture screen to the Hawala mini app. The screen shows a live mirrored webcam preview and recognizes three dynamic gestures:

- **67**: two open, upward-facing hands moving vertically in opposite directions like a seesaw.
- **Swipe left**: one hand moving decisively from right to left.
- **Swipe right**: one hand moving decisively from left to right.

The latest recognized gesture is shown prominently over the camera stream. The screen is available at `/gestures` and from a third item in the bottom navigation.

## Architecture

The feature runs entirely in the browser. TensorFlow.js uses its WebGL backend and the MediaPipe Hands model from `@tensorflow-models/hand-pose-detection` to produce up to two hands with 21 landmarks each.

The implementation is divided into three focused units:

1. **Landmark inference** owns TensorFlow/model loading and converts video frames into timestamped hand observations.
2. **Temporal recognizer** is a framework-independent module that keeps a short rolling observation history and emits gestures. It has no camera, TensorFlow, or React dependency so it can be exercised with deterministic tests.
3. **Gesture page** owns camera permission, video/canvas rendering, lifecycle cleanup, localized UI states, and the recognition loop.

The model and inference loop are loaded only on the gesture route, keeping the rest of the mini app's startup path unchanged.

## Recognition Rules

All coordinates are normalized against the video frame so thresholds behave consistently across devices.

### 67

Recognition requires two visible open hands whose wrist/palm centers are horizontally separated. Within a short time window, their vertical movement must be substantial, predominantly vertical, and opposite in direction. The recognizer requires a direction reversal or alternating phase so a static pose and ordinary two-hand movement do not trigger the gesture.

### Swipe

Recognition requires a single dominant hand center to travel a minimum horizontal distance within a bounded time window. Horizontal movement must clearly exceed vertical movement. The displacement sign determines `Swipe left` or `Swipe right`.

After an emission, a cooldown suppresses repeated results from the same continuous motion. Stale history is discarded, and losing the relevant hands resets the candidate gesture.

## User Experience

- The page uses the existing light/dark design tokens and fills the available viewport.
- The camera preview is mirrored because users expect a selfie view; recognition uses consistently mirrored coordinates so displayed direction matches perceived screen direction.
- A canvas overlays hand landmarks and connections as immediate tracking feedback.
- A prominent status pill displays `67`, `Swipe left`, or `Swipe right`. Before detection it prompts the user to show a gesture.
- Copy is available in English and Russian through the app's existing language selection.
- The bottom navigation receives a third gesture tab and remains usable on narrow mobile screens.

## Error Handling and Lifecycle

The page distinguishes these states:

- TensorFlow/model loading.
- Waiting for camera permission.
- Camera permission denied or no camera available.
- Model initialization or inference failure.
- Ready and tracking.

Recoverable errors offer a retry action. Navigating away cancels the animation loop, stops every media track, clears transient recognition state, and releases references to video/canvas elements. React Strict Mode remounts must not leave a camera stream or inference loop running.

## Validation

The temporal recognizer is developed test-first with synthetic landmark sequences covering:

- 67 detection from alternating two-hand motion.
- Rejection of static hands and same-direction two-hand motion.
- Left and right swipe direction.
- Rejection of slow, short, or predominantly vertical movement.
- Cooldown behavior.

The completed feature must also pass the mini-app lint/typecheck and production build. A browser smoke check verifies that the route renders, the model loads, camera permission/error states are usable, the bottom-navigation entry works, and the page cleans up when navigating away.

## Scope Boundaries

- No video or landmark data leaves the browser.
- No custom model training or dataset collection is included.
- No gesture-triggered business actions are added; this feature only recognizes and displays gestures.
- Railway and Docker configuration do not need changes because inference runs in the client bundle and uses the user's camera.
