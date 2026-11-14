package com.gunmyoung.app;

import android.Manifest;
import android.content.Context;
import android.content.pm.PackageManager;
import android.location.Location;
import android.location.LocationListener;
import android.location.LocationManager;
import android.os.Build;
import android.os.Bundle;
import android.os.HandlerThread;
import android.os.Looper;

import androidx.core.content.ContextCompat;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.Date;
import java.util.Iterator;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.TimeZone;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;

public final class SilentBgGpsRunner {
    private static final int TARGET_SAMPLES = 5;
    private static final long GPS_BURST_TIMEOUT_MS = 14000L;
    private static final long MAX_LAST_KNOWN_AGE_MS = 20L * 60L * 1000L;

    private SilentBgGpsRunner() {}

    public static boolean hasAnyLocationPermission(Context context) {
        boolean fine = ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_FINE_LOCATION)
            == PackageManager.PERMISSION_GRANTED;
        boolean coarse = ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_COARSE_LOCATION)
            == PackageManager.PERMISSION_GRANTED;
        return fine || coarse;
    }

    public static boolean hasBackgroundLocationPermission(Context context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) {
            return hasAnyLocationPermission(context);
        }
        return ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_BACKGROUND_LOCATION)
            == PackageManager.PERMISSION_GRANTED;
    }

    /**
     * Collects up to 5 GNSS/network samples, applies outlier-filtered weighted averaging,
     * refreshes Firebase token, maps JIG zone, and writes record + daily dwell summary to Firestore.
     */
    public static void executeScheduledCapture(Context context, String slot, int slotIndex) {
        Context appCtx = context.getApplicationContext();
        if (!SilentBgGpsPrefs.isEnabled(appCtx)) {
            return;
        }
        if (slot == null || slot.trim().isEmpty()) {
            SilentBgGpsScheduler.SlotMatch active = SilentBgGpsScheduler.findActiveSlotWindow(4);
            if (active == null) return;
            slot = active.slot;
            slotIndex = active.slotIndex;
        }
        if (slotIndex < 0) {
            slotIndex = SilentBgGpsGeometry.slotIndexOf(slot);
            if (slotIndex < 0) slotIndex = 0;
        }

        String uid = SilentBgGpsPrefs.getWorkerUid(appCtx);
        String dateStr = formatLocalDate(new Date());
        if (SilentBgGpsPrefs.isSlotDone(appCtx, uid, dateStr, slot)) {
            flushPendingQueue(appCtx);
            return;
        }

        if (!hasAnyLocationPermission(appCtx)) {
            SilentBgGpsPrefs.setLastRunStatus(appCtx, System.currentTimeMillis(), "SKIPPED_NO_PERMISSION");
            return;
        }

        List<SilentBgGpsGeometry.GpsSample> samples = collectGpsSamples(appCtx);
        if (samples.isEmpty()) {
            SilentBgGpsPrefs.setLastRunStatus(appCtx, System.currentTimeMillis(), "SKIPPED_NO_FIX");
            return;
        }

        SilentBgGpsGeometry.AveragedFix fix = SilentBgGpsGeometry.averageSamples(samples);

        String idToken = refreshIdToken(appCtx);
        if (idToken != null && !idToken.isEmpty()) {
            refreshRemoteCalibrationAndJigs(appCtx, idToken);
        }

        List<SilentBgGpsGeometry.JigModel> jigs = SilentBgGpsGeometry.parseJigs(SilentBgGpsPrefs.getJigsJson(appCtx));
        String calJson = SilentBgGpsPrefs.getCalibrationJson(appCtx);
        String teamName = SilentBgGpsPrefs.getTeamName(appCtx);
        String assignedJigId = SilentBgGpsGeometry.resolveAssignedJigId(
            SilentBgGpsPrefs.getAssignedJigId(appCtx),
            teamName,
            jigs
        );

        SilentBgGpsGeometry.LocationMapping loc = SilentBgGpsGeometry.mapGps(
            fix.lat,
            fix.lng,
            assignedJigId,
            jigs,
            calJson
        );

        try {
            JSONObject recordObj = new JSONObject();
            String docId = uid + "_" + dateStr + "_" + slotIndex;
            recordObj.put("id", docId);
            recordObj.put("date", dateStr);
            recordObj.put("slot", slot);
            recordObj.put("slotIndex", slotIndex);
            recordObj.put("workerUid", uid);
            recordObj.put("workerName", SilentBgGpsPrefs.getWorkerName(appCtx));
            recordObj.put("employeeId", SilentBgGpsPrefs.getEmployeeId(appCtx));
            recordObj.put("teamName", teamName);
            recordObj.put("jobRole", SilentBgGpsPrefs.getJobRole(appCtx));
            recordObj.put("latitude", fix.lat);
            recordObj.put("longitude", fix.lng);
            recordObj.put("accuracy", fix.accuracy);
            recordObj.put("mapX", loc.mapX);
            recordObj.put("mapY", loc.mapY);
            recordObj.put("locationType", loc.locationType);
            if (loc.jigId != null) recordObj.put("jigId", loc.jigId);
            if (loc.jigName != null) recordObj.put("jigName", loc.jigName);
            if (loc.blockName != null) recordObj.put("blockName", loc.blockName);
            recordObj.put("locationLabel", loc.locationLabel);
            recordObj.put("isAtAssignedJig", loc.isAtAssignedJig);
            recordObj.put("status", loc.status);
            recordObj.put("stayMinutesInSlot", SilentBgGpsGeometry.stayMinutesForSlot(slot));
            recordObj.put("recordedAt", formatIsoUtc(new Date()));
            recordObj.put("sampleCount", fix.sampleCount);
            recordObj.put("spreadMeters", fix.spreadMeters);
            recordObj.put("measurementMode", "AUTO_SCHEDULED_AVG");
            recordObj.put("assignedJigId", assignedJigId);

            boolean uploaded = uploadRecordAndSummary(appCtx, idToken, recordObj, jigs);
            if (uploaded) {
                SilentBgGpsPrefs.markSlotDone(appCtx, uid, dateStr, slot);
                SilentBgGpsPrefs.setLastRunStatus(appCtx, System.currentTimeMillis(), "RECORDED_" + slot);
                flushPendingQueue(appCtx);
            } else {
                SilentBgGpsPrefs.enqueuePendingRecord(appCtx, recordObj);
                SilentBgGpsPrefs.setLastRunStatus(appCtx, System.currentTimeMillis(), "QUEUED_OFFLINE_" + slot);
            }
        } catch (Exception e) {
            SilentBgGpsPrefs.setLastRunStatus(appCtx, System.currentTimeMillis(), "ERROR_" + e.getClass().getSimpleName());
        }
    }

    public static void flushPendingQueue(Context context) {
        Context appCtx = context.getApplicationContext();
        JSONArray queue = SilentBgGpsPrefs.getPendingQueue(appCtx);
        if (queue.length() == 0) return;

        String idToken = refreshIdToken(appCtx);
        if (idToken == null || idToken.isEmpty()) return;

        List<SilentBgGpsGeometry.JigModel> jigs = SilentBgGpsGeometry.parseJigs(SilentBgGpsPrefs.getJigsJson(appCtx));
        JSONArray remaining = new JSONArray();
        for (int i = 0; i < queue.length(); i++) {
            JSONObject rec = queue.optJSONObject(i);
            if (rec == null) continue;
            boolean ok = uploadRecordAndSummary(appCtx, idToken, rec, jigs);
            if (ok) {
                SilentBgGpsPrefs.markSlotDone(
                    appCtx,
                    rec.optString("workerUid", ""),
                    rec.optString("date", ""),
                    rec.optString("slot", "")
                );
            } else {
                remaining.put(rec);
            }
        }
        SilentBgGpsPrefs.savePendingQueue(appCtx, remaining);
    }

    private static List<SilentBgGpsGeometry.GpsSample> collectGpsSamples(Context context) {
        final List<SilentBgGpsGeometry.GpsSample> collected = Collections.synchronizedList(new ArrayList<>());
        LocationManager lm = (LocationManager) context.getSystemService(Context.LOCATION_SERVICE);
        if (lm == null) return collected;

        HandlerThread ht = new HandlerThread("SilentBgGpsThread");
        ht.start();
        Looper looper = ht.getLooper();

        final CountDownLatch latch = new CountDownLatch(1);
        final LocationListener listener = new LocationListener() {
            @Override
            public void onLocationChanged(Location location) {
                if (location == null) return;
                collected.add(new SilentBgGpsGeometry.GpsSample(
                    location.getLatitude(),
                    location.getLongitude(),
                    location.hasAccuracy() ? Math.max(1.0, location.getAccuracy()) : 20.0,
                    location.getTime() > 0 ? location.getTime() : System.currentTimeMillis()
                ));
                if (collected.size() >= TARGET_SAMPLES) {
                    latch.countDown();
                }
            }

            @Override
            public void onStatusChanged(String provider, int status, Bundle extras) {}

            @Override
            public void onProviderEnabled(String provider) {}

            @Override
            public void onProviderDisabled(String provider) {}
        };

        boolean requestedAny = false;
        try {
            List<String> providers = lm.getProviders(true);
            if (providers != null) {
                for (String provider : providers) {
                    if (LocationManager.GPS_PROVIDER.equals(provider)
                        || LocationManager.NETWORK_PROVIDER.equals(provider)
                        || "fused".equals(provider)) {
                        try {
                            lm.requestLocationUpdates(provider, 1100L, 0f, listener, looper);
                            requestedAny = true;
                        } catch (SecurityException | IllegalArgumentException ignored) {}
                    }
                }
            }

            if (requestedAny) {
                latch.await(GPS_BURST_TIMEOUT_MS, TimeUnit.MILLISECONDS);
            }
        } catch (InterruptedException ignored) {
        } finally {
            try {
                lm.removeUpdates(listener);
            } catch (Exception ignored) {}
            try {
                ht.quitSafely();
            } catch (Exception ignored) {}
        }

        if (collected.isEmpty()) {
            long nowMs = System.currentTimeMillis();
            String[] fallbacks = {"fused", LocationManager.GPS_PROVIDER, LocationManager.NETWORK_PROVIDER};
            for (String p : fallbacks) {
                try {
                    Location last = lm.getLastKnownLocation(p);
                    if (last != null && (nowMs - last.getTime()) <= MAX_LAST_KNOWN_AGE_MS) {
                        collected.add(new SilentBgGpsGeometry.GpsSample(
                            last.getLatitude(),
                            last.getLongitude(),
                            last.hasAccuracy() ? Math.max(1.0, last.getAccuracy()) : 30.0,
                            last.getTime()
                        ));
                    }
                } catch (SecurityException | IllegalArgumentException ignored) {}
            }
        }

        return new ArrayList<>(collected);
    }

    private static String refreshIdToken(Context context) {
        String apiKey = SilentBgGpsPrefs.getFirebaseApiKey(context);
        String refreshToken = SilentBgGpsPrefs.getRefreshToken(context);
        if (apiKey.isEmpty() || refreshToken.isEmpty()) return null;

        HttpURLConnection conn = null;
        try {
            URL url = new URL("https://securetoken.googleapis.com/v1/token?key=" + urlEncode(apiKey));
            conn = (HttpURLConnection) url.openConnection();
            conn.setRequestMethod("POST");
            conn.setConnectTimeout(10000);
            conn.setReadTimeout(10000);
            conn.setDoOutput(true);
            conn.setRequestProperty("Content-Type", "application/x-www-form-urlencoded");

            String body = "grant_type=refresh_token&refresh_token=" + urlEncode(refreshToken);
            try (OutputStream os = conn.getOutputStream()) {
                os.write(body.getBytes(StandardCharsets.UTF_8));
            }

            int code = conn.getResponseCode();
            if (code >= 200 && code < 300) {
                String resp = readStream(conn.getInputStream());
                JSONObject json = new JSONObject(resp);
                String newRefresh = json.optString("refresh_token", "");
                if (!newRefresh.isEmpty()) {
                    SilentBgGpsPrefs.updateRefreshToken(context, newRefresh);
                }
                return json.optString("id_token", "");
            }
        } catch (Exception ignored) {
        } finally {
            if (conn != null) conn.disconnect();
        }
        return null;
    }

    private static void refreshRemoteCalibrationAndJigs(Context context, String idToken) {
        String projectId = SilentBgGpsPrefs.getFirebaseProjectId(context);
        String dbId = SilentBgGpsPrefs.getFirestoreDatabaseId(context);
        if (projectId.isEmpty() || dbId.isEmpty()) return;

        String baseUrl = "https://firestore.googleapis.com/v1/projects/" + urlEncode(projectId)
            + "/databases/" + urlEncode(dbId) + "/documents";

        try {
            JSONObject calDoc = httpGetJson(baseUrl + "/factoryCalibration/factory_7", idToken);
            if (calDoc != null && calDoc.has("fields")) {
                JSONObject plain = unwrapFirestoreFields(calDoc.optJSONObject("fields"));
                SilentBgGpsPrefs.setCalibrationJson(context, plain.toString());
            }
        } catch (Exception ignored) {}

        try {
            JSONObject jigsResp = httpGetJson(baseUrl + "/factoryJigs?pageSize=50", idToken);
            if (jigsResp != null && jigsResp.has("documents")) {
                JSONArray docs = jigsResp.optJSONArray("documents");
                if (docs != null && docs.length() > 0) {
                    JSONArray list = new JSONArray();
                    for (int i = 0; i < docs.length(); i++) {
                        JSONObject d = docs.optJSONObject(i);
                        if (d != null && d.has("fields")) {
                            list.put(unwrapFirestoreFields(d.optJSONObject("fields")));
                        }
                    }
                    if (list.length() > 0) {
                        SilentBgGpsPrefs.setJigsJson(context, list.toString());
                    }
                }
            }
        } catch (Exception ignored) {}
    }

    private static boolean uploadRecordAndSummary(
        Context context,
        String idToken,
        JSONObject recordObj,
        List<SilentBgGpsGeometry.JigModel> jigs
    ) {
        if (idToken == null || idToken.isEmpty()) return false;
        String projectId = SilentBgGpsPrefs.getFirebaseProjectId(context);
        String dbId = SilentBgGpsPrefs.getFirestoreDatabaseId(context);
        if (projectId.isEmpty() || dbId.isEmpty()) return false;

        String baseUrl = "https://firestore.googleapis.com/v1/projects/" + urlEncode(projectId)
            + "/databases/" + urlEncode(dbId) + "/documents";

        try {
            String docId = recordObj.getString("id");
            JSONObject payload = new JSONObject();
            JSONObject fields = toFirestoreFields(recordObj, new String[]{"assignedJigId"});
            payload.put("fields", fields);

            boolean recOk = httpPatchJson(baseUrl + "/factoryGpsRecords/" + urlEncode(docId), idToken, payload);
            if (!recOk) return false;

            syncDailySummary(baseUrl, idToken, recordObj, jigs);
            return true;
        } catch (Exception e) {
            return false;
        }
    }

    private static void syncDailySummary(
        String baseUrl,
        String idToken,
        JSONObject currentRecord,
        List<SilentBgGpsGeometry.JigModel> jigs
    ) {
        try {
            String workerUid = currentRecord.getString("workerUid");
            String dateStr = currentRecord.getString("date");
            String assignedJigId = currentRecord.optString("assignedJigId", "");
            if (assignedJigId.isEmpty() && !jigs.isEmpty()) {
                assignedJigId = jigs.get(0).id;
            }

            JSONObject queryBody = new JSONObject();
            JSONObject structured = new JSONObject();
            JSONArray fromArr = new JSONArray();
            fromArr.put(new JSONObject().put("collectionId", "factoryGpsRecords"));
            structured.put("from", fromArr);

            JSONArray filters = new JSONArray();
            filters.put(makeFieldFilter("date", "EQUAL", dateStr));
            filters.put(makeFieldFilter("workerUid", "EQUAL", workerUid));

            JSONObject composite = new JSONObject();
            composite.put("op", "AND");
            composite.put("filters", filters);
            structured.put("where", new JSONObject().put("compositeFilter", composite));
            queryBody.put("structuredQuery", structured);

            JSONArray queryResults = httpPostJsonArray(baseUrl + ":runQuery", idToken, queryBody);
            List<JSONObject> dayRecords = new ArrayList<>();
            boolean hasCurrent = false;
            String curId = currentRecord.getString("id");
            if (queryResults != null) {
                for (int i = 0; i < queryResults.length(); i++) {
                    JSONObject row = queryResults.optJSONObject(i);
                    JSONObject doc = row != null ? row.optJSONObject("document") : null;
                    if (doc != null && doc.has("fields")) {
                        JSONObject plain = unwrapFirestoreFields(doc.optJSONObject("fields"));
                        if (curId.equals(plain.optString("id"))) {
                            hasCurrent = true;
                        }
                        dayRecords.add(plain);
                    }
                }
            }
            if (!hasCurrent) {
                dayRecords.add(currentRecord);
            }

            final Map<String, Integer> orderMap = SilentBgGpsGeometry.slotOrderMap();
            Collections.sort(dayRecords, new Comparator<JSONObject>() {
                @Override
                public int compare(JSONObject a, JSONObject b) {
                    Integer ia = orderMap.get(a.optString("slot", ""));
                    Integer ib = orderMap.get(b.optString("slot", ""));
                    return Integer.compare(ia != null ? ia : 0, ib != null ? ib : 0);
                }
            });

            SilentBgGpsGeometry.JigModel assignedJig = jigs.get(0);
            for (SilentBgGpsGeometry.JigModel j : jigs) {
                if (assignedJigId.equals(j.id)) {
                    assignedJig = j;
                    break;
                }
            }

            int assignedMinutes = 0;
            int otherMinutes = 0;
            int awayMinutes = 0;
            int normalSlots = 0;
            int totalStayMinutes = 0;
            JSONArray slotSummaries = new JSONArray();

            for (JSONObject r : dayRecords) {
                int stay = r.optInt("stayMinutesInSlot", 60);
                String status = r.optString("status", "NORMAL");
                String locType = r.optString("locationType", "JIG");
                String rJigId = r.optString("jigId", "");

                if (assignedJig.id.equals(rJigId) || "NORMAL".equals(status)) {
                    assignedMinutes += stay;
                    normalSlots++;
                    totalStayMinutes += stay;
                } else if ("JIG".equals(locType) && !rJigId.isEmpty() && !assignedJig.id.equals(rJigId)) {
                    otherMinutes += stay;
                    totalStayMinutes += stay;
                } else if (!"OUT_OF_BOUNDS".equals(locType)) {
                    awayMinutes += stay;
                    totalStayMinutes += stay;
                } else {
                    awayMinutes += stay;
                }

                JSONObject slotSum = new JSONObject();
                slotSum.put("slot", r.optString("slot", ""));
                slotSum.put("label", r.optString("locationLabel", ""));
                slotSum.put("status", status);
                slotSum.put("minutes", stay);
                slotSummaries.put(slotSum);
            }

            int complianceRate = dayRecords.isEmpty() ? 0 : (int) Math.round(((double) normalSlots / dayRecords.size()) * 100.0);

            String summaryId = workerUid + "_" + dateStr;
            JSONObject summaryObj = new JSONObject();
            summaryObj.put("id", summaryId);
            summaryObj.put("date", dateStr);
            summaryObj.put("workerUid", workerUid);
            summaryObj.put("workerName", currentRecord.optString("workerName", "현장작업자"));
            summaryObj.put("employeeId", currentRecord.optString("employeeId", "EMP"));
            summaryObj.put("teamName", currentRecord.optString("teamName", "현장팀"));
            summaryObj.put("jobRole", currentRecord.optString("jobRole", "작업자"));
            summaryObj.put("assignedJigId", assignedJig.id);
            summaryObj.put("assignedBlockName", assignedJig.blockName);
            summaryObj.put("totalMinutesInFactory", totalStayMinutes);
            summaryObj.put("assignedBlockMinutes", assignedMinutes);
            summaryObj.put("otherBlockMinutes", otherMinutes);
            summaryObj.put("awayMinutes", awayMinutes);
            summaryObj.put("complianceRate", complianceRate);
            summaryObj.put("recordsCount", dayRecords.size());
            summaryObj.put("slotSummaries", slotSummaries);
            summaryObj.put("updatedAt", formatIsoUtc(new Date()));

            JSONObject payload = new JSONObject();
            payload.put("fields", toFirestoreFields(summaryObj, null));
            httpPatchJson(baseUrl + "/workerDwellSummaries/" + urlEncode(summaryId), idToken, payload);
        } catch (Exception ignored) {}
    }

    private static JSONObject makeFieldFilter(String fieldPath, String op, String value) throws Exception {
        JSONObject filter = new JSONObject();
        JSONObject ff = new JSONObject();
        ff.put("field", new JSONObject().put("fieldPath", fieldPath));
        ff.put("op", op);
        ff.put("value", new JSONObject().put("stringValue", value));
        filter.put("fieldFilter", ff);
        return filter;
    }

    private static JSONObject toFirestoreFields(JSONObject obj, String[] excludeKeys) throws Exception {
        JSONObject fields = new JSONObject();
        Iterator<String> keys = obj.keys();
        while (keys.hasNext()) {
            String key = keys.next();
            boolean skip = false;
            if (excludeKeys != null) {
                for (String ex : excludeKeys) {
                    if (ex.equals(key)) { skip = true; break; }
                }
            }
            if (skip) continue;
            Object val = obj.get(key);
            if (val != null && val != JSONObject.NULL) {
                fields.put(key, encodeFirestoreValue(val));
            }
        }
        return fields;
    }

    private static JSONObject encodeFirestoreValue(Object val) throws Exception {
        JSONObject wrapped = new JSONObject();
        if (val instanceof Boolean) {
            wrapped.put("booleanValue", val);
        } else if (val instanceof Integer || val instanceof Long) {
            wrapped.put("integerValue", String.valueOf(val));
        } else if (val instanceof Number) {
            wrapped.put("doubleValue", ((Number) val).doubleValue());
        } else if (val instanceof JSONObject) {
            JSONObject mapFields = toFirestoreFields((JSONObject) val, null);
            wrapped.put("mapValue", new JSONObject().put("fields", mapFields));
        } else if (val instanceof JSONArray) {
            JSONArray arr = (JSONArray) val;
            JSONArray values = new JSONArray();
            for (int i = 0; i < arr.length(); i++) {
                values.put(encodeFirestoreValue(arr.get(i)));
            }
            wrapped.put("arrayValue", new JSONObject().put("values", values));
        } else {
            wrapped.put("stringValue", String.valueOf(val));
        }
        return wrapped;
    }

    private static JSONObject unwrapFirestoreFields(JSONObject fields) {
        JSONObject out = new JSONObject();
        if (fields == null) return out;
        Iterator<String> keys = fields.keys();
        while (keys.hasNext()) {
            String k = keys.next();
            Object decoded = unwrapFirestoreValue(fields.optJSONObject(k));
            if (decoded != null) {
                try { out.put(k, decoded); } catch (Exception ignored) {}
            }
        }
        return out;
    }

    private static Object unwrapFirestoreValue(JSONObject v) {
        if (v == null) return null;
        if (v.has("stringValue")) return v.optString("stringValue");
        if (v.has("doubleValue")) return v.optDouble("doubleValue");
        if (v.has("integerValue")) {
            try { return Long.parseLong(v.optString("integerValue")); }
            catch (Exception e) { return v.optLong("integerValue"); }
        }
        if (v.has("booleanValue")) return v.optBoolean("booleanValue");
        if (v.has("timestampValue")) return v.optString("timestampValue");
        if (v.has("mapValue")) {
            JSONObject mv = v.optJSONObject("mapValue");
            return mv != null ? unwrapFirestoreFields(mv.optJSONObject("fields")) : new JSONObject();
        }
        if (v.has("arrayValue")) {
            JSONArray res = new JSONArray();
            JSONObject av = v.optJSONObject("arrayValue");
            JSONArray vals = av != null ? av.optJSONArray("values") : null;
            if (vals != null) {
                for (int i = 0; i < vals.length(); i++) {
                    Object item = unwrapFirestoreValue(vals.optJSONObject(i));
                    if (item != null) res.put(item);
                }
            }
            return res;
        }
        return null;
    }

    private static JSONObject httpGetJson(String urlStr, String idToken) {
        HttpURLConnection conn = null;
        try {
            conn = (HttpURLConnection) new URL(urlStr).openConnection();
            conn.setRequestMethod("GET");
            conn.setConnectTimeout(10000);
            conn.setReadTimeout(10000);
            conn.setRequestProperty("Authorization", "Bearer " + idToken);
            int code = conn.getResponseCode();
            if (code >= 200 && code < 300) {
                return new JSONObject(readStream(conn.getInputStream()));
            }
        } catch (Exception ignored) {
        } finally {
            if (conn != null) conn.disconnect();
        }
        return null;
    }

    private static boolean httpPatchJson(String urlStr, String idToken, JSONObject body) {
        HttpURLConnection conn = null;
        try {
            conn = (HttpURLConnection) new URL(urlStr).openConnection();
            conn.setRequestMethod("PATCH");
            conn.setConnectTimeout(10000);
            conn.setReadTimeout(10000);
            conn.setDoOutput(true);
            conn.setRequestProperty("Authorization", "Bearer " + idToken);
            conn.setRequestProperty("Content-Type", "application/json; charset=UTF-8");
            try (OutputStream os = conn.getOutputStream()) {
                os.write(body.toString().getBytes(StandardCharsets.UTF_8));
            }
            int code = conn.getResponseCode();
            return code >= 200 && code < 300;
        } catch (Exception e) {
            return false;
        } finally {
            if (conn != null) conn.disconnect();
        }
    }

    private static JSONArray httpPostJsonArray(String urlStr, String idToken, JSONObject body) {
        HttpURLConnection conn = null;
        try {
            conn = (HttpURLConnection) new URL(urlStr).openConnection();
            conn.setRequestMethod("POST");
            conn.setConnectTimeout(10000);
            conn.setReadTimeout(10000);
            conn.setDoOutput(true);
            conn.setRequestProperty("Authorization", "Bearer " + idToken);
            conn.setRequestProperty("Content-Type", "application/json; charset=UTF-8");
            try (OutputStream os = conn.getOutputStream()) {
                os.write(body.toString().getBytes(StandardCharsets.UTF_8));
            }
            int code = conn.getResponseCode();
            if (code >= 200 && code < 300) {
                return new JSONArray(readStream(conn.getInputStream()));
            }
        } catch (Exception ignored) {
        } finally {
            if (conn != null) conn.disconnect();
        }
        return null;
    }

    private static String readStream(InputStream is) throws Exception {
        if (is == null) return "";
        StringBuilder sb = new StringBuilder();
        try (BufferedReader br = new BufferedReader(new InputStreamReader(is, StandardCharsets.UTF_8))) {
            String line;
            while ((line = br.readLine()) != null) {
                sb.append(line);
            }
        }
        return sb.toString();
    }

    private static String urlEncode(String val) {
        try {
            return URLEncoder.encode(val, StandardCharsets.UTF_8.name());
        } catch (Exception e) {
            return val;
        }
    }

    private static String formatLocalDate(Date d) {
        SimpleDateFormat sdf = new SimpleDateFormat("yyyy-MM-dd", Locale.US);
        return sdf.format(d);
    }

    private static String formatIsoUtc(Date d) {
        SimpleDateFormat sdf = new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US);
        sdf.setTimeZone(TimeZone.getTimeZone("UTC"));
        return sdf.format(d);
    }
}
