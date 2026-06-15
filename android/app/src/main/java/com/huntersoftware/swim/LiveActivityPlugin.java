package com.huntersoftware.swim;

import android.content.Intent;
import android.os.Build;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "LiveActivityPlugin")
public class LiveActivityPlugin extends Plugin {

    private Intent buildIntent(PluginCall call, String action) {
        Intent i = new Intent(getContext(), LiveActivityService.class);
        i.setAction(action);
        i.putExtra("timeLeft",     call.getInt("timeLeft",            0));
        i.putExtra("totalSecs",    call.getInt("totalSecs",           0));
        i.putExtra("isOnBreak",    call.getBoolean("isOnBreak",    false));
        i.putExtra("isFreeMode",   call.getBoolean("isFreeMode",   false));
        i.putExtra("freeTime",     call.getInt("freeTime",            0));
        i.putExtra("isRunning",    call.getBoolean("isRunning",    true));
        i.putExtra("finishedType", call.getInt("finishedType",        0));
        // Mutlak zaman referansları (senkronizasyon için)
        Double endTimeMs   = call.getDouble("endTimeMs",   0.0);
        Double startTimeMs = call.getDouble("startTimeMs", 0.0);
        i.putExtra("endTimeMs",   endTimeMs.longValue());
        i.putExtra("startTimeMs", startTimeMs.longValue());
        return i;
    }

    @PluginMethod()
    public void start(PluginCall call) {
        Intent i = buildIntent(call, LiveActivityService.ACTION_START);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            getContext().startForegroundService(i);
        } else {
            getContext().startService(i);
        }
        call.resolve();
    }

    @PluginMethod()
    public void update(PluginCall call) {
        Intent i = buildIntent(call, LiveActivityService.ACTION_UPDATE);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            getContext().startForegroundService(i);
        } else {
            getContext().startService(i);
        }
        call.resolve();
    }

    @PluginMethod()
    public void end(PluginCall call) {
        Intent i = new Intent(getContext(), LiveActivityService.class);
        i.setAction(LiveActivityService.ACTION_END);
        getContext().startService(i);
        call.resolve();
    }
}
