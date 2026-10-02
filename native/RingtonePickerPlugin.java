package com.teclipse.lifearc;

import android.app.Activity;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.media.AudioAttributes;
import android.media.MediaPlayer;
import android.media.Ringtone;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;
import android.os.PowerManager;
import android.provider.Settings;
import androidx.activity.result.ActivityResult;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

@CapacitorPlugin(
    name = "RingtonePicker",
    permissions = {
        @Permission(alias = "audio", strings = { "android.permission.READ_MEDIA_AUDIO" }),
        @Permission(alias = "storage", strings = { "android.permission.READ_EXTERNAL_STORAGE" })
    }
)
public class RingtonePickerPlugin extends Plugin {
    private MediaPlayer player;
    private Ringtone fallback;

    private AudioAttributes alarmAttrs() {
        return new AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_ALARM)
                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                .build();
    }

    private String audioAlias() {
        return Build.VERSION.SDK_INT >= 33 ? "audio" : "storage";
    }

    // Reading the sound's name and playing songs from the phone needs audio access.
    @PluginMethod
    public void pick(PluginCall call) {
        if (getPermissionState(audioAlias()) != PermissionState.GRANTED) {
            requestPermissionForAlias(audioAlias(), call, "afterPermission");
        } else {
            launchPicker(call);
        }
    }

    @PermissionCallback
    private void afterPermission(PluginCall call) {
        launchPicker(call);
    }

    private void launchPicker(PluginCall call) {
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
        String u = call.getString("uri");
        if (u == null) {
            call.reject("no sound selected");
            return;
        }
        boolean loop = Boolean.TRUE.equals(call.getBoolean("loop", true));
        Uri uri = Uri.parse(u);
        try {
            player = new MediaPlayer();
            player.setDataSource(getContext(), uri);
            player.setAudioAttributes(alarmAttrs());
            player.setLooping(loop);
            player.prepare();
            player.start();
            call.resolve();
        } catch (Exception first) {
            stopPlayer();
            try {
                Ringtone r = RingtoneManager.getRingtone(getContext(), uri);
                if (r == null) throw first;
                r.setAudioAttributes(alarmAttrs());
                if (Build.VERSION.SDK_INT >= 28) r.setLooping(loop);
                r.play();
                if (!r.isPlaying()) throw first;
                fallback = r;
                call.resolve();
            } catch (Exception second) {
                call.reject("no access to this sound: " + first.getMessage());
            }
        }
    }

    @PluginMethod
    public void stop(PluginCall call) {
        stopPlayer();
        call.resolve();
    }

    // Creates a notification channel whose sound is the given sound.
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

    // ---- keep alarms alive when the app is closed ----
    @PluginMethod
    public void batteryStatus(PluginCall call) {
        boolean ok = true;
        if (Build.VERSION.SDK_INT >= 23) {
            PowerManager pm = (PowerManager) getContext().getSystemService(Context.POWER_SERVICE);
            ok = pm != null && pm.isIgnoringBatteryOptimizations(getContext().getPackageName());
        }
        JSObject ret = new JSObject();
        ret.put("unrestricted", ok);
        call.resolve(ret);
    }

    @PluginMethod
    public void batteryAllow(PluginCall call) {
        String pkg = getContext().getPackageName();
        try {
            Intent i = new Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS, Uri.parse("package:" + pkg));
            i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(i);
        } catch (Exception e) {
            try {
                Intent i2 = new Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS);
                i2.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                getContext().startActivity(i2);
            } catch (Exception ignored) { }
        }
        call.resolve();
    }

    // Opens the phone maker's "Auto-start / background" screen when it exists, otherwise this app's settings page.
    @PluginMethod
    public void openAutostart(PluginCall call) {
        String[][] targets = {
            { "com.miui.securitycenter", "com.miui.permcenter.autostart.AutoStartManagementActivity" },
            { "com.coloros.safecenter", "com.coloros.safecenter.permission.startup.StartupAppListActivity" },
            { "com.oppo.safe", "com.oppo.safe.permission.startup.StartupAppListActivity" },
            { "com.vivo.permissionmanager", "com.vivo.permissionmanager.activity.BgStartUpManagerActivity" },
            { "com.iqoo.secure", "com.iqoo.secure.ui.phoneoptimize.AddWhiteListActivity" },
            { "com.huawei.systemmanager", "com.huawei.systemmanager.startupmgr.ui.StartupNormalAppListActivity" },
            { "com.samsung.android.lool", "com.samsung.android.sm.ui.battery.BatteryActivity" }
        };
        for (String[] t : targets) {
            try {
                Intent i = new Intent();
                i.setComponent(new ComponentName(t[0], t[1]));
                i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                getContext().startActivity(i);
                call.resolve();
                return;
            } catch (Exception ignored) { }
        }
        try {
            Intent i = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:" + getContext().getPackageName()));
            i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(i);
        } catch (Exception ignored) { }
        call.resolve();
    }

    private void stopPlayer() {
        if (player != null) {
            try { player.stop(); } catch (Exception ignored) { }
            player.release();
            player = null;
        }
        if (fallback != null) {
            try { fallback.stop(); } catch (Exception ignored) { }
            fallback = null;
        }
    }
}
