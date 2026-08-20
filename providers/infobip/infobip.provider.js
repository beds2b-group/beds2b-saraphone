
class InfobipProvider extends TelephonyProvider {
    constructor() {
        this.infobip = this.connect();
    }

    connect() {
        return createInfobipRtc('2e29c3a0-730a-4526-93ce-cda44556dab5', {debug: true});
    }

    disconnect() {
        infobipRTC.disconnect();
    }

}





