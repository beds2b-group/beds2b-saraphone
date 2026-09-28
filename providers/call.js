class Call {

    hangup() {
        throw new Error('not implemented');
    }

    mute(shouldMute) {
        throw new Error('not implemented');
    }

    unmute() {
        throw new Error('not implemented');
    }

    sendDTMF(dtmf) {
        throw new Error('not implemented');
    }

    onRinging(handler) {
        throw new Error('not implemented');
    }

    onEstablished(handler) {
        throw new Error('not implemented');
    }

    onHangup(handler) {
        throw new Error('not implemented');
    }

    onError(handler) {
        throw new Error('not implemented');
    }
}
