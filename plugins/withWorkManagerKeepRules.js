// expo-background-task pulls in AndroidX WorkManager. Its app startup
// initializer constructs WorkDatabase_Impl by reflection, which R8 removes
// in release builds unless the generated implementation is kept.
const { withDangerousMod, withAppBuildGradle } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

const KEEP_RULES = `-keep class androidx.work.impl.WorkDatabase_Impl { *; }
-keep class androidx.work.impl.** { *; }
`;

module.exports = function withWorkManagerKeepRules(config) {
  config = withDangerousMod(config, [
    'android',
    (config) => {
      const rulesPath = path.join(config.modRequest.projectRoot, 'android', 'app', 'proguard-rules.pro');
      fs.mkdirSync(path.dirname(rulesPath), { recursive: true });
      const current = fs.existsSync(rulesPath) ? fs.readFileSync(rulesPath, 'utf8') : '';
      if (!current.includes('-keep class androidx.work.impl.WorkDatabase_Impl')) {
        fs.writeFileSync(rulesPath, `${current}${current.endsWith('\n') || !current ? '' : '\n'}${KEEP_RULES}`);
      }
      return config;
    },
  ]);

  return withAppBuildGradle(config, (config) => {
    let gradle = config.modResults.contents;
    if (!gradle.includes('proguardFiles getDefaultProguardFile')) {
      if (/buildTypes\s*\{/.test(gradle)) {
        gradle = gradle.replace(
          /buildTypes\s*\{/,
          "buildTypes {\n        release {\n            proguardFiles getDefaultProguardFile('proguard-android-optimize.txt'), 'proguard-rules.pro'\n        }",
        );
      } else if (/android\s*\{/.test(gradle)) {
        gradle = gradle.replace(
          /android\s*\{/,
          "android {\n    buildTypes {\n        release {\n            proguardFiles getDefaultProguardFile('proguard-android-optimize.txt'), 'proguard-rules.pro'\n        }\n    }",
        );
      } else {
        throw new Error('Cannot find android block in app/build.gradle');
      }
    }
    config.modResults.contents = gradle;
    return config;
  });
};
