package com.bilalgnd.saracapp

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.media.AudioAttributes
import android.media.RingtoneManager
import android.os.Build
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import android.util.Log
import androidx.core.app.NotificationCompat
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage

class MyFirebaseMessagingService : FirebaseMessagingService() {

    override fun onNewToken(token: String) {
        super.onNewToken(token)
        Log.d("FCM", "New token: $token")
        val defter = getSharedPreferences("SaracogluDefteri", Context.MODE_PRIVATE)
        defter.edit().putString("FCM_TOKEN", token).apply()
    }

    override fun onMessageReceived(remoteMessage: RemoteMessage) {
        super.onMessageReceived(remoteMessage)

        val title = remoteMessage.notification?.title ?: remoteMessage.data["title"] ?: "🔔 Garson Çağrısı!"
        val message = remoteMessage.notification?.body ?: remoteMessage.data["body"] ?: "Garson çağrısı veya yeni sipariş."

        sendNotification(this, title, message)
    }

    companion object {
        fun sendNotification(context: Context, title: String, messageBody: String) {
            try {
                val intent = Intent(context, MainActivity::class.java)
                intent.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP)
                val pendingIntent = PendingIntent.getActivity(
                    context, 0, intent,
                    PendingIntent.FLAG_ONE_SHOT or PendingIntent.FLAG_IMMUTABLE
                )

                val channelId = "garson_cagrisi_kanali"
                val defaultSoundUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION)
                
                val notificationManager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    val audioAttributes = AudioAttributes.Builder()
                        .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                        .setUsage(AudioAttributes.USAGE_NOTIFICATION)
                        .build()
                    val channel = NotificationChannel(
                        channelId,
                        "Garson Çağrısı & Sipariş Bildirimleri",
                        NotificationManager.IMPORTANCE_HIGH
                    ).apply {
                        description = "Garson çağrısı ve yeni sipariş uyarıları"
                        enableVibration(true)
                        vibrationPattern = longArrayOf(0, 500, 200, 500)
                        setSound(defaultSoundUri, audioAttributes)
                    }
                    notificationManager.createNotificationChannel(channel)
                }

                val notificationBuilder = NotificationCompat.Builder(context, channelId)
                    .setSmallIcon(R.mipmap.saracappicon2)
                    .setContentTitle(title)
                    .setContentText(messageBody)
                    .setAutoCancel(true)
                    .setSound(defaultSoundUri)
                    .setVibrate(longArrayOf(0, 500, 200, 500))
                    .setPriority(NotificationCompat.PRIORITY_MAX)
                    .setContentIntent(pendingIntent)

                notificationManager.notify(System.currentTimeMillis().toInt(), notificationBuilder.build())

                // Also trigger vibration and ringtone directly if app is in foreground
                try {
                    val ringtone = RingtoneManager.getRingtone(context, defaultSoundUri)
                    ringtone?.play()
                } catch (_: Exception) {}

                try {
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                        val vibratorManager = context.getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as VibratorManager
                        vibratorManager.defaultVibrator.vibrate(VibrationEffect.createWaveform(longArrayOf(0, 400, 200, 400), -1))
                    } else {
                        @Suppress("DEPRECATION")
                        val vibrator = context.getSystemService(Context.VIBRATOR_SERVICE) as Vibrator
                        vibrator.vibrate(longArrayOf(0, 400, 200, 400), -1)
                    }
                } catch (_: Exception) {}

            } catch (e: Exception) {
                Log.e("FCM", "sendNotification error: ${e.message}")
            }
        }
    }
}

