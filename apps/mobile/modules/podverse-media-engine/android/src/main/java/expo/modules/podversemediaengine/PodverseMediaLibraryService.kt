package expo.modules.podversemediaengine

import android.app.PendingIntent
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.util.Log
import androidx.media3.common.C
import androidx.media3.common.MediaItem
import androidx.media3.common.MediaMetadata
import androidx.media3.common.Player
import androidx.media3.session.LibraryResult
import androidx.media3.session.MediaLibraryService
import androidx.media3.session.MediaSession
import androidx.media3.session.SessionCommands
import com.google.common.collect.ImmutableList
import com.google.common.util.concurrent.Futures
import com.google.common.util.concurrent.ListenableFuture
import org.json.JSONObject

// Media3 MediaLibraryService wrapping the single shared ExoPlayer. Browse tree reads durable
// native cache only (JS may be dead). Tree: Podcasts / Music / Queue / Downloads.
class PodverseMediaLibraryService : MediaLibraryService() {
  private var librarySession: MediaLibrarySession? = null

  override fun onCreate() {
    super.onCreate()
    PodverseNativeCache.debugDump(this)
    val player = PodverseSessionPlayer(this, PodverseAudioEngine.getOrCreatePlayer(this))
    val sessionBuilder =
      MediaLibrarySession.Builder(this, player, LibraryCallback())
        .setId("podverse_media_library")
    buildSessionActivityPendingIntent()?.let { sessionBuilder.setSessionActivity(it) }
    librarySession = sessionBuilder.build()
    PodverseCarSyncScheduler.onAutoConnected(this)
  }

  private fun buildSessionActivityPendingIntent(): PendingIntent? {
    val launchIntent =
      packageManager.getLaunchIntentForPackage(packageName)?.apply {
        flags = Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP
      } ?: return null
    val flags =
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
      } else {
        PendingIntent.FLAG_UPDATE_CURRENT
      }
    return PendingIntent.getActivity(this, 0, launchIntent, flags)
  }

  override fun onGetSession(controllerInfo: MediaSession.ControllerInfo): MediaLibrarySession? {
    return librarySession
  }

  override fun onDestroy() {
    librarySession?.release()
    librarySession = null
    super.onDestroy()
  }

  fun notifyCacheChanged() {
    librarySession?.notifyChildrenChanged(ROOT_ID, Int.MAX_VALUE, null)
    librarySession?.notifyChildrenChanged(PODCASTS_ID, Int.MAX_VALUE, null)
    librarySession?.notifyChildrenChanged(MUSIC_ID, Int.MAX_VALUE, null)
    librarySession?.notifyChildrenChanged(QUEUE_ID, Int.MAX_VALUE, null)
    librarySession?.notifyChildrenChanged(DOWNLOADS_ID, Int.MAX_VALUE, null)
  }

  private inner class LibraryCallback : MediaLibrarySession.Callback {
    override fun onConnect(
      session: MediaSession,
      controller: MediaSession.ControllerInfo
    ): MediaSession.ConnectionResult {
      val isTrustedCaller =
        session.isMediaNotificationController(controller) ||
          session.isAutoCompanionController(controller) ||
          session.isAutomotiveController(controller) ||
          controller.packageName == packageName
      if (isTrustedCaller) {
        return MediaSession.ConnectionResult.AcceptedResultBuilder(session).build()
      }
      Log.i(TAG, "onConnect player-only caller=${controller.packageName}")
      return MediaSession.ConnectionResult.AcceptedResultBuilder(session)
        .setAvailableSessionCommands(SessionCommands.EMPTY)
        .build()
    }

    override fun onGetLibraryRoot(
      session: MediaLibrarySession,
      browser: MediaSession.ControllerInfo,
      params: MediaLibraryService.LibraryParams?
    ): ListenableFuture<LibraryResult<MediaItem>> {
      val rootMetadata =
        MediaMetadata.Builder()
          .setIsBrowsable(true)
          .setIsPlayable(false)
          .setTitle("Podverse")
          .build()
      val root = MediaItem.Builder().setMediaId(ROOT_ID).setMediaMetadata(rootMetadata).build()
      return Futures.immediateFuture(LibraryResult.ofItem(root, params))
    }

    override fun onGetChildren(
      session: MediaLibrarySession,
      browser: MediaSession.ControllerInfo,
      parentId: String,
      page: Int,
      pageSize: Int,
      params: MediaLibraryService.LibraryParams?
    ): ListenableFuture<LibraryResult<ImmutableList<MediaItem>>> {
      val children =
        when {
          parentId == ROOT_ID -> rootChildren()
          parentId == PODCASTS_ID -> podcastsChildren()
          parentId == MUSIC_ID -> musicChildren()
          parentId == QUEUE_ID -> queueChildren()
          parentId == DOWNLOADS_ID -> downloadChildren()
          parentId.startsWith(CHANNEL_PREFIX) -> channelChildren(parentId.removePrefix(CHANNEL_PREFIX))
          else -> emptyList()
        }
      val paged = pageSlice(children, page, pageSize)
      return Futures.immediateFuture(
        LibraryResult.ofItemList(ImmutableList.copyOf(paged), params))
    }

    override fun onAddMediaItems(
      mediaSession: MediaSession,
      controller: MediaSession.ControllerInfo,
      mediaItems: MutableList<MediaItem>
    ): ListenableFuture<MutableList<MediaItem>> {
      val resolved = mediaItems.mapNotNull { resolveForPlayback(it) }.toMutableList()
      return Futures.immediateFuture(resolved)
    }

    override fun onSetMediaItems(
      mediaSession: MediaSession,
      controller: MediaSession.ControllerInfo,
      mediaItems: MutableList<MediaItem>,
      startIndex: Int,
      startPositionMs: Long
    ): ListenableFuture<MediaSession.MediaItemsWithStartPosition> {
      val first = mediaItems.firstOrNull() ?: return Futures.immediateFuture(
        MediaSession.MediaItemsWithStartPosition(emptyList(), 0, C.TIME_UNSET))
      val idText = first.mediaId.substringAfterLast('/')
      val playable = resolvePlayable(idText)
      if (playable == null) {
        return Futures.immediateFailedFuture(
          UnsupportedOperationException("No resolvable URL for $idText"))
      }
      val journal = PodverseNativeCache.latestJournalPosition(this@PodverseMediaLibraryService, idText)
      val seekMs =
        when {
          playable.isLive -> C.TIME_UNSET
          startPositionMs != C.TIME_UNSET -> startPositionMs
          journal != null -> (journal.first * 1000).toLong()
          playable.startPositionSeconds != null ->
            (playable.startPositionSeconds * 1000).toLong()
          else -> C.TIME_UNSET
        }
      // One item: the session player loads it through the engine, and what plays after it is the
      // queue's decision (JS when running, the projected snapshot when not).
      return Futures.immediateFuture(
        MediaSession.MediaItemsWithStartPosition(
          listOf(engineMediaItem(first.mediaId, idText, playable)), 0, seekMs))
    }

    override fun onPlaybackResumption(
      mediaSession: MediaSession,
      controller: MediaSession.ControllerInfo
    ): ListenableFuture<MediaSession.MediaItemsWithStartPosition> {
      val snapshot = readQueueSnapshot(PodverseNativeCacheKind.QUEUE_AV)
      val nowPlaying =
        snapshot.entries.firstOrNull { it.idText == snapshot.nowPlayingIdText }
          ?: snapshot.entries.firstOrNull()
          ?: return Futures.immediateFailedFuture(
            UnsupportedOperationException("No resumable media in cache"))
      val resolved =
        resolvePlayable(nowPlaying.idText)
          ?: return Futures.immediateFailedFuture(
            UnsupportedOperationException("Resume media has no resolvable URL"))
      val item = engineMediaItem("queue/${nowPlaying.idText}", nowPlaying.idText, resolved)
      val journal =
        PodverseNativeCache.latestJournalPosition(this@PodverseMediaLibraryService, nowPlaying.idText)
      val startMs =
        journal?.let { (it.first * 1000).toLong() }
          ?: nowPlaying.startPositionSeconds?.let { (it * 1000).toLong() }
          ?: C.TIME_UNSET
      return Futures.immediateFuture(
        MediaSession.MediaItemsWithStartPosition(listOf(item), 0, startMs))
    }
  }

  private fun rootChildren(): List<MediaItem> =
    listOf(
      browsableItem(PODCASTS_ID, "Podcasts", null, grid = false),
      browsableItem(MUSIC_ID, "Music", null, grid = false),
      browsableItem(QUEUE_ID, "Queue", null, grid = false),
      browsableItem(DOWNLOADS_ID, "Downloads", null, grid = false),
    )

  private fun podcastsChildren(): List<MediaItem> {
    val live =
      PodverseNativeCacheModel.parseLiveEntries(
        PodverseNativeCache.read(this, PodverseNativeCacheKind.LIVE))
    val nodes =
      readBrowseNodes().filter { it.mediumBucket != "music" }.map { node ->
        browsableItem("$CHANNEL_PREFIX${node.idText}", node.title, node.artworkUrl, grid = true)
      }
    val liveItems =
      live.map { entry ->
        playableItem("live/${entry.idText}", entry.title, entry.artworkUrl, entry.channelTitle)
      }
    return liveItems + nodes
  }

  private fun musicChildren(): List<MediaItem> =
    readBrowseNodes().filter { it.mediumBucket == "music" }.map { node ->
      browsableItem("$CHANNEL_PREFIX${node.idText}", node.title, node.artworkUrl, grid = true)
    }

  private fun queueChildren(): List<MediaItem> {
    val av = readQueueSnapshot(PodverseNativeCacheKind.QUEUE_AV)
    val music = readQueueSnapshot(PodverseNativeCacheKind.QUEUE_MUSIC)
    val history =
      PodverseNativeCacheModel.parseHistoryEntries(
        PodverseNativeCache.read(this, PodverseNativeCacheKind.HISTORY))
    val items = ArrayList<MediaItem>()
    for (entry in av.entries) {
      items.add(playableItem("queue/${entry.idText}", entry.title, entry.artworkUrl, entry.podcastTitle))
    }
    for (entry in music.entries) {
      items.add(
        playableItem("queue-music/${entry.idText}", entry.title, entry.artworkUrl, entry.podcastTitle))
    }
    for (entry in history) {
      items.add(
        playableItem("history/${entry.idText}", entry.title, entry.artworkUrl, entry.channelTitle))
    }
    return items
  }

  /** "Artist · Album" when the download names an artist, else the album or podcast title. */
  private fun downloadDetail(entry: PodverseNativeCacheModel.DownloadEntry): String? =
    if (entry.artist == null) entry.channelTitle
    else listOfNotNull(entry.artist, entry.channelTitle).joinToString(" · ")

  private fun downloadChildren(): List<MediaItem> =
    readDownloadEntries().map { entry ->
      playableItem(
        "$DOWNLOAD_ITEM_PREFIX${entry.idText}", entry.title, entry.artworkUrl, downloadDetail(entry))
    }

  private fun channelChildren(channelIdText: String): List<MediaItem> {
    val children =
      PodverseNativeCacheModel.parseChildItems(
        PodverseNativeCache.readLibraryChildren(this, channelIdText))
    return children.map { child ->
      val extras = Bundle()
      if (child.played == true) {
        extras.putInt("android.media.extra.PLAYBACK_STATUS", 2)
      } else if (child.progressSeconds != null && child.progressSeconds > 0) {
        extras.putInt("android.media.extra.PLAYBACK_STATUS", 1)
      }
      MediaItem.Builder()
        .setMediaId("item/${child.idText}")
        .setMediaMetadata(
          playableMetadata(child.title, child.artworkUrl, child.subtitle).buildUpon()
            .setExtras(extras)
            .build())
        .build()
    }
  }

  private fun readBrowseNodes(): List<PodverseNativeCacheModel.BrowseNode> =
    PodverseNativeCacheModel.parseBrowseNodes(
      PodverseNativeCache.read(this, PodverseNativeCacheKind.LIBRARY_BROWSE))

  private fun readDownloadEntries(): List<PodverseNativeCacheModel.DownloadEntry> =
    PodverseNativeCacheModel.parseDownloadEntries(
      PodverseNativeCache.read(this, PodverseNativeCacheKind.DOWNLOADS))

  private fun readQueueSnapshot(kind: PodverseNativeCacheKind): PodverseNativeCacheModel.QueueSnapshot =
    PodverseNativeCacheModel.parseQueueSnapshot(PodverseNativeCache.read(this, kind))

  private fun browsableItem(
    mediaId: String, title: String, artworkUrl: String?, grid: Boolean
  ): MediaItem {
    val extras = Bundle()
    extras.putInt(
      "androidx.media.utils.MediaConstants.CONTENT_STYLE_BROWSABLE_HINT",
      if (grid) 2 else 1)
    extras.putInt("androidx.media.utils.MediaConstants.CONTENT_STYLE_PLAYABLE_HINT", 1)
    val metadata =
      MediaMetadata.Builder()
        .setIsBrowsable(true)
        .setIsPlayable(false)
        .setTitle(title)
        .setExtras(extras)
        .apply { artworkUrl?.let { setArtworkUri(Uri.parse(it)) } }
        .build()
    return MediaItem.Builder().setMediaId(mediaId).setMediaMetadata(metadata).build()
  }

  private fun playableItem(
    mediaId: String, title: String, artworkUrl: String?, subtitle: String?
  ): MediaItem =
    MediaItem.Builder()
      .setMediaId(mediaId)
      .setMediaMetadata(playableMetadata(title, artworkUrl, subtitle))
      .build()

  private data class ResolvedMedia(
    val uri: String,
    val title: String,
    val artworkUrl: String?,
    val subtitle: String?,
    val startPositionSeconds: Double?,
    val queueMedium: String,
    val isLive: Boolean,
    val albumTitle: String? = null,
  )

  private fun resolveForPlayback(item: MediaItem): MediaItem? {
    val idText = item.mediaId.substringAfterLast('/')
    val resolved = resolvePlayable(idText) ?: return null
    return item
      .buildUpon()
      .setUri(Uri.parse(resolved.uri))
      .setMediaMetadata(
        playableMetadata(
          resolved.title, resolved.artworkUrl, resolved.subtitle, resolved.albumTitle))
      .build()
  }

  private fun resolvePlayable(idText: String): ResolvedMedia? {
    val live =
      PodverseNativeCacheModel.parseLiveEntries(
          PodverseNativeCache.read(this, PodverseNativeCacheKind.LIVE))
        .firstOrNull { it.idText == idText }
    if (live != null) {
      return ResolvedMedia(
        live.mediaUrl, live.title, live.artworkUrl, live.channelTitle, null, "av", true)
    }
    val download = readDownloadEntries().firstOrNull { it.idText == idText }
    if (download != null) {
      val uri = fileUriOrRemote(download.filePath, download.mediaUrl) ?: return null
      return ResolvedMedia(
        uri,
        download.title,
        download.artworkUrl,
        download.artist ?: download.channelTitle,
        null,
        "av",
        false,
        albumTitle = if (download.artist != null) download.channelTitle else null,
      )
    }
    for (kind in listOf(PodverseNativeCacheKind.QUEUE_AV, PodverseNativeCacheKind.QUEUE_MUSIC)) {
      val entry = readQueueSnapshot(kind).entries.firstOrNull { it.idText == idText }
      if (entry != null) {
        val uri = fileUriOrRemote(entry.downloadFileName ?: "", entry.mediaUrl) ?: continue
        return ResolvedMedia(
          uri,
          entry.title,
          entry.artworkUrl,
          entry.artist ?: entry.podcastTitle,
          entry.startPositionSeconds,
          if (kind == PodverseNativeCacheKind.QUEUE_MUSIC) "music" else "av",
          false,
          albumTitle = if (entry.artist != null) entry.podcastTitle else null,
        )
      }
    }
    val history =
      PodverseNativeCacheModel.parseHistoryEntries(
          PodverseNativeCache.read(this, PodverseNativeCacheKind.HISTORY))
        .firstOrNull { it.idText == idText }
    if (history != null) {
      val uri = fileUriOrRemote(history.downloadFileName ?: "", history.mediaUrl) ?: return null
      return ResolvedMedia(
        uri,
        history.title,
        history.artworkUrl,
        history.artist ?: history.channelTitle,
        null,
        "av",
        false,
        albumTitle = if (history.artist != null) history.channelTitle else null,
      )
    }
    // Channel children
    for (node in readBrowseNodes()) {
      val child =
        PodverseNativeCacheModel.parseChildItems(
            PodverseNativeCache.readLibraryChildren(this, node.idText))
          .firstOrNull { it.idText == idText } ?: continue
      val uri = fileUriOrRemote(child.downloadFileName ?: "", child.mediaUrl) ?: continue
      val album = child.subtitle ?: node.title
      return ResolvedMedia(
        uri,
        child.title,
        child.artworkUrl,
        child.artist ?: album,
        child.progressSeconds,
        node.mediumBucket,
        false,
        albumTitle = if (child.artist != null) album else null,
      )
    }
    return null
  }

  /** A resolved item carrying the engine source metadata [PodverseSessionPlayer] loads it with. */
  private fun engineMediaItem(mediaId: String, idText: String, playable: ResolvedMedia): MediaItem {
    val metaJson =
      JSONObject()
        .put("idText", idText)
        .put("kind", "item")
        .put("queueMedium", playable.queueMedium)
        .put("title", playable.title)
        .put("origin", "car")
        .put("isLive", playable.isLive)
        .apply {
          playable.artworkUrl?.let { put("artworkUrl", it) }
          playable.subtitle?.let { put("subtitle", it) }
          playable.albumTitle?.let { put("albumTitle", it) }
        }
        .toString()
    val metadata =
      playableMetadata(playable.title, playable.artworkUrl, playable.subtitle, playable.albumTitle)
    val extras = Bundle().apply { putString(PodverseSessionPlayer.META_JSON_EXTRA, metaJson) }
    return MediaItem.Builder()
      .setMediaId(mediaId)
      .setUri(Uri.parse(playable.uri))
      .setMediaMetadata(metadata.buildUpon().setExtras(extras).build())
      .build()
  }

  private fun fileUriOrRemote(filePath: String, mediaUrl: String?): String? {
    if (filePath.isNotBlank()) {
      resolveDownloadFileUri(filePath)?.let { return it }
    }
    return mediaUrl?.takeIf { it.isNotBlank() }
  }

  private fun resolveDownloadFileUri(stored: String): String? {
    if (stored.startsWith("content://")) return stored
    val fileName =
      when {
        stored.startsWith("file://") || stored.startsWith("/") ->
          stored.substringAfterLast('/').substringBefore('?')
        stored.startsWith("downloads/") -> stored.removePrefix("downloads/")
        else -> stored
      }
    if (fileName.isBlank()) return null
    val file = java.io.File(filesDir, "downloads/$fileName")
    if (file.exists()) return Uri.fromFile(file).toString()
    if (stored.startsWith("file://")) {
      val legacy = java.io.File(Uri.parse(stored).path ?: return null)
      if (legacy.exists()) return stored
    }
    return null
  }

  private fun playableMetadata(
    title: String, artworkUrl: String?, subtitle: String?, albumTitle: String? = null
  ): MediaMetadata =
    MediaMetadata.Builder()
      .setIsBrowsable(false)
      .setIsPlayable(true)
      .setTitle(title)
      .apply {
        subtitle?.let { setArtist(it) }
        albumTitle?.let { setAlbumTitle(it) }
        artworkUrl?.let { setArtworkUri(Uri.parse(it)) }
      }
      .build()

  private fun <T> pageSlice(items: List<T>, page: Int, pageSize: Int): List<T> {
    if (pageSize <= 0 || page < 0) return items
    val from = page * pageSize
    if (from >= items.size) return emptyList()
    return items.subList(from, minOf(from + pageSize, items.size))
  }

  private companion object {
    const val ROOT_ID = "podverse_root"
    const val PODCASTS_ID = "podcasts"
    const val MUSIC_ID = "music"
    const val QUEUE_ID = "queue"
    const val DOWNLOADS_ID = "downloads"
    const val CHANNEL_PREFIX = "channel/"
    const val DOWNLOAD_ITEM_PREFIX = "download/"
    const val TAG = "PodverseMediaLibrary"
  }
}
