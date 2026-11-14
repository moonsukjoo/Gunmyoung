package com.gunmyoung.app;

import android.app.job.JobInfo;
import android.app.job.JobParameters;
import android.app.job.JobScheduler;
import android.app.job.JobService;
import android.content.ComponentName;
import android.content.Context;
import android.os.PersistableBundle;

import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public class SilentBgGpsJobService extends JobService {
    private static final int JOB_ID = 77029;
    private static final ExecutorService EXECUTOR = Executors.newSingleThreadExecutor();

    public static void enqueueNow(Context context, String slot, int slotIndex, boolean flushOnly) {
        JobScheduler scheduler = (JobScheduler) context.getSystemService(Context.JOB_SCHEDULER_SERVICE);
        if (scheduler == null) return;

        PersistableBundle extras = new PersistableBundle();
        extras.putString(SilentBgGpsScheduler.EXTRA_SLOT, slot != null ? slot : "");
        extras.putInt(SilentBgGpsScheduler.EXTRA_SLOT_INDEX, slotIndex);
        extras.putBoolean("flushOnly", flushOnly);

        JobInfo.Builder builder = new JobInfo.Builder(
            JOB_ID,
            new ComponentName(context.getApplicationContext(), SilentBgGpsJobService.class)
        )
            .setExtras(extras)
            .setOverrideDeadline(50L)
            .setMinimumLatency(0L);

        scheduler.schedule(builder.build());
    }

    @Override
    public boolean onStartJob(final JobParameters params) {
        final PersistableBundle extras = params.getExtras();
        final String slot = extras.getString(SilentBgGpsScheduler.EXTRA_SLOT, "");
        final int slotIndex = extras.getInt(SilentBgGpsScheduler.EXTRA_SLOT_INDEX, -1);
        final boolean flushOnly = extras.getBoolean("flushOnly", false);

        EXECUTOR.execute(new Runnable() {
            @Override
            public void run() {
                try {
                    if (flushOnly) {
                        SilentBgGpsRunner.flushPendingQueue(getApplicationContext());
                    } else {
                        SilentBgGpsRunner.executeScheduledCapture(getApplicationContext(), slot, slotIndex);
                    }
                } finally {
                    jobFinished(params, false);
                }
            }
        });
        return true;
    }

    @Override
    public boolean onStopJob(JobParameters params) {
        return false;
    }
}
