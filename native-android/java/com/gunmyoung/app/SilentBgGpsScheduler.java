package com.gunmyoung.app;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.os.Build;

import java.util.Calendar;

public final class SilentBgGpsScheduler {
    private static final int ALARM_REQUEST_CODE = 77019;
    public static final String EXTRA_SLOT = "slot";
    public static final String EXTRA_SLOT_INDEX = "slotIndex";
    public static final String EXTRA_ACTION_TYPE = "actionType";
    public static final String ACTION_CAPTURE_SLOT = "CAPTURE_SLOT";

    private SilentBgGpsScheduler() {}

    public static class SlotMatch {
        public final String slot;
        public final int slotIndex;
        public SlotMatch(String slot, int slotIndex) {
            this.slot = slot;
            this.slotIndex = slotIndex;
        }
    }

    private static int parseSlotMinutes(String slot) {
        String[] parts = slot.split(":");
        int hh = Integer.parseInt(parts[0]);
        int mm = Integer.parseInt(parts[1]);
        return hh * 60 + mm;
    }

    /**
     * Checks whether the current device wall time falls inside [slot, slot + toleranceMinutes].
     */
    public static SlotMatch findActiveSlotWindow(int toleranceMinutes) {
        Calendar now = Calendar.getInstance();
        int curMins = now.get(Calendar.HOUR_OF_DAY) * 60 + now.get(Calendar.MINUTE);
        for (int i = 0; i < SilentBgGpsGeometry.TIME_SLOTS.length; i++) {
            String slot = SilentBgGpsGeometry.TIME_SLOTS[i];
            int slotMins = parseSlotMinutes(slot);
            if (curMins >= slotMins && curMins <= slotMins + toleranceMinutes) {
                return new SlotMatch(slot, i);
            }
        }
        return null;
    }

    /**
     * Arms AlarmManager for the next upcoming measurement slot (today or tomorrow 08:20),
     * firing even when the app is completely closed/killed or device is in Doze idle.
     */
    public static void scheduleNextAlarm(Context context) {
        if (!SilentBgGpsPrefs.isEnabled(context)) {
            cancelAll(context);
            return;
        }

        AlarmManager alarmManager = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        if (alarmManager == null) return;

        Calendar now = Calendar.getInstance();
        int nowSec = now.get(Calendar.HOUR_OF_DAY) * 3600
            + now.get(Calendar.MINUTE) * 60
            + now.get(Calendar.SECOND);

        String targetSlot = null;
        int targetIndex = -1;
        boolean tomorrow = false;

        for (int i = 0; i < SilentBgGpsGeometry.TIME_SLOTS.length; i++) {
            String slot = SilentBgGpsGeometry.TIME_SLOTS[i];
            int slotSec = parseSlotMinutes(slot) * 60;
            // +10s grace buffer after :00 to prevent re-triggering the exact same second
            if (slotSec > nowSec + 5) {
                targetSlot = slot;
                targetIndex = i;
                break;
            }
        }

        if (targetSlot == null) {
            targetSlot = SilentBgGpsGeometry.TIME_SLOTS[0];
            targetIndex = 0;
            tomorrow = true;
        }

        String[] parts = targetSlot.split(":");
        int hh = Integer.parseInt(parts[0]);
        int mm = Integer.parseInt(parts[1]);

        Calendar triggerCal = Calendar.getInstance();
        if (tomorrow) {
            triggerCal.add(Calendar.DAY_OF_YEAR, 1);
        }
        triggerCal.set(Calendar.HOUR_OF_DAY, hh);
        triggerCal.set(Calendar.MINUTE, mm);
        triggerCal.set(Calendar.SECOND, 3);
        triggerCal.set(Calendar.MILLISECOND, 0);

        long triggerAtMs = triggerCal.getTimeInMillis();

        Intent intent = new Intent(context.getApplicationContext(), SilentBgGpsReceiver.class);
        intent.setAction("com.gunmyoung.app.ACTION_SILENT_GPS_SLOT");
        intent.putExtra(EXTRA_ACTION_TYPE, ACTION_CAPTURE_SLOT);
        intent.putExtra(EXTRA_SLOT, targetSlot);
        intent.putExtra(EXTRA_SLOT_INDEX, targetIndex);

        int flags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            flags |= PendingIntent.FLAG_IMMUTABLE;
        }
        PendingIntent pi = PendingIntent.getBroadcast(
            context.getApplicationContext(),
            ALARM_REQUEST_CODE,
            intent,
            flags
        );

        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                if (alarmManager.canScheduleExactAlarms()) {
                    alarmManager.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerAtMs, pi);
                } else {
                    alarmManager.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerAtMs, pi);
                }
            } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                alarmManager.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerAtMs, pi);
            } else {
                alarmManager.setExact(AlarmManager.RTC_WAKEUP, triggerAtMs, pi);
            }
            SilentBgGpsPrefs.setNextScheduleInfo(context, targetSlot, triggerAtMs);
        } catch (SecurityException se) {
            try {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                    alarmManager.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerAtMs, pi);
                } else {
                    alarmManager.set(AlarmManager.RTC_WAKEUP, triggerAtMs, pi);
                }
                SilentBgGpsPrefs.setNextScheduleInfo(context, targetSlot, triggerAtMs);
            } catch (Exception ignored) {}
        }
    }

    public static void cancelAll(Context context) {
        AlarmManager alarmManager = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        if (alarmManager == null) return;

        Intent intent = new Intent(context.getApplicationContext(), SilentBgGpsReceiver.class);
        intent.setAction("com.gunmyoung.app.ACTION_SILENT_GPS_SLOT");
        int flags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            flags |= PendingIntent.FLAG_IMMUTABLE;
        }
        PendingIntent pi = PendingIntent.getBroadcast(
            context.getApplicationContext(),
            ALARM_REQUEST_CODE,
            intent,
            flags
        );
        alarmManager.cancel(pi);
        pi.cancel();
    }
}
