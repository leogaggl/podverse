import UIKit

/// Physical phone attitude, independent of the interface orientation lock.
/// Samples only while video fullscreen asks for them.
final class PodverseDeviceOrientation {
  static let shared = PodverseDeviceOrientation()

  var onChange: ((Bool) -> Void)?

  private var observer: NSObjectProtocol?
  private var lastLandscape: Bool?

  /// True when the device is currently landscape-left or landscape-right.
  /// Face-up, face-down, and unknown read as false.
  var isLandscape: Bool {
    let orientation = UIDevice.current.orientation
    return orientation == .landscapeLeft || orientation == .landscapeRight
  }

  func start() {
    UIDevice.current.beginGeneratingDeviceOrientationNotifications()
    if observer == nil {
      observer = NotificationCenter.default.addObserver(
        forName: UIDevice.orientationDidChangeNotification,
        object: nil,
        queue: .main
      ) { [weak self] _ in
        self?.emit()
      }
    }
    emit()
  }

  func stop() {
    if let observer = observer {
      NotificationCenter.default.removeObserver(observer)
      self.observer = nil
    }
    lastLandscape = nil
  }

  private func emit() {
    let orientation = UIDevice.current.orientation
    if orientation == .faceUp || orientation == .faceDown || orientation == .unknown {
      return
    }
    let landscape = orientation == .landscapeLeft || orientation == .landscapeRight
    guard lastLandscape != landscape else { return }
    lastLandscape = landscape
    onChange?(landscape)
  }
}
