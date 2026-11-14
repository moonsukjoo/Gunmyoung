package com.gunmyoung.app;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

public class SilentBgGpsReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        if (!SilentBgGpsPrefs.isEnabled(context)) {
            return;
        }

        String slot = intent != null ? intent.getStringExtra(SilentBgGpsScheduler.EXTRA_SLOT) : "";
        int slotIndex = intent != null ? intent.getIntExtra(SilentBgGpsScheduler.EXTRA_SLOT_INDEX, -1) : -1;

        // Immediately arm the following scheduled slot so alarm chain continues even after app kill
        SilentBgGpsScheduler.scheduleNextAlarm(context);

        // Dispatch async GNSS measurement + Firestore REST upload via JobScheduler
        SilentBgGpsJobService.enqueueNow(context, slot, slotIndex, false);
    }
}
