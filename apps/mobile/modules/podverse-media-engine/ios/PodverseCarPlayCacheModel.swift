import Foundation

// Native-cache payload parser for the CarPlay browse tree. Swift
// mirror of Android's `PodverseNativeCacheModel.kt` so both cars decode the SAME JSON envelopes
// written by `apps/mobile/src/data/nativeCache/projection.ts`.
//
// JS-dead contract: these payloads are the ONLY browse source in the car (SQLite is phone-UI-only
// and unavailable when the JS runtime is suspended). Parsing is deliberately tolerant — unknown
// keys are ignored, a missing/mismatched `schemaVersion` yields an empty list, and any malformed
// entry is skipped rather than throwing, so the CarPlay scene renders an empty tree (never crashes)
// when the cache is absent or corrupt.
enum PodverseCarPlayCacheModel {
  // Must match NATIVE_CACHE_SCHEMA_VERSION in projection.ts and EXPECTED_SCHEMA_VERSION in the
  // Android model. Additive optional fields do NOT bump this; only a breaking payload change does.
  static let expectedSchemaVersion = 2

  /// A browsable library node (podcast / playlist / category). See `NativeCacheBrowseNode`.
  struct BrowseNode {
    let idText: String
    let title: String
    let kind: String
    let artworkUrl: String?
    let childCount: Int?
    let mediumBucket: String
  }

  /// A completed offline download, playable from its local file path. See `NativeCacheDownloadEntry`.
  struct DownloadEntry {
    let idText: String
    let title: String
    let filePath: String
    let artworkUrl: String?
    let mediaUrl: String?
    let channelTitle: String?
  }

  struct QueueEntry {
    let idText: String
    let title: String
    let artworkUrl: String?
    let mediaUrl: String?
    let podcastTitle: String?
    let startPositionSeconds: Double?
    let downloadFileName: String?
  }

  struct QueueSnapshot {
    let nowPlayingIdText: String?
    let entries: [QueueEntry]
  }

  struct ChildItem {
    let idText: String
    let title: String
    let subtitle: String?
    let artworkUrl: String?
    let mediaUrl: String?
    let durationMs: Int?
    let progressSeconds: Double?
    let played: Bool?
    let downloadFileName: String?
  }

  struct HistoryEntry {
    let idText: String
    let title: String
    let channelTitle: String?
    let artworkUrl: String?
    let mediaUrl: String?
    let downloadFileName: String?
  }

  struct LiveEntry {
    let idText: String
    let title: String
    let channelIdText: String
    let channelTitle: String?
    let artworkUrl: String?
    let mediaUrl: String
  }

  static func parseBrowseNodes(_ json: String?) -> [BrowseNode] {
    guard let root = decodeEnvelope(json, label: "library-index"),
      let array = root["nodes"] as? [Any]
    else { return [] }
    var nodes: [BrowseNode] = []
    for element in array {
      guard let obj = element as? [String: Any],
        let idText = nonBlankString(obj["idText"]),
        let title = nonBlankString(obj["title"])
      else { continue }
      nodes.append(
        BrowseNode(
          idText: idText,
          title: title,
          kind: nonBlankString(obj["kind"]) ?? "podcast",
          artworkUrl: nonBlankString(obj["artworkUrl"]),
          childCount: intOrNil(obj["childCount"]),
          mediumBucket: nonBlankString(obj["mediumBucket"]) ?? "av"))
    }
    return nodes
  }

  static func parseDownloadEntries(_ json: String?) -> [DownloadEntry] {
    guard let root = decodeEnvelope(json, label: "downloads"),
      let array = root["entries"] as? [Any]
    else { return [] }
    var entries: [DownloadEntry] = []
    for element in array {
      guard let obj = element as? [String: Any],
        let idText = nonBlankString(obj["idText"]),
        let title = nonBlankString(obj["title"]),
        let filePath = nonBlankString(obj["filePath"])
      else { continue }
      entries.append(
        DownloadEntry(
          idText: idText,
          title: title,
          filePath: filePath,
          artworkUrl: nonBlankString(obj["artworkUrl"]),
          mediaUrl: nonBlankString(obj["mediaUrl"]),
          channelTitle: nonBlankString(obj["channelTitle"])))
    }
    return entries
  }

  static func parseQueueSnapshot(_ json: String?) -> QueueSnapshot {
    guard let root = decodeEnvelope(json, label: "queue") else {
      return QueueSnapshot(nowPlayingIdText: nil, entries: [])
    }
    let nowPlayingIdText = nonBlankString(root["nowPlayingIdText"])
    guard let array = root["entries"] as? [Any] else {
      return QueueSnapshot(nowPlayingIdText: nowPlayingIdText, entries: [])
    }
    var entries: [QueueEntry] = []
    for element in array {
      guard let obj = element as? [String: Any],
        let idText = nonBlankString(obj["idText"]),
        let title = nonBlankString(obj["title"])
      else { continue }
      entries.append(
        QueueEntry(
          idText: idText,
          title: title,
          artworkUrl: nonBlankString(obj["artworkUrl"]),
          mediaUrl: nonBlankString(obj["mediaUrl"]),
          podcastTitle: nonBlankString(obj["podcastTitle"]),
          startPositionSeconds: doubleOrNil(obj["startPositionSeconds"]),
          downloadFileName: nonBlankString(obj["downloadFileName"])))
    }
    return QueueSnapshot(nowPlayingIdText: nowPlayingIdText, entries: entries)
  }

  static func parseChildItems(_ json: String?) -> [ChildItem] {
    guard let root = decodeEnvelope(json, label: "library-children"),
      let array = root["items"] as? [Any]
    else { return [] }
    var items: [ChildItem] = []
    for element in array {
      guard let obj = element as? [String: Any],
        let idText = nonBlankString(obj["idText"]),
        let title = nonBlankString(obj["title"])
      else { continue }
      items.append(
        ChildItem(
          idText: idText,
          title: title,
          subtitle: nonBlankString(obj["subtitle"]),
          artworkUrl: nonBlankString(obj["artworkUrl"]),
          mediaUrl: nonBlankString(obj["mediaUrl"]),
          durationMs: intOrNil(obj["durationMs"]),
          progressSeconds: doubleOrNil(obj["progressSeconds"]),
          played: obj["played"] as? Bool,
          downloadFileName: nonBlankString(obj["downloadFileName"])))
    }
    return items
  }

  static func parseHistoryEntries(_ json: String?) -> [HistoryEntry] {
    guard let root = decodeEnvelope(json, label: "history"),
      let array = root["entries"] as? [Any]
    else { return [] }
    var entries: [HistoryEntry] = []
    for element in array {
      guard let obj = element as? [String: Any],
        let idText = nonBlankString(obj["idText"]),
        let title = nonBlankString(obj["title"])
      else { continue }
      entries.append(
        HistoryEntry(
          idText: idText,
          title: title,
          channelTitle: nonBlankString(obj["channelTitle"]),
          artworkUrl: nonBlankString(obj["artworkUrl"]),
          mediaUrl: nonBlankString(obj["mediaUrl"]),
          downloadFileName: nonBlankString(obj["downloadFileName"])))
    }
    return entries
  }

  static func parseLiveEntries(_ json: String?) -> [LiveEntry] {
    guard let root = decodeEnvelope(json, label: "live"),
      let array = root["entries"] as? [Any]
    else { return [] }
    var entries: [LiveEntry] = []
    for element in array {
      guard let obj = element as? [String: Any],
        let idText = nonBlankString(obj["idText"]),
        let title = nonBlankString(obj["title"]),
        let channelIdText = nonBlankString(obj["channelIdText"]),
        let mediaUrl = nonBlankString(obj["mediaUrl"])
      else { continue }
      entries.append(
        LiveEntry(
          idText: idText,
          title: title,
          channelIdText: channelIdText,
          channelTitle: nonBlankString(obj["channelTitle"]),
          artworkUrl: nonBlankString(obj["artworkUrl"]),
          mediaUrl: mediaUrl))
    }
    return entries
  }

  static func isSignedIn(_ json: String?) -> Bool {
    guard let root = decodeEnvelope(json, label: "account-context") else { return false }
    return (root["signedIn"] as? Bool) ?? false
  }

  private static func decodeEnvelope(_ json: String?, label: String) -> [String: Any]? {
    guard let json = json, !json.isEmpty, let data = json.data(using: .utf8) else { return nil }
    guard let object = try? JSONSerialization.jsonObject(with: data),
      let root = object as? [String: Any]
    else {
      NSLog("[native-cache] %@ parse failed", label)
      return nil
    }
    let version = intOrNil(root["schemaVersion"]) ?? -1
    guard version == expectedSchemaVersion else {
      NSLog(
        "[native-cache] %@ schemaVersion=%d (expected %d) — empty tree", label, version,
        expectedSchemaVersion)
      return nil
    }
    return root
  }

  private static func nonBlankString(_ value: Any?) -> String? {
    guard let string = value as? String,
      !string.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    else { return nil }
    return string
  }

  private static func intOrNil(_ value: Any?) -> Int? {
    if let number = value as? NSNumber { return number.intValue }
    if let int = value as? Int { return int }
    return nil
  }

  private static func doubleOrNil(_ value: Any?) -> Double? {
    if let number = value as? NSNumber { return number.doubleValue }
    if let double = value as? Double { return double }
    return nil
  }
}
