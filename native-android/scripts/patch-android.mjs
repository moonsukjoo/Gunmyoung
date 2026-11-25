import fs from 'fs';
import path from 'path';

const root = process.cwd();
const srcJavaDir = path.join(root, 'native-android', 'java', 'com', 'gunmyoung', 'app');
const targetJavaDir = path.join(root, 'android', 'app', 'src', 'main', 'java', 'com', 'gunmyoung', 'app');
const manifestPath = path.join(root, 'android', 'app', 'src', 'main', 'AndroidManifest.xml');

if (!fs.existsSync(targetJavaDir)) {
  throw new Error(`Target Android Java directory not found: ${targetJavaDir}`);
}

// 1. Copy all native Java files into Capacitor Android app package
const javaFiles = fs.readdirSync(srcJavaDir).filter(f => f.endsWith('.java'));
for (const file of javaFiles) {
  fs.copyFileSync(path.join(srcJavaDir, file), path.join(targetJavaDir, file));
  console.log(`[patch-android] Copied ${file}`);
}

// 2. Patch MainActivity.java to register SilentBgGpsPlugin & AppUpdaterPlugin
const mainActivityPath = path.join(targetJavaDir, 'MainActivity.java');
if (fs.existsSync(mainActivityPath)) {
  let mainActivity = fs.readFileSync(mainActivityPath, 'utf8');
  let changed = false;

  if (!mainActivity.includes('import android.os.Bundle;')) {
    mainActivity = mainActivity.replace(
      'import com.getcapacitor.BridgeActivity;',
      'import android.os.Bundle;\nimport com.getcapacitor.BridgeActivity;'
    );
    changed = true;
  }

  const pluginsToRegister = ['SilentBgGpsPlugin.class', 'AppUpdaterPlugin.class'];
  const missingPlugins = pluginsToRegister.filter(p => !mainActivity.includes(`registerPlugin(${p})`));

  if (missingPlugins.length > 0) {
    const regCalls = missingPlugins.map(p => `registerPlugin(${p});`).join('\n        ');
    if (mainActivity.includes('super.onCreate(savedInstanceState);')) {
      mainActivity = mainActivity.replace(
        'super.onCreate(savedInstanceState);',
        `${regCalls}\n        super.onCreate(savedInstanceState);`
      );
    } else {
      mainActivity = mainActivity.replace(
        /public class MainActivity extends BridgeActivity\s*\{/,
        `public class MainActivity extends BridgeActivity {\n    @Override\n    public void onCreate(Bundle savedInstanceState) {\n        ${regCalls}\n        super.onCreate(savedInstanceState);\n    }`
      );
    }
    changed = true;
  }

  if (changed) {
    fs.writeFileSync(mainActivityPath, mainActivity, 'utf8');
    console.log('[patch-android] Registered native plugins in MainActivity.java');
  }
}

// 3. Patch AndroidManifest.xml permissions & background service/receivers
if (fs.existsSync(manifestPath)) {
  let manifest = fs.readFileSync(manifestPath, 'utf8');

  const requiredPermissions = [
    '<uses-permission android:name="android.permission.INTERNET" />',
    '<uses-permission android:name="android.permission.REQUEST_INSTALL_PACKAGES" />',
    '<uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />',
    '<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />',
    '<uses-permission android:name="android.permission.ACCESS_BACKGROUND_LOCATION" />',
    '<uses-permission android:name="android.permission.REQUEST_IGNORE_BATTERY_OPTIMIZATIONS" />',
    '<uses-permission android:name="android.permission.WAKE_LOCK" />',
    '<uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED" />',
    '<uses-permission android:name="android.permission.SCHEDULE_EXACT_ALARM" />',
    '<uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />',
    '<uses-feature android:name="android.hardware.location.gps" android:required="false" />'
  ];

  const missingPerms = requiredPermissions.filter(p => {
    const match = p.match(/android:name="([^"]+)"/);
    return match ? !manifest.includes(match[1]) : false;
  });

  if (missingPerms.length > 0) {
    manifest = manifest.replace(
      '<application',
      `    ${missingPerms.join('\n    ')}\n\n    <application`
    );
  }

  const componentSnippets = [];
  if (!manifest.includes('SilentBgGpsJobService')) {
    componentSnippets.push(`        <service
            android:name=".SilentBgGpsJobService"
            android:permission="android.permission.BIND_JOB_SERVICE"
            android:exported="false" />`);
  }
  if (!manifest.includes('SilentBgGpsReceiver')) {
    componentSnippets.push(`        <receiver
            android:name=".SilentBgGpsReceiver"
            android:enabled="true"
            android:exported="false" />`);
  }
  if (!manifest.includes('SilentBgGpsBootReceiver')) {
    componentSnippets.push(`        <receiver
            android:name=".SilentBgGpsBootReceiver"
            android:enabled="true"
            android:exported="true">
            <intent-filter>
                <action android:name="android.intent.action.BOOT_COMPLETED" />
                <action android:name="android.intent.action.MY_PACKAGE_REPLACED" />
                <action android:name="android.intent.action.TIME_SET" />
                <action android:name="android.intent.action.TIMEZONE_CHANGED" />
            </intent-filter>
        </receiver>`);
  }

  if (componentSnippets.length > 0) {
    manifest = manifest.replace(
      '</application>',
      `\n${componentSnippets.join('\n\n')}\n    </application>`
    );
  }

  fs.writeFileSync(manifestPath, manifest, 'utf8');
  console.log('[patch-android] Patched AndroidManifest.xml cleanly');
}

// 4. Ensure FileProvider cache path exists for APK updates
const filePathsXml = path.join(root, 'android', 'app', 'src', 'main', 'res', 'xml', 'file_paths.xml');
if (fs.existsSync(filePathsXml)) {
  let xml = fs.readFileSync(filePathsXml, 'utf8');
  if (!xml.includes('name="updates_cache"')) {
    xml = xml.replace('</paths>', '    <cache-path name="updates_cache" path="updates/" />\n</paths>');
    fs.writeFileSync(filePathsXml, xml, 'utf8');
    console.log('[patch-android] Added updates_cache path to file_paths.xml');
  }
}

// 5. Patch Android app/build.gradle versionCode, versionName, and deterministic signingConfig when provided by CI
const appGradlePath = path.join(root, 'android', 'app', 'build.gradle');
if (fs.existsSync(appGradlePath)) {
  let gradle = fs.readFileSync(appGradlePath, 'utf8');
  let gradleChanged = false;

  const envVersionCode = Number(process.env.APP_VERSION_CODE);
  const envVersionName = process.env.APP_VERSION_NAME;
  if (Number.isFinite(envVersionCode) && envVersionCode > 0 && envVersionName) {
    gradle = gradle.replace(/versionCode\s+\d+/, `versionCode ${Math.floor(envVersionCode)}`);
    gradle = gradle.replace(/versionName\s+"[^"]+"/, `versionName "${envVersionName}"`);
    gradleChanged = true;
    console.log(`[patch-android] Set Android versionCode=${Math.floor(envVersionCode)}, versionName=${envVersionName}`);
  }

  const keystorePath = process.env.SIGNING_KEYSTORE_PATH;
  if (keystorePath && fs.existsSync(keystorePath) && !gradle.includes('signingConfigs')) {
    const signingBlock = `    signingConfigs {
        gunmyoung {
            storeFile file(System.getenv("SIGNING_KEYSTORE_PATH"))
            storePassword System.getenv("SIGNING_STORE_PASSWORD")
            keyAlias System.getenv("SIGNING_KEY_ALIAS")
            keyPassword System.getenv("SIGNING_KEY_PASSWORD")
        }
    }
    buildTypes {
        debug {
            signingConfig signingConfigs.gunmyoung
        }`;
    if (gradle.includes('buildTypes {')) {
      gradle = gradle.replace('    buildTypes {', signingBlock);
      gradle = gradle.replace(
        /release\s*\{/,
        'release {\n            signingConfig signingConfigs.gunmyoung'
      );
      gradleChanged = true;
      console.log(`[patch-android] Configured persistent signingConfig using ${keystorePath}`);
    }
  }

  if (gradleChanged) {
    fs.writeFileSync(appGradlePath, gradle, 'utf8');
  }
}


