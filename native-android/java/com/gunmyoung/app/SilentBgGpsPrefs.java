package com.gunmyoung.app;

import android.content.Context;
import android.content.SharedPreferences;

import org.json.JSONArray;
import org.json.JSONObject;

public final class SilentBgGpsPrefs {
    private static final String PREF_NAME = "SilentBgGpsPrefs";

    private static final String KEY_ENABLED = "enabled";
    private static final String KEY_WORKER_UID = "workerUid";
    private static final String KEY_WORKER_NAME = "workerName";
    private static final String KEY_EMPLOYEE_ID = "employeeId";
    private static final String KEY_TEAM_NAME = "teamName";
    private static final String KEY_JOB_ROLE = "jobRole";
    private static final String KEY_ASSIGNED_JIG_ID = "assignedJigId";
    private static final String KEY_REFRESH_TOKEN = "refreshToken";
    private static final String KEY_FIREBASE_API_KEY = "firebaseApiKey";
    private static final String KEY_FIREBASE_PROJECT_ID = "firebaseProjectId";
    private static final String KEY_FIRESTORE_DB_ID = "firestoreDatabaseId";
    private static final String KEY_CALIBRATION_JSON = "calibrationJson";
    private static final String KEY_JIGS_JSON = "jigsJson";
    private static final String KEY_NEXT_SLOT = "nextSlot";
    private static final String KEY_NEXT_TRIGGER_AT = "nextTriggerAt";
    private static final String KEY_LAST_RUN_AT = "lastRunAt";
    private static final String KEY_LAST_RUN_STATUS = "lastRunStatus";
    private static final String KEY_PENDING_QUEUE = "pendingUploadsJson";

    private SilentBgGpsPrefs() {}

    public static SharedPreferences prefs(Context context) {
        return context.getApplicationContext().getSharedPreferences(PREF_NAME, Context.MODE_PRIVATE);
    }

    public static void saveConfig(
        Context context,
        boolean enabled,
        String workerUid,
        String workerName,
        String employeeId,
        String teamName,
        String jobRole,
        String assignedJigId,
        String refreshToken,
        String firebaseApiKey,
        String firebaseProjectId,
        String firestoreDatabaseId,
        String calibrationJson,
        String jigsJson
    ) {
        SharedPreferences.Editor editor = prefs(context).edit();
        editor.putBoolean(KEY_ENABLED, enabled);
        editor.putString(KEY_WORKER_UID, safe(workerUid));
        editor.putString(KEY_WORKER_NAME, safe(workerName));
        editor.putString(KEY_EMPLOYEE_ID, safe(employeeId));
        editor.putString(KEY_TEAM_NAME, safe(teamName));
        editor.putString(KEY_JOB_ROLE, safe(jobRole));
        editor.putString(KEY_ASSIGNED_JIG_ID, safe(assignedJigId));
        if (refreshToken != null && !refreshToken.trim().isEmpty()) {
            editor.putString(KEY_REFRESH_TOKEN, refreshToken.trim());
        }
        if (firebaseApiKey != null && !firebaseApiKey.trim().isEmpty()) {
            editor.putString(KEY_FIREBASE_API_KEY, firebaseApiKey.trim());
        }
        if (firebaseProjectId != null && !firebaseProjectId.trim().isEmpty()) {
            editor.putString(KEY_FIREBASE_PROJECT_ID, firebaseProjectId.trim());
        }
        if (firestoreDatabaseId != null && !firestoreDatabaseId.trim().isEmpty()) {
            editor.putString(KEY_FIRESTORE_DB_ID, firestoreDatabaseId.trim());
        }
        if (calibrationJson != null && !calibrationJson.trim().isEmpty()) {
            editor.putString(KEY_CALIBRATION_JSON, calibrationJson);
        }
        if (jigsJson != null && !jigsJson.trim().isEmpty()) {
            editor.putString(KEY_JIGS_JSON, jigsJson);
        }
        editor.apply();
    }

    public static void clearAll(Context context) {
        prefs(context).edit()
            .putBoolean(KEY_ENABLED, false)
            .remove(KEY_WORKER_UID)
            .remove(KEY_WORKER_NAME)
            .remove(KEY_EMPLOYEE_ID)
            .remove(KEY_TEAM_NAME)
            .remove(KEY_JOB_ROLE)
            .remove(KEY_ASSIGNED_JIG_ID)
            .remove(KEY_REFRESH_TOKEN)
            .remove(KEY_NEXT_SLOT)
            .remove(KEY_NEXT_TRIGGER_AT)
            .apply();
    }

    public static boolean isEnabled(Context context) {
        return prefs(context).getBoolean(KEY_ENABLED, false) && !getWorkerUid(context).isEmpty();
    }

    public static String getWorkerUid(Context context) {
        return prefs(context).getString(KEY_WORKER_UID, "");
    }

    public static String getWorkerName(Context context) {
        return prefs(context).getString(KEY_WORKER_NAME, "현장작업자");
    }

    public static String getEmployeeId(Context context) {
        return prefs(context).getString(KEY_EMPLOYEE_ID, "EMP");
    }

    public static String getTeamName(Context context) {
        return prefs(context).getString(KEY_TEAM_NAME, "현장팀");
    }

    public static String getJobRole(Context context) {
        return prefs(context).getString(KEY_JOB_ROLE, "작업자");
    }

    public static String getAssignedJigId(Context context) {
        return prefs(context).getString(KEY_ASSIGNED_JIG_ID, "jig-01");
    }

    public static String getRefreshToken(Context context) {
        return prefs(context).getString(KEY_REFRESH_TOKEN, "");
    }

    public static void updateRefreshToken(Context context, String token) {
        if (token != null && !token.trim().isEmpty()) {
            prefs(context).edit().putString(KEY_REFRESH_TOKEN, token.trim()).apply();
        }
    }

    public static String getFirebaseApiKey(Context context) {
        return prefs(context).getString(KEY_FIREBASE_API_KEY, "");
    }

    public static String getFirebaseProjectId(Context context) {
        return prefs(context).getString(KEY_FIREBASE_PROJECT_ID, "");
    }

    public static String getFirestoreDatabaseId(Context context) {
        return prefs(context).getString(KEY_FIRESTORE_DB_ID, "(default)");
    }

    public static String getCalibrationJson(Context context) {
        return prefs(context).getString(KEY_CALIBRATION_JSON, "");
    }

    public static void setCalibrationJson(Context context, String json) {
        if (json != null && !json.trim().isEmpty()) {
            prefs(context).edit().putString(KEY_CALIBRATION_JSON, json).apply();
        }
    }

    public static String getJigsJson(Context context) {
        return prefs(context).getString(KEY_JIGS_JSON, "");
    }

    public static void setJigsJson(Context context, String json) {
        if (json != null && !json.trim().isEmpty()) {
            prefs(context).edit().putString(KEY_JIGS_JSON, json).apply();
        }
    }

    public static void setNextScheduleInfo(Context context, String slot, long triggerAtMs) {
        prefs(context).edit()
            .putString(KEY_NEXT_SLOT, safe(slot))
            .putLong(KEY_NEXT_TRIGGER_AT, triggerAtMs)
            .apply();
    }

    public static String getNextSlot(Context context) {
        return prefs(context).getString(KEY_NEXT_SLOT, "");
    }

    public static long getNextTriggerAt(Context context) {
        return prefs(context).getLong(KEY_NEXT_TRIGGER_AT, 0L);
    }

    public static void setLastRunStatus(Context context, long atMs, String status) {
        prefs(context).edit()
            .putLong(KEY_LAST_RUN_AT, atMs)
            .putString(KEY_LAST_RUN_STATUS, safe(status))
            .apply();
    }

    public static long getLastRunAt(Context context) {
        return prefs(context).getLong(KEY_LAST_RUN_AT, 0L);
    }

    public static String getLastRunStatus(Context context) {
        return prefs(context).getString(KEY_LAST_RUN_STATUS, "");
    }

    private static String slotDoneKey(String uid, String dateStr, String slot) {
        return "done_" + uid + "_" + dateStr + "_" + slot;
    }

    public static boolean isSlotDone(Context context, String uid, String dateStr, String slot) {
        return prefs(context).getBoolean(slotDoneKey(uid, dateStr, slot), false);
    }

    public static void markSlotDone(Context context, String uid, String dateStr, String slot) {
        prefs(context).edit().putBoolean(slotDoneKey(uid, dateStr, slot), true).apply();
    }

    public static synchronized void enqueuePendingRecord(Context context, JSONObject recordObj) {
        try {
            JSONArray arr = getPendingQueue(context);
            String targetId = recordObj.optString("id", "");
            JSONArray next = new JSONArray();
            for (int i = 0; i < arr.length(); i++) {
                JSONObject item = arr.optJSONObject(i);
                if (item != null && !targetId.equals(item.optString("id", ""))) {
                    next.put(item);
                }
            }
            next.put(recordObj);
            // Keep queue bounded cleanly to last 40 records
            int start = Math.max(0, next.length() - 40);
            JSONArray bounded = new JSONArray();
            for (int i = start; i < next.length(); i++) {
                bounded.put(next.opt(i));
            }
            prefs(context).edit().putString(KEY_PENDING_QUEUE, bounded.toString()).apply();
        } catch (Exception ignored) {}
    }

    public static synchronized JSONArray getPendingQueue(Context context) {
        String raw = prefs(context).getString(KEY_PENDING_QUEUE, "[]");
        try {
            return new JSONArray(raw);
        } catch (Exception e) {
            return new JSONArray();
        }
    }

    public static synchronized void savePendingQueue(Context context, JSONArray remaining) {
        prefs(context).edit().putString(KEY_PENDING_QUEUE, remaining.toString()).apply();
    }

    private static String safe(String val) {
        return val == null ? "" : val;
    }
}
