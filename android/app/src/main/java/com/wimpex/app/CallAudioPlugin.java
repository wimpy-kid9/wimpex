package com.wimpex.app;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.PluginMethod;

@CapacitorPlugin(name = "CallAudio")
public class CallAudioPlugin extends Plugin {
    @PluginMethod
    public void stopRingtone(PluginCall call) {
        IncomingCallMessagingService.stopRingtone();
        call.resolve(new JSObject());
    }
}
