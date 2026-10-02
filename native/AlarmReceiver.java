package com.teclipse.lifearc;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.media.AudioAttributes;
import android.media.RingtoneManager;
import android.os.Build;
import androidx.core.app.NotificationCompat;
import androidx.core.content.ContextCompat;
import org.json.JSONObject;

/** Fires at alarm time (even if the app is closed): starts the ringing service and books the next day. */
public class AlarmReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        String id = intent.getStringExtra("id");
        if (id == null) return;
        boolean snooze = intent.getBooleanExtra("snooze", false);
        JSONObject a = AlarmStore.find(context, id);
        if (!snooze) {
            if (a == null || !a.optBoolean("armed", true)) return; // deleted or switched off
            AlarmStore.scheduleOne(context, a, AlarmStore.nextTrigger(a, System.currentTimeMillis() + 1000), false);
        }
        Intent s = new Intent(context, AlarmService.class);
        s.putExtras(intent);
        s.setAction(AlarmService.ACTION_RING);
        try {
            ContextCompat.startForegroundService(context, s);
        } catch (Exception e) {
            fallback(context, intent); // the phone refused the service: still make the alarm heard
        }
    }

    private void fallback(Context c, Intent src) {
        NotificationManager nm = (NotificationManager) c.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm == null) return;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel ch = new NotificationChannel("alarm_fallback", "Alarm (backup)", NotificationManager.IMPORTANCE_HIGH);
            ch.setSound(RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM), new AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_ALARM).setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION).build());
            nm.createNotificationChannel(ch);
        }
        Intent open = new Intent(c, AlarmActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                .putExtra("time", src.getStringExtra("time")).putExtra("label", src.getStringExtra("label"));
        PendingIntent pi = PendingIntent.getActivity(c, 7, open, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        Notification n = new NotificationCompat.Builder(c, "alarm_fallback")
                .setSmallIcon(android.R.drawable.ic_lock_idle_alarm)
                .setContentTitle(src.getStringExtra("label"))
                .setContentText(src.getStringExtra("time"))
                .setCategory(NotificationCompat.CATEGORY_ALARM)
                .setPriority(NotificationCompat.PRIORITY_MAX)
                .setContentIntent(pi)
                .setFullScreenIntent(pi, true)
                .setAutoCancel(true)
                .build();
        nm.notify(4799, n);
    }
}
