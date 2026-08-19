package com.wimpex.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Intent;
import android.media.AudioAttributes;
import android.media.RingtoneManager;
import android.media.Ringtone;
import android.net.Uri;
import android.os.Build;

import androidx.annotation.NonNull;
import androidx.core.app.NotificationCompat;

import com.google.firebase.messaging.FirebaseMessagingService;
import com.google.firebase.messaging.RemoteMessage;

public class IncomingCallMessagingService extends FirebaseMessagingService {
    private static final String CHANNEL_ID = "wimpex-calls";
    private static final int NOTIFICATION_ID = 7401;
    private static Ringtone activeRingtone;

    @Override
    public void onMessageReceived(@NonNull RemoteMessage message) {
        if (!"incoming_call".equals(message.getData().get("type"))) {
            return;
        }

        String callerName = message.getData().get("callerName");
        String callType = message.getData().get("callType");
        String callId = message.getData().get("callId");
        String title = callerName == null || callerName.isEmpty() ? "Incoming call" : callerName;
        String body = "video".equals(callType) ? "Incoming video call" : "Incoming voice call";

        createCallChannel();

        Intent callIntent = new Intent(this, MainActivity.class);
        callIntent.setAction(Intent.ACTION_VIEW);
        callIntent.setData(Uri.parse("com.wimpex.app://calls?call_id=" + Uri.encode(callId == null ? "" : callId)));
        callIntent.putExtra("call_id", callId);
        callIntent.addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);

        PendingIntent fullScreenIntent = PendingIntent.getActivity(
            this,
            NOTIFICATION_ID,
            callIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        Notification notification = new NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(com.wimpex.app.R.mipmap.ic_launcher)
            .setContentTitle(title)
            .setContentText(body)
            .setCategory(NotificationCompat.CATEGORY_CALL)
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setOngoing(true)
            .setAutoCancel(false)
            .setFullScreenIntent(fullScreenIntent, true)
            .setContentIntent(fullScreenIntent)
            .setTimeoutAfter(60_000)
            .build();

        NotificationManager manager = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
        if (manager != null) {
            manager.notify(NOTIFICATION_ID, notification);
        }

        Uri ringtoneUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE);
        activeRingtone = RingtoneManager.getRingtone(this, ringtoneUri);
        if (activeRingtone != null) {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                activeRingtone.setLooping(true);
            }
            activeRingtone.play();
        }
    }

    public static void stopRingtone() {
        if (activeRingtone != null && activeRingtone.isPlaying()) {
            activeRingtone.stop();
        }
        activeRingtone = null;
    }

    @Override
    public void onDestroy() {
        stopRingtone();
        super.onDestroy();
    }

    private void createCallChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
            return;
        }

        NotificationManager manager = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
        if (manager == null) {
            return;
        }

        Uri ringtone = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE);
        AudioAttributes audioAttributes = new AudioAttributes.Builder()
            .setUsage(AudioAttributes.USAGE_NOTIFICATION_RINGTONE)
            .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
            .build();
        NotificationChannel channel = new NotificationChannel(
            CHANNEL_ID,
            "Calls",
            NotificationManager.IMPORTANCE_HIGH
        );
        channel.setDescription("Incoming and missed calls");
        channel.enableVibration(true);
        channel.setSound(ringtone, audioAttributes);
        manager.createNotificationChannel(channel);
    }
}
