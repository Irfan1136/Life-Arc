package com.teclipse.lifearc;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.media.AudioAttributes;
import android.media.MediaPlayer;
import android.net.Uri;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.os.PowerManager;
import android.os.VibrationEffect;
import android.os.Vibrator;
import androidx.core.app.NotificationCompat;
import org.json.JSONObject;

/** Rings like a real alarm: loops the sound on the alarm volume, vibrates, and shows Snooze / Stop. */
public class AlarmService extends Service {
    static final String ACTION_RING = "com.teclipse.lifearc.RING";
    static final String ACTION_STOP = "com.teclipse.lifearc.STOP";
    static final String ACTION_SNOOZE = "com.teclipse.lifearc.SNOOZE";
    static final String ACTION_DONE = "com.teclipse.lifearc.ALARM_DONE";
    private static final String CHANNEL = "alarm_ring";
    private static final int NOTE_ID = 4711;
    private static final long SNOOZE_MS = 5 * 60 * 1000L;
    private static final long MAX_RING_MS = 5 * 60 * 1000L;

    private MediaPlayer player;
    private PowerManager.WakeLock wake;
    private final Handler handler = new Handler(Looper.getMainLooper());
    private final Runnable giveUp = new Runnable() {
        @Override public void run() { finishRinging(true); }
    };
    private String curId = "", curTime = "", curLabel = "Alarm", curUri = "";

    @Override
    public IBinder onBind(Intent intent) { return null; }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        String action = intent == null ? ACTION_STOP : intent.getAction();
        if (ACTION_SNOOZE.equals(action)) {
            snoozeNow();
            return START_NOT_STICKY;
        }
        if (ACTION_STOP.equals(action) || intent == null) {
            finishRinging(false);
            return START_NOT_STICKY;
        }
        curId = nz(intent.getStringExtra("id"));
        curTime = nz(intent.getStringExtra("time"));
        curLabel = nz(intent.getStringExtra("label"));
        curUri = nz(intent.getStringExtra("uri"));
        ring();
        return START_NOT_STICKY;
    }

    private static String nz(String s) { return s == null ? "" : s; }

    private PendingIntent actionPi(String action, int rc) {
        Intent i = new Intent(this, AlarmService.class).setAction(action);
        return PendingIntent.getService(this, rc, i, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    private void ring() {
        NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel ch = new NotificationChannel(CHANNEL, "Alarm ringing", NotificationManager.IMPORTANCE_HIGH);
            ch.setSound(null, null);
            ch.enableVibration(false);
            ch.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
            nm.createNotificationChannel(ch);
        }
        Intent open = new Intent(this, AlarmActivity.class)
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP)
                .putExtra("time", curTime).putExtra("label", curLabel);
        PendingIntent openPi = PendingIntent.getActivity(this, 1, open, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        Notification n = new NotificationCompat.Builder(this, CHANNEL)
                .setSmallIcon(android.R.drawable.ic_lock_idle_alarm)
                .setContentTitle(curLabel.isEmpty() ? "Alarm" : curLabel)
                .setContentText(curTime + "  Life Arc alarm")
                .setCategory(NotificationCompat.CATEGORY_ALARM)
                .setPriority(NotificationCompat.PRIORITY_MAX)
                .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
                .setOngoing(true)
                .setAutoCancel(false)
                .setContentIntent(openPi)
                .setFullScreenIntent(openPi, true)
                .addAction(0, "Snooze 5 min", actionPi(ACTION_SNOOZE, 2))
                .addAction(0, "Stop", actionPi(ACTION_STOP, 3))
                .build();
        if (Build.VERSION.SDK_INT >= 29) {
            startForeground(NOTE_ID, n, ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK);
        } else {
            startForeground(NOTE_ID, n);
        }
        PowerManager pm = (PowerManager) getSystemService(Context.POWER_SERVICE);
        if (pm != null) {
            if (wake != null && wake.isHeld()) wake.release();
            wake = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "lifearc:alarm");
            wake.acquire(MAX_RING_MS + 30000L);
        }
        startSound();
        startVibration();
        handler.removeCallbacks(giveUp);
        handler.postDelayed(giveUp, MAX_RING_MS);
    }

    private void startSound() {
        stopSound();
        AudioAttributes attrs = new AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_ALARM)
                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                .build();
        String[] tries = new String[] { curUri, "android.resource://" + getPackageName() + "/raw/chime" };
        for (String u : tries) {
            if (u == null || u.isEmpty()) continue;
            try {
                MediaPlayer mp = new MediaPlayer();
                mp.setDataSource(this, Uri.parse(u));
                mp.setAudioAttributes(attrs);
                mp.setLooping(true);
                mp.prepare();
                mp.start();
                player = mp;
                return;
            } catch (Exception ignored) { }
        }
    }

    private void stopSound() {
        if (player != null) {
            try { player.stop(); } catch (Exception ignored) { }
            player.release();
            player = null;
        }
    }

    private void startVibration() {
        Vibrator v = (Vibrator) getSystemService(Context.VIBRATOR_SERVICE);
        if (v == null || !v.hasVibrator()) return;
        long[] pattern = new long[] { 0, 700, 500 };
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) v.vibrate(VibrationEffect.createWaveform(pattern, 0));
        else v.vibrate(pattern, 0);
    }

    private void snoozeNow() {
        try {
            JSONObject a = new JSONObject();
            a.put("id", curId);
            a.put("time", curTime);
            a.put("label", curLabel);
            a.put("uri", curUri);
            AlarmStore.scheduleOne(this, a, System.currentTimeMillis() + SNOOZE_MS, true);
        } catch (Exception ignored) { }
        finishRinging(false);
    }

    private void finishRinging(boolean missed) {
        handler.removeCallbacks(giveUp);
        stopSound();
        Vibrator v = (Vibrator) getSystemService(Context.VIBRATOR_SERVICE);
        if (v != null) v.cancel();
        if (wake != null && wake.isHeld()) wake.release();
        sendBroadcast(new Intent(ACTION_DONE).setPackage(getPackageName()));
        stopForeground(true);
        if (missed) {
            NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
            Notification n = new NotificationCompat.Builder(this, CHANNEL)
                    .setSmallIcon(android.R.drawable.ic_lock_idle_alarm)
                    .setContentTitle("Missed alarm")
                    .setContentText(curTime + "  " + curLabel)
                    .setAutoCancel(true)
                    .build();
            nm.notify(NOTE_ID + 1, n);
        }
        stopSelf();
    }

    @Override
    public void onDestroy() {
        handler.removeCallbacks(giveUp);
        stopSound();
        super.onDestroy();
    }
}
