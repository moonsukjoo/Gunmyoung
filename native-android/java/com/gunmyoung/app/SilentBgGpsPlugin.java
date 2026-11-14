package com.gunmyoung.app;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "SilentBgGps")
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
        JSObject res = new JSObject();
        res.put("enabled", SilentBgGpsPrefs.isEnabled(getContext()));
        res.put("hasAnyPermission", SilentBgGpsRunner.hasAnyLocationPermission(getContext()));
        res.put("hasBackgroundPermission", SilentBgGpsRunner.hasBackgroundLocationPermission(getContext()));
        res.put("nextSlot", SilentBgGpsPrefs.getNextSlot(getContext()));
        res.put("nextTriggerAt", SilentBgGpsPrefs.getNextTriggerAt(getContext()));
        res.put("pendingQueueCount", SilentBgGpsPrefs.getPendingQueue(getContext()).length());
        res.put("lastRunAt", SilentBgGpsPrefs.getLastRunAt(getContext()));
        res.put("lastRunStatus", SilentBgGpsPrefs.getLastRunStatus(getContext()));
        call.resolve(res);
    }
}
