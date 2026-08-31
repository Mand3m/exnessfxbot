package com.forextradingconsultants.app;

import android.Manifest;
import android.app.AlarmManager;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.os.Build;
import android.os.SystemClock;
import android.webkit.CookieManager;

import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;
import androidx.core.content.ContextCompat;

import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;

public final class SignalAlerts {
    static final String CHANNEL_ID = "ftc_signals";
    static final String PREFS = "ftc_push";
    static final String KEY_SEEN = "seen_id";
    static final String KEY_SEEN_MANAGE = "seen_manage_id";
    static final int NOTICE_ID = 41001;
    static final int ALARM_ID = 41002;
    static final int MANAGE_NOTICE_ID = 41003;
    static final String HEAD_URL = "https://forextradingconsultants.com/api/push/head";
    static final String MANAGE_URL = "https://forextradingconsultants.com/api/push/manage";

    private SignalAlerts() {}

    static void ensureChannel(Context context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationChannel channel = new NotificationChannel(
            CHANNEL_ID,
            "Trade signals",
            NotificationManager.IMPORTANCE_HIGH
        );
        channel.setDescription("Alerts when a new desk signal is published");
        NotificationManager manager = context.getSystemService(NotificationManager.class);
        if (manager != null) manager.createNotificationChannel(channel);
    }

    static void schedule(Context context) {
        ensureChannel(context);
        AlarmManager alarms = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        if (alarms == null) return;
        PendingIntent pi = pending(context);
        alarms.setInexactRepeating(
            AlarmManager.ELAPSED_REALTIME_WAKEUP,
            SystemClock.elapsedRealtime() + 20_000,
            2 * 60 * 1000,
            pi
        );
        new Thread(() -> check(context.getApplicationContext()), "ftc-signal-check").start();
    }

    static PendingIntent pending(Context context) {
        Intent intent = new Intent(context, SignalCheckReceiver.class);
        int flags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) flags |= PendingIntent.FLAG_IMMUTABLE;
        return PendingIntent.getBroadcast(context, ALARM_ID, intent, flags);
    }

    static void check(Context context) {
        SharedPreferences prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        try {
            HttpURLConnection conn = (HttpURLConnection) new URL(HEAD_URL).openConnection();
            conn.setConnectTimeout(8000);
            conn.setReadTimeout(8000);
            conn.setRequestProperty("Accept", "application/json");
            BufferedReader reader = new BufferedReader(new InputStreamReader(conn.getInputStream()));
            StringBuilder body = new StringBuilder();
            String line;
            while ((line = reader.readLine()) != null) body.append(line);
            reader.close();
            conn.disconnect();
            JSONObject json = new JSONObject(body.toString());
            String id = json.optString("id", "");
            if (id != null && !id.isEmpty() && !"null".equals(id)) {
                String seen = prefs.getString(KEY_SEEN, "");
                if (seen.isEmpty()) {
                    prefs.edit().putString(KEY_SEEN, id).apply();
                } else if (!id.equals(seen)) {
                    prefs.edit().putString(KEY_SEEN, id).apply();
                    String label = json.optString("label", "the desk");
                    show(context, "New signal", label + " is on the desk. Open the app to view the card.", NOTICE_ID);
                }
            }
        } catch (Exception ignored) {
        }
        checkManage(context, prefs);
    }

    static void checkManage(Context context, SharedPreferences prefs) {
        try {
            HttpURLConnection conn = (HttpURLConnection) new URL(MANAGE_URL).openConnection();
            conn.setConnectTimeout(8000);
            conn.setReadTimeout(8000);
            conn.setRequestProperty("Accept", "application/json");
            String cookie = CookieManager.getInstance().getCookie("https://forextradingconsultants.com");
            if (cookie != null && !cookie.isEmpty()) conn.setRequestProperty("Cookie", cookie);
            BufferedReader reader = new BufferedReader(new InputStreamReader(conn.getInputStream()));
            StringBuilder body = new StringBuilder();
            String line;
            while ((line = reader.readLine()) != null) body.append(line);
            reader.close();
            conn.disconnect();
            JSONObject json = new JSONObject(body.toString());
            String id = json.optString("id", "");
            if (id == null || id.isEmpty() || "null".equals(id)) return;
            String seen = prefs.getString(KEY_SEEN_MANAGE, "");
            if (seen.isEmpty()) {
                prefs.edit().putString(KEY_SEEN_MANAGE, id).apply();
                return;
            }
            if (id.equals(seen)) return;
            prefs.edit().putString(KEY_SEEN_MANAGE, id).apply();
            String title = json.optString("title", "Trade update");
            String text = json.optString("body", "A stop was updated. Open the app for details.");
            show(context, title, text, MANAGE_NOTICE_ID);
        } catch (Exception ignored) {
        }
    }

    static void show(Context context, String title, String text, int noticeId) {
        if (Build.VERSION.SDK_INT >= 33
            && ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS)
                != PackageManager.PERMISSION_GRANTED) {
            return;
        }
        ensureChannel(context);
        Intent open = new Intent(context, MainActivity.class);
        open.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        int flags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) flags |= PendingIntent.FLAG_IMMUTABLE;
        PendingIntent content = PendingIntent.getActivity(context, noticeId, open, flags);
        NotificationCompat.Builder builder = new NotificationCompat.Builder(context, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_stat_notify)
            .setContentTitle(title)
            .setContentText(text)
            .setAutoCancel(true)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setContentIntent(content);
        NotificationManagerCompat.from(context).notify(noticeId, builder.build());
    }
}
