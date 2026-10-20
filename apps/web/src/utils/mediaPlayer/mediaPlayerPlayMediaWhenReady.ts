export function waitForSourceUri(
  media: HTMLMediaElement | null,
  maxWaitMs = 1000,
  intervalMs = 50
): Promise<string | null> {
  return new Promise((resolve) => {
    const start = Date.now();
    const check = () => {
      const uri = media?.src || null;
      if (uri) {
        resolve(uri);
      } else if (Date.now() - start >= maxWaitMs) {
        resolve(null);
      } else {
        setTimeout(check, intervalMs);
      }
    };
    check();
  });
}

export function playMediaWhenReady(
  media: HTMLMediaElement | null,
  onPlayed?: () => void,
  onRejected?: (error: unknown) => void
) {
  if (!media) {
    return;
  }
  const start = () => {
    media.play().catch((error: unknown) => {
      onRejected?.(error);
    });
    if (onPlayed) {
      onPlayed();
    }
  };
  if (media.readyState >= 2) {
    // HAVE_CURRENT_DATA
    start();
  } else {
    const onCanPlay = () => {
      start();
      media.removeEventListener('canplay', onCanPlay);
    };
    media.addEventListener('canplay', onCanPlay);
  }
}
