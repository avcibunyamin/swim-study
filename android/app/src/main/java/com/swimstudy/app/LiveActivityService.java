package com.swimstudy.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;
import android.os.IBinder;
import android.os.SystemClock;
import android.content.res.ColorStateList;
import android.view.View;
import android.widget.RemoteViews;
import androidx.core.app.NotificationCompat;

public class LiveActivityService extends Service {

    static final String ACTION_START  = "LA_START";
    static final String ACTION_UPDATE = "LA_UPDATE";
    static final String ACTION_END    = "LA_END";

    private static final String CHANNEL_ID = "swim_live";
    private static final int    NOTIF_ID   = 2001;

    private static final String PREFS_NAME        = "swim_live_prefs";
    private static final String KEY_TARGET_ELAPSED = "targetElapsed";
    private static final String KEY_IS_FREE_MODE   = "isFreeMode";

    private int     timeLeft     = 0;
    private int     totalSecs    = 1;
    private boolean isOnBreak    = false;
    private boolean isFreeMode   = false;
    private int     freeTime     = 0;
    private boolean isRunning    = false;
    private int     finishedType = 0;
    private long    endTimeMs    = 0;   // countdown bitiş anı (wall-clock ms, sadece dönüşüm için)
    private long    startTimeMs  = 0;   // free mode başlangıç anı (wall-clock ms, sadece dönüşüm için)

    // Wall-clock → elapsedRealtime dönüşümü sonucu sabitlenmiş hedef
    // Kullanıcı saat değiştirse bile bu değer etkilenmez
    private long    targetElapsed = 0;

    @Override
    public void onCreate() {
        super.onCreate();
        createChannel();
        restoreState();
    }

    // ── SharedPreferences yardımcıları ──────────────────────────────────────

    private void saveState() {
        getSharedPreferences(PREFS_NAME, MODE_PRIVATE)
            .edit()
            .putLong(KEY_TARGET_ELAPSED, targetElapsed)
            .putBoolean(KEY_IS_FREE_MODE, isFreeMode)
            .apply();
    }

    private void restoreState() {
        SharedPreferences prefs = getSharedPreferences(PREFS_NAME, MODE_PRIVATE);
        long saved = prefs.getLong(KEY_TARGET_ELAPSED, 0);
        if (saved != 0) {
            targetElapsed = saved;
            isFreeMode    = prefs.getBoolean(KEY_IS_FREE_MODE, false);
        }
    }

    private void clearState() {
        getSharedPreferences(PREFS_NAME, MODE_PRIVATE)
            .edit()
            .remove(KEY_TARGET_ELAPSED)
            .remove(KEY_IS_FREE_MODE)
            .apply();
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent == null) return START_NOT_STICKY;
        String action = intent.getAction() != null ? intent.getAction() : "";
        readExtras(intent);

        switch (action) {
            case ACTION_START:
                // Wall-clock → elapsedRealtime dönüşümü (sadece bir kez burada yapılır)
                // Bundan sonra targetElapsed sabittir; kullanıcı saati değiştirse etkilenmez.
                //
                // Formül: targetElapsed = elapsedRealtime() + (endTimeMs - currentTimeMs)
                //   endTimeMs - currentTimeMs = kalan wall-clock ms
                //   elapsedRealtime() + kalan ms = elapsedRealtime domain'inde bitiş noktası
                if (isFreeMode && startTimeMs > 0) {
                    long wallElapsed = System.currentTimeMillis() - startTimeMs;
                    targetElapsed = SystemClock.elapsedRealtime() - wallElapsed;
                } else if (!isFreeMode && endTimeMs > 0) {
                    long wallRemaining = endTimeMs - System.currentTimeMillis();
                    targetElapsed = SystemClock.elapsedRealtime() + wallRemaining;
                } else {
                    // Fallback (endTimeMs yoksa)
                    targetElapsed = isFreeMode
                        ? SystemClock.elapsedRealtime() - (freeTime * 1000L)
                        : SystemClock.elapsedRealtime() + (timeLeft * 1000L);
                }
                saveState();
                startForeground(NOTIF_ID, buildNotification());
                break;
            case ACTION_UPDATE:
                // Sadece durum değişikliklerinde base'i güncelle (pause/resume/break geçişi)
                if (!isRunning || finishedType != 0) {
                    // Durmuş veya bitmiş — statik gösterilecek, base önemli değil
                } else {
                    // Base zaten doğru, Chronometer kendi sayıyor
                }
                startForeground(NOTIF_ID, buildNotification());
                break;
            case ACTION_END:
                clearState();
                stopForeground(true);
                stopSelf();
                break;
        }
        return START_NOT_STICKY;
    }

    private void readExtras(Intent i) {
        timeLeft     = i.getIntExtra("timeLeft",     timeLeft);
        totalSecs    = Math.max(i.getIntExtra("totalSecs", totalSecs), 1);
        isOnBreak    = i.getBooleanExtra("isOnBreak",    isOnBreak);
        isFreeMode   = i.getBooleanExtra("isFreeMode",   isFreeMode);
        freeTime     = i.getIntExtra("freeTime",     freeTime);
        isRunning    = i.getBooleanExtra("isRunning",    isRunning);
        finishedType = i.getIntExtra("finishedType", finishedType);
        long e = i.getLongExtra("endTimeMs",   0);
        long s = i.getLongExtra("startTimeMs", 0);
        if (e != 0) endTimeMs   = e;
        if (s != 0) startTimeMs = s;
    }

    private Notification buildNotification() {
        RemoteViews views    = new RemoteViews(getPackageName(), R.layout.notification_live);
        RemoteViews bigViews = new RemoteViews(getPackageName(), R.layout.notification_live_expanded);

        // ── İkon ve mod etiketi ──────────────────────────────────────────────
        String icon;
        String label;
        if (finishedType == 1) {
            icon  = "✅";
            label = "Çalışma bitti";
        } else if (finishedType == 2) {
            icon  = "⏰";
            label = "Mola bitti";
        } else if (!isRunning) {
            icon  = "⏸";
            label = "Duraklatıldı";
        } else if (isFreeMode) {
            icon  = "🎯";
            label = "Serbest Çalışma";
        } else {
            icon  = isOnBreak ? "☕" : "🏊";
            label = isOnBreak ? "Mola" : "Çalışıyor";
        }
        for (RemoteViews rv : new RemoteViews[]{views, bigViews}) {
            rv.setTextViewText(R.id.icon_emoji,  icon);
            rv.setTextViewText(R.id.mode_label, label);
        }

        // ── Renk ────────────────────────────────────────────────────────────
        int accent = finishedType == 1 ? 0xFF2DD4BF
                   : finishedType == 2 ? 0xFFF97316
                   : !isRunning        ? 0xFF8899AA
                   : isOnBreak         ? 0xFFF97316
                   :                     0xFF2DD4BF;
        for (RemoteViews rv : new RemoteViews[]{views, bigViews}) {
            rv.setTextColor(R.id.chronometer,  accent);
            rv.setTextColor(R.id.timer_static, accent);
            rv.setTextColor(R.id.swim_label,   accent);
        }

        // ── Zamanlayıcı ──────────────────────────────────────────────────────
        if (isRunning && finishedType == 0) {
            // targetElapsed = elapsedRealtime domain'inde sabitlenmiş bitiş/başlangıç noktası
            // Chronometer bu değeri referans alır, wall-clock'tan bağımsız çalışır
            for (RemoteViews rv : new RemoteViews[]{views, bigViews}) {
                rv.setChronometer(R.id.chronometer, targetElapsed, null, true);
                rv.setChronometerCountDown(R.id.chronometer, !isFreeMode);
                rv.setViewVisibility(R.id.chronometer,  View.VISIBLE);
                rv.setViewVisibility(R.id.timer_static, View.GONE);
            }
        } else {
            int secs = isFreeMode ? freeTime : timeLeft;
            for (RemoteViews rv : new RemoteViews[]{views, bigViews}) {
                rv.setTextViewText(R.id.timer_static, formatTime(secs));
                rv.setViewVisibility(R.id.chronometer,  View.GONE);
                rv.setViewVisibility(R.id.timer_static, View.VISIBLE);
            }
        }

        // ── İlerleme çubuğu (sadece expanded) ───────────────────────────────
        if (isFreeMode || finishedType != 0) {
            bigViews.setViewVisibility(R.id.progress_bar, View.GONE);
            bigViews.setViewVisibility(R.id.pct_label, View.GONE);
        } else {
            bigViews.setViewVisibility(R.id.progress_bar, View.VISIBLE);
            bigViews.setViewVisibility(R.id.pct_label, View.VISIBLE);
            int progress = (int)(1000.0 * (totalSecs - timeLeft) / totalSecs);
            progress = Math.max(0, Math.min(1000, progress));
            bigViews.setProgressBar(R.id.progress_bar, 1000, progress, false);
            bigViews.setTextViewText(R.id.pct_label, (progress / 10) + "%");
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                bigViews.setColorStateList(R.id.progress_bar, "setProgressTintList",
                    ColorStateList.valueOf(accent));
            }
        }

        for (RemoteViews rv : new RemoteViews[]{views, bigViews}) {
            rv.setViewVisibility(R.id.finished_text, View.GONE);
        }

        // ── Tıklanınca uygulamayı aç ─────────────────────────────────────────
        Intent tap = new Intent(this, MainActivity.class);
        tap.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent pi = PendingIntent.getActivity(
            this, 0, tap,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        return new NotificationCompat.Builder(this, CHANNEL_ID)
                .setSmallIcon(R.drawable.ic_swim_notif)
                .setCustomContentView(views)
                .setCustomBigContentView(bigViews)
                .setOngoing(true)
                .setOnlyAlertOnce(true)
                .setContentIntent(pi)
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .setCategory(NotificationCompat.CATEGORY_SERVICE)
                .build();
    }

    private String formatTime(int s) {
        int h = s / 3600, m = (s % 3600) / 60, sec = s % 60;
        return h > 0
            ? String.format("%d:%02d:%02d", h, m, sec)
            : String.format("%02d:%02d", m, sec);
    }

    private void createChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationManager nm = getSystemService(NotificationManager.class);
            if (nm == null) return;

            // Eski kanalları temizle
            nm.deleteNotificationChannel("swim_live_start");
            nm.deleteNotificationChannel("swim_live_update");
            nm.deleteNotificationChannel("swim_live_activity");
            nm.deleteNotificationChannel("swim_timer_channel");

            NotificationChannel ch = new NotificationChannel(
                CHANNEL_ID, "SWIM Zamanlayıcı", NotificationManager.IMPORTANCE_DEFAULT
            );
            ch.setDescription("Çalışma oturumu bildirimi");
            ch.setShowBadge(false);
            ch.setSound(null, null);
            ch.enableVibration(false);
            nm.createNotificationChannel(ch);
        }
    }

    @Override public IBinder onBind(Intent intent) { return null; }

    @Override
    public void onDestroy() {
        stopForeground(true);
        super.onDestroy();
    }
}
