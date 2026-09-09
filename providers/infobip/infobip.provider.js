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
            console.log('Connected to Infobip RTC Cloud with: %s', event.identity);
            this.onRegistered();
        });

        this.infobip.on(InfobipRTCEvent.DISCONNECTED, (event) => {
            console.log('Disconnected from Infobip RTC Cloud');
            this.onTerminated();
        });
        
        this.infobip.on('incoming-application-call', (event) => {
            console.log(event);
            // const call = new InfobipCall(event.incomingCall);
            const call = event.incomingCall;
            this.actualCall = call;
            this.handleInvite(call);
        });
    }

    answer() {
        if (!this.actualCall) {
            console.warn("No hay llamada entrante para aceptar.");
            return;
        }

        console.log('LLAMADA ENTRANTE ACEPTADA');
        
        this.actualCall.accept({
            audio: true,
            video: false
        });

        this.actualCall.on("established", () => {
            console.log("CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAL");
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

    handleInvite(s) {        
        if (isDnd) {
            console.log("Llamada entrante rechazada por DND");
            this.actualCall.decline(); 
        } else {
            var span = document.getElementById('calling');
            var txt = "---";
            isIncomingCall = true;
            isOutboundCall = false;
            
            //Arreglar el metodo obtener numero de telefono

            console.log("Llamada entrante aceptada");
            var telefono = this.actualCall.caller.identity;
            console.log(telefono);
            
            // console.log("Hemos recibido la llamada entrante de: " + telefono);
            span.innerText = "CALL FROM: " + telefono;
                        
            $("#isIncomingcall").show();
            $("#isNotIncomingcall").hide();

            //Metodo de cancelacion de llamadas entrantes
            this.actualCall.once("hangup", onCancelled.bind(this.actualCall));
            
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

    }

    onAccepted() {
        audioElement.pause();

        $("#signin").hide();
        $("#dial").hide();
        $("#incall").show();

        isOnMute = false;
        $("#mutebtn").removeClass('btn-danger').addClass('btn-warning');
    }
}
