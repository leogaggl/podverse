package expo.modules.podversemediaengine

import android.content.Context
import android.os.Build
import android.view.OrientationEventListener
import android.view.Surface
import android.view.WindowManager

/**
 * Physical phone attitude, independent of the activity's requested orientation.
 * Samples only while video fullscreen asks for them.
 */
object PodverseDeviceOrientation {
  var onChange: ((Boolean) -> Unit)? = null

  private var listener: OrientationEventListener? = null
  private var lastAngle = OrientationEventListener.ORIENTATION_UNKNOWN
  private var lastLandscape: Boolean? = null

  fun isLandscape(context: Context): Boolean {
    if (lastAngle != OrientationEventListener.ORIENTATION_UNKNOWN) {
      return isLandscapeAngle(lastAngle)
    }
    val rotation =
      if (Build.VERSION.SDK_INT >= 30) {
        context.display?.rotation
      } else {
        @Suppress("DEPRECATION")
        (context.getSystemService(Context.WINDOW_SERVICE) as? WindowManager)?.defaultDisplay?.rotation
      }
    return rotation == Surface.ROTATION_90 || rotation == Surface.ROTATION_270
  }

  fun start(context: Context) {
    if (listener != null) {
      emit()
      return
    }
    val created =
      object : OrientationEventListener(context.applicationContext) {
        override fun onOrientationChanged(orientation: Int) {
          if (orientation == ORIENTATION_UNKNOWN) return
          lastAngle = orientation
          emit()
        }
      }
    if (!created.canDetectOrientation()) return
    created.enable()
    listener = created
  }

  fun stop() {
    listener?.disable()
    listener = null
    lastLandscape = null
  }

  private fun emit() {
    val landscape = isLandscapeAngle(lastAngle)
    if (lastLandscape == landscape) return
    lastLandscape = landscape
    onChange?.invoke(landscape)
  }

  private fun isLandscapeAngle(angle: Int): Boolean {
    return angle in 45..134 || angle in 225..314
  }
}
