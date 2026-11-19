// Expo config plugin: wire the release keystore into android/app/build.gradle.
// The keystore (PKCS#12, alias "collect") is decoded by CI to <project>/collect-release.p12
// BEFORE `expo prebuild` runs. If the file is absent (local dev), the plugin is a no-op
// so debug builds keep working untouched.
const { withAppBuildGradle } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

module.exports = function withReleaseSigning(config) {
  return withAppBuildGradle(config, (config) => {
    const projectRoot = config.modRequest.projectRoot;
    const keystorePath = path.join(projectRoot, 'collect-release.p12');
    if (!fs.existsSync(keystorePath)) {
      // eslint-disable-next-line no-console
      console.log('[withReleaseSigning] no collect-release.p12 at project root, skipping release signing');
      return config;
    }
    let gradle = config.modResults.contents;
    if (!gradle.includes('signingConfigs.release')) {
      const signingBlock = [
        '    signingConfigs {',
        '        release {',
        '            storeFile file("../../collect-release.p12")',
        '            storePassword findProperty("COLLECT_KEYSTORE_PASSWORD")',
        '            keyAlias findProperty("COLLECT_KEY_ALIAS") ?: "collect"',
        '            keyPassword findProperty("COLLECT_KEY_PASSWORD")',
        '            storeType "pkcs12"',
        '        }',
        '    }',
        '',
      ].join('\n');
      gradle = gradle.replace(/(\n\s*)buildTypes\s*\{/, `$1${signingBlock}buildTypes {`);
      // The template's release build type points at signingConfigs.debug
      // (with a "generate your own keystore" comment). Point it at the
      // release config instead. NOTE: merely ADDING a
      // `signingConfig signingConfigs.release` line does NOT work — the
      // template's later `signingConfig signingConfigs.debug` line wins
      // (last assignment wins), which silently debug-signs the release APK.
      // So the debug line inside the release block must be REPLACED.
      // The match is anchored on `buildTypes` because the injected
      // signingConfigs block above also contains a `release {` line.
      const releaseSigning = /(buildTypes\s*\{[\s\S]*?\n\s*release\s*\{[\s\S]*?)signingConfig signingConfigs\.debug/;
      if (releaseSigning.test(gradle)) {
        gradle = gradle.replace(releaseSigning, '$1signingConfig signingConfigs.release');
      } else {
        // Fallback: no debug line found in the release block; insert one.
        const btIndex = gradle.indexOf('buildTypes {');
        const relIndex = gradle.indexOf('release {', btIndex);
        if (relIndex !== -1) {
          const braceEnd = gradle.indexOf('\n', relIndex);
          gradle =
            gradle.slice(0, braceEnd + 1) +
            '            signingConfig signingConfigs.release\n' +
            gradle.slice(braceEnd + 1);
        }
      }
      config.modResults.contents = gradle;
    }
    return config;
  });
};
