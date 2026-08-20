class Call {

    constructor(incomingCall) {
        this.call = incomingCall;
    }

    accept(options) {
        this.call.accept(options);
    }

    decline(options) {
        this.call.decline(options);
    }

    hangup() {
        this.call.hangup();
    }

    mute(shouldMute = true) {
        return this.call.mute(shouldMute);
    }

    sendDTMF(dtmf) {
        return this.call.sendDTMF(dtmf);
    }

    onRinging(handler) {
        this.call.on(CallsApiEvent.RINGING, handler);
    }

    onEstablished(handler) {
        this.call.on(CallsApiEvent.ESTABLISHED, handler);
    }

    onHangup(handler) {
        this.call.on(CallsApiEvent.HANGUP, handler);
    }

    onError(handler) {
        this.call.on(CallsApiEvent.ERROR, handler);
    }

}
