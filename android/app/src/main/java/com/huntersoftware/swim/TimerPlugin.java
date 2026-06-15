package com.huntersoftware.swim;

import android.content.Intent;
import android.os.Build;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "TimerPlugin")
public class TimerPlugin extends Plugin {

    @PluginMethod()
    public void startTimer(PluginCall call) {
        int timeLeft = call.getInt("timeLeft", 0);
        boolean isFreeMode = call.getBoolean("isFreeMode", false);
        int freeTime = call.getInt("freeTime", 0);
        boolean isOnBreak = call.getBoolean("isOnBreak", false);

        Intent intent = new Intent(getContext(), TimerService.class);
        intent.setAction("START");
        intent.putExtra("timeLeft", timeLeft);
        intent.putExtra("isFreeMode", isFreeMode);
        intent.putExtra("freeTime", freeTime);
        intent.putExtra("isOnBreak", isOnBreak);

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            getContext().startForegroundService(intent);
        } else {
            getContext().startService(intent);
        }
        call.resolve();
    }

    @PluginMethod()
    public void updateTimer(PluginCall call) {
        int timeLeft = call.getInt("timeLeft", 0);
        boolean isFreeMode = call.getBoolean("isFreeMode", false);
        int freeTime = call.getInt("freeTime", 0);
        boolean isOnBreak = call.getBoolean("isOnBreak", false);

        Intent intent = new Intent(getContext(), TimerService.class);
        intent.setAction("UPDATE");
        intent.putExtra("timeLeft", timeLeft);
        intent.putExtra("isFreeMode", isFreeMode);
        intent.putExtra("freeTime", freeTime);
        intent.putExtra("isOnBreak", isOnBreak);
        getContext().startService(intent);
        call.resolve();
    }

    @PluginMethod()
    public void stopTimer(PluginCall call) {
        Intent intent = new Intent(getContext(), TimerService.class);
        intent.setAction("STOP");
        getContext().startService(intent);
        call.resolve();
    }
}
