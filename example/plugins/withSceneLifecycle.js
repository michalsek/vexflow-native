// Remove once on an Expo SDK with scene support.
const { withAppDelegate, withInfoPlist } = require('expo/config-plugins');

const WINDOW_SETUP =
  /\n#if os\(iOS\) \|\| os\(tvOS\)\n {4}window = UIWindow\(frame: UIScreen\.main\.bounds\)\n[\s\S]*?#endif\n/;

const SCENE_DELEGATE = `
class SceneDelegate: UIResponder, UIWindowSceneDelegate {
  var window: UIWindow?

  func scene(
    _ scene: UIScene,
    willConnectTo session: UISceneSession,
    options connectionOptions: UIScene.ConnectionOptions
  ) {
    guard let windowScene = scene as? UIWindowScene,
      let appDelegate = UIApplication.shared.delegate as? AppDelegate
    else { return }

    let window = UIWindow(windowScene: windowScene)
    var launchOptions: [UIApplication.LaunchOptionsKey: Any] = [:]
    if let url = connectionOptions.urlContexts.first?.url {
      launchOptions[.url] = url
    }
    self.window = window
    appDelegate.window = window
    appDelegate.reactNativeFactory?.startReactNative(
      withModuleName: "main", in: window, launchOptions: launchOptions)
  }

  func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
    for context in URLContexts {
      _ = RCTLinkingManager.application(UIApplication.shared, open: context.url, options: [:])
    }
  }
}
`;

module.exports = (config) =>
  withInfoPlist(
    withAppDelegate(config, (mod) => {
      const { contents } = mod.modResults;

      if (!contents.includes('class SceneDelegate')) {
        if (!WINDOW_SETUP.test(contents)) {
          throw new Error('withSceneLifecycle: AppDelegate template changed');
        }
        mod.modResults.contents =
          contents.replace(WINDOW_SETUP, '\n') + SCENE_DELEGATE;
      }

      return mod;
    }),
    (mod) => {
      mod.modResults.UIApplicationSceneManifest = {
        UIApplicationSupportsMultipleScenes: false,
        UISceneConfigurations: {
          UIWindowSceneSessionRoleApplication: [
            {
              UISceneConfigurationName: 'Default',
              UISceneDelegateClassName: '$(PRODUCT_MODULE_NAME).SceneDelegate',
            },
          ],
        },
      };

      return mod;
    }
  );
