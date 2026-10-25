import Foundation

// JS mirrors queue / downloads / library-index snapshots into these files whenever phone-side state
// changes. CarPlay and Android Auto load them with the JS runtime NOT running, so the car experience
// works "get in the car, browse and play, phone app never opened"
// (DOCS-MOBILE-CARPLAY-ANDROID-AUTO.md). Each payload carries a `schemaVersion` + `updatedAtMs`
// envelope; this layer stores opaque JSON and never re-decides queue policy (that stays in
// `@podverse/playback-core`).

/// One persisted payload kind. `rawValue` is only for logging; on-disk name is `fileName`.
enum PodverseNativeCacheKind: String, CaseIterable {
  case queueAv
  case queueMusic
  case advanceWindow
  case downloads
  case libraryBrowse
  case history
  case live
  case playbackJournal
  case accountContext

  var fileName: String {
    switch self {
    case .queueAv: return "queue-snapshot-av.json"
    case .queueMusic: return "queue-snapshot-music.json"
    case .advanceWindow: return "advance-window.json"
    case .downloads: return "downloads-index.json"
    case .libraryBrowse: return "library-index.json"
    case .history: return "history-index.json"
    case .live: return "live-index.json"
    case .playbackJournal: return "playback-journal.json"
    case .accountContext: return "account-context.json"
    }
  }
}

enum PodverseNativeCache {
  // App Group container id for sharing the cache with CarPlay. The App ID
  // `com.podverse.app.next` has this group provisioned. JS writes and the
  // CarPlay scene read from the same shared container, so browse/play work with the phone app
  // force-quit. Keep this in sync with `com.apple.security.application-groups` in app.config.ts.
  static let appGroupIdentifier: String? = "group.com.podverse.app.next"

  private static let directoryName = "native-cache"
  private static let childrenDirectoryName = "library-children"

  private static func baseDirectory() -> URL? {
    let fileManager = FileManager.default
    if let group = appGroupIdentifier,
      let container = fileManager.containerURL(forSecurityApplicationGroupIdentifier: group)
    {
      return container.appendingPathComponent(directoryName, isDirectory: true)
    }
    guard
      let support = fileManager.urls(for: .applicationSupportDirectory, in: .userDomainMask).first
    else {
      return nil
    }
    return support.appendingPathComponent(directoryName, isDirectory: true)
  }

  /// Cache directory for CarPlay file watchers. Creates the directory when missing so a watcher can
  /// attach before the first JS projection write.
  static func cacheDirectoryURL() -> URL? {
    guard let directory = baseDirectory() else { return nil }
    try? FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
    return directory
  }

  private static func fileURL(for kind: PodverseNativeCacheKind) -> URL? {
    guard let directory = baseDirectory() else { return nil }
    return directory.appendingPathComponent(kind.fileName, isDirectory: false)
  }

  private static func childrenFileURL(channelIdText: String) -> URL? {
    guard let directory = baseDirectory() else { return nil }
    let safe = sanitizeFileName(channelIdText)
    return directory
      .appendingPathComponent(childrenDirectoryName, isDirectory: true)
      .appendingPathComponent("\(safe).json", isDirectory: false)
  }

  private static func sanitizeFileName(_ value: String) -> String {
    let allowed = CharacterSet.alphanumerics.union(CharacterSet(charactersIn: "-_."))
    let scalars = value.unicodeScalars.map { allowed.contains($0) ? Character($0) : "_" }
    return String(scalars)
  }

  /// Atomically persist a JSON payload string. Best-effort: logs and returns `false` on failure so a
  /// bridge write never rolls back the successful phone-side mutation that triggered it.
  @discardableResult
  static func write(_ kind: PodverseNativeCacheKind, json: String) -> Bool {
    guard let directory = baseDirectory(), let url = fileURL(for: kind) else {
      NSLog("[native-cache] no base directory for \(kind.rawValue)")
      return false
    }
    return writeAtomically(json: json, to: url, directory: directory, label: kind.rawValue)
  }

  @discardableResult
  static func writeLibraryChildren(channelIdText: String, json: String) -> Bool {
    guard let directory = baseDirectory(), let url = childrenFileURL(channelIdText: channelIdText)
    else {
      NSLog("[native-cache] no base directory for library-children")
      return false
    }
    let childrenDir = directory.appendingPathComponent(childrenDirectoryName, isDirectory: true)
    return writeAtomically(json: json, to: url, directory: childrenDir, label: "library-children")
  }

  private static func writeAtomically(
    json: String, to url: URL, directory: URL, label: String
  ) -> Bool {
    guard let data = json.data(using: .utf8) else {
      NSLog("[native-cache] non-utf8 payload for \(label)")
      return false
    }
    do {
      try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
      try data.write(to: url, options: [.atomic])
      return true
    } catch {
      NSLog("[native-cache] write failed for \(label): \(error.localizedDescription)")
      return false
    }
  }

  /// Read a persisted JSON payload string with the JS runtime not running.
  /// Returns `nil` when missing or unreadable; callers render an empty tree and never crash.
  static func read(_ kind: PodverseNativeCacheKind) -> String? {
    guard let url = fileURL(for: kind) else { return nil }
    return readFile(url)
  }

  static func readLibraryChildren(channelIdText: String) -> String? {
    guard let url = childrenFileURL(channelIdText: channelIdText) else { return nil }
    return readFile(url)
  }

  private static func readFile(_ url: URL) -> String? {
    do {
      let data = try Data(contentsOf: url)
      return String(data: data, encoding: .utf8)
    } catch {
      return nil
    }
  }

  /// Read every payload and log a one-line summary (presence, byte size, parsed `schemaVersion`).
  /// Safe to call from a native entry point with the JS runtime not started. Never throws.
  @discardableResult
  static func debugDump() -> String {
    let parts = PodverseNativeCacheKind.allCases.map { kind -> String in
      guard let json = read(kind) else { return "\(kind.rawValue)=absent" }
      let version = schemaVersion(from: json).map(String.init) ?? "?"
      return "\(kind.rawValue)=present(bytes:\(json.utf8.count),schemaVersion:\(version))"
    }
    let summary = "[native-cache] debugDump " + parts.joined(separator: " ")
    NSLog("%@", summary)
    return summary
  }

  private static func schemaVersion(from json: String) -> Int? {
    guard let data = json.data(using: .utf8) else { return nil }
    let object = try? JSONSerialization.jsonObject(with: data)
    guard let dictionary = object as? [String: Any] else { return nil }
    return dictionary["schemaVersion"] as? Int
  }

  private static let journalMaxEntries = 200

  /// Append one playback-journal entry. Bounded; drops oldest when over the cap. Soft-fail.
  @discardableResult
  static func appendJournalEntry(_ entry: [String: Any]) -> Bool {
    var entries: [[String: Any]] = []
    var nextSeq = 1
    if let json = read(.playbackJournal),
      let data = json.data(using: .utf8),
      let object = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
      let existing = object["entries"] as? [[String: Any]]
    {
      entries = existing
      if let last = existing.last, let seq = last["seq"] as? Int {
        nextSeq = seq + 1
      }
    }
    var row = entry
    row["seq"] = nextSeq
    if row["occurredAtMs"] == nil {
      row["occurredAtMs"] = Int(Date().timeIntervalSince1970 * 1000)
    }
    entries.append(row)
    if entries.count > journalMaxEntries {
      entries = Array(entries.suffix(journalMaxEntries))
    }
    let payload: [String: Any] = [
      "schemaVersion": 2,
      "updatedAtMs": Int(Date().timeIntervalSince1970 * 1000),
      "entries": entries,
    ]
    guard let data = try? JSONSerialization.data(withJSONObject: payload),
      let json = String(data: data, encoding: .utf8)
    else { return false }
    return write(.playbackJournal, json: json)
  }

  /// Account id from account-context.json, if present.
  static func accountIdTextFromContext() -> String? {
    guard let json = read(.accountContext),
      let data = json.data(using: .utf8),
      let object = try? JSONSerialization.jsonObject(with: data) as? [String: Any]
    else { return nil }
    return object["accountIdText"] as? String
  }

  /// Latest journal position for an idText when newer than `minOccurredAtMs`.
  static func latestJournalPosition(idText: String) -> (position: Double, occurredAtMs: Int)? {
    guard let json = read(.playbackJournal),
      let data = json.data(using: .utf8),
      let object = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
      let entries = object["entries"] as? [[String: Any]]
    else { return nil }
    var best: (Double, Int)?
    for entry in entries.reversed() {
      guard let entryId = entry["idText"] as? String, entryId == idText,
        let position = entry["positionSeconds"] as? Double
      else { continue }
      let occurred = (entry["occurredAtMs"] as? Int) ?? 0
      if best == nil || occurred > best!.1 {
        best = (position, occurred)
      }
      break
    }
    return best.map { (position: $0.0, occurredAtMs: $0.1) }
  }

  /// Clear account-scoped car cache files on logout (queues, advance window, history, library, live,
  /// journal).
  static func clearAccountScopedFiles() {
    let kinds: [PodverseNativeCacheKind] = [
      .queueAv, .queueMusic, .advanceWindow, .history, .live, .libraryBrowse, .playbackJournal,
      .accountContext,
    ]
    for kind in kinds {
      if let url = fileURL(for: kind) {
        try? FileManager.default.removeItem(at: url)
      }
    }
    if let directory = baseDirectory() {
      let children = directory.appendingPathComponent(childrenDirectoryName, isDirectory: true)
      try? FileManager.default.removeItem(at: children)
    }
  }
}
