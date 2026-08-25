package com.forextradingconsultants.app;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

public class SignalCheckReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        final Context app = context.getApplicationContext();
        new Thread(() -> SignalAlerts.check(app), "ftc-signal-check").start();
    }
}
