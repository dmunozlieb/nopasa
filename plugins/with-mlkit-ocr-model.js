const { withAndroidManifest, AndroidConfig } = require('@expo/config-plugins');

/**
 * Adds the ML Kit "download model at install time" hint to AndroidManifest:
 *   <meta-data android:name="com.google.mlkit.vision.DEPENDENCIES" android:value="ocr" />
 * so Google Play Store fetches the on-device OCR model when the app is installed,
 * rather than on first use. Inference stays on-device; no user data is uploaded.
 */
module.exports = function withMlkitOcrModel(config) {
  return withAndroidManifest(config, (cfg) => {
    const application = AndroidConfig.Manifest.getMainApplicationOrThrow(cfg.modResults);
    AndroidConfig.Manifest.addMetaDataItemToMainApplication(
      application,
      'com.google.mlkit.vision.DEPENDENCIES',
      'ocr',
    );
    return cfg;
  });
};
