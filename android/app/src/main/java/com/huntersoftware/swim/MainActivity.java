package com.huntersoftware.swim;

import android.Manifest;
import android.app.AlertDialog;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.PowerManager;
import android.provider.Settings;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    private static final int    REQ_NOTIF   = 1001;
    private static final String PREFS_BATT  = "swim_prefs";
    private static final String KEY_BATT_OK = "battery_dialog_shown";

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(LiveActivityPlugin.class);
        super.onCreate(savedInstanceState);
        requestNotificationPermission();
        maybeShowBatteryDialog();
    }

    // ── Android 13+ bildirim izni ────────────────────────────────────────────
    private void requestNotificationPermission() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS)
                    != PackageManager.PERMISSION_GRANTED) {
                ActivityCompat.requestPermissions(
                    this,
                    new String[]{ Manifest.permission.POST_NOTIFICATIONS },
                    REQ_NOTIF
                );
            }
        }
    }

    // ── Pil optimizasyonu diyaloğu (yalnızca bir kez göster) ────────────────
    private void maybeShowBatteryDialog() {
        PowerManager pm = (PowerManager) getSystemService(POWER_SERVICE);
        if (pm == null) return;

        // Zaten muaf tutulmuşsa veya daha önce gösterildiyse atla
        if (pm.isIgnoringBatteryOptimizations(getPackageName())) return;
        boolean shown = getSharedPreferences(PREFS_BATT, MODE_PRIVATE)
                            .getBoolean(KEY_BATT_OK, false);
        if (shown) return;

        // Bir daha gösterme
        getSharedPreferences(PREFS_BATT, MODE_PRIVATE)
            .edit().putBoolean(KEY_BATT_OK, true).apply();

        new AlertDialog.Builder(this)
            .setTitle("Süreyi Arka Planda Koru")
            .setMessage(
                "SWIM, çalışma süresini milisaniyesine kadar doğru takip etmek için " +
                "arka planda kesintisiz çalışmaya ihtiyaç duyar.\n\n" +
                "Bazı telefonlar (Xiaomi, Samsung, Huawei) pil tasarrufu için " +
                "arka plan uygulamalarını dondurabilir. " +
                "Bunu önlemek için bir sonraki ekranda " +
                "\"Kısıtlama Yok\" seçeneğini seç."
            )
            .setPositiveButton("Ayarları Aç", (d, w) -> {
                Intent i = new Intent(
                    Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS,
                    Uri.parse("package:" + getPackageName())
                );
                startActivity(i);
            })
            .setNegativeButton("Şimdi Değil", null)
            .show();
    }
}
