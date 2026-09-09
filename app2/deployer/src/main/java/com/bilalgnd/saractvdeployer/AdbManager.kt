package com.bilalgnd.saractvdeployer

import dadb.Dadb
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.File
import java.net.InetSocketAddress
import java.net.Socket

class AdbManager {

    private var dadb: Dadb? = null
    var isConnected: Boolean = false
        private set

    var connectedIp: String? = null
        private set

    suspend fun connect(ip: String, port: Int = 5555): Result<String> = withContext(Dispatchers.IO) {
        try {
            disconnect()
            // Quick socket check first
            val reachable = Socket().use { s ->
                try {
                    s.connect(InetSocketAddress(ip, port), 2500)
                    true
                } catch (_: Exception) {
                    false
                }
            }
            if (!reachable) {
                return@withContext Result.failure(Exception("$ip:$port portuna ulaşılamadı. TV'de Ağ Hata Ayıklama (Wireless ADB) açık mı?"))
            }

            val d = Dadb.create(ip, port)
            // Test connection by running simple shell command
            val echoRes = d.shell("echo ok").output
            if (echoRes.contains("ok")) {
                dadb = d
                isConnected = true
                connectedIp = ip
                Result.success("✅ Bağlantı başarılı: $ip:$port")
            } else {
                Result.failure(Exception("Yetki bekleniyor. Lütfen TV ekranında çıkan 'İzin Ver' onayını kumandayla kabul edin."))
            }
        } catch (e: Exception) {
            disconnect()
            Result.failure(e)
        }
    }

    suspend fun installApk(apkFile: File, onProgress: (String) -> Unit): Result<String> = withContext(Dispatchers.IO) {
        val d = dadb ?: return@withContext Result.failure(Exception("TV'ye bağlı değilsiniz"))
        try {
            onProgress("📦 APK TV'ye gönderiliyor (${apkFile.length() / (1024 * 1024)} MB)...")
            d.install(apkFile)
            onProgress("✅ TV'ye kurulum tamamlandı!")
            Result.success("Başarılı")
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun launchTvApp(): Result<String> = withContext(Dispatchers.IO) {
        val d = dadb ?: return@withContext Result.failure(Exception("TV'ye bağlı değilsiniz"))
        try {
            val res = d.shell("am start -n com.bilalgnd.saracapptv/.MainActivity").output
            Result.success(res)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun restartTvApp(): Result<String> = withContext(Dispatchers.IO) {
        val d = dadb ?: return@withContext Result.failure(Exception("TV'ye bağlı değilsiniz"))
        try {
            d.shell("am force-stop com.bilalgnd.saracapptv")
            val res = d.shell("am start -n com.bilalgnd.saracapptv/.MainActivity").output
            Result.success(res)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun setKasaIp(kasaIp: String): Result<String> = withContext(Dispatchers.IO) {
        val d = dadb ?: return@withContext Result.failure(Exception("TV'ye bağlı değilsiniz"))
        try {
            // Push Kasa IP into TV app shared preferences via am broadcast or shell
            val cmd = "am start -n com.bilalgnd.saracapptv/.MainActivity --es KASA_IP $kasaIp"
            val res = d.shell(cmd).output
            Result.success("Kasa IP ($kasaIp) TV'ye gönderildi!")
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    fun disconnect() {
        try {
            dadb?.close()
        } catch (_: Exception) {}
        dadb = null
        isConnected = false
        connectedIp = null
    }
}
