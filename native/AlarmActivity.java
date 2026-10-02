package com.teclipse.lifearc;

import android.app.Activity;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.os.Build;
import android.os.Bundle;
import android.view.Gravity;
import android.view.WindowManager;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.TextView;
import androidx.core.content.ContextCompat;

/** The full-screen alarm: appears over the lock screen and over other apps. */
public class AlarmActivity extends Activity {
    private BroadcastReceiver done;

    private int dp(int v) { return (int) (v * getResources().getDisplayMetrics().density); }

    private Button button(String text, int fill, final String action) {
        Button b = new Button(this);
        b.setText(text);
        b.setAllCaps(false);
        b.setTextSize(18);
        b.setTextColor(Color.WHITE);
        b.setTypeface(Typeface.DEFAULT_BOLD);
        GradientDrawable bg = new GradientDrawable();
        bg.setColor(fill);
        bg.setCornerRadius(dp(16));
        b.setBackground(bg);
        LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, dp(60));
        lp.topMargin = dp(14);
        b.setLayoutParams(lp);
        b.setOnClickListener(v -> {
            startService(new Intent(AlarmActivity.this, AlarmService.class).setAction(action));
            finish();
        });
        return b;
    }

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        if (Build.VERSION.SDK_INT >= 27) {
            setShowWhenLocked(true);
            setTurnScreenOn(true);
        } else {
            getWindow().addFlags(WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED | WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON);
        }
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);

        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setGravity(Gravity.CENTER);
        root.setBackgroundColor(Color.BLACK);
        root.setPadding(dp(28), dp(28), dp(28), dp(28));

        TextView tag = new TextView(this);
        tag.setText("Life Arc");
        tag.setTextColor(Color.parseColor("#EF4444"));
        tag.setTextSize(16);
        tag.setGravity(Gravity.CENTER);

        TextView time = new TextView(this);
        time.setText(getIntent().getStringExtra("time"));
        time.setTextColor(Color.WHITE);
        time.setTextSize(72);
        time.setTypeface(Typeface.DEFAULT_BOLD);
        time.setGravity(Gravity.CENTER);

        TextView label = new TextView(this);
        String l = getIntent().getStringExtra("label");
        label.setText(l == null || l.isEmpty() ? "Alarm" : l);
        label.setTextColor(Color.parseColor("#D4D4D4"));
        label.setTextSize(22);
        label.setGravity(Gravity.CENTER);

        root.addView(tag);
        root.addView(time);
        root.addView(label);
        root.addView(button("Snooze 5 min", Color.parseColor("#DC2626"), AlarmService.ACTION_SNOOZE));
        root.addView(button("Stop", Color.parseColor("#404040"), AlarmService.ACTION_STOP));
        setContentView(root);

        done = new BroadcastReceiver() {
            @Override public void onReceive(Context c, Intent i) { finish(); }
        };
        ContextCompat.registerReceiver(this, done, new IntentFilter(AlarmService.ACTION_DONE), ContextCompat.RECEIVER_NOT_EXPORTED);
    }

    @Override
    protected void onDestroy() {
        if (done != null) {
            try { unregisterReceiver(done); } catch (Exception ignored) { }
        }
        super.onDestroy();
    }
}
