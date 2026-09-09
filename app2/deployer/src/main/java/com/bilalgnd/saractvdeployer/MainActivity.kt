package com.bilalgnd.saractvdeployer

import android.content.Context
import android.net.Uri
import android.os.Bundle
import android.widget.Toast
import androidx.activity.ComponentActivity
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import okhttp3.OkHttpClient
import okhttp3.Request
import java.io.File
import java.io.FileOutputStream
import java.net.InetSocketAddress
import java.net.Socket

class MainActivity : ComponentActivity() {

    private val adbManager = AdbManager()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            MaterialTheme(
                colorScheme = darkColorScheme(
                    background = Color(0xFF0F172A),
                    surface = Color(0xFF1E293B),
                    primary = Color(0xFF3B82F6)
                )
            ) {
                Surface(
                    modifier = Modifier.fillMaxSize(),
                    color = MaterialTheme.colorScheme.background
                ) {
                    DeployerScreen(adbManager)
                }
            }
        }
    }

    override fun onDestroy() {
        adbManager.disconnect()
        super.onDestroy()
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun DeployerScreen(adb: AdbManager) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val prefs = remember { context.getSharedPreferences("deployer_prefs", Context.MODE_PRIVATE) }

    var tvIp by remember { mutableStateOf(prefs.getString("last_tv_ip", "192.168.1.50") ?: "192.168.1.50") }
    var kasaIp by remember { mutableStateOf(prefs.getString("last_kasa_ip", "192.168.1.35") ?: "192.168.1.35") }
    var isConnected by remember { mutableStateOf(adb.isConnected) }
    var statusMessage by remember { mutableStateOf("TV IP adresini girip bağlanın") }
    var isBusy by remember { mutableStateOf(false) }

    val filePicker = rememberLauncherForActivityResult(ActivityResultContracts.GetContent()) { uri: Uri? ->
        if (uri != null) {
            scope.launch {
                isBusy = true
                statusMessage = "Yerel APK dosyası hazırlanıyor..."
                val tmpFile = File(context.cacheDir, "temp_install.apk")
                withContext(Dispatchers.IO) {
                    context.contentResolver.openInputStream(uri)?.use { input ->
                        FileOutputStream(tmpFile).use { output ->
                            input.copyTo(output)
                        }
                    }
                }
                statusMessage = "TV'ye yükleniyor..."
                val res = adb.installApk(tmpFile) { statusMessage = it }
                isBusy = false
                res.onSuccess {
                    statusMessage = "🎉 Kurulum başarılı!"
                    Toast.makeText(context, "Uygulama TV'ye başarıyla kuruldu!", Toast.LENGTH_LONG).show()
                }.onFailure { err ->
                    statusMessage = "❌ Kurulum Hatası: ${err.message}"
                }
            }
        }
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(16.dp),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        // Header
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Column {
                Text("Saraç TV Yöneticisi", fontSize = 22.sp, fontWeight = FontWeight.Bold, color = Color.White)
                Text("Kablosuz ADB Kurulum & Komuta", fontSize = 13.sp, color = Color(0xFF94A3B8))
            }

            AssistChip(
                onClick = {},
                label = { Text(if (isConnected) "Bağlı" else "Bağlantı Yok", fontSize = 12.sp) },
                leadingIcon = {
                    Box(
                        modifier = Modifier
                            .size(8.dp)
                            .background(
                                if (isConnected) Color(0xFF22C55E) else Color(0xFFEF4444),
                                shape = RoundedCornerShape(4.dp)
                            )
                    )
                },
                colors = AssistChipDefaults.assistChipColors(
                    containerColor = Color(0xFF1E293B),
                    labelColor = Color.White
                )
            )
        }

        Spacer(Modifier.height(16.dp))

        // Status Card
        Card(
            modifier = Modifier.fillMaxWidth(),
            colors = CardDefaults.cardColors(containerColor = Color(0xFF1E293B)),
            shape = RoundedCornerShape(12.dp)
        ) {
            Row(
                modifier = Modifier.padding(14.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                if (isBusy) {
                    CircularProgressIndicator(modifier = Modifier.size(20.dp), color = Color(0xFF38BDF8), strokeWidth = 2.dp)
                    Spacer(Modifier.width(12.dp))
                }
                Text(statusMessage, color = Color(0xFFE2E8F0), fontSize = 13.sp)
            }
        }

        Spacer(Modifier.height(16.dp))

        // Card 1: Connection
        Card(
            modifier = Modifier.fillMaxWidth(),
            colors = CardDefaults.cardColors(containerColor = Color(0xFF1E293B)),
            shape = RoundedCornerShape(12.dp)
        ) {
            Column(modifier = Modifier.padding(16.dp)) {
                Text("1. TV BAĞLANTISI (ADB)", color = Color(0xFF38BDF8), fontSize = 13.sp, fontWeight = FontWeight.Bold)
                Spacer(Modifier.height(12.dp))

                OutlinedTextField(
                    value = tvIp,
                    onValueChange = { tvIp = it },
                    label = { Text("TV IP Adresi") },
                    placeholder = { Text("Örn: 192.168.1.50") },
                    singleLine = true,
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Uri),
                    modifier = Modifier.fillMaxWidth()
                )

                Spacer(Modifier.height(12.dp))

                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    Button(
                        onClick = {
                            scope.launch {
                                isBusy = true
                                statusMessage = "TV aranıyor ($tvIp:5555)..."
                                prefs.edit().putString("last_tv_ip", tvIp).apply()
                                val res = adb.connect(tvIp.trim())
                                isBusy = false
                                isConnected = adb.isConnected
                                res.onSuccess {
                                    statusMessage = it
                                    Toast.makeText(context, "TV'ye Bağlandı!", Toast.LENGTH_SHORT).show()
                                }.onFailure { err ->
                                    statusMessage = "Bağlantı Başarısız: ${err.message}"
                                }
                            }
                        },
                        modifier = Modifier.weight(1f),
                        enabled = !isBusy,
                        colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF2563EB))
                    ) {
                        Icon(Icons.Default.Wifi, contentDescription = null, modifier = Modifier.size(18.dp))
                        Spacer(Modifier.width(6.dp))
                        Text(if (isConnected) "Yeniden Bağlan" else "TV'ye Bağlan")
                    }

                    OutlinedButton(
                        onClick = {
                            scope.launch {
                                isBusy = true
                                statusMessage = "Ağdaki Android TV'ler taranıyor..."
                                val found = scanSubnetForAdb(tvIp)
                                isBusy = false
                                if (found != null) {
                                    tvIp = found
                                    prefs.edit().putString("last_tv_ip", found).apply()
                                    statusMessage = "TV bulundu: $found"
                                } else {
                                    statusMessage = "Ağda port 5555 açık TV bulunamadı."
                                }
                            }
                        },
                        enabled = !isBusy
                    ) {
                        Icon(Icons.Default.Search, contentDescription = null, modifier = Modifier.size(18.dp))
                        Spacer(Modifier.width(4.dp))
                        Text("Tara")
                    }
                }
            }
        }

        Spacer(Modifier.height(16.dp))

        // Card 2: Install
        Card(
            modifier = Modifier.fillMaxWidth(),
            colors = CardDefaults.cardColors(containerColor = Color(0xFF1E293B)),
            shape = RoundedCornerShape(12.dp)
        ) {
            Column(modifier = Modifier.padding(16.dp)) {
                Text("2. TV UYGULAMASINI YÜKLE", color = Color(0xFF38BDF8), fontSize = 13.sp, fontWeight = FontWeight.Bold)
                Spacer(Modifier.height(12.dp))

                Button(
                    onClick = {
                        scope.launch {
                            isBusy = true
                            statusMessage = "Gömülü TV APK hazırlanıyor..."
                            val apkFile = extractBundledTvApk(context)
                            if (apkFile != null) {
                                statusMessage = "TV'ye kablosuz yükleniyor..."
                                val res = adb.installApk(apkFile) { statusMessage = it }
                                res.onSuccess {
                                    statusMessage = "🎉 TV Uygulaması Başarıyla Kuruldu!"
                                    adb.launchTvApp()
                                    Toast.makeText(context, "Kuruldu ve TV'de Başlatıldı!", Toast.LENGTH_LONG).show()
                                }.onFailure { err ->
                                    statusMessage = "Yükleme Hatası: ${err.message}"
                                }
                            } else {
                                statusMessage = "Gömülü APK bulunamadı. Lütfen canlıdan indirmeyi deneyin."
                            }
                            isBusy = false
                        }
                    },
                    modifier = Modifier.fillMaxWidth(),
                    enabled = isConnected && !isBusy,
                    colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF2563EB))
                ) {
                    Icon(Icons.Default.Bolt, contentDescription = null, modifier = Modifier.size(20.dp))
                    Spacer(Modifier.width(8.dp))
                    Text("Gömülü TV Uygulamasını Kur (İnternetsiz / En Hızlı)", fontWeight = FontWeight.Bold)
                }

                Spacer(Modifier.height(8.dp))

                Button(
                    onClick = {
                        scope.launch {
                            isBusy = true
                            statusMessage = "Buluttan en son TV APK indiriliyor..."
                            val apkFile = downloadLatestTvApk(context) { statusMessage = it }
                            if (apkFile != null) {
                                statusMessage = "TV'ye kablosuz yükleniyor..."
                                val res = adb.installApk(apkFile) { statusMessage = it }
                                res.onSuccess {
                                    statusMessage = "🎉 TV Uygulaması Başarıyla Kuruldu!"
                                    adb.launchTvApp()
                                    Toast.makeText(context, "Kuruldu ve TV'de Başlatıldı!", Toast.LENGTH_LONG).show()
                                }.onFailure { err ->
                                    statusMessage = "Yükleme Hatası: ${err.message}"
                                }
                            } else {
                                statusMessage = "APK indirilemedi. Lütfen 'Yerel APK Seç' butonunu kullanın."
                            }
                            isBusy = false
                        }
                    },
                    modifier = Modifier.fillMaxWidth(),
                    enabled = isConnected && !isBusy,
                    colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF059669))
                ) {
                    Icon(Icons.Default.CloudDownload, contentDescription = null, modifier = Modifier.size(20.dp))
                    Spacer(Modifier.width(8.dp))
                    Text("Canlıdan İndir & TV'ye Kur", fontWeight = FontWeight.Bold)
                }

                Spacer(Modifier.height(8.dp))

                OutlinedButton(
                    onClick = { filePicker.launch("application/vnd.android.package-archive") },
                    modifier = Modifier.fillMaxWidth(),
                    enabled = isConnected && !isBusy
                ) {
                    Icon(Icons.Default.FolderOpen, contentDescription = null, modifier = Modifier.size(18.dp))
                    Spacer(Modifier.width(8.dp))
                    Text("Telefondaki APK Dosyasını Seçip Kur")
                }
            }
        }

        Spacer(Modifier.height(16.dp))

        // Card 3: Remote Controls
        Card(
            modifier = Modifier.fillMaxWidth(),
            colors = CardDefaults.cardColors(containerColor = Color(0xFF1E293B)),
            shape = RoundedCornerShape(12.dp)
        ) {
            Column(modifier = Modifier.padding(16.dp)) {
                Text("3. TV UZAKTAN KONTROL", color = Color(0xFF38BDF8), fontSize = 13.sp, fontWeight = FontWeight.Bold)
                Spacer(Modifier.height(12.dp))

                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    Button(
                        onClick = {
                            scope.launch {
                                val res = adb.launchTvApp()
                                res.onSuccess { Toast.makeText(context, "TV Uygulaması Açıldı", Toast.LENGTH_SHORT).show() }
                            }
                        },
                        modifier = Modifier.weight(1f),
                        enabled = isConnected && !isBusy,
                        colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF475569))
                    ) {
                        Icon(Icons.Default.PlayArrow, contentDescription = null, modifier = Modifier.size(18.dp))
                        Spacer(Modifier.width(4.dp))
                        Text("TV'de Başlat")
                    }

                    Button(
                        onClick = {
                            scope.launch {
                                val res = adb.restartTvApp()
                                res.onSuccess { Toast.makeText(context, "Yeniden Başlatıldı", Toast.LENGTH_SHORT).show() }
                            }
                        },
                        modifier = Modifier.weight(1f),
                        enabled = isConnected && !isBusy,
                        colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF475569))
                    ) {
                        Icon(Icons.Default.Refresh, contentDescription = null, modifier = Modifier.size(18.dp))
                        Spacer(Modifier.width(4.dp))
                        Text("Yenile")
                    }
                }

                Spacer(Modifier.height(12.dp))

                OutlinedTextField(
                    value = kasaIp,
                    onValueChange = { kasaIp = it },
                    label = { Text("Kasa Yerel IP Adresi (Offline için)") },
                    placeholder = { Text("192.168.1.35") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth()
                )

                Spacer(Modifier.height(8.dp))

                OutlinedButton(
                    onClick = {
                        scope.launch {
                            prefs.edit().putString("last_kasa_ip", kasaIp).apply()
                            val res = adb.setKasaIp(kasaIp.trim())
                            res.onSuccess {
                                Toast.makeText(context, "Kasa IP TV'ye iletildi", Toast.LENGTH_SHORT).show()
                            }.onFailure { err ->
                                Toast.makeText(context, "Hata: ${err.message}", Toast.LENGTH_SHORT).show()
                            }
                        }
                    },
                    modifier = Modifier.fillMaxWidth(),
                    enabled = isConnected && !isBusy
                ) {
                    Icon(Icons.Default.Send, contentDescription = null, modifier = Modifier.size(18.dp))
                    Spacer(Modifier.width(8.dp))
                    Text("Kasa IP'sini TV'ye Gönder")
                }
            }
        }
    }
}

suspend fun scanSubnetForAdb(currentIp: String): String? = withContext(Dispatchers.IO) {
    val prefix = if (currentIp.contains(".")) {
        currentIp.substring(0, currentIp.lastIndexOf(".") + 1)
    } else "192.168.1."

    val priorityList = listOf(50, 100, 35, 10, 20, 25, 40, 60, 75, 80, 90, 150)
    for (last in priorityList) {
        val target = "$prefix$last"
        try {
            Socket().use { s ->
                s.connect(InetSocketAddress(target, 5555), 300)
                return@withContext target
            }
        } catch (_: Exception) {}
    }
    null
}

suspend fun downloadLatestTvApk(context: Context, onProgress: (String) -> Unit): File? = withContext(Dispatchers.IO) {
    try {
        val url = "https://bilalgnd.shop/tv.apk"
        onProgress("Sunucuya bağlanılıyor: $url")
        val client = OkHttpClient()
        val req = Request.Builder().url(url).build()
        val resp = client.newCall(req).execute()
        if (!resp.isSuccessful) {
            return@withContext null
        }
        val file = File(context.cacheDir, "SaracApp-TV-latest.apk")
        resp.body?.byteStream()?.use { input ->
            FileOutputStream(file).use { output ->
                input.copyTo(output)
            }
        }
        file
    } catch (_: Exception) {
        null
    }
}

suspend fun extractBundledTvApk(context: Context): File? = withContext(Dispatchers.IO) {
    try {
        val file = File(context.cacheDir, "SaracApp-TV-bundled.apk")
        context.assets.open("tv.apk").use { input ->
            FileOutputStream(file).use { output ->
                input.copyTo(output)
            }
        }
        file
    } catch (_: Exception) {
        null
    }
}
