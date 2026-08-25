/*
   SaraPhone
   Version: MPL 1.1

   The contents of this file are subject to Mozilla Public License Version
   1.1 (the "License"); you may not use this file except in compliance with
   the License. You may obtain a copy of the License at
   http://www.mozilla.org/MPL/

   Software distributed under the License is distributed on an "AS IS" basis,
   WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
   for the specific language governing rights and limitations under the
   License.

   The Original Code is SaraPhone

   The Initial Developer of the Original Code is
   Giovanni Maruzzelli <gmaruzz@opentelecom.it>
   Portions created by the Initial Developer are Copyright (C) 2020
   the Initial Developer. All Rights Reserved.

   SaraPhone gets its name from Giovanni's wife, Sara.

   Author(s):
   Giovanni Maruzzelli <gmaruzz@opentelecom.it>
   Danilo Volpinari
   Luca Mularoni
 */

'use strict';

var cur_prov = 'SIP.js';
// var cur_prov = 'twilio';
// var cur_prov = "infobip";

// MULTI-PROVIDER TODO:
var cur_call = null;
var prov = null;
// MULTI-PROVIDER TODO:
var ua;
var which_server;
var isAndroid = false;
var isIOS = false;
var isOnMute = false;
var isOnHold = false;
var clicklogin = "no";
var isRecording = false;
var isDnd = false;
var isNoRing = false;
var isAutoAnswer = false;
var autoAnswerOnce = false;
var isRegistered = false;
var vmail_subscription = false;
var presence_array = new Array();
// MULTI-PROVIDER TODO:
var incomingsession = null;
var audioElement = document.createElement('audio');
var callTimer;
var oldext = false;
var gotopanel = false;
var isIncomingCall = false;
var isOutboundCall = false;

var dtmf_options = {
  'duration': 100,
  'interToneGap': 100
};

window.addEventListener("keydown", function (event) {
  if (event.key === "Backspace") {
    console.log("Backspace pulsado");
    try {
        var extEl = document.getElementById('ext');
        var callingInput = document.getElementById('calling_input');
        if (!extEl) return;
        var cur = extEl.value || "";
        if (cur.length > 0) {
            extEl.value = cur.slice(0, -1);
            if (callingInput) callingInput.value = extEl.value;
        }
    } catch (e) {
        console.error('keydown handler error', e);
    }
  }
});

window.addEventListener("message", function(event) {

    // Cambia esto por el dominio real de Zammad
    var allowedOrigins = [
        "https://zammad.senator.tools",
        "http://localhost:3000",
        "http://127.0.0.1:3000"
    ];

    console.log("Origen recibido:", event.origin);
    console.log("Permitido:", allowedOrigins.includes(event.origin));

    if (!allowedOrigins.includes(event.origin)) {
        console.warn("Mensaje rechazado por origen no permitido!:", event.origin);
        return;
    }

    if (!event.data || event.data.source !== "zammad") {
        return;
    }

    switch (event.data.action) {

        case "answer-call":
            answerIncomingCall();
            break;

        case "reject-call":
            rejectIncomingCall();
            break;

        case "hangup-call":
            if (cur_call) {
                cur_call.hangup();
            }
            break;

        default:
            console.warn("Acción no reconocida:", event.data.action);
            break;
    }
});


//COMMS
function answerIncomingCall() {
    audioElement.pause();
    hideIncomingCall();

    cur_call = prov.answer(incomingsession);
    cur_call.onEstablished(onAccepted.bind(cur_call));
    cur_call.onHangup(onTerminated.bind(cur_call));
    cur_call.onError(onTerminated.bind(cur_call));

    console.log("Llamada aceptada desde API iframe.");
}

 
function rejectIncomingCall() {
    
    prov.reject();

    hideIncomingCall();

    console.log("Llamada rechazada desde API iframe.");
}

function sendHeight() {
  const height = document.body.scrollHeight;

  window.parent.postMessage(
    {
      type: "resize",
      height: height
    },
    "*"
  );
}

window.addEventListener("load", sendHeight);

new ResizeObserver(sendHeight).observe(document.body);

//http://jsfiddle.net/55Kfu/1506/
//https://stackoverflow.com/posts/13194087/revisions
var beep = (function() {
    var ctxClass = window.audioContext || window.AudioContext || window.AudioContext || window.webkitAudioContext
    var ctx = new ctxClass();
    return function(duration, type, finishedCallback) {

        duration = +duration;

        // Only 0-4 are valid types.
        type = (type % 5) || 0;

        if (typeof finishedCallback != "function") {
            finishedCallback = function() {};
        }

        var osc = ctx.createOscillator();

        //osc.type = type;
        osc.type = "sine";

        osc.connect(ctx.destination);
        if (osc.noteOn) osc.noteOn(0); // old browsers
        if (osc.start) osc.start(); // new browsers

        setTimeout(function() {
            if (osc.noteOff) osc.noteOff(0); // old browsers
            if (osc.stop) osc.stop(); // new browsers
            finishedCallback();
        }, duration);

    };
})();

function tempAlert(msg,duration)
{
     var el = document.createElement("div");
     el.setAttribute("style","position:absolute;top:1%;left:1%;background-color:red;foreground-color:black;");
     el.innerHTML = msg;
     setTimeout(function(){
      el.parentNode.removeChild(el);
      location.reload(true);
     },duration);
     document.body.appendChild(el);
    console.error("TEMPALERT");
}

function onCancelled() {
    audioElement.pause();
    console.log('cancelled');
    hideIncomingCall();
    incomingsession = null;
    var span = document.getElementById('calling');
    $("#calling_input").val("");
    span.innerText = "...";
}

function onTerminated() {
    audioElement.pause();
    console.log('Onterminated');
    $("#signin").hide();
    $("#dial").show();
    $("#incall").hide();
    $("#ext").val("");
    if (cur_call) {
        terminateCurrCall();
    }
    isOnMute = false;

    incomingsession = null;

    var span = document.getElementById('calling');
    $("#calling_input").val("");
    span.innerText = "...";
}

function onTerminated2() {
    console.log('Onterminated2');
    cur_call = null;
    incomingsession = null;
}

function onAccepted() {
    audioElement.pause();

    $("#signin").hide();
    $("#dial").hide();
    $("#incall").show();

    isOnMute = false;
    $("#mutebtn").removeClass('btn-danger').addClass('btn-warning');

}

$("#asknotificationpermission").click(function() {
    if (isIOS) {
        //do nothing
    } else {
        // Let's check if the browser supports notifications
        if (!("Notification" in window)) {
            alert("This browser does not support desktop notification");
        }

        // Otherwise, we need to ask the user for permission
        // Note, Chrome does not implement the permission static property
        // So we have to check for NOT 'denied' instead of 'default'
        else if (Notification.permission !== 'denied') {
            Notification.requestPermission(function(permission) {

                // Whatever the user answers, we make sure we store the information
                if (!('permission' in Notification)) {
                    Notification.permission = permission;
                }

                // If the user is okay, let's create a notification
                if (permission === "granted") {
                    console.log("Notification Permission Granted!");
                    var notification = new Notification("Notification Permission Granted!");
                    $("#asknotificationpermission").hide();
                }
            });
        } else {
            alert(`Permission is ${Notification.permission}`);
        }

    }
});


function notifyMe(msg) {
    if (isIOS) {
        //do nothing
    } else {
        if (Notification.permission === "granted") {
            console.log(msg);
            let img = 'img/notification.png';
            let notification = new Notification('WebPhone', {
                body: msg,
                icon: img
            });
            notification.onclick = function() {
                parent.focus();
                window.focus();
                this.close();
            };
            notification.onclose = function() {
                parent.focus();
                window.focus();
                this.close();
            };
            notification.onerror = function() {
                parent.focus();
                window.focus();
                this.close();
            };
        }
    }
}
function onRegisteredCommon(){
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
}


function onRegistered() {

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

$("#checkvmailbtn").click(function() {
    $("#extstarbtn").click();
    $("#ext9btn").click();
    $("#ext8btn").click();
    $("#callbtn").click();
});

$("#gotopanel1").click(function() {
    gotToPanel("GOTOPANEL1");
});

$("#gotopanel2").click(function() {
    gotToPanel("GOTOPANEL2");
});

$("#gotopanel3").click(function() {
    gotToPanel("GOTOPANEL3");
});

function gotToPanel(panelId) {
    gotopanel = true;
    console.error(panelId);
    window.location.assign('/');
}

$("#anscallbtn").click(function() {
    answerIncomingCall();
});

// MULTI-PROVIDER DONE
$("#rejcallbtn").click(function() {
    audioElement.pause();
    prov.reject();
    console.log('rejected');
    hideIncomingCall();
    var span = document.getElementById('calling');
    $("#calling_input").val("");
    span.innerText = "...";
});


// MULTI-PROVIDER DONE:
function docall() {
    if (cur_call) {
        terminateCurrCall();
    }

    isIncomingCall = false;
    isOutboundCall = true;

    cur_call = prov.dial($("#ext").val(), {
        deviceId: $("#selectmic").val(),
        remoteAudioElement: document.getElementById('audio')
    });

    cur_call.onEstablished(onAccepted.bind(cur_call));

    cur_call.onError(function(reason) {
        var span = document.getElementById('calling');
        onTerminated(cur_call);
        span.innerText = reason;
    });

    cur_call.onHangup(function(reason) {
        var span = document.getElementById('calling');
        onTerminated(cur_call);
        span.innerText = reason || "...";
    });

    var span = document.getElementById('speakingwith');
    var txt = document.createTextNode($("#ext").val());
    span.innerText = txt.textContent;
}

function toggleDisplay(elementId) {
    var el = document.getElementById(elementId);
    el.style.display = (el.style.display === 'none') ? 'block' : 'none';
}

$("#dialctrlbtn").click(function() {
    toggleDisplay('dialadv1');
    toggleDisplay('dialadv2');
});

$("#signinctrlbtn").click(function() {
    toggleDisplay('signinadv1');
});

if (cur_prov !== 'SIP.js') {
    document.getElementById('signinctrlbtn').style.display = 'none';
    document.getElementById('passwd').style.display = 'none';
}

$("#callbtn").click(function() {
    if ($("#ext").val()) {
        var regex1 = /#/g;
        var new_ext = $("#ext").val().replace(regex1, "_");
        $("#ext").val(new_ext);
	    oldext=$("#ext").val();
        docall();
    }
});

$("#delcallbtn").click(function() {
    $("#ext").val("");
    $("#calling_input").val("");
    var span = document.getElementById('calling');
    span.innerText = "...";

    $("#hangupbtn").trigger("click");
});


$("#hangupbtn").click(function() {
    if (cur_call) {
        terminateCurrCall();
    }
    $("#br").show();
    $("#ext").show();
    $("#calling_input").val("");
    var span = document.getElementById('calling');
    span.innerText = "...";
});

$("#loginbtn").click(function() {
    init();
});


function terminateCurrCall() {
    cur_call.hangup();
    cur_call = null;
    // resetOptionsTimer();
}

//BUTTON LOGIC - OPTIONS TOOLS
//DONE:
$("#mutebtn").click(function() {
    if (isOnMute) {
        cur_call.unmute();
        isOnMute = false;
        $(this).removeClass('btn-danger').addClass('btn-warning');
    } else {
        cur_call.mute();
        isOnMute = true;

        $(this).removeClass('btn-warning').addClass('btn-danger');
    }
});

$("#holdbtn").click(function() {
    if (isOnHold==false){
        isOnHold = true;
        cur_call.dtmf(isOutboundCall ? "*299" : "*399", dtmf_options);
        $("#unholdbtn").show();
        console.error("HOLD begins");
    }
});

$("#unholdbtn").click(function() {
    if (isOnHold == true){
        isOnHold = false;
        $("#extstarbtn").click();
        $("#ext6btn").click();
        $("#ext5btn").click();
        $("#ext5btn").click();
        $("#callbtn").click();
        $("#unholdbtn").hide();
        console.error("HOLD ends");
    }
});

$("#redialbtn").click(function() {
    audioElement.pause();
    $("#ext").val(oldext);
    $("#callbtn").click();
});

$("#callbackbtn").click(function() {
    audioElement.pause();
    $("#extstarbtn").click();
    $("#ext6btn").click();
    $("#ext9btn").click();
    $("#callbtn").click();
});

$("#recordcallbtn").click(function() {
    cur_call.dtmf("*");
    cur_call.dtmf("2");

    isRecording = !isRecording;
    
    if (isRecording) {
        $(this).removeClass('btn-danger').addClass('btn-warning');
    } else {
        $(this).removeClass('btn-warning').addClass('btn-danger');
    }
});

$("#dndbtn").click(function() {
    isDnd = !isDnd;
    if (isDnd) {
        $(this).removeClass('btn-danger').addClass('btn-warning');
    } else {
        $(this).removeClass('btn-warning').addClass('btn-danger');
    }
});

$("#ringbtn").click(function() {
    isNoRing = !isNoRing;
    if (isNoRing) {
        $(this).removeClass('btn-danger').addClass('btn-warning');
    } else {
        $(this).removeClass('btn-warning').addClass('btn-danger');
    }
});

$("#autoanswerbtn").click(function() {
    isAutoAnswer = !isAutoAnswer;
    if (isAutoAnswer) {
        $(this).removeClass('btn-danger').addClass('btn-warning');
    } else {
        $(this).removeClass('btn-warning').addClass('btn-danger');
    }
});

//DIAL BUTTONS LOGIC - INCOMING CALL
$("#ext1btn").click(function() {
    buttonExtLogic("1");
});

$("#ext2btn").click(function() {
    buttonExtLogic("2");
});

$("#ext3btn").click(function() {
    buttonExtLogic("3");
});

$("#ext4btn").click(function() {
    buttonExtLogic("4");
});

$("#ext5btn").click(function() {
    buttonExtLogic("5");
});

$("#ext6btn").click(function() {
    buttonExtLogic("6");
});

$("#ext7btn").click(function() {
    buttonExtLogic("7");
});

$("#ext8btn").click(function() {
    buttonExtLogic("8");
});

$("#ext9btn").click(function() {
    buttonExtLogic("9");
});

$("#ext0btn").click(function() {
    buttonExtLogic("0");
});

$("#extstarbtn").click(function() {
    buttonExtLogic("*");
});

$("#extpoundbtn").click(function() {
    buttonExtLogic("#");
});

function buttonExtLogic(button) {
    $("#ext").val($("#ext").val() + button);
    var input = document.getElementById('calling_input');
    input.value = $("#ext").val();
}

//DIAL BUTTONS LOGIC - IN CALL
$("#dtmf1btn").click(function() {
    cur_call.dtmf("1", dtmf_options);
});

$("#dtmf2btn").click(function() {
    cur_call.dtmf("2", dtmf_options);
});

$("#dtmf3btn").click(function() {
    cur_call.dtmf("3", dtmf_options);
});

$("#dtmf4btn").click(function() {
    cur_call.dtmf("4", dtmf_options);
});

$("#dtmf5btn").click(function() {
    cur_call.dtmf("5", dtmf_options);
});

$("#dtmf6btn").click(function() {
    cur_call.dtmf("6", dtmf_options);
});

$("#dtmf7btn").click(function() {
    cur_call.dtmf("7", dtmf_options);
});

$("#dtmf8btn").click(function() {
    cur_call.dtmf("8", dtmf_options);
});

$("#dtmf9btn").click(function() {
    cur_call.dtmf("9", dtmf_options);
});

$("#dtmf0btn").click(function() {
    cur_call.dtmf("0", dtmf_options);
});

$("#dtmfstarbtn").click(function() {
    cur_call.dtmf("*", dtmf_options);
});

$("#dtmfpoundbtn").click(function() {
    cur_call.dtmf("#", dtmf_options);
});

//Call on enter key pressed in input field
$("#calling_input").keyup(function(event) {
    if (event.keyCode == 13 && !event.shiftKey) {
        $("#ext").val($("#calling_input").val());
        $("#callbtn").trigger("click");
    }
});

function init() {
    prov = null;

    if (cur_prov === 'SIP.js') {
        prov = new SIPjsProvider();
    } else if (cur_prov === 'infobip') {
        prov = new InfobipProvider();
    }

    var login;
    var yourname;

    cur_call = null;
    // resetOptionsTimer();
    login = $("#login").val();
    yourname = $("#yourname").val();

    if (yourname === "") {
        yourname = $("#login").val();
    }
 
    prov.connect(login, yourname);

    $("#isIncomingcall").hide();

    $(document).keyup(function(event) {
        if (event.keyCode == 13 && !event.shiftKey) {
            if (isRegistered) {
                if (cur_call) {} else {
                    $("#callbtn").trigger("click");
                }
            }
        }
    });

    $(document).keypress(function(event) {
        var key = String.fromCharCode(event.keyCode || event.charCode);
        var i = parseInt(key);
        var tag = event.target.tagName.toLowerCase();
        if (isRegistered) {
            if (cur_call) {
                if (key === "#" || key === "*" || key === "0" || (i > 0 && i <= 9)) {
                    cur_call.dtmf(key, dtmf_options);
                }
            } else {
                if (key === "#" || key === "*" || key === "0" || (i > 0 && i <= 9)) {

                    if (key === "0") $("#ext0btn").click();
                    if (key === "1") $("#ext1btn").click();
                    if (key === "2") $("#ext2btn").click();
                    if (key === "3") $("#ext3btn").click();
                    if (key === "4") $("#ext4btn").click();
                    if (key === "5") $("#ext5btn").click();
                    if (key === "6") $("#ext6btn").click();
                    if (key === "7") $("#ext7btn").click();
                    if (key === "8") $("#ext8btn").click();
                    if (key === "9") $("#ext9btn").click();
                    if (key === "*") $("#extstarbtn").click();
                    if (key === "#") $("#extpoundbtn").click();
                }
            }
        }
    });
}

$(window).load(function() {
    cur_call = null;
    // resetOptionsTimer();
    isAndroid = (navigator.userAgent.toLowerCase().indexOf('android') > -1);
    isIOS = /(iPad|iPhone|iPod)/g.test(navigator.userAgent);

    console.log("The doctor is in");
    console.log("Is something troubling you?");


    var url_string = window.location.href; //window.location.href
    var url = new URL(url_string);

    var loginParam = url.searchParams.get("login");
    var passwdParam = url.searchParams.get("passwd");
    var isAutoAnswerParam = url.searchParams.get("autoanswer");

    if (loginParam)
        $("#login").val(loginParam);
    
    if (passwdParam)
        $("#passwd").val(passwdParam);

    if (isAutoAnswerParam)
        autoAnswerOnce = true;

    if (loginParam && passwdParam)
        clicklogin = "yes";

    $("#signin").hide();
    $("#dial").hide();
    $("#incall").hide();

    $("#controls").hide();
    $("#dialadv1").hide();
    $("#dialadv2").hide();
    $("#unholdbtn").hide();

    $("#yourname").keyup(function(event) {
        if (event.keyCode == 13 && !event.shiftKey) {
            $("#loginbtn").trigger("click");
        }
    });

    $("#passwd").keyup(function(event) {
        if (event.keyCode == 13 && !event.shiftKey) {
            $("#loginbtn").trigger("click");
        }
    });
    $("#login").keyup(function(event) {
        if (event.keyCode == 13 && !event.shiftKey) {
            $("#loginbtn").trigger("click");
        }
    });
    $("#ext").keyup(function(event) {
        if (event.keyCode == 13 && !event.shiftKey) {
            $("#callbtn").trigger("click");
        }
    });


    // Safari requires the user to grant device access before providing
    // all necessary device info, so do that first.
    var constraints = {
        audio: true,
        video: false,
    };
    navigator.mediaDevices.getUserMedia(constraints);

    navigator.mediaDevices.enumerateDevices()
        .then(function(devices) {
            var i = 1;
            var div = document.querySelector("#listmic"),
                frag = document.createDocumentFragment(),
                selectmic = document.createElement("select");

            while (div.firstChild) {
                div.removeChild(div.firstChild);
            }
            i = 1;
            selectmic.id = "selectmic";
            selectmic.style = "background-color: black;";

            devices.forEach(function(device) {


                if (device.kind === 'audioinput') {

                    selectmic.options.add(new Option('Microphone: ' + (device.label ? device.label : (i)), device.deviceId));
                    i++;

                }
            });

            frag.appendChild(selectmic);

            div.appendChild(frag);

        })
        .catch(function(err) {
            console.log(err.name + ": " + err.message);
        });

    document.getElementById("hideAll").style.display = "none";
    $("#signin").show();
    $("#signinadv1").hide();

    $("#webphone_blf").hide();

    if (clicklogin === "yes") {
        $("#loginbtn").trigger("click");
    }
});


$(document).ready(function() {
    audioElement.setAttribute('src', 'mp3/ring.mp3');
    setupCacheHandler();
});

//CACHE HANDLER
var cacheItems = ['login', 'passwd', 'yourname', 'domain', 'proxy', 'port',
    'pres1', 'pres1_label',
    'pres2', 'pres2_label',
    'pres3', 'pres3_label',
    'pres4', 'pres4_label',
    'pres5', 'pres5_label',
    'pres6', 'pres6_label',
    'pres7', 'pres7_label',
    'pres8', 'pres8_label',
    'pres9', 'pres9_label',
    'pres10', 'pres10_label',
];

function setupCacheHandler() {
    for (var i = 0; i < cacheItems.length; i++) {
        var key = cacheItems[i];

        // 1. Si hay valor en localStorage, tiene prioridad (el usuario lo cambió manualmente)
        var cachedValue = localStorage.getItem("saraphone." + key);
        if (cachedValue) {
            document.getElementById(key).value = cachedValue;

        // 2. Si no hay valor en localStorage pero existe config.js, cargarlo desde ahí
        } else if (typeof SARAPHONE_CONFIG !== 'undefined' && SARAPHONE_CONFIG[key] !== undefined) {
            document.getElementById(key).value = SARAPHONE_CONFIG[key];
            // También lo guardamos en localStorage para futuras visitas
            localStorage.setItem("saraphone." + key, SARAPHONE_CONFIG[key]);
        }

        // 3. Seguimos guardando los cambios del usuario en localStorage como antes
        $("#" + key).change(function(e) {
            localStorage.setItem("saraphone." + e.target.id, e.target.value);
        });
    }
}

function hideIncomingCall() {
    $("#isIncomingcall").hide();
    $("#isNotIncomingcall").show();
}
