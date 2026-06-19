export interface SWRegistrationState {
  ready: boolean;
  waiting: boolean;
  error: string | null;
}

export interface SWRegistrationCallbacks {
  onUpdateReady?: () => void;
  onRegistered?: (registration: ServiceWorkerRegistration) => void;
  onError?: (error: Error) => void;
}

export async function registerServiceWorker(
  callbacks: SWRegistrationCallbacks = {}
): Promise<SWRegistrationState> {
  const result: SWRegistrationState = {
    ready: false,
    waiting: false,
    error: null,
  };

  if (!("serviceWorker" in navigator)) {
    result.error = "当前浏览器不支持 Service Worker";
    return result;
  }

  if (!window.isSecureContext && location.hostname !== "localhost" && location.hostname !== "127.0.0.1") {
    result.error = "Service Worker 仅在 HTTPS 或 localhost 环境下可用";
    return result;
  }

  const swUrl = "/sw.js";

  try {
    const registration = await navigator.serviceWorker.register(swUrl, {
      scope: "/",
      updateViaCache: "imports",
    });

    result.ready = true;
    callbacks.onRegistered?.(registration);

    if (registration.waiting) {
      result.waiting = true;
      callbacks.onUpdateReady?.();
    }

    registration.addEventListener("updatefound", () => {
      const installingWorker = registration.installing;
      if (!installingWorker) return;

      installingWorker.addEventListener("statechange", () => {
        if (installingWorker.state === "installed" && navigator.serviceWorker.controller) {
          result.waiting = true;
          callbacks.onUpdateReady?.();
        }
      });
    });

    registration.addEventListener("waiting", () => {
      result.waiting = true;
      callbacks.onUpdateReady?.();
    });

    setInterval(() => {
      registration.update().catch(() => {});
    }, 60 * 60 * 1000);

    return result;
  } catch (err) {
    result.error = err instanceof Error ? err.message : String(err);
    callbacks.onError?.(err instanceof Error ? err : new Error(String(err)));
    return result;
  }
}

export function skipWaitingAndReload() {
  if (!("serviceWorker" in navigator)) return;
  navigator.serviceWorker.controller?.postMessage({ type: "SKIP_WAITING" });
  navigator.serviceWorker.getRegistration().then((registration) => {
    registration?.waiting?.postMessage({ type: "SKIP_WAITING" });
  });
  setTimeout(() => window.location.reload(), 300);
}

export function isServiceWorkerReady(): Promise<boolean> {
  if (!("serviceWorker" in navigator)) return Promise.resolve(false);
  return navigator.serviceWorker.ready.then(() => true).catch(() => false);
}
