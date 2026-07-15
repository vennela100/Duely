package expo.modules.smsdirect

import android.os.Build
import android.telephony.SmsManager
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class SmsdirectModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("Smsdirect")

    // Present only in a native build (not Expo Go). JS still gates on Platform.
    Function("isAvailable") {
      true
    }

    // Sends an SMS straight through the SIM via Android SmsManager — no composer.
    // Requires SEND_SMS permission (requested from JS before calling).
    AsyncFunction("sendSms") { phone: String, message: String ->
      val context = appContext.reactContext ?: throw Exceptions.ReactContextLost()
      val smsManager: SmsManager =
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
          context.getSystemService(SmsManager::class.java)
        } else {
          @Suppress("DEPRECATION")
          SmsManager.getDefault()
        }
      val parts = smsManager.divideMessage(message)
      if (parts.size > 1) {
        smsManager.sendMultipartTextMessage(phone, null, parts, null, null)
      } else {
        smsManager.sendTextMessage(phone, null, message, null, null)
      }
      true
    }
  }
}
