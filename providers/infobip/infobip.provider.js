class InfobipProvider extends TelephonyProvider {
    constructor() {
        super();
        this.baseUrl = 'https://d86wng.api.infobip.com/';
        this.calls = new Map();
    }

    #generateWebrtcToken(username, displayName) {
        //Headers keeped in proxy
        var settings = {
            "url": this.baseUrl + "/webrtc/1/token",
            "method": "POST",
            "timeout": 0,
            "data": JSON.stringify({
                "identity": username,
                "displayName": displayName,
                "timeToLive": 43200
            }),
        };

        $.ajax(settings).done(function (response) {
            console.log(response);
            return response.token;
        });

        return null;
    }

    connect(username, displayName) {
        this.infobip = createInfobipRtc(this.#generateWebrtcToken(username, displayName), {debug: true});

        this.infobip.on(InfobipRTCEvent.INCOMING_WEBRTC_CALL, (event) => {
            const call = new InfobipCall(event.incomingCall);
            this.onIncomingCall(call);
        });

        this.infobip.connect();
    }

    onIncomingCall(call) {
        this.incomingCall = call;
        call.onRinging(() => {
            this.calls.set(call.id, call);
            console.log("Incoming call is ringing...");
        });
    }

    answer() {
        if (!this.incomingCall) {
            console.warn("No hay llamada entrante para aceptar.");
            return;
        }

        this.incomingCall.accept({
            audio: true,
            video: false
        });

        return this.incomingCall;
    }

    reject() {
        if (!this.incomingCall) {
            console.warn("No hay llamada entrante para rechazar.");
            return;
        }

        this.incomingCall.decline();
        this.incomingCall = null;
    }

    disconnect() {
        this.infobip.disconnect();
    }

    dial(destination, options) {
        var call = this.infobip.callPhone(destination, {
            audio: true,
            video: false
        });
        return new InfobipCall(call);
    }
}
