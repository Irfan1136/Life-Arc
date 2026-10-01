package com.teclipse.lifearc;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(RingtonePickerPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
