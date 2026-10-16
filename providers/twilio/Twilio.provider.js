class TwilioProvider extends TelephonyProvider {
    constructor() {
        super();
        this.tokenUrl = TELEPHONE_CONFIG.twilio.tokenUrl;
        this.transferUrl = TELEPHONE_CONFIG.twilio.transferUrl;
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

        this.disconnect();

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
            if (this.isCurrentActiveCall()) {
                console.warn("Llamada entrante rechazada: ya hay una llamada en curso", this.actualCall.parameters.CallSid);
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

    #guardAudioTeardown(call) {
        const media = call._mediaHandler;
        if (!media || media._saraphoneGuarded) return;
        media._saraphoneGuarded = true;

        const disableOutput = media._disableOutput;
        media._disableOutput = function (pc, id) {
            const output = pc.outputs.get(id);
            if (output && output.audio && typeof output.audio.pause !== "function") {
                console.warn("Salida de audio no válida en el SDK de Twilio, se omite:", id, output.audio);
                if (output.dest) output.dest.disconnect();
                return;
            }
            return disableOutput.call(this, pc, id);
        };

        const close = media.close;
        media.close = function () {
            try {
                return close.apply(this, arguments);
            } catch (error) {
                console.error("Error al cerrar el audio de la llamada, se fuerza el cierre:", error);
                if (this.status !== "closed") {
                    this.status = "closed";
                    this.onclose();
                }
            }
        };
    }

    #bindCallEvents(call) {
        this.#guardAudioTeardown(call);

        call.on("accept", () => {
            if (this.actualCall !== call) return;
            console.log("Llamada establecida");
            this.onAccepted();
        });

        call.on("disconnect", () => {
            console.log("Llamada finalizada");
            this.#endCall(call);
        });

        call.on("cancel", () => this.#endCall(call));
        call.on("reject", () => this.#endCall(call));

        call.on("error", (error) => {
            console.error("Error en llamada:", error);
            if (call.status() === "closed") this.#endCall(call);
        });
    }

    #endCall(call) {
        if (this.actualCall !== call) return;
        this.actualCall = null;
        this.onTerminated();
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
        span.innerText = "";

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
        $("#speakingwith").text(telefono);

        hideAgents();
        $("#dial").show();
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
        hideAgents();
        $("#incall").show();

        isOnMute = false;
        $("#mutebtn").removeClass('btn-danger').addClass('btn-warning');
    }

    onTerminated() {
        audioElement.pause();

        $("#signin").hide();
        hideAgents();
        $("#dial").show();
        $("#incall").hide();
        hideIncomingCall();
        $("#ext").val("");
        $("#speakingwith").text("...");

        isOnMute = false;
        incomingsession = null;
        resetCallingVars();
    }

    hangup() {
        $("#incall").hide();
        hideAgents();
        $("#dial").show();
        resetCallingVars();

        isOnMute = false;
        this.terminateCurrCall();
    }

    terminateCurrCall() {
        const call = this.actualCall;
        this.actualCall = null;

        if (call && call.status() === "pending") 
            call.reject();

        if (!this.device) return;
        this.device.disconnectAll();
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

    async transfer(target) {
        if (!this.actualCall) {
            console.warn("No hay llamada para transferir.");
            return;
        }

        const callSid = this.actualCall.parameters.CallSid;
        console.log("Transfiriendo", callSid, "a", target);

        try {
            await $.ajax({
                url: this.transferUrl,
                method: "POST",
                data: { CallSid: callSid, identity: this.identity, target: target },
                dataType: "json"
            });

        } catch (error) {
            console.error("Error al transferir:", error.responseJSON || error);
            throw error;
        }
    }

    senddtmf(dtmf) {
        if (!this.actualCall) return;
        this.actualCall.sendDigits(dtmf);
    }

    resetCurrCall() {
        this.actualCall = null;
    }

    isCurrentActiveCall() {
        return this.actualCall !== null && this.actualCall.status() !== "closed";
    }
}
