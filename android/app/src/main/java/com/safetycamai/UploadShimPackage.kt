package com.safetycamai

import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ViewManager

// Import the module class that exists in your node_modules
import com.vydia.RNUploader.UploaderModule

class UploadShimPackage : ReactPackage {
  override fun createNativeModules(reactContext: ReactApplicationContext): List<NativeModule> {
    // Register RNFileUploader (UploaderModule#getName() returns "RNFileUploader")
    return listOf(UploaderModule(reactContext))
  }

  override fun createViewManagers(reactContext: ReactApplicationContext): List<ViewManager<*, *>> {
    return emptyList()
  }
}
