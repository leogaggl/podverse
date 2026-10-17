/**
 * Expo config plugin: add a CarPlay scene beside the phone scene Expo generates.
 *
 * Expo's prebuild owns the phone scene: `SceneDelegate` (an `ExpoAppSceneDelegate`) creates the
 * `UIWindow` and starts React Native, and the template's `UIApplicationSceneManifest` declares it
 * for `UIWindowSceneSessionRoleApplication`. This plugin leaves that entry and that delegate alone.
 *
 * It adds:
 * - a `CPTemplateApplicationSceneSessionRoleApplication` manifest entry for
 *   `PodverseCarPlaySceneDelegate` (podverse-media-engine), and
 * - `application(_:configurationForConnecting:options:)` on AppDelegate, which routes the CarPlay
 *   role to that delegate and returns every other role's configuration unchanged from Info.plist.
 */
const { createRunOncePlugin, withAppDelegate, withInfoPlist } = require('expo/config-plugins');

const CARPLAY_CONFIGURATION_NAME = 'PodverseCarPlay';
const CARPLAY_DELEGATE_CLASS = 'PodverseCarPlaySceneDelegate';
const CARPLAY_SESSION_ROLE = 'CPTemplateApplicationSceneSessionRoleApplication';
const PHONE_SESSION_ROLE = 'UIWindowSceneSessionRoleApplication';

const METHOD_MARKER_BEGIN = '// @generated begin podverse-carplay-scene';
const METHOD_MARKER_END = '// @generated end podverse-carplay-scene';

// Matches any scene block this plugin has generated, so a regenerated AppDelegate never carries
// two copies.
const GENERATED_BLOCK =
  /\n?\/\/ @generated begin podverse-(?:carplay|phone)-scene[\s\S]*?\/\/ @generated end podverse-(?:carplay|phone)-scene\n?/g;

const CARPLAY_METHOD = `
${METHOD_MARKER_BEGIN}
  // The phone role keeps the configuration UIKit loaded from Info.plist (Expo's SceneDelegate,
  // which creates the window). Only the CarPlay role is routed here.
  func application(
    _ application: UIApplication,
    configurationForConnecting connectingSceneSession: UISceneSession,
    options: UIScene.ConnectionOptions
  ) -> UISceneConfiguration {
    guard connectingSceneSession.role == .carTemplateApplication else {
      return connectingSceneSession.configuration
    }
    let configuration = UISceneConfiguration(
      name: "${CARPLAY_CONFIGURATION_NAME}",
      sessionRole: connectingSceneSession.role
    )
    configuration.sceneClass = CPTemplateApplicationScene.self
    configuration.delegateClass = NSClassFromString("${CARPLAY_DELEGATE_CLASS}")
    return configuration
  }
${METHOD_MARKER_END}
`;

const ensureSwiftImport = (contents, importName) => {
  const importLine = `import ${importName}`;
  if (contents.includes(importLine)) {
    return contents;
  }
  const match = contents.match(/^(?:internal |public |@_implementationOnly )?import .*$/m);
  if (match === null || match.index === undefined) {
    return `${importLine}\n${contents}`;
  }
  const insertAt = match.index + match[0].length;
  return `${contents.slice(0, insertAt)}\n${importLine}${contents.slice(insertAt)}`;
};

const findClassCloseBrace = (contents, classDeclarationPrefix) => {
  const classIndex = contents.indexOf(classDeclarationPrefix);
  if (classIndex === -1) {
    throw new Error(`withPodverseCarPlay: could not find ${classDeclarationPrefix}`);
  }
  const openBraceIndex = contents.indexOf('{', classIndex);
  if (openBraceIndex === -1) {
    throw new Error('withPodverseCarPlay: could not find AppDelegate class opening brace');
  }

  let depth = 0;
  for (let index = openBraceIndex; index < contents.length; index += 1) {
    const char = contents[index];
    if (char === '{') {
      depth += 1;
    } else if (char === '}') {
      depth -= 1;
      if (depth === 0) {
        return index;
      }
    }
  }
  throw new Error('withPodverseCarPlay: could not find AppDelegate class closing brace');
};

const withCarPlayAppDelegate = (config) =>
  withAppDelegate(config, (modConfig) => {
    if (modConfig.modResults.language !== 'swift') {
      throw new Error(
        `withPodverseCarPlay: expected Swift AppDelegate, got ${modConfig.modResults.language}`
      );
    }

    let contents = modConfig.modResults.contents.replace(GENERATED_BLOCK, '\n');

    if (contents.includes('configurationForConnecting')) {
      throw new Error(
        'withPodverseCarPlay: the generated AppDelegate already implements ' +
          'configurationForConnecting. Extend that method with the CarPlay branch instead of ' +
          'adding a second one.'
      );
    }

    contents = ensureSwiftImport(contents, 'CarPlay');
    const closeBraceIndex = findClassCloseBrace(contents, 'class AppDelegate');
    contents = `${contents.slice(0, closeBraceIndex)}${CARPLAY_METHOD}${contents.slice(closeBraceIndex)}`;

    modConfig.modResults.contents = contents;
    return modConfig;
  });

const withCarPlaySceneManifest = (config) =>
  withInfoPlist(config, (modConfig) => {
    const manifest = modConfig.modResults.UIApplicationSceneManifest;
    const sceneConfigurations = manifest?.UISceneConfigurations;
    const phoneScenes = sceneConfigurations?.[PHONE_SESSION_ROLE];
    if (!Array.isArray(phoneScenes) || phoneScenes.length === 0) {
      throw new Error(
        'withPodverseCarPlay: Info.plist has no phone scene in UIApplicationSceneManifest. ' +
          'Expo prebuild is expected to generate it; a CarPlay-only manifest leaves the phone ' +
          'with no window.'
      );
    }

    sceneConfigurations[CARPLAY_SESSION_ROLE] = [
      {
        UISceneClassName: 'CPTemplateApplicationScene',
        UISceneConfigurationName: CARPLAY_CONFIGURATION_NAME,
        UISceneDelegateClassName: CARPLAY_DELEGATE_CLASS,
      },
    ];
    return modConfig;
  });

const withPodverseCarPlay = (config) => withCarPlaySceneManifest(withCarPlayAppDelegate(config));

module.exports = createRunOncePlugin(withPodverseCarPlay, 'podverse-carplay-scene', '3.0.0');
