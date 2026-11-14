package com.gunmyoung.app;

import android.Manifest;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;

import androidx.activity.result.ActivityResult;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

@CapacitorPlugin(
    name = "SilentBgGps",
    permissions = {
        @Permission(
            strings = {
                Manifest.permission.ACCESS_FINE_LOCATION,
                Manifest.permission.ACCESS_COARSE_LOCATION
            },
            alias = "location"
        ),
        @Permission(
            strings = {
                Manifest.permission.ACCESS_BACKGROUND_LOCATION
            },
            alias = "backgroundLocation"
        )
    }
)
public class SilentBgGpsPlugin extends Plugin {
    @PluginMethod
    public void syncConfig(PluginCall call) {
        boolean enabled = Boolean.TRUE.equals(call.getBoolean("enabled", false));
        if (!enabled) {
            SilentBgGpsScheduler.cancelAll(getContext());
            SilentBgGpsPrefs.clearAll(getContext());
            JSObject res = new JSObject();
            res.put("scheduled", false);
            call.resolve(res);
            return;
        }

        SilentBgGpsPrefs.saveConfig(
            getContext(),
            true,
            call.getString("workerUid", ""),
            call.getString("workerName", "현장작업자"),
            call.getString("employeeId", "EMP"),
            call.getString("teamName", "현장팀"),
            call.getString("jobRole", "작업자"),
            call.getString("assignedJigId", "jig-01"),
            call.getString("refreshToken", ""),
            call.getString("firebaseApiKey", ""),
            call.getString("firebaseProjectId", ""),
            call.getString("firestoreDatabaseId", "(default)"),
            call.getString("calibrationJson", ""),
            call.getString("jigsJson", "")
        );

        SilentBgGpsScheduler.scheduleNextAlarm(getContext());

        if (SilentBgGpsPrefs.getPendingQueue(getContext()).length() > 0) {
            SilentBgGpsJobService.enqueueNow(getContext(), "", -1, true);
        }

        JSObject res = new JSObject();
        res.put("scheduled", true);
        res.put("nextSlot", SilentBgGpsPrefs.getNextSlot(getContext()));
        res.put("nextTriggerAt", SilentBgGpsPrefs.getNextTriggerAt(getContext()));
        call.resolve(res);
    }

    @PluginMethod
    public void clearSchedule(PluginCall call) {
        SilentBgGpsScheduler.cancelAll(getContext());
        SilentBgGpsPrefs.clearAll(getContext());
        JSObject res = new JSObject();
        res.put("cleared", true);
        call.resolve(res);
    }

    @PluginMethod
    public void getStatus(PluginCall call) {
        call.resolve(buildStatusObject());
    }

    /**
     * Sequentially requests OS permissions needed for closed-app background measurement:
     * 1) Foreground location (FINE / COARSE)
     * 2) Background location ("항상 허용", Android 10+)
     * 3) Battery optimization exemption ("제한 없음", Android 6+)
     */
    @PluginMethod
    public void requestRequiredPermissions(PluginCall call) {
        if (!SilentBgGpsRunner.hasAnyLocationPermission(getContext())) {
            requestPermissionForAlias("location", call, "onLocationPermissionResult");
            return;
        }
        proceedBackgroundLocationOrBattery(call);
    }

    @PermissionCallback
    private void onLocationPermissionResult(PluginCall call) {
        if (call == null) return;
        proceedBackgroundLocationOrBattery(call);
    }

    private void proceedBackgroundLocationOrBattery(PluginCall call) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q
            && SilentBgGpsRunner.hasAnyLocationPermission(getContext())
            && !SilentBgGpsRunner.hasBackgroundLocationPermission(getContext())) {
            requestPermissionForAlias("backgroundLocation", call, "onBackgroundLocationResult");
            return;
        }
        proceedBatteryOptimization(call);
    }

    @PermissionCallback
    private void onBackgroundLocationResult(PluginCall call) {
        if (call == null) return;
        proceedBatteryOptimization(call);
    }

    private void proceedBatteryOptimization(PluginCall call) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M
            && !SilentBgGpsRunner.isIgnoringBatteryOptimizations(getContext())) {
            try {
                Intent intent = new Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS);
                intent.setData(Uri.parse("package:" + getContext().getPackageName()));
                startActivityForResult(call, intent, "onBatteryOptimizationResult");
                return;
            } catch (Exception ignored) {
                // Fallback safely if ROM blocks direct dialog intent
            }
        }
        call.resolve(buildStatusObject());
    }

    @ActivityCallback
    private void onBatteryOptimizationResult(PluginCall call, ActivityResult result) {
        if (call == null) return;
        call.resolve(buildStatusObject());
    }

    private JSObject buildStatusObject() {
        JSObject res = new JSObject();
        res.put("enabled", SilentBgGpsPrefs.isEnabled(getContext()));
        res.put("hasAnyPermission", SilentBgGpsRunner.hasAnyLocationPermission(getContext()));
        res.put("hasBackgroundPermission", SilentBgGpsRunner.hasBackgroundLocationPermission(getContext()));
        res.put("isIgnoringBatteryOptimizations", SilentBgGpsRunner.isIgnoringBatteryOptimizations(getContext()));
        res.put("nextSlot", SilentBgGpsPrefs.getNextSlot(getContext()));
        res.put("nextTriggerAt", SilentBgGpsPrefs.getNextTriggerAt(getContext()));
        res.put("pendingQueueCount", SilentBgGpsPrefs.getPendingQueue(getContext()).length());
        res.put("lastRunAt", SilentBgGpsPrefs.getLastRunAt(getContext()));
        res.put("lastRunStatus", SilentBgGpsPrefs.getLastRunStatus(getContext()));
        return res;
    }
}
