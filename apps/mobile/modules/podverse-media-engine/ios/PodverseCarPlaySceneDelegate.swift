import CarPlay
import Foundation

// CarPlay audio scene. iOS instantiates this for the CarPlay scene role even when the phone app
// has never been foregrounded / is force-quit. Browse IA: Podcasts | Music | Queue | Downloads.
// Cache JSON only — no SQLite, no network for browse.
@objc(PodverseCarPlaySceneDelegate)
public final class PodverseCarPlaySceneDelegate: NSObject, CPTemplateApplicationSceneDelegate {
  private var interfaceController: CPInterfaceController?
  private var cacheDirectorySource: DispatchSourceFileSystemObject?
  private var cacheDirectoryFileDescriptor: Int32 = -1
  private var cacheReloadWorkItem: DispatchWorkItem?

  public func templateApplicationScene(
    _ templateApplicationScene: CPTemplateApplicationScene,
    didConnect interfaceController: CPInterfaceController
  ) {
    self.interfaceController = interfaceController
    PodverseNativeCache.debugDump()
    NotificationCenter.default.post(name: .podverseCarPlayDidConnect, object: nil)
    interfaceController.setRootTemplate(makeTabBar(), animated: false, completion: nil)
    startCacheDirectoryWatcher()
  }

  public func templateApplicationScene(
    _ templateApplicationScene: CPTemplateApplicationScene,
    didDisconnectInterfaceController interfaceController: CPInterfaceController
  ) {
    if self.interfaceController === interfaceController {
      stopCacheDirectoryWatcher()
      self.interfaceController = nil
    }
  }

  // MARK: - Cache change reload

  /// Watch the App Group native-cache directory so browse tabs refresh when JS reprojects (CarPlay
  /// connect sync, phone foreground sync) while the scene is still connected.
  private func startCacheDirectoryWatcher() {
    stopCacheDirectoryWatcher()
    guard let directory = PodverseNativeCache.cacheDirectoryURL() else { return }
    let fd = open(directory.path, O_EVTONLY)
    guard fd >= 0 else { return }
    cacheDirectoryFileDescriptor = fd
    let source = DispatchSource.makeFileSystemObjectSource(
      fileDescriptor: fd, eventMask: [.write, .extend, .attrib, .rename, .delete],
      queue: .main)
    source.setEventHandler { [weak self] in
      self?.scheduleRootTemplateReload()
    }
    source.setCancelHandler {
      close(fd)
    }
    cacheDirectorySource = source
    source.resume()
  }

  private func stopCacheDirectoryWatcher() {
    cacheReloadWorkItem?.cancel()
    cacheReloadWorkItem = nil
    cacheDirectorySource?.cancel()
    cacheDirectorySource = nil
    cacheDirectoryFileDescriptor = -1
  }

  private func scheduleRootTemplateReload() {
    cacheReloadWorkItem?.cancel()
    let work = DispatchWorkItem { [weak self] in
      self?.reloadRootTemplate()
    }
    cacheReloadWorkItem = work
    // Debounce bursty multi-file projection writes into one tab rebuild.
    DispatchQueue.main.asyncAfter(deadline: .now() + 0.4, execute: work)
  }

  private func reloadRootTemplate() {
    guard let interfaceController = interfaceController else { return }
    // Rebuild only when the root tab bar is showing so a mid-drill-down push is not discarded.
    if interfaceController.templates.count <= 1 {
      interfaceController.setRootTemplate(makeTabBar(), animated: false, completion: nil)
    }
  }

  private func makeTabBar() -> CPTabBarTemplate {
    let podcasts = makePodcastsTemplate()
    podcasts.tabTitle = "Podcasts"
    podcasts.tabImage = UIImage(systemName: "mic.fill")

    let music = makeMusicTemplate()
    music.tabTitle = "Music"
    music.tabImage = UIImage(systemName: "music.note")

    let queue = makeQueueTemplate()
    let signedIn = PodverseCarPlayCacheModel.isSignedIn(PodverseNativeCache.read(.accountContext))
    queue.tabTitle = signedIn ? "Queue" : "Recent"
    queue.tabImage = UIImage(systemName: "list.bullet")

    let downloads = makeDownloadsTemplate()
    downloads.tabTitle = "Downloads"
    downloads.tabImage = UIImage(systemName: "arrow.down.circle.fill")

    return CPTabBarTemplate(templates: [podcasts, music, queue, downloads])
  }

  private func makePodcastsTemplate() -> CPListTemplate {
    let live = PodverseCarPlayCacheModel.parseLiveEntries(PodverseNativeCache.read(.live))
    let nodes = PodverseCarPlayCacheModel.parseBrowseNodes(PodverseNativeCache.read(.libraryBrowse))
      .filter { $0.mediumBucket != "music" }

    var sections: [CPListSection] = []
    if !live.isEmpty {
      let items = live.map { entry -> CPListItem in
        let item = CPListItem(text: entry.title, detailText: entry.channelTitle)
        item.handler = { [weak self] _, completion in
          self?.playLive(entry)
          completion()
        }
        return item
      }
      sections.append(CPListSection(items: items, header: "Live Now", sectionIndexTitle: nil))
    }
    let channelItems = nodes.map { node -> CPListItem in
      let item = CPListItem(text: node.title, detailText: nil)
      item.handler = { [weak self] _, completion in
        self?.pushChannelChildren(node)
        completion()
      }
      return item
    }
    if channelItems.isEmpty && live.isEmpty {
      sections.append(
        CPListSection(items: [
          CPListItem(text: "Open Podverse on your phone to sync", detailText: nil)
        ]))
    } else if !channelItems.isEmpty {
      sections.append(CPListSection(items: channelItems, header: "Podcasts", sectionIndexTitle: nil))
    }
    return CPListTemplate(title: "Podcasts", sections: sections)
  }

  private func makeMusicTemplate() -> CPListTemplate {
    let nodes = PodverseCarPlayCacheModel.parseBrowseNodes(PodverseNativeCache.read(.libraryBrowse))
      .filter { $0.mediumBucket == "music" }
    let items = nodes.map { node -> CPListItem in
      let item = CPListItem(text: node.title, detailText: nil)
      item.handler = { [weak self] _, completion in
        self?.pushChannelChildren(node)
        completion()
      }
      return item
    }
    let sectionItems =
      items.isEmpty
      ? [CPListItem(text: "Open Podverse on your phone to sync", detailText: nil)] : items
    return CPListTemplate(title: "Music", sections: [CPListSection(items: sectionItems)])
  }

  private func makeQueueTemplate() -> CPListTemplate {
    let av = PodverseCarPlayCacheModel.parseQueueSnapshot(PodverseNativeCache.read(.queueAv))
    let music = PodverseCarPlayCacheModel.parseQueueSnapshot(PodverseNativeCache.read(.queueMusic))
    let history = PodverseCarPlayCacheModel.parseHistoryEntries(PodverseNativeCache.read(.history))
    let signedIn = PodverseCarPlayCacheModel.isSignedIn(PodverseNativeCache.read(.accountContext))

    var sections: [CPListSection] = []
    if signedIn {
      if !av.entries.isEmpty {
        sections.append(
          CPListSection(
            items: queueItems(av.entries), header: "Up Next", sectionIndexTitle: nil))
      }
      if !music.entries.isEmpty {
        sections.append(
          CPListSection(
            items: queueItems(music.entries), header: "Up Next Music", sectionIndexTitle: nil))
      }
      if !history.isEmpty {
        sections.append(
          CPListSection(
            items: historyItems(history), header: "Recently Played", sectionIndexTitle: nil))
      }
    } else {
      let resume = av.entries.first ?? music.entries.first
      if let resume = resume {
        sections.append(CPListSection(items: queueItems([resume]), header: "Resume", sectionIndexTitle: nil))
      }
      if !history.isEmpty {
        sections.append(
          CPListSection(items: historyItems(history), header: "Recent", sectionIndexTitle: nil))
      }
    }
    if sections.isEmpty {
      sections.append(
        CPListSection(items: [
          CPListItem(text: "Open Podverse on your phone to sync", detailText: nil)
        ]))
    }
    return CPListTemplate(title: signedIn ? "Queue" : "Recent", sections: sections)
  }

  /// "Artist · Album" when the download names an artist, else the album or podcast title.
  private func downloadDetail(_ entry: PodverseCarPlayCacheModel.DownloadEntry) -> String? {
    guard let artist = entry.artist else { return entry.channelTitle }
    return [artist, entry.channelTitle].compactMap { $0 }.joined(separator: " · ")
  }

  private func makeDownloadsTemplate() -> CPListTemplate {
    let downloads = PodverseCarPlayCacheModel.parseDownloadEntries(
      PodverseNativeCache.read(.downloads))
    let items = downloads.map { entry -> CPListItem in
      let item = CPListItem(text: entry.title, detailText: downloadDetail(entry))
      item.handler = { [weak self] _, completion in
        self?.playDownload(entry)
        completion()
      }
      return item
    }
    let sectionItems =
      items.isEmpty
      ? [CPListItem(text: "No downloads yet", detailText: nil)] : items
    return CPListTemplate(title: "Downloads", sections: [CPListSection(items: sectionItems)])
  }

  private func queueItems(_ entries: [PodverseCarPlayCacheModel.QueueEntry]) -> [CPListItem] {
    entries.map { entry in
      let item = CPListItem(text: entry.title, detailText: entry.podcastTitle)
      item.handler = { [weak self] _, completion in
        self?.playQueueEntry(entry, queueMedium: "av")
        completion()
      }
      return item
    }
  }

  private func historyItems(_ entries: [PodverseCarPlayCacheModel.HistoryEntry]) -> [CPListItem] {
    entries.map { entry in
      let item = CPListItem(text: entry.title, detailText: entry.channelTitle)
      item.handler = { [weak self] _, completion in
        self?.playHistory(entry)
        completion()
      }
      return item
    }
  }

  private func pushChannelChildren(_ node: PodverseCarPlayCacheModel.BrowseNode) {
    let children = PodverseCarPlayCacheModel.parseChildItems(
      PodverseNativeCache.readLibraryChildren(channelIdText: node.idText))
    let items = children.map { child -> CPListItem in
      var detail: String? = child.subtitle
      if child.played == true {
        detail = [detail, "Played"].compactMap { $0 }.joined(separator: " · ")
      } else if let progress = child.progressSeconds, progress > 0 {
        detail = [detail, "In progress"].compactMap { $0 }.joined(separator: " · ")
      }
      if child.downloadFileName != nil {
        detail = [detail, "Downloaded"].compactMap { $0 }.joined(separator: " · ")
      }
      let item = CPListItem(text: child.title, detailText: detail)
      item.handler = { [weak self] _, completion in
        self?.playChild(child, node: node)
        completion()
      }
      return item
    }
    let sectionItems =
      items.isEmpty
      ? [CPListItem(text: "Open Podverse on your phone to sync", detailText: nil)] : items
    let template = CPListTemplate(title: node.title, sections: [CPListSection(items: sectionItems)])
    interfaceController?.pushTemplate(template, animated: true, completion: nil)
  }

  private func playChild(
    _ child: PodverseCarPlayCacheModel.ChildItem, node: PodverseCarPlayCacheModel.BrowseNode
  ) {
    let url = resolvePlayableURL(
      filePath: child.downloadFileName ?? "", mediaUrl: child.mediaUrl)
    guard let url = url else {
      presentOfflineAlert()
      return
    }
    let journal = PodverseNativeCache.latestJournalPosition(idText: child.idText)
    let seek = journal?.position ?? child.progressSeconds
    let album = child.subtitle ?? node.title
    playURL(
      url, idText: child.idText, title: child.title, artworkUrl: child.artworkUrl,
      queueMedium: node.mediumBucket, isLive: false, seek: seek,
      subtitle: child.artist ?? album, albumTitle: child.artist != nil ? album : nil)
  }

  private func playQueueEntry(
    _ entry: PodverseCarPlayCacheModel.QueueEntry, queueMedium: String
  ) {
    let url = resolvePlayableURL(
      filePath: entry.downloadFileName ?? "", mediaUrl: entry.mediaUrl)
    guard let url = url else {
      presentOfflineAlert()
      return
    }
    let journal = PodverseNativeCache.latestJournalPosition(idText: entry.idText)
    let seek = journal?.position ?? entry.startPositionSeconds
    playURL(
      url, idText: entry.idText, title: entry.title, artworkUrl: entry.artworkUrl,
      queueMedium: queueMedium, isLive: false, seek: seek,
      subtitle: entry.artist ?? entry.podcastTitle,
      albumTitle: entry.artist != nil ? entry.podcastTitle : nil)
  }

  private func playHistory(_ entry: PodverseCarPlayCacheModel.HistoryEntry) {
    let url = resolvePlayableURL(
      filePath: entry.downloadFileName ?? "", mediaUrl: entry.mediaUrl)
    guard let url = url else {
      presentOfflineAlert()
      return
    }
    playURL(
      url, idText: entry.idText, title: entry.title, artworkUrl: entry.artworkUrl,
      queueMedium: "av", isLive: false, seek: nil,
      subtitle: entry.artist ?? entry.channelTitle,
      albumTitle: entry.artist != nil ? entry.channelTitle : nil)
  }

  private func playDownload(_ entry: PodverseCarPlayCacheModel.DownloadEntry) {
    guard let url = resolvePlayableURL(filePath: entry.filePath, mediaUrl: entry.mediaUrl) else {
      presentOfflineAlert()
      return
    }
    let journal = PodverseNativeCache.latestJournalPosition(idText: entry.idText)
    playURL(
      url, idText: entry.idText, title: entry.title, artworkUrl: entry.artworkUrl,
      queueMedium: "av", isLive: false, seek: journal?.position,
      subtitle: entry.artist ?? entry.channelTitle,
      albumTitle: entry.artist != nil ? entry.channelTitle : nil)
  }

  private func playLive(_ entry: PodverseCarPlayCacheModel.LiveEntry) {
    playURL(
      entry.mediaUrl, idText: entry.idText, title: entry.title, artworkUrl: entry.artworkUrl,
      queueMedium: "av", isLive: true, seek: nil, subtitle: entry.channelTitle)
  }

  private func playURL(
    _ url: String, idText: String, title: String, artworkUrl: String?, queueMedium: String,
    isLive: Bool, seek: Double?, subtitle: String? = nil, albumTitle: String? = nil
  ) {
    var meta: [String: Any] = [
      "idText": idText,
      "kind": "item",
      "queueMedium": queueMedium,
      "title": title,
      "origin": "car",
      "isLive": isLive,
    ]
    if let artworkUrl = artworkUrl { meta["artworkUrl"] = artworkUrl }
    if let subtitle = subtitle { meta["subtitle"] = subtitle }
    if let albumTitle = albumTitle { meta["albumTitle"] = albumTitle }
    let metaJson =
      (try? JSONSerialization.data(withJSONObject: meta)).flatMap {
        String(data: $0, encoding: .utf8)
      }
    do {
      try PodverseAudioEngine.shared.loadAndStart(
        url: url, initialSeekSeconds: isLive ? nil : seek, basicAuth: nil, audioProfile: nil,
        metaJson: metaJson)
      PodverseAudioEngine.shared.setNowPlayingMetadata(
        title: title, artist: subtitle, albumTitle: albumTitle)
      interfaceController?.pushTemplate(CPNowPlayingTemplate.shared, animated: true, completion: nil)
    } catch {
      NSLog("[carplay] play failed idText=%@: %@", idText, error.localizedDescription)
      presentOfflineAlert()
    }
  }

  private func presentOfflineAlert() {
    let ok = CPAlertAction(title: "OK", style: .default) { _ in }
    let alert = CPAlertTemplate(
      titleVariants: ["A connection is needed to play this item."], actions: [ok])
    interfaceController?.presentTemplate(alert, animated: true, completion: nil)
  }

  private func resolvePlayableURL(filePath: String, mediaUrl: String?) -> String? {
    if !filePath.isEmpty {
      if let local = resolveDownloadFileURL(filePath) { return local }
    }
    if let mediaUrl = mediaUrl, !mediaUrl.isEmpty { return mediaUrl }
    return nil
  }

  private func resolveDownloadFileURL(_ stored: String) -> String? {
    if stored.hasPrefix("content://") { return stored }
    let fileName =
      stored.hasPrefix("downloads/")
      ? String(stored.dropFirst("downloads/".count)) : stored
    guard !fileName.isEmpty else { return nil }
    guard
      let documents = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask).first
    else { return nil }
    let url = documents.appendingPathComponent("downloads", isDirectory: true)
      .appendingPathComponent(fileName, isDirectory: false)
    if FileManager.default.fileExists(atPath: url.path) {
      return url.absoluteString
    }
    return nil
  }
}

extension Notification.Name {
  static let podverseCarPlayDidConnect = Notification.Name("podverseCarPlayDidConnect")
}
