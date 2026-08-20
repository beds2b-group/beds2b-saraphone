const SARAPHONE_CONFIG = {
  login: "55001",
  passwd: "56X5wjYXj7InhArM$3f",
  yourname: "Senator Agent",
  domain: "contactcenter.it.senator.tools",
  proxy: "contactcenter.it.senator.tools",
  port: "8089/wss",
  pres1: "",
  pres1_label: "",
  pres2: "",
  pres2_label: "",
  pres3: "",
  pres3_label: "",
};


const TELEPHONE_CONFIG = {
  provider: "infobip",
  sip: {
    login: "55001",  passwd: "56X5wjYXj7InhArM$3f",  yourname: "Senator Agent",  domain: "contactcenter.it.senator.tools", proxy: "contactcenter.it.senator.tools", 
    port: "8089/wss", pres1: "",  pres1_label: "",  pres2: "",  pres2_label: "", pres3: "", pres3_label: ""
  },
  infobip: {
    apiHost: "https://k9v5ge.api.infobip.com"
  }
}


const PROVIDERS = {
  infobip: InfobipProvider,
  sip: SipProvider
};