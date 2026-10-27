package expo.modules.podversemediaengine

import android.app.Activity
import android.app.PictureInPictureParams
import android.content.Context
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.util.Rational
import android.view.TextureView
import android.view.View
import android.view.ViewGroup
import androidx.activity.ComponentActivity
import androidx.lifecycle.Lifecycle
import java.lang.ref.WeakReference

// The ONE native video surface for the process. Mini player and full player are two React views
// over a single ExoPlayer and a single TextureView; expanding **reparents** THIS view into the
// active RN target instead of creating a second player or mounting a second RN <Video>.
//
// TextureView (not SurfaceView): SurfaceView has a separate compositor window and throws
// `IllegalStateException: child already has a parent` when reparented during React Navigation
// native-stack modal fragment transitions (MainActivity onPause). TextureView is a normal view and
// reparents cleanly between the mini and full PodverseVideoSurfaceView hosts.
object PodverseVideoSurfaceHost {
  /** Stable target ids the single surface can occupy. RN mounts a `PodverseVideoSurfaceView` each. */
  const val TARGET_MINI = "mini"
  const val TARGET_FULL = "full"

  private val mainHandler = Handler(Looper.getMainLooper())

  /** The one and only video TextureView. Bound to the shared ExoPlayer via the engine. */
  private var textureView: TextureView? = null

  /** RN-mounted target views by id. The single surface is reparented into the active target's view. */
  private val targetViews = mutableMapOf<String, WeakReference<ViewGroup>>()

  /** The target the surface occupies (`null` when unplaced / hidden). */
  private var activeTarget: String? = null

  /**
   * Last capability reported by the engine. The surface only shows when the current item actually
   * has video frames — so a video-medium item playing its audio enclosure never leaves a black
   * rectangle.
   */
  private var currentItemHasVideo = false

  /**
   * JS-desired visibility for the active target (RN drives this from the playback target kind via
   * `setVideoSurfaceVisible`). Final visibility = `desiredVisible && currentItemHasVideo`.
   */
  private var desiredVisible = false

  /** Video fullscreen is showing. Picture-in-picture is offered only from that surface. */
  private var fullscreenActive = false

  private var videoWidth = 0
  private var videoHeight = 0
  private var activityRef = WeakReference<Activity>(null)
  private var pipListenerActivity: Activity? = null
  private var lastPresented: Boolean? = null

  /** Fired when the surface's presented state changes. */
  var onVideoPresentedChanged: ((Boolean) -> Unit)? = null

  /** Fired when the system picture-in-picture window starts or stops. `restore` is the second value. */
  var onPictureInPictureChanged: ((Boolean, Boolean) -> Unit)? = null

  private var engineHooksInstalled = false

  /**
   * Return the single [TextureView], creating it and binding it to the shared ExoPlayer on first
   * use. There is exactly one surface for the process; callers must not create their own.
   */
  fun getOrCreateSurface(context: Context): TextureView {
    return onMainSync {
      textureView
        ?: TextureView(context.applicationContext).also { view ->
          view.visibility = View.GONE
          textureView = view
          // Bind the one texture to the one shared player.
          PodverseAudioEngine.attachVideoTextureView(view)
          ensureEngineHooks()
        }
    }
  }

  // MARK: - RN-facing API (called by PodverseVideoSurfaceView + the Expo module)

  /**
   * Register (or replace) the RN view for [target]. The first registered target becomes active so
   * the single surface is placed; if [target] is active, reparent into it. Never loads/releases.
   */
  fun registerTargetView(target: String, view: ViewGroup) {
    onMain {
      targetViews[target] = WeakReference(view)
      if (activeTarget == null) {
        activeTarget = target
      }
      if (activeTarget == target) {
        reparentIntoActiveTarget()
      }
    }
  }

  /**
   * Unregister an RN view (on RN unmount). Only clears when the going-away view is the registered
   * one (avoids clobbering a re-registered view during a fast remount). If it was the
   * active target's view, detach the surface (kept alive; just no host).
   */
  fun unregisterTargetView(target: String, view: ViewGroup) {
    onMain {
      if (targetViews[target]?.get() === view) {
        targetViews.remove(target)
        if (activeTarget == target) {
          (textureView?.parent as? ViewGroup)?.removeView(textureView)
          updateVisibility()
        }
      }
    }
  }

  /**
   * Move the single surface to a registered target. Only reparenting/geometry changes; the ExoPlayer
   * and playhead are untouched.
   */
  fun setActiveTarget(target: String, animatedDurationMs: Long = 0) {
    onMain {
      activeTarget = target
      reparentIntoActiveTarget()
    }
  }

  /**
   * Set the JS-desired visibility for the active target (RN drives this from the playback target
   * kind). The surface only actually shows when the current item also has video frames. Never
   * releases the player.
   */
  fun setVisible(visible: Boolean) {
    onMain {
      desiredVisible = visible
      updateVisibility()
      refreshPictureInPicture()
    }
  }

  /** Video fullscreen changed. Picture-in-picture is offered only from that surface. */
  fun setFullscreenActive(active: Boolean, activity: Activity?) {
    onMain {
      fullscreenActive = active
      if (activity != null) {
        activityRef = WeakReference(activity)
        attachPipListener(activity)
      }
      refreshPictureInPicture()
    }
  }

  fun isFullscreenActive(): Boolean = fullscreenActive

  fun isVideoPresented(): Boolean {
    val hasHost = activeTarget?.let { targetViews[it]?.get() } != null
    return desiredVisible && currentItemHasVideo && hasHost
  }

  /** True when leaving the app should move fullscreen video into picture-in-picture. */
  fun shouldEnterPictureInPicture(): Boolean {
    return fullscreenActive && currentItemHasVideo && PodverseAudioEngine.isPlaybackActive()
  }

  /**
   * Home gesture on API 26–30. API 31+ enters from [PictureInPictureParams.setAutoEnterEnabled]
   * after this clears a fixed orientation, which would otherwise refuse the window.
   */
  fun onUserLeaveHint(activity: Activity) {
    if (!shouldEnterPictureInPicture()) return
    activity.requestedOrientation = android.content.pm.ActivityInfo.SCREEN_ORIENTATION_UNSPECIFIED
    publishPictureInPictureParams(activity)
    if (Build.VERSION.SDK_INT in 26..30) {
      enterPictureInPicture(activity)
    }
  }

  fun publishPictureInPictureParams(activity: Activity) {
    if (Build.VERSION.SDK_INT < 26) return
    try {
      activity.setPictureInPictureParams(buildPictureInPictureParams())
    } catch (_: IllegalStateException) {
      // The activity does not support picture-in-picture until the manifest flag is in the build.
    } catch (_: IllegalArgumentException) {
      // Aspect ratio outside the platform range. Skip the update.
    }
  }

  /** True when the current item has video frames to present. */
  fun hasVideo(): Boolean = currentItemHasVideo

  /**
   * Called from the active target view's `onLayout` so the surface tracks size changes (rotation,
   * mini↔full). Main-thread only.
   */
  fun layoutSurface(view: ViewGroup, target: String) {
    onMain {
      if (activeTarget != target || targetViews[target]?.get() !== view) return@onMain
      val tv = textureView ?: return@onMain
      val params = tv.layoutParams ?: ViewGroup.LayoutParams(view.width, view.height)
      params.width = view.width.coerceAtLeast(1)
      params.height = view.height.coerceAtLeast(1)
      tv.layoutParams = params
    }
  }

  // MARK: - Helpers

  /**
   * Reparent the single texture into the active target's RN view and fill its bounds. Safe no-op
   * when the active target has no registered view yet. Defensive remove-before-add so a concurrent
   * register during modal fragment attach cannot throw `child already has a parent`.
   */
  private fun reparentIntoActiveTarget() {
    val target = activeTarget ?: run {
      updateVisibility()
      return
    }
    val host = targetViews[target]?.get() ?: run {
      updateVisibility()
      return
    }
    val tv = getOrCreateSurface(host.context)
    if (tv.parent === host) {
      updateVisibility()
      return
    }
    (tv.parent as? ViewGroup)?.removeView(tv)
    if (tv.parent != null) {
      (tv.parent as? ViewGroup)?.removeView(tv)
    }
    if (tv.parent == null) {
      val width = if (host.width > 0) host.width else ViewGroup.LayoutParams.MATCH_PARENT
      val height = if (host.height > 0) host.height else ViewGroup.LayoutParams.MATCH_PARENT
      host.addView(tv, ViewGroup.LayoutParams(width, height))
    }
    updateVisibility()
  }

  /** Recompute surface visibility from JS intent + native capability + placement. Main-thread only. */
  private fun updateVisibility() {
    val hasHost = activeTarget?.let { targetViews[it]?.get() } != null
    val presented = desiredVisible && currentItemHasVideo && hasHost
    textureView?.visibility = if (presented) View.VISIBLE else View.GONE
    if (lastPresented == presented) return
    lastPresented = presented
    onVideoPresentedChanged?.invoke(presented)
  }

  private fun ensureEngineHooks() {
    if (engineHooksInstalled) return
    engineHooksInstalled = true
    PodverseAudioEngine.onVideoCapabilityChanged = { hasVideo ->
      onMain {
        currentItemHasVideo = hasVideo
        updateVisibility()
        refreshPictureInPicture()
      }
    }
    PodverseAudioEngine.onVideoSizeChanged = { width, height ->
      onMain {
        videoWidth = width
        videoHeight = height
        refreshPictureInPicture()
      }
    }
    PodverseAudioEngine.onPlaybackPlayingChanged = {
      onMain { refreshPictureInPicture() }
    }
  }

  private fun refreshPictureInPicture() {
    val activity = activityRef.get() ?: return
    publishPictureInPictureParams(activity)
  }

  private fun attachPipListener(activity: Activity) {
    val component = activity as? ComponentActivity ?: return
    if (pipListenerActivity === component) return
    pipListenerActivity = component
    component.addOnPictureInPictureModeChangedListener { info ->
      val active = info.isInPictureInPictureMode
      val restore =
        !active && component.lifecycle.currentState.isAtLeast(Lifecycle.State.STARTED)
      onPictureInPictureChanged?.invoke(active, restore)
    }
  }

  private fun enterPictureInPicture(activity: Activity) {
    if (Build.VERSION.SDK_INT < 26) return
    try {
      activity.enterPictureInPictureMode(buildPictureInPictureParams())
    } catch (_: IllegalStateException) {
      // Fixed orientation or a build without the picture-in-picture manifest flag.
    }
  }

  private fun buildPictureInPictureParams(): PictureInPictureParams {
    val builder = PictureInPictureParams.Builder()
    if (videoWidth > 0 && videoHeight > 0) {
      builder.setAspectRatio(clampedAspectRatio(videoWidth, videoHeight))
    }
    if (Build.VERSION.SDK_INT >= 31) {
      builder.setAutoEnterEnabled(shouldEnterPictureInPicture())
    }
    return builder.build()
  }

  /** Platform accepts ratios from about 1:2.39 through 2.39:1. */
  private fun clampedAspectRatio(width: Int, height: Int): Rational {
    val safeHeight = height.coerceAtLeast(1)
    var ratio = width.coerceAtLeast(1).toFloat() / safeHeight.toFloat()
    ratio = ratio.coerceIn(0.418410f, 2.39f)
    return Rational((ratio * 1000).toInt().coerceAtLeast(1), 1000)
  }

  private fun onMain(work: () -> Unit) {
    if (Looper.myLooper() == Looper.getMainLooper()) work() else mainHandler.post(work)
  }

  private fun <T> onMainSync(block: () -> T): T {
    if (Looper.myLooper() == Looper.getMainLooper()) return block()
    val latch = java.util.concurrent.CountDownLatch(1)
    var result: T? = null
    var error: Throwable? = null
    mainHandler.post {
      try {
        result = block()
      } catch (t: Throwable) {
        error = t
      } finally {
        latch.countDown()
      }
    }
    latch.await()
    error?.let { throw it }
    @Suppress("UNCHECKED_CAST")
    return result as T
  }
}
