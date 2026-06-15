package com.huntersoftware.swim;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Intent;
import android.os.Build;
import android.os.IBinder;
import android.os.Handler;
import android.os.Looper;
import androidx.core.app.NotificationCompat;

public class TimerService extends Service {
    private static final String CHANNEL_ID = "swim_timer_channel";
    private static final int NOTIFICATION_ID = 1001;
    private Handler handler;
    private Runnable updateRunnable;
    private int timeLeftSeconds = 0;
    private boolean isRunning = false;
    private boolean isFreeMode = false;
    private int freeTimeSeconds = 0;
    private boolean isOnBreak = false;

    @Override
    public void onCreate() {
        super.onCreate();
        createNotificationChannel();
        handler = new Handler(Looper.getMainLooper());
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent != null) {
            String action = intent.getAction();
            if ("START".equals(action)) {
                timeLeftSeconds = intent.getIntExtra("timeLeft", 0);
                isFreeMode = intent.getBooleanExtra("isFreeMode", false);
                freeTimeSeconds = intent.getIntExtra("freeTime", 0);
                isOnBreak = intent.getBooleanExtra("isOnBreak", false);
                isRunning = true;
                startForeground(NOTIFICATION_ID, buildNotification());
                startTimer();
            } else if ("UPDATE".equals(action)) {
                timeLeftSeconds = intent.getIntExtra("timeLeft", timeLeftSeconds);
                isFreeMode = intent.getBooleanExtra("isFreeMode", isFreeMode);
                freeTimeSeconds = intent.getIntExtra("freeTime", freeTimeSeconds);
                isOnBreak = intent.getBooleanExtra("isOnBreak", isOnBreak);
                updateNotification();
            } else if ("STOP".equals(action)) {
                isRunning = false;
                if (handler != null && updateRunnable != null) {
                    handler.removeCallbacks(updateRunnable);
                }
                stopForeground(true);
                stopSelf();
            }
        }
        return START_STICKY;
    }

    private void startTimer() {
        updateRunnable = new Runnable() {
            @Override
            public void run() {
                if (!isRunning) return;
                if (isFreeMode) {
                    freeTimeSeconds++;
                } else {
                    if (timeLeftSeconds > 0) timeLeftSeconds--;
                }
                updateNotification();
                handler.postDelayed(this, 1000);
            }
        };
        handler.postDelayed(updateRunnable, 1000);
    }

    private void updateNotification() {
        NotificationManager manager = getSystemService(NotificationManager.class);
        if (manager != null) {
            manager.notify(NOTIFICATION_ID, buildNotification());
        }
    }

    private Notification buildNotification() {
        Intent notificationIntent = new Intent(this, MainActivity.class);
        notificationIntent.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent pendingIntent = PendingIntent.getActivity(this, 0, notificationIntent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

        String timeText;
        String title;
        if (isFreeMode) {
            timeText = formatTime(freeTimeSeconds);
            title = "🎯 Serbest Çalışma";
        } else {
            timeText = formatTime(timeLeftSeconds);
            title = isOnBreak ? "☕ Mola" : "📚 Çalışıyor";
        }

        return new NotificationCompat.Builder(this, CHANNEL_ID)
                .setContentTitle(title)
                .setContentText(timeText)
                .setSmallIcon(android.R.drawable.ic_media_play)
                .setOngoing(true)
                .setSilent(true)
                .setContentIntent(pendingIntent)
                .setPriority(NotificationCompat.PRIORITY_LOW)
                .setCategory(NotificationCompat.CATEGORY_SERVICE)
                .build();
    }

    private String formatTime(int totalSeconds) {
        int hours = totalSeconds / 3600;
        int minutes = (totalSeconds % 3600) / 60;
        int seconds = totalSeconds % 60;
        if (hours > 0) {
            return String.format("%d:%02d:%02d", hours, minutes, seconds);
        }
        return String.format("%02d:%02d", minutes, seconds);
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                    CHANNEL_ID,
                    "SWIM Timer",
                    NotificationManager.IMPORTANCE_LOW
            );
            channel.setDescription("Çalışma zamanlayıcısı bildirimi");
            channel.setShowBadge(false);
            NotificationManager manager = getSystemService(NotificationManager.class);
            if (manager != null) {
                manager.createNotificationChannel(channel);
            }
        }
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    @Override
    public void onDestroy() {
        isRunning = false;
        if (handler != null && updateRunnable != null) {
            handler.removeCallbacks(updateRunnable);
        }
        super.onDestroy();
    }
}
