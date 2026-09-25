class InfobipProvider extends TelephonyProvider {
    constructor() {
        super();
        this.baseUrl = 'https://d86wng.api.infobip.com/';
        this.callsQueue = [];
        this.actualCall = null;
    }

    async #generateWebrtcToken(username, displayName) {
        //Headers keeped in proxy
        var settings = {
            "url": this.baseUrl + "webrtc/1/token",
            "method": "POST",
            "timeout": 0,
            "headers": {
                "Authorization": "App e8cce4f7f30c26f0dbfaf0b46429dadf-08eaf429-de11-4c17-be63-75503008c4c3",
                "Content-Type": "application/json"
            },
            "data": JSON.stringify({
                "identity": username,
                "displayName": displayName,
                "timeToLive": 43200
            }),
        };

        return $.ajax(settings).then((response) => response.token);        
    }

    async connect(username, displayName) {
        var aux = await this.#generateWebrtcToken(username, displayName);
        this.infobip = createInfobipRtc(aux, {debug: true});
        
        this.infobip.connect();

        this.infobip.on(InfobipRTCEvent.CONNECTED, (event) => {
            console.log('Connected to Infobip RTC Cloud with:');
            this.onRegistered();
        });

        this.infobip.on(InfobipRTCEvent.DISCONNECTED, (event) => {
            console.log('Disconnected from Infobip RTC Cloud');
            this.onTerminated();
        });
        
        this.infobip.on('incoming-application-call', (event) => {
            console.log(event);
            this.actualCall = event.incomingCall;
            this.handleInvite();
        });
        
        this.infobip.on('DTMF_COLLECTED', (event) => {
            console.log(event);
            this.startRecording();
        });

    }

    recording() {
        
    }

    answer() {
        if (!this.actualCall) {
            console.warn("No hay llamada entrante para aceptar.");
            return;
        }
        
        this.actualCall.accept({
            audio: true,
            video: false
        });

        this.actualCall.on("established", () => {
            console.log("Llamada establecida");
            this.onAccepted();
        });

        this.actualCall.on('hangup', event => {
            console.log(event);
            this.onTerminated();
        });

        this.actualCall.on("error", event => {
            console.log(event);
            this.onTerminated();
        });
    }

    reject() {
        if (!this.actualCall) {
            console.warn("No hay llamada entrante para rechazar.");
            return;
        }

        this.actualCall.decline();
        this.actualCall = null;
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

    onRegistered() {
        $("#signin").hide();
        $("#dial").show();
        $("#incall").hide();
        $("#ext").val("");
        var span = document.getElementById('calling');
        $("#calling_input").val("");
        span.innerText = "...";
        console.log("Conectado a Infobip");

        var span = document.getElementById('whoami');
        var txt = document.createTextNode($("#login").val());
        span.innerText = txt.textContent + " (" + $("#yourname").val() + ")";
    }

    mute(inOnMute){
        this.actualCall.mute(inOnMute);
    }

    handleInvite() {

        if (isDnd) {
            console.log("Llamada entrante rechazada por DND");
            this.actualCall.decline(); 
            return;
        }
        
        var span = document.getElementById('calling');
        var txt = "---";
        isIncomingCall = true;
        isOutboundCall = false;
        
        var telefono = this.actualCall.caller.identity;
        console.log(telefono);
        
        span.innerText = "CALL FROM: " + telefono;
        
        $("#isIncomingcall").show();
        $("#isNotIncomingcall").hide();
        
        //Metodo de cancelacion de llamadas entrantes
        this.actualCall.on('hangup', event => {
            this.onTerminated();
        });
        
        if(!isIOS) 
            notifyMe("CALL FROM: " + telefono);

        if (isNoRing == false) {
            audioElement.currentTime = 0;
            audioElement.play();
        }

        if (isAutoAnswer == true || autoAnswerOnce == true) {
            $("#anscallbtn").trigger("click");
            autoAnswerOnce = false;
        }
    }

    onAccepted() {
        audioElement.pause();

        $("#signin").hide();
        $("#dial").hide();
        $("#incall").show();

        isOnMute = false;
        $("#mutebtn").removeClass('btn-danger').addClass('btn-warning');
    }

    onCancelled() {
        this.infobip = null;
    }

    onTerminated() {
        audioElement.pause();
        console.log('Onterminated');
        
        $("#signin").hide();
        $("#dial").show();
        $("#incall").hide();
        $("#ext").val("");

        this.terminateCurrCall();   

        isOnMute = false;
        incomingsession = null;
        resetCallingVars();
    }

    hangup() {
        this.terminateCurrCall();
    }

    terminateCurrCall() {
        if (!this.actualCall) return;
        this.actualCall.hangup();
        this.actualCall = null;
    }

    doCall() {
        this.terminateCurrCall();

        const destination = $("#ext").val();

        console.log("Llamando a:", destination);

        isIncomingCall = false;
        isOutboundCall = true;

        this.actualCall = this.infobip.callPhone(destination);

        this.actualCall.on('ringing', () => {
            console.log("El teléfono está sonando");
        });

        this.actualCall.on('established', (event) => {
            console.log("Llamada establecida");

            const audio = document.getElementById("audio");

            if (event.stream) {
                audio.srcObject = event.stream;
                audio.play();
            }

            this.onAccepted();
        });

        this.actualCall.on('hangup', (event) => {
            console.log("Llamada finalizada", event);

            this.actualCall = null;
            this.onTerminated();
        });

        this.actualCall.on('error', (event) => {
            console.error("Error en llamada:", event);

            this.actualCall = null;
            this.onTerminated();
        });

        $("#speakingwith").text(destination);
    }

    senddtmf(dtmf) {
        this.actualCall.sendDTMF(dtmf);
    }

    resetCurrCall() {
        this.actualCall = null;
    }

    isCurrentActiveCall() {
        return this.actualCall !== null ? true : false;
    }

    isRecordAccepted() {
        
    }
}
