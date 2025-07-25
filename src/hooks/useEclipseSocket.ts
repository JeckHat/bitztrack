import { useEffect } from "react"
import { NativeEventEmitter } from "react-native"

import EclipseWebSocket from "@modules/EclipseWebSocket"
const eclipseEmitter = new NativeEventEmitter(EclipseWebSocket.getModule())
  
export const startEclipseSocket = (url: string, accounts: { id: string, account: string }[]) => {
    EclipseWebSocket.startService(url, accounts)
}
  
export const useEclipseSocket = (
    url: string,
    accounts: { id: string, account: string }[],
    onMessage: (event: { id: string; data: any }) => void
) => {
    useEffect(() => {
        if (!url || accounts.length === 0) return

        const sub = eclipseEmitter.addListener("EclipseSocketEvent", (event) => {
            onMessage(event)
        });
    
        startEclipseSocket(url, accounts)
    
        return () => {
            sub.remove()
            EclipseWebSocket.stopService()
        };
    }, [url, JSON.stringify(accounts)])
}
  