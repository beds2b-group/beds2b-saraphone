class SIPjsProvider extends TelephonyProvider {
    constructor(incomingsession) {
        super();
        this.incomingsession = incomingsession;
    }

    connect(login, yourname) {

        var nameDomain;
        var nameProxy;
        var uri;
        var password;
        var wssport;

        nameDomain = $("#domain").val();
        nameProxy = $("#proxy").val();
        wssport = $("#port").val();
        which_server = "wss://" + nameProxy + ":" + wssport;

        password = $("#passwd").val();

        uri = login + "@" + nameDomain;
        
        ua = new SIP.UA({
            wsServers: which_server,
            uri: uri,
            password: password,
            userAgentString: 'SIP.js/0.7.8 SaraPhone 04',
            traceSip: true,
            displayName: yourname,
            iceCheckingTimeout: 1000,
            registerExpires: 120,
            allowLegacyNotifications: true,
            hackWssInTransport: true,
            wsServerMaxReconnection: 5000,
            wsServerReconnectionTimeout: 1,
            connectionRecoveryMaxInterval: 3,
            connectionRecoveryMinInterval: 2,
            log: {
                level: 2,
                connector: function(level, category, label, content) {
                    var str = content;
                    var patt2 = new RegExp("WebSocket abrupt disconnection");
                    var res2 = patt2.exec(str);

                    if (res2) {
                        if (gotopanel == false){
                            console.error('WebSocket ABRUPT DISCONNECTION');
                tempAlert("- WebSocket ABRUPT DISCONNECTION - WebSocket ABRUPT DISCONNECTION - WebSocket ABRUPT DISCONNECTION - WebSocket ABRUPT DISCONNECTION - WebSocket ABRUPT DISCONNECTION - WebSocket ABRUPT DISCONNECTION - WebSocket ABRUPT DISCONNECTION - WebSocket ABRUPT DISCONNECTION - WebSocket ABRUPT DISCONNECTION - WebSocket ABRUPT DISCONNECTION - WebSocket ABRUPT DISCONNECTION - WebSocket ABRUPT DISCONNECTION - WebSocket ABRUPT DISCONNECTION - WebSocket ABRUPT DISCONNECTION - WebSocket ABRUPT DISCONNECTION - ",10000);
                        }
                    }
                },
            }
        });

        ua.on('notify', this.handleNotify.bind(this));
        ua.on('invite', this.handleInvite.bind(this));
        ua.on('disconnected', function() {
            console.error('DISCONNECTED');
            //alert("DO YOU HAVE AUTHORIZED SSL CERTS FOR PORT 7443 ???? - READ THE README! :) - NETWORK DISCONNECT, CLICK OK TO PROCEED");
            if (gotopanel == false){
            tempAlert("- NETWORK DISCONNECTED - NETWORK DISCONNECTED - NETWORK DISCONNECTED - NETWORK DISCONNECTED - DO YOU HAVE WSS PORT OPEN ON FIREWALL? DO YOU HAVE AUTHORIZED SSL CERTS? AND YOUR WSS CERTS, ARE AUTHORIZED? - READ THE README! :) - NETWORK DISCONNECTED - NETWORK DISCONNECTED - NETWORK DISCONNECTED - NETWORK DISCONNECTED - ",60000);
            }
        });
        ua.once('registered', this.onRegistered.bind(this));
        ua.on('unregistered', function() {
            console.error('UNREGISTERED');
            if (gotopanel == false){
            tempAlert("- UNREGISTERED - UNREGISTERED - UNREGISTERED - UNREGISTERED - UNREGISTERED - UNREGISTERED - UNREGISTERED - UNREGISTERED - UNREGISTERED - UNREGISTERED - UNREGISTERED - UNREGISTERED - UNREGISTERED - UNREGISTERED - UNREGISTERED - UNREGISTERED - UNREGISTERED - UNREGISTERED - UNREGISTERED - UNREGISTERED - UNREGISTERED - UNREGISTERED - UNREGISTERED - UNREGISTERED - UNREGISTERED - UNREGISTERED - ",3000);
            }
        });


    }

    answer(incomingsession) {
        if (!this.incomingsession) {
            console.warn("No hay llamada entrante para aceptar.");
            return;
        }

        this.incomingsession.accept({
            media: {
                constraints: {
                    audio: {
                        deviceId: {
                            ideal: $("#selectmic").val()
                        }
                    },
                    video: false
                },
                render: {
                    remote: document.getElementById("audio")
                }
            }
        });

        return new SIPCall(this.incomingsession);
    }

    reject() {
        if (!this.incomingsession) {
            console.warn("No hay llamada entrante para rechazar.");
            return;
        }

        try {
            this.incomingsession.reject({
                statusCode: '486',
                reasonPhrase: 'Busy Here 1'
            });
        } catch (e) {
            console.error("Error rechazando llamada:", e);
        }

        this.incomingsession = null;

    }

    handleNotify(r) {    
        var newMessages = 0;
        var oldMessages = 0;
        var span = document.getElementById('vmailcount');
        var gotmsg = r.request.body.match(/voice-message:\s*(\d+)\/(\d+)/i);
        if (gotmsg) {
            newMessages = parseInt(gotmsg[1]);
            oldMessages = parseInt(gotmsg[2]);
            if (newMessages) {
                $("#checkvmailbtn").removeClass('btn-info').addClass('btn-warning');

            } else {
                $("#checkvmailbtn").removeClass('btn-warning').addClass('btn-info');

            }
            span.innerText = newMessages + "/" + oldMessages;
        }
    }

    disconnect() {
        
    }

    dial(destination, options) {
        var session = ua.invite(destination, {
            media: {
                constraints: {
                    audio: {
                        deviceId: {
                            ideal: options.deviceId
                        }
                    },
                    video: false
                },
                render: {
                    remote: options.remoteAudioElement
                }
            }
        });

        return new SIPCall(session);
    }

    
    handleInvite(s) {
        if (cur_call || isDnd) {
            s.reject({
                statusCode: '486',
                reasonPhrase: 'Busy Here 2'
            });
        } else {
            if (!cur_call) {
                var span = document.getElementById('calling');
                var txt = "---";
                isIncomingCall = true;
                isOutboundCall = false;
                if(s.remoteIdentity.displayName && s.remoteIdentity.displayName.toString()) {
                    txt = document.createTextNode(s.remoteIdentity.displayName.toString());
                }
                span.innerText = "CALL FROM: " + txt.textContent + " (" + s.remoteIdentity.uri.user.toString() + ")";
                this.incomingsession = s;
                $("#isIncomingcall").show();
                $("#isNotIncomingcall").hide();
                this.incomingsession.once('cancel', onCancelled.bind(this.incomingsession));

                if (isIOS) {
                    //do nothing
                } else {
                    notifyMe("CALL FROM: " + txt.textContent + " (" + s.remoteIdentity.uri.user.toString() + ")");
                }

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
    }

    onRegistered() {
        if (!isIOS && Notification.permission === "granted") {
            $("#asknotificationpermission").hide();
        }

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

        //SIP Exclusive
        if (cur_prov === 'SIP.js') {
            var countpres = 1;

            while (countpres < 61) {
                if ($("#pres" + countpres).val()) {
                    presence_array[countpres] = ua.subscribe($("#pres" + countpres).val(), 'presence', {
                        expires: 120
                    });

                    const mycountpres = countpres;
                    presence_array[countpres].on('notify', function(notification) {
                        //console.log(notification.request.body);

                        var presence = notification.request.body.match(/<dm:note>(.*)<\/dm:note>/i);
                        if (presence) {
                            var ispresent = presence[1];

                            if (ispresent.match(/unregistered/i)) {
                                $("#pres" + mycountpres + "btn").removeClass('btn-success btn-warning btn-default btn-danger').addClass('btn-danger');
                            } else {
                                if (ispresent.match(/available/i) || ispresent.match(/closed/i)) {
                                    $("#pres" + mycountpres + "btn").removeClass('btn-success btn-warning btn-default btn-danger').addClass('btn-success');

                                } else {
                                    $("#pres" + mycountpres + "btn").removeClass('btn-success btn-warning btn-default btn-danger').addClass('btn-warning');
                                }
                            }

                            var span = document.getElementById('ispresent' + mycountpres);
                            $("#pres" + mycountpres + "_label").val($("#pres" + mycountpres + "_label").val().substr(0, 10));
                            if (ispresent.match(/available/i) || ispresent.match(/closed/i)) {
                                span.innerText = $("#pres" + mycountpres + "_label").val();
                            } else {
                                span.innerText = $("#pres" + mycountpres + "_label").val() + ": " + ispresent;
                            }
                        }

                    });



                    $("#pres" + mycountpres + "btn").click(function() {
                        $("#ext").val($("#pres" + mycountpres).val());
                        oldext=$("#ext").val();
                        docall();
                    });



                } else {

                    $("#pres" + countpres + "btn").remove();

                }
                countpres++;
            }

            $("#webphone_blf").show();  
        }
        //SIP Exclusive
        if (cur_prov === 'SIP.js') {
            vmail_subscription = ua.subscribe($("#login").val() + '@' + $("#domain").val(), 'message-summary', {
                extraHeaders: ['Accept: application/simple-message-summary'],
                expires: 120
            });
            vmail_subscription.on('notify', prov.handleNotify);
        }

        if (isAndroid || isIOS) {
            $("#calling_input").hide();
        }
    }

    onEstablished(){
        
    }
}