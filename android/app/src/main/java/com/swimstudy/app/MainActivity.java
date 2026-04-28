package com.swimstudy.app;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(TimerPlugin.class);
        registerPlugin(LiveActivityPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
