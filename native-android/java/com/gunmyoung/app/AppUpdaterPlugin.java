package com.gunmyoung.app;

import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageInfo;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;

import androidx.activity.result.ActivityResult;
import androidx.core.content.FileProvider;
import androidx.core.content.pm.PackageInfoCompat;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.BufferedInputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

@CapacitorPlugin(name = "AppUpdater")
public class AppUpdaterPlugin extends Plugin {
    private final ExecutorService executor = Executors.newSingleThreadExecutor();
    private volatile boolean isDownloading = false;

    @PluginMethod
    public void getAppVersion(PluginCall call) {
        try {
            Context context = getContext();
            PackageInfo pInfo = context.getPackageManager().getPackageInfo(context.getPackageName(), 0);
            long versionCode = PackageInfoCompat.getLongVersionCode(pInfo);
            String versionName = pInfo.versionName != null ? pInfo.versionName : "1.0.0";

            JSObject res = new JSObject();
            res.put("versionCode", versionCode);
            res.put("versionName", versionName);
            res.put("packageName", context.getPackageName());
            call.resolve(res);
        } catch (Exception e) {
            call.reject("앱 버전 정보를 확인할 수 없습니다: " + e.getMessage());
        }
    }

    @PluginMethod
    public void canInstallPackages(PluginCall call) {
        boolean granted = true;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            granted = getContext().getPackageManager().canRequestPackageInstalls();
        }
        JSObject res = new JSObject();
        res.put("granted", granted);
        call.resolve(res);
    }

    @PluginMethod
    public void openInstallPermissionSettings(PluginCall call) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            try {
                Intent intent = new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES);
                intent.setData(Uri.parse("package:" + getContext().getPackageName()));
                startActivityForResult(call, intent, "onInstallPermissionResult");
                return;
            } catch (Exception e) {
                call.reject("설치 권한 화면을 열 수 없습니다: " + e.getMessage());
                return;
            }
        }
        JSObject res = new JSObject();
        res.put("granted", true);
        call.resolve(res);
    }

    @ActivityCallback
    private void onInstallPermissionResult(PluginCall call, ActivityResult result) {
        if (call == null) return;
        boolean granted = true;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            granted = getContext().getPackageManager().canRequestPackageInstalls();
        }
        JSObject res = new JSObject();
        res.put("granted", granted);
        call.resolve(res);
    }

    @PluginMethod
    public void downloadAndInstallApk(PluginCall call) {
        String urlStr = call.getString("url", "");
        String targetVersionName = call.getString("versionName", "");

        if (urlStr == null || !urlStr.trim().toLowerCase().startsWith("https://")) {
            call.reject("보안(HTTPS) APK 다운로드 주소만 지원합니다.");
            return;
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && !getContext().getPackageManager().canRequestPackageInstalls()) {
            JSObject res = new JSObject();
            res.put("started", false);
            res.put("needsPermission", true);
            call.resolve(res);
            return;
        }

        if (isDownloading) {
            call.reject("이미 업데이트 파일을 다운로드 중입니다.");
            return;
        }

        isDownloading = true;
        final String cleanUrl = urlStr.trim();

        executor.execute(() -> {
            HttpURLConnection conn = null;
            File outFile = null;
            try {
                String currentUrl = cleanUrl;
                int redirects = 0;
                int statusCode = 0;

                while (redirects < 6) {
                    URL url = new URL(currentUrl);
                    conn = (HttpURLConnection) url.openConnection();
                    conn.setInstanceFollowRedirects(false);
                    conn.setConnectTimeout(15000);
                    conn.setReadTimeout(30000);
                    conn.setRequestProperty("User-Agent", "GunmyoungHRM-Updater/1.0");
                    conn.connect();

                    statusCode = conn.getResponseCode();
                    if (statusCode == HttpURLConnection.HTTP_MOVED_PERM
                        || statusCode == HttpURLConnection.HTTP_MOVED_TEMP
                        || statusCode == HttpURLConnection.HTTP_SEE_OTHER
                        || statusCode == 307
                        || statusCode == 308) {
                        String location = conn.getHeaderField("Location");
                        conn.disconnect();
                        if (location == null || !location.startsWith("https://")) {
                            throw new Exception("유효하지 않은 다운로드 리다이렉트 경로입니다.");
                        }
                        currentUrl = location;
                        redirects++;
                        continue;
                    }
                    break;
                }

                if (conn == null || statusCode < 200 || statusCode >= 300) {
                    throw new Exception("APK 다운로드 실패 (HTTP " + statusCode + ")");
                }

                long totalBytes = conn.getContentLengthLong();
                File updatesDir = new File(getContext().getCacheDir(), "updates");
                if (!updatesDir.exists()) {
                    updatesDir.mkdirs();
                }
                outFile = new File(updatesDir, "gunyoung-update.apk");
                if (outFile.exists()) {
                    outFile.delete();
                }

                long downloadedBytes = 0;
                long lastEmitAt = 0;
                byte[] headerBytes = new byte[2];
                int headerRead = 0;

                try (InputStream in = new BufferedInputStream(conn.getInputStream());
                     FileOutputStream out = new FileOutputStream(outFile)) {
                    byte[] buffer = new byte[16384];
                    int bytesRead;
                    while ((bytesRead = in.read(buffer)) != -1) {
                        if (headerRead < 2) {
                            for (int i = 0; i < bytesRead && headerRead < 2; i++) {
                                headerBytes[headerRead++] = buffer[i];
                            }
                        }
                        out.write(buffer, 0, bytesRead);
                        downloadedBytes += bytesRead;

                        long now = System.currentTimeMillis();
                        if (now - lastEmitAt >= 150 || (totalBytes > 0 && downloadedBytes >= totalBytes)) {
                            lastEmitAt = now;
                            int percent = totalBytes > 0
                                ? (int) Math.min(100, Math.round((downloadedBytes * 100.0) / totalBytes))
                                : -1;
                            JSObject progress = new JSObject();
                            progress.put("percent", percent);
                            progress.put("downloadedBytes", downloadedBytes);
                            progress.put("totalBytes", totalBytes);
                            notifyListeners("downloadProgress", progress);
                        }
                    }
                    out.flush();
                }

                // Verify APK ZIP magic header ('PK' = 0x50, 0x4B) to prevent HTML error pages
                if (headerRead < 2 || headerBytes[0] != 0x50 || headerBytes[1] != 0x4B || downloadedBytes < 100_000) {
                    if (outFile.exists()) {
                        outFile.delete();
                    }
                    throw new Exception("다운로드된 파일이 올바른 APK가 아닙니다. (저장소가 비공개이거나 APK 직링크가 아닐 수 있습니다)");
                }

                JSObject completeProgress = new JSObject();
                completeProgress.put("percent", 100);
                completeProgress.put("downloadedBytes", downloadedBytes);
                completeProgress.put("totalBytes", totalBytes > 0 ? totalBytes : downloadedBytes);
                notifyListeners("downloadProgress", completeProgress);

                Uri apkUri = FileProvider.getUriForFile(
                    getContext(),
                    getContext().getPackageName() + ".fileprovider",
                    outFile
                );

                Intent installIntent = new Intent(Intent.ACTION_VIEW);
                installIntent.setDataAndType(apkUri, "application/vnd.android.package-archive");
                installIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_GRANT_READ_URI_PERMISSION);

                getActivity().runOnUiThread(() -> getContext().startActivity(installIntent));

                JSObject res = new JSObject();
                res.put("started", true);
                res.put("needsPermission", false);
                res.put("versionName", targetVersionName);
                res.put("filePath", outFile.getAbsolutePath());
                call.resolve(res);
            } catch (Exception e) {
                if (outFile != null && outFile.exists()) {
                    outFile.delete();
                }
                call.reject("자동 업데이트 실패: " + e.getMessage());
            } finally {
                if (conn != null) {
                    conn.disconnect();
                }
                isDownloading = false;
            }
        });
    }
}
