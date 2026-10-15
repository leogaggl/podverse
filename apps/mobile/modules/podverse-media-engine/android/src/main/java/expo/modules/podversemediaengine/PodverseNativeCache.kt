package expo.modules.podversemediaengine

import android.content.Context
import android.util.Log
import java.io.File
import org.json.JSONObject

// Durable native-cache storage.
//
// JS mirrors queue / downloads / library-index snapshots into app-private files whenever phone-side
// state changes. Android Auto connects to PodverseMediaLibraryService (NOT the Activity), so the
// service reads these files with the app process killed and JS not running
// (DOCS-MOBILE-CARPLAY-ANDROID-AUTO.md). Each payload carries a schemaVersion + updatedAtMs
// envelope; this layer stores opaque JSON and never re-decides queue policy (that stays in
// @podverse/playback-core). No Google Play Services dependency.

/** One persisted payload kind; [fileName] is the on-disk name under the cache directory. */
enum class PodverseNativeCacheKind(val fileName: String) {
  QUEUE("queue-snapshot.json"),
  QUEUE_AV("queue-snapshot-av.json"),
  QUEUE_MUSIC("queue-snapshot-music.json"),
  DOWNLOADS("downloads-index.json"),
  LIBRARY_BROWSE("library-index.json"),
  HISTORY("history-index.json"),
  LIVE("live-index.json"),
  PLAYBACK_JOURNAL("playback-journal.json"),
  ACCOUNT_CONTEXT("account-context.json"),
}

object PodverseNativeCache {
  private const val TAG = "PodverseNativeCache"
  private const val DIR_NAME = "native-cache"
  private const val CHILDREN_DIR = "library-children"

  private fun directory(context: Context): File =
    File(context.filesDir, DIR_NAME).apply {
      if (!exists()) {
        mkdirs()
      }
    }

  private fun file(context: Context, kind: PodverseNativeCacheKind): File =
    File(directory(context), kind.fileName)

  private fun sanitizeFileName(value: String): String =
    value.map { ch -> if (ch.isLetterOrDigit() || ch == '-' || ch == '_' || ch == '.') ch else '_' }
      .joinToString("")

  private fun childrenFile(context: Context, channelIdText: String): File =
    File(File(directory(context), CHILDREN_DIR).apply { mkdirs() }, "${sanitizeFileName(channelIdText)}.json")

  /**
   * Atomically persist a JSON payload. Best-effort: logs and returns `false` on failure so a bridge
   * write never rolls back the successful phone-side mutation that triggered it. Last-write-wins per
   * payload is acceptable for v1.
   */
  fun write(context: Context, kind: PodverseNativeCacheKind, json: String): Boolean {
    return writeAtomically(file(context, kind), json, kind.name)
  }

  fun writeLibraryChildren(context: Context, channelIdText: String, json: String): Boolean {
    return writeAtomically(childrenFile(context, channelIdText), json, "library-children")
  }

  private fun writeAtomically(target: File, json: String, label: String): Boolean {
    return try {
      val tmp = File(target.parentFile, ".${target.name}.tmp")
      tmp.writeText(json, Charsets.UTF_8)
      if (tmp.renameTo(target)) {
        true
      } else {
        target.writeText(json, Charsets.UTF_8)
        tmp.delete()
        true
      }
    } catch (error: Exception) {
      Log.w(TAG, "write failed for $label: ${error.message}")
      false
    }
  }

  /**
   * Read a persisted JSON payload with the app force-stopped for Android Auto browse.
   * Returns `null` when missing or unreadable; callers render an empty browse tree and never crash.
   */
  fun read(context: Context, kind: PodverseNativeCacheKind): String? {
    return try {
      when (kind) {
        PodverseNativeCacheKind.LIBRARY_BROWSE -> {
          val primary = file(context, kind)
          if (primary.exists()) {
            primary.readText(Charsets.UTF_8)
          } else {
            val legacy = File(directory(context), "library-browse-index.json")
            if (legacy.exists()) legacy.readText(Charsets.UTF_8) else null
          }
        }
        PodverseNativeCacheKind.QUEUE_AV -> {
          val primary = file(context, kind)
          if (primary.exists()) {
            primary.readText(Charsets.UTF_8)
          } else {
            read(context, PodverseNativeCacheKind.QUEUE)
          }
        }
        else -> {
          val target = file(context, kind)
          if (target.exists()) target.readText(Charsets.UTF_8) else null
        }
      }
    } catch (error: Exception) {
      Log.w(TAG, "read failed for ${kind.name}: ${error.message}")
      null
    }
  }

  fun readLibraryChildren(context: Context, channelIdText: String): String? {
    return try {
      val target = childrenFile(context, channelIdText)
      if (target.exists()) target.readText(Charsets.UTF_8) else null
    } catch (error: Exception) {
      Log.w(TAG, "readLibraryChildren failed: ${error.message}")
      null
    }
  }

  /**
   * Read every payload and log a one-line summary (presence, byte size, parsed `schemaVersion`).
   * Called from [PodverseMediaLibraryService.onCreate], which Android Auto / DHU starts WITHOUT the
   * Activity or JS runtime. Never throws.
   */
  fun debugDump(context: Context): String {
    val parts =
      PodverseNativeCacheKind.values().map { kind ->
        val label = kind.name.lowercase()
        val json = read(context, kind)
        if (json == null) {
          "$label=absent"
        } else {
          val bytes = json.toByteArray(Charsets.UTF_8).size
          "$label=present(bytes:$bytes,schemaVersion:${schemaVersion(json) ?: "?"})"
        }
      }
    val summary = "debugDump " + parts.joinToString(" ")
    Log.i(TAG, summary)
    return summary
  }

  private fun schemaVersion(json: String): Int? {
    return try {
      JSONObject(json).optInt("schemaVersion", -1).takeIf { it >= 0 }
    } catch (error: Exception) {
      null
    }
  }

  private const val JOURNAL_MAX_ENTRIES = 200

  /** Append one playback-journal entry. Bounded; soft-fail. */
  fun appendJournalEntry(context: Context, entry: Map<String, Any?>): Boolean {
    return try {
      val existingJson = read(context, PodverseNativeCacheKind.PLAYBACK_JOURNAL)
      val entries = org.json.JSONArray()
      var nextSeq = 1
      if (existingJson != null) {
        val obj = JSONObject(existingJson)
        val arr = obj.optJSONArray("entries")
        if (arr != null) {
          for (i in 0 until arr.length()) {
            entries.put(arr.getJSONObject(i))
          }
          if (arr.length() > 0) {
            nextSeq = arr.getJSONObject(arr.length() - 1).optInt("seq", 0) + 1
          }
        }
      }
      val row = JSONObject()
      for ((key, value) in entry) {
        row.put(key, value ?: JSONObject.NULL)
      }
      row.put("seq", nextSeq)
      if (!row.has("occurredAtMs")) {
        row.put("occurredAtMs", System.currentTimeMillis())
      }
      entries.put(row)
      while (entries.length() > JOURNAL_MAX_ENTRIES) {
        entries.remove(0)
      }
      val payload =
        JSONObject()
          .put("schemaVersion", 2)
          .put("updatedAtMs", System.currentTimeMillis())
          .put("entries", entries)
      write(context, PodverseNativeCacheKind.PLAYBACK_JOURNAL, payload.toString())
    } catch (error: Exception) {
      Log.w(TAG, "appendJournalEntry failed: ${error.message}")
      false
    }
  }

  fun accountIdTextFromContext(context: Context): String? {
    val json = read(context, PodverseNativeCacheKind.ACCOUNT_CONTEXT) ?: return null
    return try {
      JSONObject(json).optString("accountIdText").takeIf { it.isNotBlank() }
    } catch (_: Exception) {
      null
    }
  }

  fun latestJournalPosition(context: Context, idText: String): Pair<Double, Long>? {
    val json = read(context, PodverseNativeCacheKind.PLAYBACK_JOURNAL) ?: return null
    return try {
      val arr = JSONObject(json).optJSONArray("entries") ?: return null
      for (i in arr.length() - 1 downTo 0) {
        val entry = arr.getJSONObject(i)
        if (entry.optString("idText") == idText && entry.has("positionSeconds")) {
          return Pair(entry.optDouble("positionSeconds"), entry.optLong("occurredAtMs"))
        }
      }
      null
    } catch (_: Exception) {
      null
    }
  }

  fun clearAccountScopedFiles(context: Context) {
    val kinds =
      listOf(
        PodverseNativeCacheKind.QUEUE,
        PodverseNativeCacheKind.QUEUE_AV,
        PodverseNativeCacheKind.QUEUE_MUSIC,
        PodverseNativeCacheKind.HISTORY,
        PodverseNativeCacheKind.LIVE,
        PodverseNativeCacheKind.LIBRARY_BROWSE,
        PodverseNativeCacheKind.PLAYBACK_JOURNAL,
        PodverseNativeCacheKind.ACCOUNT_CONTEXT,
      )
    for (kind in kinds) {
      try {
        file(context, kind).delete()
      } catch (_: Exception) {
      }
    }
    try {
      File(directory(context), CHILDREN_DIR).deleteRecursively()
    } catch (_: Exception) {
    }
  }
}
