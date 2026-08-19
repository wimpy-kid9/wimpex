package com.wimpex.app;

import com.getcapacitor.BridgeActivity;

import android.app.NotificationManager;
import android.os.Bundle;
import android.content.Intent;

public class MainActivity extends BridgeActivity {
	private static final int INCOMING_CALL_NOTIFICATION_ID = 7401;

	@Override
	public void onCreate(Bundle savedInstanceState) {
		super.onCreate(savedInstanceState);
		clearIncomingCallNotification();
	}

	@Override
	public void onNewIntent(Intent intent) {
		super.onNewIntent(intent);
		setIntent(intent);
		clearIncomingCallNotification();
	}

	private void clearIncomingCallNotification() {
		IncomingCallMessagingService.stopRingtone();
		NotificationManager manager = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
		if (manager != null) {
			manager.cancel(INCOMING_CALL_NOTIFICATION_ID);
		}
	}
}
