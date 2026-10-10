package expo.modules.smsdirect

import android.os.Build
import android.telephony.SmsManager
import android.telephony.SubscriptionManager
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

    // Lists active SIMs without reading or returning their phone numbers.
    Function("getSubscriptions") {
      val context = appContext.reactContext ?: throw Exceptions.ReactContextLost()
      val manager = context.getSystemService(SubscriptionManager::class.java)
      val defaultSmsSubscriptionId = SubscriptionManager.getDefaultSmsSubscriptionId()
      manager.activeSubscriptionInfoList.orEmpty().map { info ->
        mapOf(
          "subscriptionId" to info.subscriptionId,
          "slotIndex" to info.simSlotIndex,
          "label" to info.displayName.toString(),
          "carrierName" to (info.carrierName?.toString() ?: ""),
          "isDefault" to (info.subscriptionId == defaultSmsSubscriptionId),
        )
      }
    }

    // Sends an SMS straight through the SIM via Android SmsManager — no composer.
    // Requires SEND_SMS permission (requested from JS before calling).
    AsyncFunction("sendSms") { phone: String, message: String, subscriptionId: Int? ->
      val context = appContext.reactContext ?: throw Exceptions.ReactContextLost()
      val smsManager: SmsManager =
        if (subscriptionId != null && subscriptionId >= 0 && Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
          context.getSystemService(SmsManager::class.java).createForSubscriptionId(subscriptionId)
        } else if (subscriptionId != null && subscriptionId >= 0) {
          @Suppress("DEPRECATION")
          SmsManager.getSmsManagerForSubscriptionId(subscriptionId)
        } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
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
