const SARAPHONE_CONFIG = {
  login: "55001",
  passwd: "56X5wjYXj7InhArM$3f",
  yourname: "Senator Agent",
  domain: "contactcenter.it.senator.tools",
  proxy: "contactcenter.it.senator.tools",
  port: "8089/ws",
  pres1: "",
  pres1_label: "",
  pres2: "",
  pres2_label: "",
  pres3: "",
  pres3_label: "",
};


const TELEPHONE_CONFIG = {
  provider: "twilio",
  sip: {
    login: "55001",  passwd: "56X5wjYXj7InhArM$3f",  yourname: "Senator Agent",  domain: "contactcenter.it.senator.tools", proxy: "contactcenter.it.senator.tools", 
    port: "8089/wss", pres1: "",  pres1_label: "",  pres2: "",  pres2_label: "", pres3: "", pres3_label: ""
  },
  infobip: {
    apiHost: "https://k9v5ge.api.infobip.com"
  },
  twilio: {
    // Twilio Function /voice-token. Local: npm start in saraphone-voice.
    // Local: http://localhost:3001/voice-token
    tokenUrl: "https://saraphone-voice-7991-dev.twil.io/voice-token"
  }
}