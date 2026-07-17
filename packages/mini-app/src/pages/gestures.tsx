import { GestureRecognizer, type GestureType } from '@/features/gestures/gesture-recognizer';
import { loadHandDetector } from '@/features/gestures/gesture-runtime';
import { toHandObservation } from '@/features/gestures/hand-observation';
import { drawHands } from '@/features/gestures/hand-overlay';
import { useI18n } from '@/lib/i18n';
import { AnimatePresence, motion } from 'framer-motion';
import { Camera, Hand, LoaderCircle, RefreshCw, ShieldCheck } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

type StartupState =
  | 'starting'
  | 'ready'
  | 'camera-denied'
  | 'camera-error'
  | 'model-error'
  | 'unsupported';

const COPY = {
  en: {
    eyebrow: 'ON-DEVICE VISION',
    title: 'Gesture lab',
    subtitle: 'Show 67 or swipe across the frame',
    starting: 'Starting TensorFlow…',
    ready: 'Tracking',
    showGesture: 'Show a gesture',
    hands: (count: number) => `${count}/2 hands`,
    privacy: 'Processed on this device',
    hint67: '67 · alternate both palms',
    hintSwipe: 'Swipe · move one open hand',
    cameraDeniedTitle: 'Camera access is blocked',
    cameraDeniedBody: 'Allow camera access in your browser or Telegram settings, then try again.',
    cameraErrorTitle: 'Camera unavailable',
    cameraErrorBody: 'No usable camera was found. Close other camera apps and try again.',
    modelErrorTitle: 'TensorFlow could not start',
    modelErrorBody: 'Check your connection and WebGL support, then reload the detector.',
    unsupportedTitle: 'Camera is not supported',
    unsupportedBody: 'Open this screen in a secure, modern browser with camera access.',
    retry: 'Try again',
    detected: 'GESTURE DETECTED',
    gesture67: '67',
    swipeLeft: 'Swipe left',
    swipeRight: 'Swipe right',
  },
  ru: {
    eyebrow: 'РАСПОЗНАВАНИЕ НА УСТРОЙСТВЕ',
    title: 'Лаборатория жестов',
    subtitle: 'Покажите 67 или проведите рукой в кадре',
    starting: 'Запускаем TensorFlow…',
    ready: 'Слежение',
    showGesture: 'Покажите жест',
    hands: (count: number) => `${count}/2 рук`,
    privacy: 'Обработка только на устройстве',
    hint67: '67 · двигайте ладонями по очереди',
    hintSwipe: 'Swipe · проведите одной раскрытой рукой',
    cameraDeniedTitle: 'Нет доступа к камере',
    cameraDeniedBody: 'Разрешите камеру в настройках браузера или Telegram и попробуйте снова.',
    cameraErrorTitle: 'Камера недоступна',
    cameraErrorBody: 'Подходящая камера не найдена. Закройте другие приложения с камерой и повторите.',
    modelErrorTitle: 'TensorFlow не запустился',
    modelErrorBody: 'Проверьте подключение и поддержку WebGL, затем перезапустите детектор.',
    unsupportedTitle: 'Камера не поддерживается',
    unsupportedBody: 'Откройте экран в современном браузере с HTTPS и доступом к камере.',
    retry: 'Попробовать снова',
    detected: 'ЖЕСТ РАСПОЗНАН',
    gesture67: '67',
    swipeLeft: 'Свайп влево',
    swipeRight: 'Свайп вправо',
  },
} as const;

function cameraFailureState(error: unknown): StartupState {
  if (error instanceof DOMException && (error.name === 'NotAllowedError' || error.name === 'SecurityError')) {
    return 'camera-denied';
  }
  return 'camera-error';
}

export default function GesturesPage() {
  const { lang } = useI18n();
  const copy = COPY[lang];
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [startupState, setStartupState] = useState<StartupState>('starting');
  const [recognizedGesture, setRecognizedGesture] = useState<GestureType | null>(null);
  const [handCount, setHandCount] = useState(0);
  const [runId, setRunId] = useState(0);

  useEffect(() => {
    let cancelled = false;
    let animationFrame = 0;
    let resultTimer = 0;
    let stream: MediaStream | null = null;
    let lastInferenceAt = 0;
    let visibleHandCount = -1;
    const recognizer = new GestureRecognizer();
    const videoElement = videoRef.current;
    const canvasElement = canvasRef.current;

    const stopStream = (mediaStream: MediaStream | null) => {
      mediaStream?.getTracks().forEach((track) => track.stop());
    };

    const start = async () => {
      setStartupState('starting');
      setRecognizedGesture(null);
      setHandCount(0);

      if (!navigator.mediaDevices?.getUserMedia) {
        setStartupState('unsupported');
        return;
      }

      const detectorRequest = loadHandDetector();
      const cameraRequest = navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: 'user',
          width: { ideal: 720 },
          height: { ideal: 1_280 },
        },
      });
      const [detectorResult, cameraResult] = await Promise.allSettled([
        detectorRequest,
        cameraRequest,
      ]);

      if (cancelled) {
        if (cameraResult.status === 'fulfilled') stopStream(cameraResult.value);
        return;
      }
      if (cameraResult.status === 'rejected') {
        setStartupState(cameraFailureState(cameraResult.reason));
        return;
      }
      if (detectorResult.status === 'rejected') {
        stopStream(cameraResult.value);
        setStartupState('model-error');
        return;
      }

      stream = cameraResult.value;
      const detector = detectorResult.value;
      const video = videoElement;
      const canvas = canvasElement;
      if (!video || !canvas) {
        stopStream(stream);
        return;
      }

      try {
        video.srcObject = stream;
        await video.play();
      } catch (error) {
        stopStream(stream);
        setStartupState(cameraFailureState(error));
        return;
      }

      if (cancelled) {
        stopStream(stream);
        return;
      }

      setStartupState('ready');

      const infer = async (time: number) => {
        if (cancelled) return;
        if (time - lastInferenceAt < 55 || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
          animationFrame = requestAnimationFrame((nextTime) => void infer(nextTime));
          return;
        }
        lastInferenceAt = time;

        try {
          const hands = (await detector.estimateHands(video, {
            flipHorizontal: true,
            staticImageMode: false,
          })).filter((hand) => hand.score >= 0.6);

          if (cancelled) return;
          const frame = { width: video.videoWidth, height: video.videoHeight };
          drawHands(canvas, hands, frame);

          if (visibleHandCount !== hands.length) {
            visibleHandCount = hands.length;
            setHandCount(hands.length);
          }

          const result = recognizer.addFrame({
            timestamp: performance.now(),
            hands: hands.map((hand) => toHandObservation(hand, frame)),
          });
          if (result) {
            window.clearTimeout(resultTimer);
            setRecognizedGesture(result.type);
            resultTimer = window.setTimeout(() => setRecognizedGesture(null), 1_800);
          }
        } catch {
          if (!cancelled) {
            stopStream(stream);
            stream = null;
            video.srcObject = null;
            setStartupState('model-error');
          }
          return;
        }

        animationFrame = requestAnimationFrame((nextTime) => void infer(nextTime));
      };

      animationFrame = requestAnimationFrame((time) => void infer(time));
    };

    void start();

    return () => {
      cancelled = true;
      cancelAnimationFrame(animationFrame);
      window.clearTimeout(resultTimer);
      recognizer.reset();
      stopStream(stream);
      if (videoElement) videoElement.srcObject = null;
    };
  }, [runId]);

  const gestureLabel = recognizedGesture === '67'
    ? copy.gesture67
    : recognizedGesture === 'swipe-left'
      ? copy.swipeLeft
      : copy.swipeRight;

  const errorContent = startupState === 'camera-denied'
    ? { title: copy.cameraDeniedTitle, body: copy.cameraDeniedBody }
    : startupState === 'camera-error'
      ? { title: copy.cameraErrorTitle, body: copy.cameraErrorBody }
      : startupState === 'model-error'
        ? { title: copy.modelErrorTitle, body: copy.modelErrorBody }
        : { title: copy.unsupportedTitle, body: copy.unsupportedBody };

  const hasError = !['starting', 'ready'].includes(startupState);

  return (
    <div className="flex h-dvh w-full flex-col overflow-hidden bg-background pb-[112px] text-foreground">
      <header className="mx-auto w-full max-w-lg px-5 pb-4 pt-[max(14px,env(safe-area-inset-top))]">
        <p className="mb-1 text-[10px] font-bold tracking-[0.18em] text-muted-foreground">
          {copy.eyebrow}
        </p>
        <div className="flex items-end justify-between gap-4">
          <div>
            <h1 className="text-[28px] font-bold leading-none tracking-[-0.03em]">{copy.title}</h1>
            <p className="mt-2 text-[14px] text-muted-foreground">{copy.subtitle}</p>
          </div>
          <div className="mb-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-[0_0_0_6px_rgba(200,241,53,0.12)]">
            <Hand className="h-5 w-5" strokeWidth={2.4} />
          </div>
        </div>
      </header>

      <main className="mx-auto min-h-0 w-full max-w-lg flex-1 px-4">
        <section className="relative h-full min-h-[360px] overflow-hidden rounded-[32px] border border-white/10 bg-[#070806] shadow-[0_24px_70px_rgba(0,0,0,0.28)]">
          <video
            ref={videoRef}
            aria-label={copy.title}
            className="absolute inset-0 h-full w-full -scale-x-100 object-cover"
            muted
            playsInline
          />
          <canvas
            ref={canvasRef}
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 h-full w-full object-cover"
          />

          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(2,3,2,0.68)_0%,transparent_28%,transparent_58%,rgba(2,3,2,0.82)_100%)]" />
          <div className="pointer-events-none absolute inset-3 rounded-[24px] border border-white/12" />
          <div className="pointer-events-none absolute left-1/2 top-1/2 h-[44%] w-[76%] -translate-x-1/2 -translate-y-1/2 rounded-[50%] border border-primary/20 shadow-[0_0_80px_rgba(200,241,53,0.08)]" />

          <div className="absolute left-6 right-6 top-6 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 rounded-full border border-white/10 bg-black/45 px-3 py-2 text-[11px] font-semibold text-white backdrop-blur-md">
              {startupState === 'starting' ? (
                <LoaderCircle className="h-3.5 w-3.5 animate-spin text-primary" />
              ) : (
                <span className="h-2 w-2 rounded-full bg-primary shadow-[0_0_12px_#C8F135]" />
              )}
              {startupState === 'ready' ? copy.ready : copy.starting}
            </div>
            {startupState === 'ready' ? (
              <div className="rounded-full border border-white/10 bg-black/45 px-3 py-2 text-[11px] font-semibold text-white/80 backdrop-blur-md">
                {copy.hands(handCount)}
              </div>
            ) : null}
          </div>

          {startupState === 'starting' ? (
            <div className="absolute inset-0 flex items-center justify-center px-8">
              <div className="flex flex-col items-center text-center text-white">
                <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-full border border-primary/25 bg-primary/10">
                  <LoaderCircle className="h-7 w-7 animate-spin text-primary" />
                </div>
                <p className="text-[17px] font-semibold">{copy.starting}</p>
              </div>
            </div>
          ) : null}

          {hasError ? (
            <div className="absolute inset-0 flex items-center justify-center bg-[#070806]/92 px-8" role="alert">
              <div className="max-w-[290px] text-center text-white">
                <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-white/8">
                  <Camera className="h-7 w-7 text-primary" />
                </div>
                <h2 className="text-[20px] font-bold tracking-[-0.02em]">{errorContent.title}</h2>
                <p className="mt-2 text-[14px] leading-relaxed text-white/60">{errorContent.body}</p>
                <button
                  type="button"
                  onClick={() => setRunId((value) => value + 1)}
                  className="mt-6 inline-flex h-12 items-center gap-2 rounded-full bg-primary px-5 text-[14px] font-bold text-primary-foreground transition-transform active:scale-95"
                >
                  <RefreshCw className="h-4 w-4" />
                  {copy.retry}
                </button>
              </div>
            </div>
          ) : null}

          {startupState === 'ready' ? (
            <>
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center px-6" aria-live="polite">
                <AnimatePresence mode="wait">
                  {recognizedGesture ? (
                    <motion.div
                      key={recognizedGesture}
                      initial={{ opacity: 0, scale: 0.78, y: 12 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 1.08 }}
                      transition={{ type: 'spring', stiffness: 420, damping: 24 }}
                      className="rounded-[28px] border border-primary/40 bg-primary px-7 py-5 text-center text-primary-foreground shadow-[0_0_60px_rgba(200,241,53,0.42)]"
                    >
                      <p className="text-[9px] font-black tracking-[0.2em] opacity-65">{copy.detected}</p>
                      <p className="mt-1 text-[34px] font-black leading-none tracking-[-0.04em]">{gestureLabel}</p>
                    </motion.div>
                  ) : (
                    <motion.div
                      key="prompt"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="rounded-full border border-white/12 bg-black/30 px-5 py-3 text-[14px] font-semibold text-white/85 backdrop-blur-sm"
                    >
                      {copy.showGesture}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <div className="absolute bottom-5 left-5 right-5">
                <div className="mb-3 grid grid-cols-2 gap-2 text-[10px] font-semibold text-white/75">
                  <div className="rounded-2xl border border-white/10 bg-black/35 px-3 py-2.5 backdrop-blur-md">{copy.hint67}</div>
                  <div className="rounded-2xl border border-white/10 bg-black/35 px-3 py-2.5 backdrop-blur-md">{copy.hintSwipe}</div>
                </div>
                <div className="flex items-center justify-center gap-1.5 text-[10px] font-medium text-white/55">
                  <ShieldCheck className="h-3.5 w-3.5 text-primary" />
                  {copy.privacy}
                </div>
              </div>
            </>
          ) : null}
        </section>
      </main>
    </div>
  );
}
