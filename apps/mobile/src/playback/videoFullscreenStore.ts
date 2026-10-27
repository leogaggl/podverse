type Listener = () => void;

let videoPresented = false;
let videoFullscreen = false;

const presentedListeners = new Set<Listener>();
const fullscreenListeners = new Set<Listener>();

const emitPresented = (): void => {
  presentedListeners.forEach((listener) => {
    listener();
  });
};

const emitFullscreen = (): void => {
  fullscreenListeners.forEach((listener) => {
    listener();
  });
};

export const subscribeVideoPresented = (listener: Listener): (() => void) => {
  presentedListeners.add(listener);
  return () => {
    presentedListeners.delete(listener);
  };
};

export const getVideoPresentedSnapshot = (): boolean => videoPresented;

export const subscribeVideoFullscreen = (listener: Listener): (() => void) => {
  fullscreenListeners.add(listener);
  return () => {
    fullscreenListeners.delete(listener);
  };
};

export const getVideoFullscreenSnapshot = (): boolean => videoFullscreen;

export const isVideoFullscreenActive = (): boolean => videoFullscreen;

export const setVideoPresented = (presented: boolean): void => {
  if (presented === videoPresented) {
    return;
  }
  videoPresented = presented;
  emitPresented();
  if (!presented && videoFullscreen) {
    videoFullscreen = false;
    emitFullscreen();
  }
};

export const enterVideoFullscreen = (): void => {
  if (videoFullscreen) {
    return;
  }
  videoFullscreen = true;
  emitFullscreen();
};

export const exitVideoFullscreen = (): void => {
  if (!videoFullscreen) {
    return;
  }
  videoFullscreen = false;
  emitFullscreen();
};
