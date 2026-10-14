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

// var cur_prov = 'SIP.js';
var cur_prov = 'twilio';
// var cur_prov = "infobip";

// MULTI-PROVIDER TODO:
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
    if (event.key !== "Backspace") return;
    
    try {
        var extEl = document.getElementById('ext');
        var callingInput = document.getElementById('calling_input');
        if (!extEl) return;

        var cur = extEl.value || "";
        if (cur.length <= 0) return;
        
        extEl.value = cur.slice(0, -1);
        if (callingInput) callingInput.value = extEl.value;
    } catch (e) {
        console.error('keydown handler error', e);
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

    if (!event.data || event.data.source !== "zammad") return;

    switch (event.data.action) {
        case "answer-call":
            answerIncomingCall();
            break;

        case "reject-call":
            rejectIncomingCall();
            break;

        case "hangup-call":
            if (prov.isCurrentActiveCall()) {
                prov.hangup();
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
    prov.answer(incomingsession);
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
    resetCallingVars();
}

$("#asknotificationpermission").click(function() {
    if (isIOS) return;

    if (!("Notification" in window)){
        alert("This browser does not support desktop notification");
        return;
    }

    if (Notification.permisision === 'denied') {
        alert(`Permission is ${Notification.permission}`);
        return;
    }


    Notification.requestPermission(function(permission) {

        if (!('permission' in Notification))
            Notification.permission = permission;
       
        if (permission === "granted") {
            console.log("Notification Permission Granted!");
            var notification = new Notification("Notification Permission Granted!");
            $("#asknotificationpermission").hide();
        }
    });
});


function notifyMe(msg) {
    if (isIOS) return;
    if (Notification.permission !== "granted") return;  

    console.log(msg);
    let img = 'img/notification.png';
    let notification = new Notification('WebPhone', {
        body: msg,
        icon: img
    });
    
    function focusFunction() {
        parent.focus();
        window.focus();
        notification.close();
    }

    notification.onclick = focusFunction
    notification.onclose = focusFunction
    notification.onerror = focusFunction
}

function onRegisteredCommon(){
    if (!isIOS && Notification.permission === "granted") {
        $("#asknotificationpermission").hide();
    }

    $("#signin").hide();
    $("#dial").show();
    $("#incall").hide();
    hideAgents();
    $("#ext").val("");
    resetCallingVars();

        
    var span = document.getElementById('whoami');
    var txt = document.createTextNode($("#login").val());
    span.innerText = txt.textContent + " (" + $("#yourname").val() + ")";

    isRegistered = true;
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

$("#rejcallbtn").click(function() {
    audioElement.pause();
    prov.reject();
    console.log('rejected');
    hideIncomingCall();
    resetCallingVars();
});

function resetCallingVars() {
    var span = document.getElementById('calling');
    $("#calling_input").val("");
    span.innerText = "";
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
    if (!$("#ext").val()) return;
    var regex1 = /#/g;
    var new_ext = $("#ext").val().replace(regex1, "_");
    $("#ext").val(new_ext);
    oldext=$("#ext").val();
    prov.doCall();
});

$("#delcallbtn").click(function() {
    $("#ext").val("");
    resetCallingVars();
    $("#hangupbtn").trigger("click");
});


//AGENTS
// Lista de agentes: SARAPHONE_CONFIG.agents = [{ name, ext, status: 'available'|'oncall'|'away', since }]
// "since" son los segundos que lleva en llamada. SARAPHONE_CONFIG.role = 'controller' activa Listen.
var defaultAgents = [
    { name: 'Laura Gómez', ext: '55002', status: 'available' },
    { name: 'Marc Puig', ext: '55003', status: 'oncall', since: 225 },
    { name: 'Núria Vidal', ext: '55004', status: 'available' },
    { name: 'Jordi Serra', ext: '55005', status: 'oncall', since: 731 },
    { name: 'Ana Ruiz', ext: '55006', status: 'available' },
    { name: 'Pau Martí', ext: '55007', status: 'away' },
    { name: 'Elena Soler', ext: '55008', status: 'oncall', since: 64 },
    { name: 'David Roca', ext: '55009', status: 'available' }
];
var agentsSelected = null;
var agentsTimer = null;
var agentsOpenedAt = 0;
var agentsReturnTo = '#dial';
// Abierta desde ringing u oncall: cada agente muestra su botón de llamada y no se selecciona.
// Abierta desde dial: sin botón por agente, se selecciona y se llama desde el pie.
var agentsBusy = false;
var agentsHintLocked = false;

function getAgents() {
    if (typeof SARAPHONE_CONFIG !== 'undefined' && Array.isArray(SARAPHONE_CONFIG.agents))
        return SARAPHONE_CONFIG.agents;
    return defaultAgents;
}

function isController() {
    return typeof SARAPHONE_CONFIG !== 'undefined' && SARAPHONE_CONFIG.role === 'controller';
}

function agentInitials(name) {
    return name.split(' ').filter(Boolean).slice(0, 2).map(function(w) { return w[0]; }).join('').toUpperCase();
}

function fmtSecs(x) {
    var pad = function(n) { return String(n).padStart(2, '0'); };
    return pad(Math.floor(x / 60)) + ':' + pad(x % 60);
}

function renderAgents() {
    var agents = getAgents();
    var elapsed = Math.floor((Date.now() - agentsOpenedAt) / 1000);
    var list = $("#agents_list").empty();

    $("#agents_role").toggle(isController());

    if (agents.length === 0)
        list.append($('<div class="agents-empty">').text('No hay agentes disponibles'));

    agents.forEach(function(a, i) {
        var status = a.status || 'available';
        var badge = status === 'oncall' ? 'On call ' + fmtSecs((a.since || 0) + elapsed)
                  : status === 'away' ? 'Away' : 'Available';

        var item = $('<div class="agent-item">').toggleClass('selected', agentsSelected === i);
        var avatar = $('<div class="agent-avatar">').text(agentInitials(a.name))
            .append($('<span class="agent-dot">').addClass(status));
        var info = $('<div class="agent-info">')
            .append($('<div class="agent-name">').text(a.name))
            .append($('<div class="agent-meta">')
                .append($('<span class="agent-badge">').addClass(status).text(badge))
                .append($('<span>').text(a.ext)));

        item.append(avatar, info);

        if (isController() && status === 'oncall' && !agentsBusy) {
            var listen = $('<button class="agent-listen" data-inline="true">')
                .html('<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M6 8.5a6.5 6.5 0 1 1 13 0c0 6-6 6-6 10a3.5 3.5 0 1 1-7 0"></path><path d="M15 8.5a2.5 2.5 0 0 0-5 0v1a2 2 0 1 1 0 4"></path></svg>Listen')
                .click(function(e) {
                    e.stopPropagation();
                    callAgent(listenPrefix() + a.ext);
                });
            item.append(listen);
        }

        if (agentsBusy) item.append($('<button class="agent-select" data-inline="true" title="Llamar" aria-label="Llamar">')
            .html('<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.4 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z"></path></svg>')
            .click(function(e) {
                e.stopPropagation();
                transferToAgent(a);
            }));

        if (!agentsBusy) item.click(function() {
            agentsSelected = agentsSelected === i ? null : i;
            renderAgents();
        });

        list.append(item);
    });

    var sel = agentsSelected !== null ? agents[agentsSelected] : null;
    $("#agents_list").toggleClass('readonly', agentsBusy);
    if (!agentsHintLocked)
        $("#agents_hint").text(agentsBusy ? 'Pulsa el teléfono para pasar la llamada' : 'Selecciona un agente para llamar');
    $("#agents_hint").toggle(!sel);
    $("#agentscancelbtn").toggle(!!sel);
    $("#agentsconfirmbtn").toggle(!!sel).text(sel ? 'Llamar a ' + sel.name.split(' ')[0] : '');
}

// Prefijo de escucha (eavesdrop de FusionPBX por defecto)
function listenPrefix() {
    if (typeof SARAPHONE_CONFIG !== 'undefined' && SARAPHONE_CONFIG.listenPrefix)
        return SARAPHONE_CONFIG.listenPrefix;
    return '*33';
}

// Con llamada activa no se puede usar doCall(): los providers cuelgan la llamada actual antes de marcar.
// Si el provider implementa transfer(destino) se usa; si no, se avisa sin cortar la llamada.
function transferToAgent(agent) {
    if (!prov || typeof prov.transfer !== 'function') {
        console.warn('Transferencia no soportada por el provider', cur_prov);
        showAgentsHint('Transferencia no disponible en ' + cur_prov);
        return;
    }

    showAgentsHint('Transfiriendo a ' + agent.name.split(' ')[0] + '...');
    Promise.resolve(prov.transfer(agent.ext)).catch(function() {
        showAgentsHint('No se ha podido transferir la llamada');
    });
}

// Mensaje temporal en el pie de la pantalla de agentes
function showAgentsHint(text) {
    agentsHintLocked = true;
    $("#agents_hint").text(text).show();
    setTimeout(function() { agentsHintLocked = false; renderAgents(); }, 2500);
}

function showAgents(returnTo, busy) {
    agentsReturnTo = returnTo;
    agentsBusy = busy;
    agentsSelected = null;
    agentsOpenedAt = Date.now();
    $("#dial").hide();
    $("#incall").hide();
    $("#agents").show();
    renderAgents();
    clearInterval(agentsTimer);
    agentsTimer = setInterval(renderAgents, 1000);
}

function hideAgents() {
    clearInterval(agentsTimer);
    agentsTimer = null;
    $("#agents").hide();
}

function callAgent(number) {
    hideAgents();
    $("#dial").show();
    $("#ext").val(number);
    $("#calling_input").val(number);
    $("#callbtn").click();
}

$("#usersbtn").click(function() {
    showAgents('#dial', false);
});

$("#usersringbtn").click(function() {
    showAgents('#dial', true);
});

$("#usersincallbtn").click(function() {
    showAgents('#incall', true);
});

$("#agentsbackbtn").click(function() {
    hideAgents();
    $(agentsReturnTo).show();
});

$("#agentscancelbtn").click(function() {
    agentsSelected = null;
    renderAgents();
});

$("#agentsconfirmbtn").click(function() {
    var agents = getAgents();
    if (agentsSelected === null || !agents[agentsSelected]) return;
    callAgent(agents[agentsSelected].ext);
});

$("#hangupbtn").click(function() {
    prov.hangup();
    $("#br").show();
    $("#ext").show();
    resetCallingVars();
});

$("#loginbtn").click(function() {
    init();
});

//BUTTON LOGIC - OPTIONS TOOLS
$("#mutebtn").click(function() {
    isOnMute = !isOnMute;
    prov.mute(isOnMute);
    $(this).toggleClass('btn-danger', isOnMute).toggleClass('btn-warning', !isOnMute);
});

$("#holdbtn").click(function() {
    if (isOnHold) return;
    
    isOnHold = true;
    prov.senddtmf(isOutboundCall ? "*299" : "*399", dtmf_options);
    $("#unholdbtn").show();
    console.error("HOLD begins");

});

$("#unholdbtn").click(function() {
    if (isOnHold == false) return;
    
    isOnHold = false;
    $("#extstarbtn").click();
    $("#ext6btn").click();
    $("#ext5btn").click();
    $("#ext5btn").click();
    $("#callbtn").click();
    $("#unholdbtn").hide();
    console.error("HOLD ends");
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
    prov.senddtmf("*");
    prov.senddtmf("2");

    isRecording = !isRecording;
});

$("#dndbtn").click(function() {
    isDnd = !isDnd;
});

$("#ringbtn").click(function() {
    isNoRing = !isNoRing;
});

$("#autoanswerbtn").click(function() {
    isAutoAnswer = !isAutoAnswer;
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
    prov.senddtmf("1", dtmf_options);
});

$("#dtmf2btn").click(function() {
    prov.senddtmf("2", dtmf_options);
});

$("#dtmf3btn").click(function() {
    prov.senddtmf("3", dtmf_options);
});

$("#dtmf4btn").click(function() {
    prov.senddtmf("4", dtmf_options);
});

$("#dtmf5btn").click(function() {
    prov.senddtmf("5", dtmf_options);
});

$("#dtmf6btn").click(function() {
    prov.senddtmf("6", dtmf_options);
});

$("#dtmf7btn").click(function() {
    prov.senddtmf("7", dtmf_options);
});

$("#dtmf8btn").click(function() {
    prov.senddtmf("8", dtmf_options);
});

$("#dtmf9btn").click(function() {
    prov.senddtmf("9", dtmf_options);
});

$("#dtmf0btn").click(function() {
    prov.senddtmf("0", dtmf_options);
});

$("#dtmfstarbtn").click(function() {
    prov.senddtmf("*", dtmf_options);
});

$("#dtmfpoundbtn").click(function() {
    prov.senddtmf("#", dtmf_options);
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
    else if (cur_prov === 'twilio') {
        prov = new TwilioProvider();
    }

    var login;
    var yourname;

    // resetOptionsTimer();
    login = $("#login").val();
    yourname = $("#yourname").val();

    if (yourname === "") {
        yourname = $("#login").val();
    }
 
    prov.connect(login, yourname);

    console.log("Paso la conexión");

    $("#isIncomingcall").hide();

    $(document).keyup(function(event) {
        if (event.keyCode != 13 || event.shiftKey) return;
        
        if (isRegistered && !prov.isCurrentActiveCall())
            $("#callbtn").trigger("click");
    });

    $(document).keypress(function(event) {
        var target = event.target;
        var targetTag = target && target.tagName ? target.tagName.toLowerCase() : "";
        var isEditableTarget = targetTag === "input" || targetTag === "textarea" || targetTag === "select" || (target && target.isContentEditable);

        if (isEditableTarget) {
            return;
        }

        var key = String.fromCharCode(event.keyCode || event.charCode);
        var i = parseInt(key);
        var tag = event.target.tagName.toLowerCase();

        if (!isRegistered) return;

        if (!(key === "#" || key === "*" || key === "0" || (i > 0 && i <= 9))) return;

        if (prov.isCurrentActiveCall()) {
            prov.senddtmf(key, dtmf_options);
            return;
        }

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
    });
}

$(window).load(function() {
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
    $("#agents").hide();

    $("#controls").hide();
    $("#dialadv1").hide();
    $("#dialadv2").hide();
    $("#unholdbtn").hide();

    $("#yourname").keyup(function(event) {
        if (event.keyCode != 13 || event.shiftKey) return;
        $("#loginbtn").trigger("click");
    });

    $("#passwd").keyup(function(event) {
        if (event.keyCode != 13 || event.shiftKey) return;
        $("#loginbtn").trigger("click");
    });
    
    $("#login").keyup(function(event) {
        if (event.keyCode != 13 || event.shiftKey) return;
        $("#loginbtn").trigger("click");
    });
    
    $("#ext").keyup(function(event) {
        if (event.keyCode != 13 || event.shiftKey) return;
        $("#callbtn").trigger("click");
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
                if (device.kind !== 'audioinput') return;
                selectmic.options.add(new Option('Microphone: ' + (device.label ? device.label : (i)), device.deviceId));
                i++;
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

    if (clicklogin === "yes")
        $("#loginbtn").trigger("click");
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
