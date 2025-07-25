package com.bitztrack

import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ViewManager
import com.bitztrack.modules.CpuUsageModule
import com.bitztrack.modules.BitzTrackInfoModule
import com.bitztrack.modules.EclipseWebSocketModule

class BitzTrackPackage : ReactPackage {
    override fun createNativeModules(reactContext: ReactApplicationContext): List<NativeModule> {
        return listOf(
            BitzTrackInfoModule(reactContext),
            CpuUsageModule(reactContext),
            EclipseWebSocketModule(reactContext)
        )
    }

    override fun createViewManagers(reactContext: ReactApplicationContext): List<ViewManager<in Nothing, in Nothing>> {
        return emptyList()
    }
}