const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const withWorkManagerKeepRules = require('../plugins/withWorkManagerKeepRules.js');

async function main() {
  const root = path.resolve(__dirname, '..');
  const appConfig = JSON.parse(fs.readFileSync(path.join(root, 'app.json'), 'utf8'));
  assert(
    appConfig.expo.plugins.includes('./plugins/withWorkManagerKeepRules.js'),
    'release plugin must be enabled in app.json',
  );

  const modConfig = {
    mods: { android: {} },
    modRequest: { projectRoot: root, platform: 'android' },
  };
  const pluginResult = withWorkManagerKeepRules(modConfig);
  const withGradle = pluginResult.mods.android.appBuildGradle;
  const withRules = pluginResult.mods.android.dangerous;
  assert(withGradle, 'plugin must configure app/build.gradle');
  assert(withRules, 'plugin must write ProGuard rules');

  const gradleResult = await withGradle({
    ...modConfig,
    modResults: { contents: 'android {\n    defaultConfig {}\n}\n' },
  });
  assert(
    gradleResult.modResults.contents.includes(
      "proguardFiles getDefaultProguardFile('proguard-android-optimize.txt'), 'proguard-rules.pro'",
    ),
  );

  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'collect-keep-'));
  try {
    await withRules({
      ...modConfig,
      modRequest: { ...modConfig.modRequest, projectRoot: tmpRoot },
    });
    const rules = fs.readFileSync(path.join(tmpRoot, 'android', 'app', 'proguard-rules.pro'), 'utf8');
    assert(rules.includes('-keep class androidx.work.impl.WorkDatabase_Impl { *; }'));
  } finally {
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  }

  console.log('WorkManager release keep-rule checks passed');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
