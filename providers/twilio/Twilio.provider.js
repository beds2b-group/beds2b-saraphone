// Requires the Twilio Voice SDK loaded as a script (global Twilio.Device)
class TwilioProvider extends TelephonyProvider {
    constructor() {
        super();
        // Twilio Function (saraphone-voice/functions/voice-token.js)
        this.tokenUrl = TELEPHONE_CONFIG.twilio.tokenUrl;
        this.device = null;
        this.actualCall = null;
        this.identity = null;
    }

    async #generateToken(identity) {
        const response = await $.ajax({
            url: this.tokenUrl,
            method: "GET",
            data: { identity: identity },
            dataType: "json"    
        });
        console.log(response.token);
        return response.token;
    }

    async connect(username, displayName) {
        this.identity = username;
        const token = await this.#generateToken(username);

        this.device = new Twilio.Device(token, {
            logLevel: 1,
            codecPreferences: ["opus", "pcmu"]
        });

        this.device.audio.incoming(false);

        this.device.on("registered", () => {
            console.log("Connected to Twilio as", this.identity);
            this.onRegistered();
        });

        this.device.on("unregistered", () => {
            console.log("Disconnected from Twilio");
        });

        this.device.on("error", (error) => {
            console.error("Twilio Device error:", error);
        });

        this.device.on("incoming", (call) => {
            if (this.actualCall) {
                call.reject();
                return;
            }
            this.actualCall = call;
            this.handleInvite();
        });

        this.device.on("tokenWillExpire", async () => {
            this.device.updateToken(await this.#generateToken(this.identity));
        });

        await this.device.register();
    }

    #bindCallEvents(call) {
        call.on("accept", () => {
            console.log("Llamada establecida");
            this.onAccepted();
        });

        call.on("disconnect", () => {
            console.log("Llamada finalizada");
            this.actualCall = null;
            this.onTerminated();
        });

        call.on("cancel", () => {
            this.actualCall = null;
            this.onTerminated();
        });

        call.on("reject", () => {
            this.actualCall = null;
            this.onTerminated();
        });

        call.on("error", (error) => {
            console.error("Error en llamada:", error);
            this.actualCall = null;
            this.onTerminated();
        });
    }

    answer() {
        if (!this.actualCall) {
            console.warn("No hay llamada entrante para aceptar.");
            return;
        }
        this.actualCall.accept();
    }

    reject() {
        if (!this.actualCall) {
            console.warn("No hay llamada entrante para rechazar.");
            return;
        }
        this.actualCall.reject();
        this.actualCall = null;
    }

    disconnect() {
        if (!this.device) return;
        this.device.destroy();
        this.device = null;
    }

    onRegistered() {
        $("#signin").hide();
        $("#dial").show();
        $("#incall").hide();
        $("#ext").val("");
        var span = document.getElementById('calling');
        $("#calling_input").val("");
        span.innerText = "...";

        var span = document.getElementById('whoami');
        var txt = document.createTextNode($("#login").val());
        span.innerText = txt.textContent + " (" + $("#yourname").val() + ")";

        isRegistered = true;
    }

    mute(inOnMute) {
        if (!this.actualCall) return;
        this.actualCall.mute(inOnMute);
    }

    handleInvite() {
        if (isDnd) {
            console.log("Llamada entrante rechazada por DND");
            this.reject();
            return;
        }

        this.#bindCallEvents(this.actualCall);

        var span = document.getElementById('calling');
        isIncomingCall = true;
        isOutboundCall = false;

        var telefono = this.actualCall.parameters.From;
        span.innerText = "CALL FROM: " + telefono;

        $("#isIncomingcall").show();
        $("#isNotIncomingcall").hide();

        if (!isIOS)
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

    onTerminated() {
        audioElement.pause();

        $("#signin").hide();
        $("#dial").show();
        $("#incall").hide();
        $("#ext").val("");

        isOnMute = false;
        incomingsession = null;
        resetCallingVars();
    }

    hangup() {
        $("#incall").hide();
        $("#dial").show();

        isOnMute = false;
        this.terminateCurrCall();
    }

    terminateCurrCall() {
        if (!this.actualCall) return;
        this.actualCall.disconnect();
        this.actualCall = null;
    }

    async doCall() {
        this.terminateCurrCall();

        const destination = $("#ext").val();
        console.log("Llamando a:", destination);

        isIncomingCall = false;
        isOutboundCall = true;

        this.actualCall = await this.device.connect({ params: { To: destination } });
        this.#bindCallEvents(this.actualCall);

        $("#speakingwith").text(destination);
    }

    senddtmf(dtmf) {
        if (!this.actualCall) return;
        this.actualCall.sendDigits(dtmf);
    }

    resetCurrCall() {
        this.actualCall = null;
    }

    isCurrentActiveCall() {
        return this.actualCall !== null;
    }
}
