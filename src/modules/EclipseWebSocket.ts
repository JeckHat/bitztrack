import { NativeModules } from "react-native"

const { RNEclipseWebSocket } = NativeModules

class EclipseWebSocket {
    constructor() {}

    startService(url: string, account: { id: string, account: string }[]) {
        RNEclipseWebSocket.startService(url, account);
    }

    stopService() {
        RNEclipseWebSocket.stopService();
    };

    getModule() {
        return RNEclipseWebSocket
    }
}

export default new EclipseWebSocket()