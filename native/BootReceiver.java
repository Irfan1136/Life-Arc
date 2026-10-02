package com.teclipse.lifearc;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/** Alarms are lost when the phone restarts or the app updates, so book them again. */
public class BootReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        AlarmStore.scheduleAll(context);
    }
}
