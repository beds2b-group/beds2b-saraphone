class SIPCall extends Call {

    constructor(session) {
        super();
        this.session = session;
    }

    hangup() {
        this.session.terminate();
    }

    mute(shouldMute = true) {
        var options = { audio: true, video: false };
        return shouldMute ? this.session.mute(options) : this.session.unmute(options);
    }

    unmute() {
        return this.session.unmute({ audio: true, video: false });
    }

    sendDTMF(dtmf) {
        return this.session.dtmf(dtmf, dtmf_options);
    }

    onRinging(handler) {
        this.session.on('progress', handler);
    }

    onEstablished(handler) {
        this.session.on('accepted', handler);
    }

    onHangup(handler) {
        this.session.once('bye', (request) => {
            handler(SIPCall.reasonFromBye(request));
        });
        this.session.once('cancel', () => handler());
        this.session.once('terminated', () => handler());
    }

    onError(handler) {
        this.session.once('failed', (response, cause) => {
            if (cause == "null") {
                cause = "N/A";
            }
            console.log(cause);
            handler(response.status_code + ": " + cause);
        });
    }

    static reasonFromBye(request) {
        if (request.headers.Reason
            && !request.headers.Reason["0"].raw.toString().match(/cause=16/)
            && !request.headers.Reason["0"].raw.toString().match(/cause=31/)) {
            console.log(request);
            var regex = /.*text="(.*)".*/;
            return request.headers.Reason["0"].raw.toString().replace(regex, "$1");
        }
        return undefined;
    }
}
