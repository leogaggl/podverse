package expo.modules.podversemediaengine

import android.util.Log
import org.json.JSONObject

// Native-cache payload parser for the Android Auto browse tree. Decodes the opaque JSON strings
// returned by PodverseNativeCache.read into typed nodes the MediaLibraryService maps to Media3
// MediaItems.
//
// JS-dead contract: these payloads are the ONLY browse source in the car (SQLite is phone-UI-only).
// The TypeScript source of truth is apps/mobile/src/data/nativeCache/projection.ts. Parsing is
// deliberately tolerant: unknown keys are ignored, a missing or mismatched
// schemaVersion yields an empty list, and any malformed entry is skipped rather than throwing — the
// service must render an empty tree, never crash, when the cache is absent/corrupt.
object PodverseNativeCacheModel {
  private const val TAG = "PodverseNativeCache"

  // Must match NATIVE_CACHE_SCHEMA_VERSION in projection.ts.
  private const val EXPECTED_SCHEMA_VERSION = 2

  data class BrowseNode(
    val idText: String,
    val title: String,
    val kind: String,
    val artworkUrl: String?,
    val childCount: Int?,
    val mediumBucket: String,
  )

  data class DownloadEntry(
    val idText: String,
    val title: String,
    val filePath: String,
    val artworkUrl: String?,
    val mediaUrl: String?,
    val channelTitle: String?,
  )

  data class QueueEntry(
    val idText: String,
    val title: String,
    val artworkUrl: String?,
    val mediaUrl: String?,
    val podcastTitle: String?,
    val startPositionSeconds: Double?,
    val downloadFileName: String?,
  )

  data class QueueSnapshot(
    val nowPlayingIdText: String?,
    val entries: List<QueueEntry>,
  )

  data class ChildItem(
    val idText: String,
    val title: String,
    val subtitle: String?,
    val artworkUrl: String?,
    val mediaUrl: String?,
    val downloadFileName: String?,
    val progressSeconds: Double?,
    val played: Boolean?,
  )

  data class HistoryEntry(
    val idText: String,
    val title: String,
    val channelTitle: String?,
    val artworkUrl: String?,
    val mediaUrl: String?,
    val downloadFileName: String?,
  )

  data class LiveEntry(
    val idText: String,
    val title: String,
    val channelIdText: String,
    val channelTitle: String?,
    val artworkUrl: String?,
    val mediaUrl: String,
  )

  fun parseBrowseNodes(json: String?): List<BrowseNode> {
    val root = decodeEnvelope(json, "library-index") ?: return emptyList()
    val array = root.optJSONArray("nodes") ?: return emptyList()
    val nodes = ArrayList<BrowseNode>(array.length())
    for (i in 0 until array.length()) {
      val obj = array.optJSONObject(i) ?: continue
      val idText = obj.optString("idText").takeIf { it.isNotBlank() } ?: continue
      val title = obj.optString("title").takeIf { it.isNotBlank() } ?: continue
      nodes.add(
        BrowseNode(
          idText = idText,
          title = title,
          kind = obj.optString("kind").takeIf { it.isNotBlank() } ?: "podcast",
          artworkUrl = optStringOrNull(obj, "artworkUrl"),
          childCount =
            if (obj.has("childCount") && !obj.isNull("childCount")) obj.optInt("childCount")
            else null,
          mediumBucket = obj.optString("mediumBucket").takeIf { it.isNotBlank() } ?: "av",
        ))
    }
    return nodes
  }

  fun parseDownloadEntries(json: String?): List<DownloadEntry> {
    val root = decodeEnvelope(json, "downloads") ?: return emptyList()
    val array = root.optJSONArray("entries") ?: return emptyList()
    val entries = ArrayList<DownloadEntry>(array.length())
    for (i in 0 until array.length()) {
      val obj = array.optJSONObject(i) ?: continue
      val idText = obj.optString("idText").takeIf { it.isNotBlank() } ?: continue
      val title = obj.optString("title").takeIf { it.isNotBlank() } ?: continue
      val filePath = obj.optString("filePath").takeIf { it.isNotBlank() } ?: continue
      entries.add(
        DownloadEntry(
          idText = idText,
          title = title,
          filePath = filePath,
          artworkUrl = optStringOrNull(obj, "artworkUrl"),
          mediaUrl = optStringOrNull(obj, "mediaUrl"),
          channelTitle = optStringOrNull(obj, "channelTitle"),
        ))
    }
    return entries
  }

  fun parseQueueSnapshot(json: String?): QueueSnapshot {
    val root = decodeEnvelope(json, "queue") ?: return QueueSnapshot(null, emptyList())
    val nowPlayingIdText = optStringOrNull(root, "nowPlayingIdText")
    val array = root.optJSONArray("entries") ?: return QueueSnapshot(nowPlayingIdText, emptyList())
    val entries = ArrayList<QueueEntry>(array.length())
    for (i in 0 until array.length()) {
      val obj = array.optJSONObject(i) ?: continue
      val idText = obj.optString("idText").takeIf { it.isNotBlank() } ?: continue
      val title = obj.optString("title").takeIf { it.isNotBlank() } ?: continue
      entries.add(
        QueueEntry(
          idText = idText,
          title = title,
          artworkUrl = optStringOrNull(obj, "artworkUrl"),
          mediaUrl = optStringOrNull(obj, "mediaUrl"),
          podcastTitle = optStringOrNull(obj, "podcastTitle"),
          startPositionSeconds =
            if (obj.has("startPositionSeconds") && !obj.isNull("startPositionSeconds"))
              obj.optDouble("startPositionSeconds")
            else null,
          downloadFileName = optStringOrNull(obj, "downloadFileName"),
        ))
    }
    return QueueSnapshot(nowPlayingIdText, entries)
  }

  fun parseChildItems(json: String?): List<ChildItem> {
    val root = decodeEnvelope(json, "library-children") ?: return emptyList()
    val array = root.optJSONArray("items") ?: return emptyList()
    val items = ArrayList<ChildItem>(array.length())
    for (i in 0 until array.length()) {
      val obj = array.optJSONObject(i) ?: continue
      val idText = obj.optString("idText").takeIf { it.isNotBlank() } ?: continue
      val title = obj.optString("title").takeIf { it.isNotBlank() } ?: continue
      items.add(
        ChildItem(
          idText = idText,
          title = title,
          subtitle = optStringOrNull(obj, "subtitle"),
          artworkUrl = optStringOrNull(obj, "artworkUrl"),
          mediaUrl = optStringOrNull(obj, "mediaUrl"),
          downloadFileName = optStringOrNull(obj, "downloadFileName"),
          progressSeconds =
            if (obj.has("progressSeconds") && !obj.isNull("progressSeconds"))
              obj.optDouble("progressSeconds")
            else null,
          played = if (obj.has("played") && !obj.isNull("played")) obj.optBoolean("played") else null,
        ))
    }
    return items
  }

  fun parseHistoryEntries(json: String?): List<HistoryEntry> {
    val root = decodeEnvelope(json, "history") ?: return emptyList()
    val array = root.optJSONArray("entries") ?: return emptyList()
    val entries = ArrayList<HistoryEntry>(array.length())
    for (i in 0 until array.length()) {
      val obj = array.optJSONObject(i) ?: continue
      val idText = obj.optString("idText").takeIf { it.isNotBlank() } ?: continue
      val title = obj.optString("title").takeIf { it.isNotBlank() } ?: continue
      entries.add(
        HistoryEntry(
          idText = idText,
          title = title,
          channelTitle = optStringOrNull(obj, "channelTitle"),
          artworkUrl = optStringOrNull(obj, "artworkUrl"),
          mediaUrl = optStringOrNull(obj, "mediaUrl"),
          downloadFileName = optStringOrNull(obj, "downloadFileName"),
        ))
    }
    return entries
  }

  fun parseLiveEntries(json: String?): List<LiveEntry> {
    val root = decodeEnvelope(json, "live") ?: return emptyList()
    val array = root.optJSONArray("entries") ?: return emptyList()
    val entries = ArrayList<LiveEntry>(array.length())
    for (i in 0 until array.length()) {
      val obj = array.optJSONObject(i) ?: continue
      val idText = obj.optString("idText").takeIf { it.isNotBlank() } ?: continue
      val title = obj.optString("title").takeIf { it.isNotBlank() } ?: continue
      val channelIdText = obj.optString("channelIdText").takeIf { it.isNotBlank() } ?: continue
      val mediaUrl = obj.optString("mediaUrl").takeIf { it.isNotBlank() } ?: continue
      entries.add(
        LiveEntry(
          idText = idText,
          title = title,
          channelIdText = channelIdText,
          channelTitle = optStringOrNull(obj, "channelTitle"),
          artworkUrl = optStringOrNull(obj, "artworkUrl"),
          mediaUrl = mediaUrl,
        ))
    }
    return entries
  }

  fun isSignedIn(json: String?): Boolean {
    val root = decodeEnvelope(json, "account-context") ?: return false
    return root.optBoolean("signedIn", false)
  }

  private fun decodeEnvelope(json: String?, label: String): JSONObject? {
    if (json.isNullOrBlank()) return null
    return try {
      val root = JSONObject(json)
      val version = root.optInt("schemaVersion", -1)
      if (version != EXPECTED_SCHEMA_VERSION) {
        Log.i(TAG, "$label schemaVersion=$version (expected $EXPECTED_SCHEMA_VERSION) — empty tree")
        null
      } else {
        root
      }
    } catch (error: Exception) {
      Log.w(TAG, "$label parse failed: ${error.message}")
      null
    }
  }

  private fun optStringOrNull(obj: JSONObject, key: String): String? =
    if (obj.has(key) && !obj.isNull(key)) obj.optString(key).takeIf { it.isNotBlank() } else null
}
