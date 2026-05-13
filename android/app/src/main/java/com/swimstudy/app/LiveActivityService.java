package com.swimstudy.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Intent;
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

    private static final String CHANNEL_ID = "swim_live_activity";
    private static final int    NOTIF_ID   = 2001;

    // Durum
    private int     timeLeft     = 0;
    private int     totalSecs    = 1;
    private boolean isOnBreak    = false;
    private boolean isFreeMode   = false;
    private int     freeTime     = 0;
    private boolean isRunning    = false;
    private int     finishedType = 0;   // 0=normal 1=çalışma bitti 2=mola bitti

    @Override
    public void onCreate() {
        super.onCreate();
        createChannel();
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent == null) return START_NOT_STICKY;
        String action = intent.getAction() != null ? intent.getAction() : "";
        readExtras(intent);

        switch (action) {
            case ACTION_START:
            case ACTION_UPDATE:
                // Her iki durumda da startForeground çağır — servis zaten
                // çalışıyorsa bu sadece bildirimi günceller, crash olmaz.
                startForeground(NOTIF_ID, buildNotification());
                break;
            case ACTION_END:
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
    }

    private Notification buildNotification() {
        RemoteViews views = new RemoteViews(getPackageName(), R.layout.notification_live);

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
        views.setTextViewText(R.id.icon_emoji,  icon);
        views.setTextViewText(R.id.mode_label, label);

        // ── Renk: teal=çalışma, turuncu=mola, gri=duraklat ──────────────────
        int accent = finishedType == 1 ? 0xFF2DD4BF
                   : finishedType == 2 ? 0xFFF97316
                   : !isRunning        ? 0xFF8899AA
                   : isOnBreak         ? 0xFFF97316
                   :                     0xFF2DD4BF;
        views.setTextColor(R.id.chronometer,  accent);
        views.setTextColor(R.id.timer_static, accent);
        views.setTextColor(R.id.swim_label, accent);

        // ── Zamanlayıcı ──────────────────────────────────────────────────────
        if (isRunning && finishedType == 0) {
            // Chronometer: sistem tarafından her saniye güncellenir
            long base = isFreeMode
                ? SystemClock.elapsedRealtime() - (freeTime * 1000L)   // yukarı say
                : SystemClock.elapsedRealtime() + (timeLeft * 1000L);  // aşağı say
            views.setChronometer(R.id.chronometer, base, null, true);
            views.setChronometerCountDown(R.id.chronometer, !isFreeMode);
            views.setViewVisibility(R.id.chronometer,  View.VISIBLE);
            views.setViewVisibility(R.id.timer_static, View.GONE);
        } else {
            // Duraklatıldı ya da bitti — statik metin
            int secs = isFreeMode ? freeTime : timeLeft;
            views.setTextViewText(R.id.timer_static, formatTime(secs));
            views.setViewVisibility(R.id.chronometer,  View.GONE);
            views.setViewVisibility(R.id.timer_static, View.VISIBLE);
        }

        // ── İlerleme çubuğu ──────────────────────────────────────────────────
        if (isFreeMode || finishedType != 0) {
            views.setViewVisibility(R.id.progress_bar, View.GONE);
        } else {
            views.setViewVisibility(R.id.progress_bar, View.VISIBLE);
            int progress = (int)(1000.0 * (totalSecs - timeLeft) / totalSecs);
            views.setProgressBar(R.id.progress_bar, 1000, Math.max(0, Math.min(1000, progress)), false);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                views.setColorStateList(R.id.progress_bar, "setProgressTintList", ColorStateList.valueOf(accent));
            }
        }

        // ── Bitti yazısı artık mode_label'da gösteriliyor, ayrı text gerekmez
        views.setViewVisibility(R.id.finished_text, View.GONE);

        // ── Uygulamayı aç (bildirime tıklanınca) ─────────────────────────────
        Intent tap = new Intent(this, MainActivity.class);
        tap.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent pi = PendingIntent.getActivity(
            this, 0, tap,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        return new NotificationCompat.Builder(this, CHANNEL_ID)
                .setSmallIcon(android.R.drawable.ic_media_play)
                .setCustomContentView(views)
                .setCustomBigContentView(views)
                .setOngoing(true)
                .setSilent(true)
                .setContentIntent(pi)
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .setCategory(NotificationCompat.CATEGORY_SERVICE)
                .setStyle(new NotificationCompat.DecoratedCustomViewStyle())
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
            NotificationChannel ch = new NotificationChannel(
                CHANNEL_ID, "SWIM Live Activity", NotificationManager.IMPORTANCE_HIGH
            );
            ch.setDescription("Canlı çalışma zamanlayıcısı");
            ch.setShowBadge(false);
            ch.setSound(null, null);
            NotificationManager nm = getSystemService(NotificationManager.class);
            if (nm != null) nm.createNotificationChannel(ch);
        }
    }

    @Override public IBinder onBind(Intent intent) { return null; }

    @Override
    public void onDestroy() {
        stopForeground(true);
        super.onDestroy();
    }
}
