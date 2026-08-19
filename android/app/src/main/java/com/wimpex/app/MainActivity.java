package com.wimpex.app;

import android.app.NotificationManager;
import android.Manifest;
import android.content.pm.PackageManager;
import android.os.Bundle;
import android.content.Intent;
import android.webkit.PermissionRequest;
import android.webkit.WebChromeClient;

import androidx.annotation.NonNull;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
	private static final int INCOMING_CALL_NOTIFICATION_ID = 7401;
	private static final int MEDIA_PERMISSION_REQUEST = 4101;
	private static volatile boolean isForeground;
	private PermissionRequest pendingWebViewPermissionRequest;

	@Override
	public void onCreate(Bundle savedInstanceState) {
		super.onCreate(savedInstanceState);
		getBridge().getWebView().setWebChromeClient(new WebChromeClient() {
			@Override
			public void onPermissionRequest(final PermissionRequest request) {
				runOnUiThread(() -> handleWebViewPermissionRequest(request));
			}
		});
		clearIncomingCallNotification();
	}

	@Override
	public void onResume() {
		super.onResume();
		isForeground = true;
	}

	@Override
	public void onPause() {
		isForeground = false;
		super.onPause();
	}

	public static boolean isAppForeground() {
		return isForeground;
	}

	private void handleWebViewPermissionRequest(PermissionRequest request) {
		boolean needsCamera = false;
		boolean needsMicrophone = false;
		for (String resource : request.getResources()) {
			needsCamera |= PermissionRequest.RESOURCE_VIDEO_CAPTURE.equals(resource);
			needsMicrophone |= PermissionRequest.RESOURCE_AUDIO_CAPTURE.equals(resource);
		}

		boolean cameraGranted = !needsCamera || ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED;
		boolean microphoneGranted = !needsMicrophone || ContextCompat.checkSelfPermission(this, Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED;
		if (cameraGranted && microphoneGranted) {
			request.grant(request.getResources());
			return;
		}

		pendingWebViewPermissionRequest = request;
		if (needsCamera && needsMicrophone) {
			ActivityCompat.requestPermissions(this, new String[] { Manifest.permission.CAMERA, Manifest.permission.RECORD_AUDIO }, MEDIA_PERMISSION_REQUEST);
		} else if (needsCamera) {
			ActivityCompat.requestPermissions(this, new String[] { Manifest.permission.CAMERA }, MEDIA_PERMISSION_REQUEST);
		} else if (needsMicrophone) {
			ActivityCompat.requestPermissions(this, new String[] { Manifest.permission.RECORD_AUDIO }, MEDIA_PERMISSION_REQUEST);
		} else {
			request.deny();
			pendingWebViewPermissionRequest = null;
		}
	}

	@Override
	public void onRequestPermissionsResult(int requestCode, @NonNull String[] permissions, @NonNull int[] grantResults) {
		super.onRequestPermissionsResult(requestCode, permissions, grantResults);
		if (requestCode != MEDIA_PERMISSION_REQUEST || pendingWebViewPermissionRequest == null) {
			return;
		}

		boolean allGranted = true;
		for (int result : grantResults) {
			if (result != PackageManager.PERMISSION_GRANTED) {
				allGranted = false;
				break;
			}
		}
		if (allGranted) {
			pendingWebViewPermissionRequest.grant(pendingWebViewPermissionRequest.getResources());
		} else {
			pendingWebViewPermissionRequest.deny();
		}
		pendingWebViewPermissionRequest = null;
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
