package expo.modules.podversemediaengine

import android.content.Context
import android.content.Intent
import android.os.Handler
import android.os.Looper
import android.util.Log

/**
 * Triggers background car sync while Android Auto is connected. Attempts a headless JS task when
 * the React host can run; otherwise the native playback journal covers catch-up until the phone
 * app opens (plan 09 spike fallback).
 */
object PodverseCarSyncScheduler {
  private const val TAG = "PodverseCarSync"
  private val mainHandler = Handler(Looper.getMainLooper())
  private var periodic: Runnable? = null

  fun onAutoConnected(context: Context) {
    requestSync(context.applicationContext, reason = "auto_connect")
    startPeriodic(context.applicationContext)
  }

  fun onPlaybackPausedOrEnded(context: Context) {
    requestSync(context.applicationContext, reason = "playback_idle")
  }

  private fun startPeriodic(context: Context) {
    stopPeriodic()
    val runnable =
      object : Runnable {
        override fun run() {
          requestSync(context, reason = "periodic")
          mainHandler.postDelayed(this, 5 * 60 * 1000L)
        }
      }
    periodic = runnable
    mainHandler.postDelayed(runnable, 5 * 60 * 1000L)
  }

  private fun stopPeriodic() {
    periodic?.let { mainHandler.removeCallbacks(it) }
    periodic = null
  }

  private fun requestSync(context: Context, reason: String) {
    Log.i(TAG, "requestSync reason=$reason")
    try {
      val intent = Intent(context, PodverseCarHeadlessSyncService::class.java)
      intent.putExtra("reason", reason)
      context.startService(intent)
    } catch (error: Exception) {
      // Bridgeless Expo may reject headless JS; journal drain on next app open still applies.
      Log.w(TAG, "headless sync start failed (journal fallback): ${error.message}")
    }
  }
}
