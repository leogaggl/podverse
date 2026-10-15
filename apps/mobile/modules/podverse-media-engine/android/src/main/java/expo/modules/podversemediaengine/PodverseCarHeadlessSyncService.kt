package expo.modules.podversemediaengine

import android.content.Intent
import android.util.Log
import com.facebook.react.HeadlessJsTaskService
import com.facebook.react.bridge.Arguments
import com.facebook.react.jstasks.HeadlessJsTaskConfig

/**
 * Headless JS entry for car background sync. Under bridgeless Expo SDK 57 this may fail to start;
 * [PodverseCarSyncScheduler] treats that as soft-fail and relies on the native playback journal.
 */
class PodverseCarHeadlessSyncService : HeadlessJsTaskService() {
  override fun getTaskConfig(intent: Intent?): HeadlessJsTaskConfig? {
    val reason = intent?.getStringExtra("reason") ?: "unknown"
    Log.i(TAG, "getTaskConfig reason=$reason")
    val data = Arguments.createMap()
    data.putString("reason", reason)
    return HeadlessJsTaskConfig(
      "PodverseCarBackgroundSync",
      data,
      60_000L,
      true,
    )
  }

  companion object {
    private const val TAG = "PodverseCarHeadless"
  }
}
