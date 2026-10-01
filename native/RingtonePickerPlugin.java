package com.teclipse.lifearc;

import android.app.Activity;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.Context;
import android.content.Intent;
import android.media.AudioAttributes;
import android.media.MediaPlayer;
import android.media.Ringtone;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;
import androidx.activity.result.ActivityResult;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "RingtonePicker")
public class RingtonePickerPlugin extends Plugin {
    private MediaPlayer player;

    private AudioAttributes alarmAttrs() {
        return new AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_ALARM)
                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                .build();
    }

    @PluginMethod
    public void pick(PluginCall call) {
        Intent i = new Intent(RingtoneManager.ACTION_RINGTONE_PICKER);
        i.putExtra(RingtoneManager.EXTRA_RINGTONE_TYPE,
                RingtoneManager.TYPE_ALARM | RingtoneManager.TYPE_RINGTONE | RingtoneManager.TYPE_NOTIFICATION);
        i.putExtra(RingtoneManager.EXTRA_RINGTONE_SHOW_DEFAULT, true);
        i.putExtra(RingtoneManager.EXTRA_RINGTONE_SHOW_SILENT, false);
        i.putExtra(RingtoneManager.EXTRA_RINGTONE_TITLE, "Choose alarm sound");
        startActivityForResult(call, i, "onPicked");
    }

    @ActivityCallback
    private void onPicked(PluginCall call, ActivityResult result) {
        if (call == null) return;
        Intent data = result.getData();
        if (result.getResultCode() != Activity.RESULT_OK || data == null) {
            call.reject("cancelled");
            return;
        }
        Uri uri = data.getParcelableExtra(RingtoneManager.EXTRA_RINGTONE_PICKED_URI);
        if (uri == null) {
            call.reject("none");
            return;
        }
        Ringtone r = RingtoneManager.getRingtone(getContext(), uri);
        JSObject ret = new JSObject();
        ret.put("uri", uri.toString());
        ret.put("title", r != null ? r.getTitle(getContext()) : "Device sound");
        call.resolve(ret);
    }

    @PluginMethod
    public void play(PluginCall call) {
        stopPlayer();
        try {
            player = new MediaPlayer();
            player.setDataSource(getContext(), Uri.parse(call.getString("uri")));
            player.setAudioAttributes(alarmAttrs());
            player.setLooping(call.getBoolean("loop", true));
            player.prepare();
            player.start();
            call.resolve();
        } catch (Exception e) {
            stopPlayer();
            call.reject("play failed");
        }
    }

    @PluginMethod
    public void stop(PluginCall call) {
        stopPlayer();
        call.resolve();
    }

    // Creates a notification channel whose sound is the chosen device sound.
    @PluginMethod
    public void channel(PluginCall call) {
        String id = call.getString("id");
        String name = call.getString("name");
        String uri = call.getString("uri");
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && id != null && uri != null) {
            NotificationManager nm = (NotificationManager) getContext().getSystemService(Context.NOTIFICATION_SERVICE);
            NotificationChannel ch = new NotificationChannel(id, name == null ? "Alarm" : name, NotificationManager.IMPORTANCE_HIGH);
            ch.setSound(Uri.parse(uri), alarmAttrs());
            ch.enableVibration(true);
            nm.createNotificationChannel(ch);
        }
        call.resolve();
    }

    private void stopPlayer() {
        if (player != null) {
            try { player.stop(); } catch (Exception ignored) { }
            player.release();
            player = null;
        }
    }
}
