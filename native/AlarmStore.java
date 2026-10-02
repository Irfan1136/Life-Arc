package com.teclipse.lifearc;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import java.util.Calendar;
import org.json.JSONArray;
import org.json.JSONObject;

/** Keeps the alarm list on the phone and schedules each one with AlarmManager (works with the app closed). */
final class AlarmStore {
    static final String ACTION_FIRE = "com.teclipse.lifearc.ALARM_FIRE";
    private static final String PREFS = "life_alarms";
    private static final String KEY = "list";

    private AlarmStore() { }

    static JSONArray load(Context c) {
        try {
            return new JSONArray(c.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString(KEY, "[]"));
        } catch (Exception e) {
            return new JSONArray();
        }
    }

    static void save(Context c, JSONArray arr) {
        c.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putString(KEY, arr.toString()).apply();
    }

    static int code(String id) {
        long n = 0;
        try { n = Math.abs(Long.parseLong(id)); } catch (Exception e) { n = Math.abs((long) id.hashCode()); }
        return (int) (n % 100000000L);
    }

    private static boolean dayOk(JSONArray days, int dow) {
        if (days == null || days.length() == 0) return true;
        for (int i = 0; i < days.length(); i++) if (days.optInt(i, -1) == dow) return true;
        return false;
    }

    /** Next time (ms) after 'after' when this alarm should ring, or -1. */
    static long nextTrigger(JSONObject a, long after) {
        String[] hm = a.optString("time", "06:00").split(":");
        int h = 6, m = 0;
        try { h = Integer.parseInt(hm[0]); m = Integer.parseInt(hm[1]); } catch (Exception ignored) { }
        Calendar cal = Calendar.getInstance();
        cal.setTimeInMillis(after);
        cal.set(Calendar.HOUR_OF_DAY, h);
        cal.set(Calendar.MINUTE, m);
        cal.set(Calendar.SECOND, 0);
        cal.set(Calendar.MILLISECOND, 0);
        JSONArray days = a.optJSONArray("days");
        for (int i = 0; i < 9; i++) {
            if (cal.getTimeInMillis() > after && dayOk(days, cal.get(Calendar.DAY_OF_WEEK) - 1)) return cal.getTimeInMillis();
            cal.add(Calendar.DAY_OF_YEAR, 1);
        }
        return -1;
    }

    private static PendingIntent firePi(Context c, JSONObject a, boolean snooze) {
        Intent i = new Intent(c, AlarmReceiver.class).setAction(ACTION_FIRE);
        i.putExtra("id", a.optString("id"));
        i.putExtra("time", a.optString("time"));
        i.putExtra("label", a.optString("label", "Alarm"));
        i.putExtra("uri", a.optString("uri", ""));
        i.putExtra("snooze", snooze);
        int rc = code(a.optString("id")) + (snooze ? 300000000 : 0);
        return PendingIntent.getBroadcast(c, rc, i, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    static void scheduleOne(Context c, JSONObject a, long at, boolean snooze) {
        AlarmManager am = (AlarmManager) c.getSystemService(Context.ALARM_SERVICE);
        if (am == null || at < 0) return;
        PendingIntent show = PendingIntent.getActivity(c, 0, new Intent(c, MainActivity.class),
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        // setAlarmClock is exempt from battery saving and needs no special permission
        am.setAlarmClock(new AlarmManager.AlarmClockInfo(at, show), firePi(c, a, snooze));
    }

    static void cancelOne(Context c, JSONObject a) {
        AlarmManager am = (AlarmManager) c.getSystemService(Context.ALARM_SERVICE);
        if (am == null) return;
        am.cancel(firePi(c, a, false));
        am.cancel(firePi(c, a, true));
    }

    /** Replace everything: cancel the old ones, save the new list, schedule every armed alarm. */
    static void replaceAll(Context c, JSONArray fresh) {
        JSONArray old = load(c);
        for (int i = 0; i < old.length(); i++) {
            JSONObject o = old.optJSONObject(i);
            if (o != null) cancelOne(c, o);
        }
        save(c, fresh);
        scheduleAll(c);
    }

    static void scheduleAll(Context c) {
        JSONArray list = load(c);
        long now = System.currentTimeMillis();
        for (int i = 0; i < list.length(); i++) {
            JSONObject a = list.optJSONObject(i);
            if (a != null && a.optBoolean("armed", true)) scheduleOne(c, a, nextTrigger(a, now), false);
        }
    }

    static JSONObject find(Context c, String id) {
        JSONArray list = load(c);
        for (int i = 0; i < list.length(); i++) {
            JSONObject a = list.optJSONObject(i);
            if (a != null && id.equals(a.optString("id"))) return a;
        }
        return null;
    }
}
