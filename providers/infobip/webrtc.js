class webrtc {
    constructor(username, displayName) {
        this.baseUrl = 'https://d86wng.api.infobip.com/';
        this.infobip = this.connect(username, displayName);
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
        let infobipRTC = createInfobipRtc(this.#generateWebrtcToken(username, displayName), {debug: true});

        infobipRTC.on(InfobipRTCEvent.INCOMING_WEBRTC_CALL, (event) => {
            const call = new Call(event.incomingCall);
            this.onIncomingCall(call);
        });

        infobipRTC.connect();
        return infobipRTC;
    }

    onIncomingCall(call) {
        // Override this (or reassign the property) to handle incoming calls in the UI.
        call.onRinging(() => {
            this.calls.set(call.id, call);
            console.log("Incoming call is ringing...");
            //TO-DO: Tone Ringing
            //TO-DO: Show incoming call UI
        });
    }


    acceptCall() {
        this.infobip.acceptCall();
    }

    disconnect() {
        this.infobip.disconnect();
    }

}