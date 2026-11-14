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

// 2. Patch MainActivity.java to register SilentBgGpsPlugin
const mainActivityPath = path.join(targetJavaDir, 'MainActivity.java');
if (fs.existsSync(mainActivityPath)) {
  let mainActivity = fs.readFileSync(mainActivityPath, 'utf8');
  if (!mainActivity.includes('registerPlugin(SilentBgGpsPlugin.class)')) {
    if (!mainActivity.includes('import android.os.Bundle;')) {
      mainActivity = mainActivity.replace(
        'import com.getcapacitor.BridgeActivity;',
        'import android.os.Bundle;\nimport com.getcapacitor.BridgeActivity;'
      );
    }

    if (mainActivity.includes('super.onCreate(savedInstanceState);')) {
      mainActivity = mainActivity.replace(
        'super.onCreate(savedInstanceState);',
        'registerPlugin(SilentBgGpsPlugin.class);\n        super.onCreate(savedInstanceState);'
      );
    } else {
      mainActivity = mainActivity.replace(
        /public class MainActivity extends BridgeActivity\s*\{/,
        `public class MainActivity extends BridgeActivity {\n    @Override\n    public void onCreate(Bundle savedInstanceState) {\n        registerPlugin(SilentBgGpsPlugin.class);\n        super.onCreate(savedInstanceState);\n    }`
      );
    }
    fs.writeFileSync(mainActivityPath, mainActivity, 'utf8');
    console.log('[patch-android] Registered SilentBgGpsPlugin in MainActivity.java');
  }
}

// 3. Patch AndroidManifest.xml permissions & background service/receivers
if (fs.existsSync(manifestPath)) {
  let manifest = fs.readFileSync(manifestPath, 'utf8');

  const requiredPermissions = [
    '<uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />',
    '<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />',
    '<uses-permission android:name="android.permission.ACCESS_BACKGROUND_LOCATION" />',
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
