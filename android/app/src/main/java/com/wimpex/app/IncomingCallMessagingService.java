package com.wimpex.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Intent;
import android.media.AudioAttributes;
import android.media.AudioManager;
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
    private static final String MESSAGE_CHANNEL_ID = "wimpex-messages-default";
    private static final int NOTIFICATION_ID = 7401;
    private static Ringtone activeRingtone;
    private static AudioManager audioManager;
    private static AudioManager.OnAudioFocusChangeListener audioFocusListener;

    @Override
    public void onMessageReceived(@NonNull RemoteMessage message) {
        if (!"incoming_call".equals(message.getData().get("type"))) {
            showMessageNotification(message);
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

        if (!MainActivity.isAppForeground()) {
            audioManager = (AudioManager) getSystemService(AUDIO_SERVICE);
            audioFocusListener = focusChange -> { };
            if (audioManager != null) {
                audioManager.requestAudioFocus(audioFocusListener, AudioManager.STREAM_RING, AudioManager.AUDIOFOCUS_GAIN_TRANSIENT);
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
    }

    private void showMessageNotification(RemoteMessage message) {
        if (MainActivity.isAppForeground()) {
            return;
        }
        String notificationSound = message.getData().get("notificationSound");
        String messageChannelId = getMessageChannelId(notificationSound);
        createMessageChannels();

        String title = message.getNotification() != null ? message.getNotification().getTitle() : null;
        String body = message.getNotification() != null ? message.getNotification().getBody() : null;
        if (title == null || title.isEmpty()) title = message.getData().get("title");
        if (body == null || body.isEmpty()) body = message.getData().get("body");
        if (title == null || title.isEmpty()) title = "New message";
        if (body == null || body.isEmpty()) body = "You received a new message.";

        String url = message.getData().get("url");
        Intent messageIntent = new Intent(this, MainActivity.class);
        messageIntent.setAction(Intent.ACTION_VIEW);
        if (url != null && !url.isEmpty()) {
            messageIntent.setData(Uri.parse("com.wimpex.app://" + url.replaceFirst("^/", "")));
        }
        messageIntent.addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);

        PendingIntent pendingIntent = PendingIntent.getActivity(
            this,
            (int) (System.currentTimeMillis() & 0x7fffffff),
            messageIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        Notification notification = new NotificationCompat.Builder(this, messageChannelId)
            .setSmallIcon(com.wimpex.app.R.mipmap.ic_launcher)
            .setContentTitle(title)
            .setContentText(body)
            .setStyle(new NotificationCompat.BigTextStyle().bigText(body))
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setVisibility(NotificationCompat.VISIBILITY_PRIVATE)
            .setAutoCancel(true)
            .setContentIntent(pendingIntent)
            .build();

        NotificationManager manager = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
        if (manager != null) {
            manager.notify((int) (System.currentTimeMillis() & 0x7fffffff), notification);
        }
    }

    public static void stopRingtone() {
        if (activeRingtone != null && activeRingtone.isPlaying()) {
            activeRingtone.stop();
        }
        activeRingtone = null;
        if (audioManager != null && audioFocusListener != null) {
            audioManager.abandonAudioFocus(audioFocusListener);
            audioManager = null;
            audioFocusListener = null;
        }
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

    private String getMessageChannelId(String sound) {
        if ("chime".equals(sound) || "pop".equals(sound) || "marimba".equals(sound)) return "wimpex-messages-" + sound;
        return MESSAGE_CHANNEL_ID;
    }

    private void createMessageChannels() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
            return;
        }

        NotificationManager manager = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
        if (manager == null) {
            return;
        }

        AudioAttributes audioAttributes = new AudioAttributes.Builder()
            .setUsage(AudioAttributes.USAGE_NOTIFICATION)
            .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
            .build();
        for (String soundName : new String[] { "default", "chime", "pop", "marimba" }) {
            NotificationChannel channel = new NotificationChannel(
                "wimpex-messages-" + soundName,
                "Messages (" + soundName + ")",
                NotificationManager.IMPORTANCE_HIGH
            );
            channel.setDescription("New direct and group messages");
            channel.enableVibration(true);
            channel.setSound(getMessageSoundUri(soundName), audioAttributes);
            manager.createNotificationChannel(channel);
        }
    }

    private Uri getMessageSoundUri(String soundName) {
        if ("default".equals(soundName)) {
            return RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION);
        }

        int resourceId = getResources().getIdentifier(soundName, "raw", getPackageName());
        return resourceId == 0
            ? RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION)
            : Uri.parse("android.resource://" + getPackageName() + "/" + resourceId);
    }
}
