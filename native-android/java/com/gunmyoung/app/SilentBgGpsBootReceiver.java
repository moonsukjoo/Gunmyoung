package com.gunmyoung.app;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

public class SilentBgGpsBootReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        try {
            if (!SilentBgGpsPrefs.isEnabled(context)) {
                return;
            }

            SilentBgGpsScheduler.scheduleNextAlarm(context);

            SilentBgGpsScheduler.SlotMatch active = SilentBgGpsScheduler.findActiveSlotWindow(4);
            if (active != null) {
                SilentBgGpsJobService.enqueueNow(context, active.slot, active.slotIndex, false);
            } else if (SilentBgGpsPrefs.getPendingQueue(context).length() > 0) {
                SilentBgGpsJobService.enqueueNow(context, "", -1, true);
            }
        } catch (IllegalStateException ignored) {
            // Credential-encrypted SharedPreferences locked during early boot
        }
    }
}
