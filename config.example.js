// Plantilla de configuración del softphone.
// Copia este fichero como config.js y rellena los valores. config.js NO se versiona:
// se sirve al navegador, así que nada de lo que pongas aquí es secreto para el usuario.
// Las credenciales SIP solo son necesarias si se usa el proveedor "sip".

const SARAPHONE_CONFIG = {
  login: "",
  passwd: "",
  yourname: "",
  domain: "",
  proxy: "",
  port: "8089/ws",
  pres1: "",
  pres1_label: "",
  pres2: "",
  pres2_label: "",
  pres3: "",
  pres3_label: "",
};

const TELEPHONE_CONFIG = {
  // "twilio" | "infobip" | "sip"
  provider: "twilio",
  sip: {
    login: "", passwd: "", yourname: "", domain: "", proxy: "",
    port: "8089/wss", pres1: "", pres1_label: "", pres2: "", pres2_label: "", pres3: "", pres3_label: ""
  },
  infobip: {
    apiHost: ""
  },
  twilio: {
    // URL que emite el token de Voice SDK. Provisional: función de Twilio; definitivo: One-Desk.
    tokenUrl: "",
    transferUrl: ""
  }
}
