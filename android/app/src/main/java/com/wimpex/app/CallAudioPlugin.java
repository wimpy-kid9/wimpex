package com.wimpex.app;

import android.content.Context;
import android.media.AudioFocusRequest;
import android.media.AudioManager;
import android.os.Build;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.PluginMethod;

@CapacitorPlugin(name = "CallAudio")
public class CallAudioPlugin extends Plugin {
    private static AudioManager audioManager;
    private static AudioManager.OnAudioFocusChangeListener audioFocusListener;
    private static AudioFocusRequest audioFocusRequest;

    @PluginMethod
    public void stopRingtone(PluginCall call) {
        IncomingCallMessagingService.stopRingtone();
        call.resolve(new JSObject());
    }

    @PluginMethod
    public void prepareCallAudio(PluginCall call) {
        audioManager = (AudioManager) getContext().getSystemService(Context.AUDIO_SERVICE);
        if (audioManager == null) {
            call.reject("AudioManager is unavailable");
            return;
        }

        audioManager.setMode(AudioManager.MODE_IN_COMMUNICATION);
        audioManager.setSpeakerphoneOn(false);
        audioFocusListener = focusChange -> { };

        int result;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            audioFocusRequest = new AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN)
                .setAudioAttributes(new android.media.AudioAttributes.Builder()
                    .setUsage(android.media.AudioAttributes.USAGE_VOICE_COMMUNICATION)
                    .setContentType(android.media.AudioAttributes.CONTENT_TYPE_SPEECH)
                    .build())
                .setOnAudioFocusChangeListener(audioFocusListener)
                .build();
            result = audioManager.requestAudioFocus(audioFocusRequest);
        } else {
            result = audioManager.requestAudioFocus(
                audioFocusListener,
                AudioManager.STREAM_VOICE_CALL,
                AudioManager.AUDIOFOCUS_GAIN
            );
        }

        if (result != AudioManager.AUDIOFOCUS_REQUEST_GRANTED) {
            releaseAudioFocus();
            call.reject("Unable to acquire call audio focus");
            return;
        }
        call.resolve(new JSObject());
    }

    @PluginMethod
    public void releaseCallAudio(PluginCall call) {
        releaseAudioFocus();
        call.resolve(new JSObject());
    }

    private static void releaseAudioFocus() {
        if (audioManager != null && audioFocusListener != null) {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && audioFocusRequest != null) {
                audioManager.abandonAudioFocusRequest(audioFocusRequest);
            } else {
                audioManager.abandonAudioFocus(audioFocusListener);
            }
        }
        if (audioManager != null) {
            audioManager.setMode(AudioManager.MODE_NORMAL);
        }
        audioManager = null;
        audioFocusListener = null;
        audioFocusRequest = null;
    }
}
