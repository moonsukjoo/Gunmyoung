package com.gunmyoung.app;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

public final class SilentBgGpsGeometry {
    private static final double METERS_PER_DEG_LAT = 111320.0;
    private static final double BP_X_MIN = 150.0;
    private static final double BP_X_MAX = 1320.0;
    private static final double BP_Y_MIN = 120.0;
    private static final double BP_Y_MAX = 860.0;
    private static final double BP_CENTER_X = (BP_X_MIN + BP_X_MAX) / 2.0; // 735
    private static final double BP_CENTER_Y = (BP_Y_MIN + BP_Y_MAX) / 2.0; // 490
    private static final double BP_HALF_W = (BP_X_MAX - BP_X_MIN) / 2.0;   // 585
    private static final double BP_HALF_H = (BP_Y_MAX - BP_Y_MIN) / 2.0;   // 370

    public static final String[] TIME_SLOTS = {
        "08:20", "09:45", "10:15", "11:45", "13:10", "14:45", "15:15", "17:45"
    };

    public static final int[] SLOT_MINUTES = {
        70, 50, 60, 45, 60, 45, 75, 75
    };

    private SilentBgGpsGeometry() {}

    public static class GpsSample {
        public final double lat;
        public final double lng;
        public final double accuracy;
        public final long timestamp;

        public GpsSample(double lat, double lng, double accuracy, long timestamp) {
            this.lat = lat;
            this.lng = lng;
            this.accuracy = accuracy;
            this.timestamp = timestamp;
        }
    }

    public static class AveragedFix {
        public final double lat;
        public final double lng;
        public final double accuracy;
        public final int sampleCount;
        public final double spreadMeters;

        public AveragedFix(double lat, double lng, double accuracy, int sampleCount, double spreadMeters) {
            this.lat = lat;
            this.lng = lng;
            this.accuracy = accuracy;
            this.sampleCount = sampleCount;
            this.spreadMeters = spreadMeters;
        }
    }

    public static class JigModel {
        public String id;
        public String jigName;
        public String blockName;
        public String assignedTeam;
        public double x;
        public double y;
        public double width;
        public double height;
        public Double centerLat;
        public Double centerLng;
        public double gpsRadiusMeters;
        public String gpsCalibratedAt;
    }

    public static class LocationMapping {
        public int mapX;
        public int mapY;
        public String locationType;
        public String locationLabel;
        public String jigId;
        public String jigName;
        public String blockName;
        public boolean isAtAssignedJig;
        public String status;
    }

    public static double haversineMeters(double lat1, double lng1, double lat2, double lng2) {
        double R = 6371000.0;
        double dLat = Math.toRadians(lat2 - lat1);
        double dLng = Math.toRadians(lng2 - lng1);
        double a = Math.sin(dLat / 2.0) * Math.sin(dLat / 2.0)
            + Math.cos(Math.toRadians(lat1)) * Math.cos(Math.toRadians(lat2))
            * Math.sin(dLng / 2.0) * Math.sin(dLng / 2.0);
        double c = 2.0 * Math.atan2(Math.sqrt(a), Math.sqrt(1.0 - a));
        return Math.round(R * c * 10.0) / 10.0;
    }

    /**
     * Exact Java equivalent of TS computeFilteredAverageCoordinate (outlier filter + 1/accuracy^2 weighting).
     */
    public static AveragedFix averageSamples(List<GpsSample> samples) {
        if (samples.isEmpty()) {
            throw new IllegalArgumentException("No GPS samples");
        }
        if (samples.size() == 1) {
            GpsSample only = samples.get(0);
            return new AveragedFix(
                round7(only.lat),
                round7(only.lng),
                Math.round(only.accuracy * 10.0) / 10.0,
                1,
                0.0
            );
        }

        List<Double> lats = new ArrayList<>();
        List<Double> lngs = new ArrayList<>();
        for (GpsSample s : samples) {
            lats.add(s.lat);
            lngs.add(s.lng);
        }
        Collections.sort(lats);
        Collections.sort(lngs);
        double medLat = lats.get(lats.size() / 2);
        double medLng = lngs.get(lngs.size() / 2);

        List<Double> dists = new ArrayList<>();
        List<Double> sortedDists = new ArrayList<>();
        for (GpsSample s : samples) {
            double d = haversineMeters(medLat, medLng, s.lat, s.lng);
            dists.add(d);
            sortedDists.add(d);
        }
        Collections.sort(sortedDists);
        double madDist = sortedDists.get(sortedDists.size() / 2);
        double cutoff = Math.max(25.0, madDist * 2.5);

        List<GpsSample> filtered = new ArrayList<>();
        for (int i = 0; i < samples.size(); i++) {
            if (dists.get(i) <= cutoff) {
                filtered.add(samples.get(i));
            }
        }
        if (filtered.isEmpty()) {
            filtered = samples;
        }

        double totalWeight = 0.0;
        double sumLat = 0.0;
        double sumLng = 0.0;
        double sumAcc = 0.0;
        for (GpsSample s : filtered) {
            double effAcc = Math.max(s.accuracy, 4.0);
            double w = 1.0 / (effAcc * effAcc);
            totalWeight += w;
            sumLat += s.lat * w;
            sumLng += s.lng * w;
            sumAcc += s.accuracy * w;
        }

        double avgLat = sumLat / totalWeight;
        double avgLng = sumLng / totalWeight;
        double avgAcc = sumAcc / totalWeight;
        double maxSpread = 0.0;
        for (GpsSample s : filtered) {
            double d = haversineMeters(avgLat, avgLng, s.lat, s.lng);
            if (d > maxSpread) maxSpread = d;
        }

        return new AveragedFix(
            round7(avgLat),
            round7(avgLng),
            Math.round(avgAcc * 10.0) / 10.0,
            filtered.size(),
            Math.round(maxSpread * 10.0) / 10.0
        );
    }

    public static List<JigModel> defaultJigs() {
        List<JigModel> list = new ArrayList<>();
        String[][] defs = {
            {"jig-01", "JIG-01", "2301 블럭", "외주물량1팀(김철수)", "220", "170", "190", "220"},
            {"jig-02", "JIG-02", "2302 블럭", "외주물량2팀(이만기)", "430", "170", "190", "220"},
            {"jig-03", "JIG-03", "2305 블럭", "외주물량3팀(박영호)", "640", "170", "190", "220"},
            {"jig-04", "JIG-04", "2308 블럭", "외주물량4팀(정성훈)", "870", "170", "190", "220"},
            {"jig-05", "JIG-05", "2310 블럭", "건명 직영조립팀(강태우)", "1100", "170", "190", "220"},
            {"jig-06", "JIG-06", "2401 블럭", "외주물량5팀(최동석)", "220", "610", "190", "220"},
            {"jig-07", "JIG-07", "2404 블럭", "외주물량6팀(오세진)", "430", "610", "190", "220"},
            {"jig-08", "JIG-08", "2407 블럭", "외주물량7팀(윤병국)", "640", "610", "190", "220"},
            {"jig-09", "JIG-09", "2411 블럭", "건명 직영의장팀", "870", "610", "190", "220"},
            {"jig-10", "JIG-10", "2412 블럭", "품질검사 및 출하반", "1100", "610", "190", "220"}
        };
        for (String[] d : defs) {
            JigModel j = new JigModel();
            j.id = d[0];
            j.jigName = d[1];
            j.blockName = d[2];
            j.assignedTeam = d[3];
            j.x = Double.parseDouble(d[4]);
            j.y = Double.parseDouble(d[5]);
            j.width = Double.parseDouble(d[6]);
            j.height = Double.parseDouble(d[7]);
            j.gpsRadiusMeters = 12.0;
            list.add(j);
        }
        return list;
    }

    public static List<JigModel> parseJigs(String jigsJson) {
        List<JigModel> defaults = defaultJigs();
        if (jigsJson == null || jigsJson.trim().isEmpty()) {
            return defaults;
        }
        try {
            JSONArray arr = new JSONArray(jigsJson);
            if (arr.length() == 0) return defaults;
            List<JigModel> parsed = new ArrayList<>();
            for (int i = 0; i < arr.length(); i++) {
                JSONObject o = arr.optJSONObject(i);
                if (o == null) continue;
                JigModel j = new JigModel();
                j.id = o.optString("id", "jig-" + (i + 1));
                j.jigName = o.optString("jigName", "JIG-" + (i + 1));
                j.blockName = o.optString("blockName", "");
                j.assignedTeam = o.optString("assignedTeam", "");
                j.x = o.optDouble("x", 220);
                j.y = o.optDouble("y", 170);
                j.width = o.optDouble("width", 190);
                j.height = o.optDouble("height", 220);
                if (o.has("centerLat") && !o.isNull("centerLat")) {
                    j.centerLat = o.optDouble("centerLat");
                }
                if (o.has("centerLng") && !o.isNull("centerLng")) {
                    j.centerLng = o.optDouble("centerLng");
                }
                j.gpsRadiusMeters = o.optDouble("gpsRadiusMeters", 12.0);
                j.gpsCalibratedAt = o.optString("gpsCalibratedAt", "");
                parsed.add(j);
            }
            return parsed.isEmpty() ? defaults : parsed;
        } catch (Exception e) {
            return defaults;
        }
    }

    public static String resolveAssignedJigId(String configuredJigId, String teamName, List<JigModel> jigs) {
        if (configuredJigId != null && !configuredJigId.isEmpty()) {
            for (JigModel j : jigs) {
                if (configuredJigId.equals(j.id)) return j.id;
            }
        }
        if (teamName != null && !teamName.trim().isEmpty()) {
            String cleanTeam = teamName.replaceAll("\\s+", "").toLowerCase();
            for (JigModel j : jigs) {
                if (j.assignedTeam == null || j.assignedTeam.isEmpty()) continue;
                String cleanAssigned = j.assignedTeam.replaceAll("\\s+", "").toLowerCase();
                String prefix = cleanAssigned.split("\\(")[0];
                if (cleanAssigned.contains(cleanTeam) || (!prefix.isEmpty() && cleanTeam.contains(prefix))) {
                    return j.id;
                }
            }
        }
        return jigs.isEmpty() ? "jig-01" : jigs.get(0).id;
    }

    private static class AnchorPoint {
        double lat;
        double lng;
        double u;
        double v;
        AnchorPoint(double lat, double lng, double u, double v) {
            this.lat = lat;
            this.lng = lng;
            this.u = u;
            this.v = v;
        }
    }

    private static boolean validCoord(JSONObject pt) {
        if (pt == null) return false;
        double lat = pt.optDouble("lat", Double.NaN);
        double lng = pt.optDouble("lng", Double.NaN);
        return !Double.isNaN(lat) && !Double.isNaN(lng) && Math.abs(lat) > 1.0 && Math.abs(lng) > 1.0;
    }

    public static LocationMapping mapGps(
        double lat,
        double lng,
        String assignedJigId,
        List<JigModel> jigs,
        String calibrationJson
    ) {
        JSONObject cal = null;
        if (calibrationJson != null && !calibrationJson.trim().isEmpty()) {
            try {
                cal = new JSONObject(calibrationJson);
            } catch (Exception ignored) {}
        }

        List<AnchorPoint> anchors = new ArrayList<>();
        JSONObject east = cal != null ? cal.optJSONObject("east") : null;
        JSONObject west = cal != null ? cal.optJSONObject("west") : null;
        JSONObject south = cal != null ? cal.optJSONObject("south") : null;
        JSONObject north = cal != null ? cal.optJSONObject("north") : null;

        if (validCoord(east)) anchors.add(new AnchorPoint(east.optDouble("lat"), east.optDouble("lng"), -1.0, 0.0));
        if (validCoord(west)) anchors.add(new AnchorPoint(west.optDouble("lat"), west.optDouble("lng"), 1.0, 0.0));
        if (validCoord(south)) anchors.add(new AnchorPoint(south.optDouble("lat"), south.optDouble("lng"), 0.0, -1.0));
        if (validCoord(north)) anchors.add(new AnchorPoint(north.optDouble("lat"), north.optDouble("lng"), 0.0, 1.0));

        if (anchors.isEmpty()) {
            JigModel fallback = jigs.get(0);
            for (JigModel j : jigs) {
                if (j.id.equals(assignedJigId)) {
                    fallback = j;
                    break;
                }
            }
            LocationMapping m = new LocationMapping();
            m.mapX = (int) Math.round(fallback.x + fallback.width / 2.0);
            m.mapY = (int) Math.round(fallback.y + fallback.height / 2.0);
            m.locationType = "JIG";
            m.locationLabel = fallback.jigName + " (" + fallback.blockName + ")";
            m.jigId = fallback.id;
            m.jigName = fallback.jigName;
            m.blockName = fallback.blockName;
            m.isAtAssignedJig = true;
            m.status = "NORMAL";
            return m;
        }

        double refLat = 0.0;
        double refLng = 0.0;
        for (AnchorPoint a : anchors) {
            refLat += a.lat;
            refLng += a.lng;
        }
        refLat /= anchors.size();
        refLng /= anchors.size();
        double metersPerDegLng = 111320.0 * Math.cos(Math.toRadians(refLat));

        double ewLen = Math.max(10.0, cal.optDouble("eastWestLengthMeters", 230.0));
        double nsLen = Math.max(10.0, cal.optDouble("northSouthLengthMeters", 180.0));
        double halfEW = ewLen / 2.0;
        double halfNS = nsLen / 2.0;

        double eux = 0, euy = 0;
        boolean hasEu = false;
        double evx = 0, evy = 0;
        boolean hasEv = false;

        if (validCoord(east) && validCoord(west)) {
            double dx = (west.optDouble("lng") - east.optDouble("lng")) * metersPerDegLng;
            double dy = (west.optDouble("lat") - east.optDouble("lat")) * METERS_PER_DEG_LAT;
            double len = Math.hypot(dx, dy);
            if (len >= 1.0) {
                eux = dx / len;
                euy = dy / len;
                hasEu = true;
            }
        }
        if (validCoord(south) && validCoord(north)) {
            double dx = (north.optDouble("lng") - south.optDouble("lng")) * metersPerDegLng;
            double dy = (north.optDouble("lat") - south.optDouble("lat")) * METERS_PER_DEG_LAT;
            double len = Math.hypot(dx, dy);
            if (len >= 1.0) {
                evx = dx / len;
                evy = dy / len;
                hasEv = true;
            }
        }

        if (hasEu && !hasEv) {
            evx = euy;
            evy = -eux;
            hasEv = true;
        } else if (hasEv && !hasEu) {
            eux = -evy;
            euy = evx;
            hasEu = true;
        } else if (!hasEu && !hasEv) {
            if (anchors.size() >= 2) {
                AnchorPoint a0 = anchors.get(0);
                AnchorPoint a1 = anchors.get(1);
                double p0x = (a0.lng - refLng) * metersPerDegLng;
                double p0y = (a0.lat - refLat) * METERS_PER_DEG_LAT;
                double p1x = (a1.lng - refLng) * metersPerDegLng;
                double p1y = (a1.lat - refLat) * METERS_PER_DEG_LAT;
                double mdx = p1x - p0x;
                double mdy = p1y - p0y;
                double udx = (a1.u - a0.u) * halfEW * -1.0;
                double udy = (a1.v - a0.v) * halfNS;
                if (Math.hypot(mdx, mdy) >= 1.0 && Math.hypot(udx, udy) >= 1.0) {
                    double theta = Math.atan2(mdy, mdx) - Math.atan2(udy, udx);
                    eux = -Math.cos(theta);
                    euy = -Math.sin(theta);
                    evx = -Math.sin(theta);
                    evy = Math.cos(theta);
                    hasEu = true;
                    hasEv = true;
                }
            }
            if (!hasEu) {
                eux = -1.0; euy = 0.0;
                evx = 0.0; evy = 1.0;
            }
        }

        double hux = eux * halfEW;
        double huy = euy * halfEW;
        double hvx = evx * halfNS;
        double hvy = evy * halfNS;

        double sumCx = 0.0;
        double sumCy = 0.0;
        for (AnchorPoint a : anchors) {
            double px = (a.lng - refLng) * metersPerDegLng;
            double py = (a.lat - refLat) * METERS_PER_DEG_LAT;
            sumCx += px - a.u * hux - a.v * hvx;
            sumCy += py - a.u * huy - a.v * hvy;
        }
        double centerX = sumCx / anchors.size();
        double centerY = sumCy / anchors.size();

        // Populate calibrated JIG centers dynamically if missing
        String calUpdated = cal != null ? cal.optString("updatedAt", "") : "";
        for (JigModel j : jigs) {
            boolean hasFresh = j.centerLat != null && j.centerLng != null
                && j.gpsCalibratedAt != null && !j.gpsCalibratedAt.isEmpty()
                && calUpdated != null && j.gpsCalibratedAt.compareTo(calUpdated) >= 0;
            if (!hasFresh) {
                double jcx = j.x + j.width / 2.0;
                double jcy = j.y + j.height / 2.0;
                double ju = (jcx - BP_CENTER_X) / BP_HALF_W;
                double jv = (jcy - BP_CENTER_Y) / BP_HALF_H;
                double mx = centerX + ju * hux + jv * hvx;
                double my = centerY + ju * huy + jv * hvy;
                j.centerLat = round7(refLat + my / METERS_PER_DEG_LAT);
                j.centerLng = round7(refLng + mx / metersPerDegLng);
                double wM = (j.width / (BP_X_MAX - BP_X_MIN)) * ewLen;
                double hM = (j.height / (BP_Y_MAX - BP_Y_MIN)) * nsLen;
                j.gpsRadiusMeters = Math.max(5.0, Math.round(Math.max(wM, hM) / 2.0));
            }
        }

        // Transform device (lat, lng) to normalized (u, v) and blueprint pixels
        double dpx = (lng - refLng) * metersPerDegLng - centerX;
        double dpy = (lat - refLat) * METERS_PER_DEG_LAT - centerY;
        double det = hux * hvy - huy * hvx;

        double u = 0.0;
        double v = 0.0;
        if (Math.abs(det) >= 1e-6) {
            u = (dpx * hvy - dpy * hvx) / det;
            v = (hux * dpy - huy * dpx) / det;
        }

        double overEW = Math.max(0.0, (Math.abs(u) - 1.0) * halfEW);
        double overNS = Math.max(0.0, (Math.abs(v) - 1.0) * halfNS);
        double boundaryDistanceMeters = Math.round(Math.hypot(overEW, overNS) * 10.0) / 10.0;
        boolean isInsideFactory = boundaryDistanceMeters <= 18.0;

        int rawMapX = (int) Math.round(BP_CENTER_X + u * BP_HALF_W);
        int rawMapY = (int) Math.round(BP_CENTER_Y + v * BP_HALF_H);
        int mapX = (int) Math.max(BP_X_MIN, Math.min(BP_X_MAX, rawMapX));
        int mapY = (int) Math.max(BP_Y_MIN, Math.min(BP_Y_MAX, rawMapY));

        // Nearest JIG search
        JigModel nearestJig = null;
        double nearestDist = Double.POSITIVE_INFINITY;
        for (JigModel j : jigs) {
            if (j.centerLat != null && j.centerLng != null) {
                double d = haversineMeters(lat, lng, j.centerLat, j.centerLng);
                if (d < nearestDist) {
                    nearestDist = d;
                    nearestJig = j;
                }
            }
        }

        LocationMapping res = new LocationMapping();
        res.mapX = mapX;
        res.mapY = mapY;

        if (!isInsideFactory) {
            res.locationType = "OUT_OF_BOUNDS";
            res.locationLabel = "7공장 외곽 이탈 (경계 밖 약 " + Math.round(boundaryDistanceMeters) + "m)";
            res.isAtAssignedJig = false;
            res.status = "AWAY";
            return res;
        }

        // Check JIG rectangle overlap on blueprint
        for (JigModel j : jigs) {
            if (mapX >= j.x - 15 && mapX <= j.x + j.width + 15
                && mapY >= j.y - 15 && mapY <= j.y + j.height + 15) {
                boolean isAssigned = j.id.equals(assignedJigId);
                res.locationType = "JIG";
                res.locationLabel = j.jigName + " (" + j.blockName + ")";
                res.jigId = j.id;
                res.jigName = j.jigName;
                res.blockName = j.blockName;
                res.isAtAssignedJig = isAssigned;
                res.status = isAssigned ? "NORMAL" : "AWAY";
                return res;
            }
        }

        // Check facilities
        if (mapX >= 30 && mapX <= 140 && mapY >= 40 && mapY <= 140) {
            res.locationType = "REST_AREA";
            res.locationLabel = "물량팀 현장 휴게실 & 식수대";
            res.isAtAssignedJig = false;
            res.status = "RESTING";
            return res;
        }
        if (mapX >= 1270 && mapX <= 1380 && mapY >= 40 && mapY <= 140) {
            res.locationType = "RESTROOM";
            res.locationLabel = "안전관리실 & 현장 화장실";
            res.isAtAssignedJig = false;
            res.status = "RESTING";
            return res;
        }
        if (mapX >= 30 && mapX <= 140 && mapY >= 860 && mapY <= 960) {
            res.locationType = "AISLE";
            res.locationLabel = "공구 및 용접기 자재실";
            res.isAtAssignedJig = false;
            res.status = "AWAY";
            return res;
        }
        if (mapX >= 1270 && mapX <= 1380 && mapY >= 860 && mapY <= 960) {
            res.locationType = "AISLE";
            res.locationLabel = "완성 블럭 검사 및 반출 대기장";
            res.isAtAssignedJig = false;
            res.status = "AWAY";
            return res;
        }

        // Nearest JIG Haversine snap (+8m drift buffer)
        if (nearestJig != null && !Double.isInfinite(nearestDist)) {
            double captureRadius = (nearestJig.gpsRadiusMeters > 0 ? nearestJig.gpsRadiusMeters : 12.0) + 8.0;
            if (nearestDist <= captureRadius) {
                boolean isAssigned = nearestJig.id.equals(assignedJigId);
                res.locationType = "JIG";
                res.locationLabel = nearestJig.jigName + " (" + nearestJig.blockName + ")";
                res.jigId = nearestJig.id;
                res.jigName = nearestJig.jigName;
                res.blockName = nearestJig.blockName;
                res.isAtAssignedJig = isAssigned;
                res.status = isAssigned ? "NORMAL" : "AWAY";
                return res;
            }
        }

        if (mapY >= 430 && mapY <= 570) {
            res.locationType = "AISLE";
            res.locationLabel = "중앙 메인 물류 통로";
            res.isAtAssignedJig = false;
            res.status = "AWAY";
            return res;
        }

        res.locationType = "OUT_OF_BOUNDS";
        res.locationLabel = "공장 외곽/미지정 구역";
        res.isAtAssignedJig = false;
        res.status = "AWAY";
        return res;
    }

    public static int slotIndexOf(String slot) {
        for (int i = 0; i < TIME_SLOTS.length; i++) {
            if (TIME_SLOTS[i].equals(slot)) return i;
        }
        return -1;
    }

    public static int stayMinutesForSlot(String slot) {
        int idx = slotIndexOf(slot);
        return idx >= 0 ? SLOT_MINUTES[idx] : 60;
    }

    public static Map<String, Integer> slotOrderMap() {
        Map<String, Integer> m = new HashMap<>();
        for (int i = 0; i < TIME_SLOTS.length; i++) {
            m.put(TIME_SLOTS[i], i);
        }
        return m;
    }

    private static double round7(double val) {
        return Math.round(val * 10000000.0) / 10000000.0;
    }
}
