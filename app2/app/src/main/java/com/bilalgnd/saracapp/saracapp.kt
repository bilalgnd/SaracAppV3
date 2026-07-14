package com.bilalgnd.saracapp

import android.content.Context
import android.content.Intent
import android.net.Uri
import org.json.JSONObject
import android.os.Bundle
import android.widget.Toast
import androidx.activity.ComponentActivity
import androidx.activity.compose.BackHandler
import androidx.activity.compose.setContent
import androidx.compose.animation.animateColorAsState
import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.gestures.detectHorizontalDragGestures
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.pager.HorizontalPager
import androidx.compose.foundation.pager.rememberPagerState
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.material3.TabRowDefaults.tabIndicatorOffset
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.scale
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.Font
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.google.gson.Gson
import com.google.gson.annotations.SerializedName
import com.google.gson.reflect.TypeToken
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import okhttp3.*
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory
import retrofit2.http.Body
import retrofit2.http.POST
import java.text.SimpleDateFormat
import java.util.Date
import androidx.compose.ui.hapticfeedback.HapticFeedbackType
import androidx.compose.ui.platform.LocalHapticFeedback
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.layout.systemBarsPadding
import androidx.compose.foundation.combinedClickable
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.layout.offset
import java.util.Locale
import androidx.compose.foundation.border
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ContentCopy
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material.icons.filled.Assessment
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material.icons.filled.NoteAlt
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Print
import androidx.compose.material.icons.filled.DoneAll
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.KeyboardArrowUp
import androidx.compose.material.icons.filled.List
import androidx.compose.material.icons.filled.Info
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.input.nestedscroll.NestedScrollConnection
import androidx.compose.ui.input.nestedscroll.NestedScrollSource
import androidx.compose.ui.input.nestedscroll.nestedScroll

data class Secenek(@SerializedName("portion") val gramaj: String, @SerializedName("price") val fiyat: Int)
data class Urun(
    @SerializedName("name") val ad: String,
    @SerializedName("options") val secenekler: List<Secenek>? = emptyList(),
    @SerializedName("color") val color: String? = null,
    @SerializedName("textColor") val textColor: String? = null
)

data class SiparisKalemi(
    @SerializedName("name") val urunAd: String,
    @SerializedName("portion") val detay: String,
    @SerializedName("price") val fiyat: Int,
    @SerializedName("notes") val notlar: String
)

data class Adisyon(
    @SerializedName("customer_name") val musteriAdi: String,
    @SerializedName("time") val saat: String,
    @SerializedName("items") val kalemler: List<SiparisKalemi>,
    @SerializedName("total_amount") val toplamTutar: Int,
    @SerializedName("status") val durum: String = "Bekliyor",
    @SerializedName("order_note") val siparisNotu: String? = null,
    @SerializedName("color") val renk: String? = null
)

data class Kategori(
    @SerializedName("id") val id: String,
    @SerializedName("name") val name: String,
    @SerializedName("items") val items: List<Urun>
)

data class UrunSatis(
    @SerializedName("ad") val ad: String?,
    @SerializedName("satis") val satis: Int?
)
data class IptalBilgisi(
    @SerializedName("adet") val adet: Int?,
    @SerializedName("fireOrani") val fireOrani: Int?
)
data class DailyReportResponse(
    @SerializedName("bugunkuCiro") val bugunkuCiro: Double?,
    @SerializedName("haftalikCiro") val haftalikCiro: Double?,
    @SerializedName("bugunkuSiparis") val bugunkuSiparis: Int?,
    @SerializedName("haftalikSiparis") val haftalikSiparis: Int?,
    @SerializedName("favoriDoner") val favoriDoner: UrunSatis?,
    @SerializedName("favoriUrun") val favoriUrun: UrunSatis?,
    @SerializedName("bugunkuIptaller") val bugunkuIptaller: IptalBilgisi?,
    @SerializedName("ortalamaSepetTutari") val ortalamaSepetTutari: Double?,
    @SerializedName("bugunSatilanEtKg") val bugunSatilanEtKg: String?,
    @SerializedName("bugunSatilanTavukKg") val bugunSatilanTavukKg: String?,
    @SerializedName("availableDates") val availableDates: List<String>?,
    @SerializedName("isSpecificDate") val isSpecificDate: Boolean?
)

data class MenuResponse(
    @SerializedName("categories") val categories: List<Kategori>? = emptyList(),
    @SerializedName("extras") val ekstralar: Map<String, Int>? = emptyMap()
)

data class TvLinkResponse(
    @SerializedName("tvLink") val tvLink: String
)

data class BossTokenResponse(
    @SerializedName("token") val token: String
)

data class SystemLog(
    @SerializedName("time") val time: String,
    @SerializedName("source") val source: String,
    @SerializedName("type") val type: String,
    @SerializedName("message") val message: String
)

data class LoginResponse(
    @SerializedName("success") val success: Boolean,
    @SerializedName("token") val token: String?,
    @SerializedName("error") val error: String?
)

interface KasaApi {
    @retrofit2.http.POST("set_tv_screensaver")
    suspend fun setTvScreensaver(@retrofit2.http.Body request: Map<String, String>): retrofit2.Response<Void>

    @retrofit2.http.GET("api/daily_report")
    suspend fun gunlukRaporGetir(@retrofit2.http.Query("date") date: String? = null): retrofit2.Response<DailyReportResponse>

    @retrofit2.http.POST("api/clear_data")
    suspend fun verileriSifirla(): retrofit2.Response<Void>

    @retrofit2.http.POST("api/clean_logs")
    suspend fun cleanLogs(): retrofit2.Response<Void>

    @retrofit2.http.POST("api/register_fcm_token")
    suspend fun fcmTokenKaydet(@retrofit2.http.Body request: Map<String, String>): retrofit2.Response<Void>

    @retrofit2.http.GET("api/logs")
    suspend fun loglariGetir(): retrofit2.Response<List<SystemLog>>

    @retrofit2.http.GET("api/boss-token")
    suspend fun bossTokenGetir(@retrofit2.http.Header("x-boss-secret") secret: String): retrofit2.Response<BossTokenResponse>

    @retrofit2.http.GET("menu")
    suspend fun menuGetir(): retrofit2.Response<MenuResponse>

    @retrofit2.http.GET("tv_link")
    suspend fun tvLinkGetir(): retrofit2.Response<TvLinkResponse>

    @retrofit2.http.POST("restart_tunnel")
    suspend fun tüneliYenidenBaşlat(): retrofit2.Response<TvLinkResponse>

    @retrofit2.http.POST("siparis")
    suspend fun siparisGonder(@retrofit2.http.Body adisyon: Adisyon): retrofit2.Response<Void>

    @POST("close_bill")
    suspend fun hesapKapat(@Body request: Map<String, String>): retrofit2.Response<Void>

    @POST("yazdir")
    suspend fun yazdir(@Body request: Map<String, String>): retrofit2.Response<Void>
    @POST("update_status")
    suspend fun guncelleDurum(@Body request: Map<String, String>): retrofit2.Response<Void>

    @POST("update_table_name")
    suspend fun guncelleMasaIsmi(@Body request: Map<String, String>): retrofit2.Response<Void>

    @POST("panic")
    suspend fun tetiklePanik(@Body request: Map<String, String>): retrofit2.Response<Void>

    @retrofit2.http.GET("active_devices")
    suspend fun aktifCihazlariGetir(): retrofit2.Response<ActiveDevicesResponse>

    @POST("api/login")
    suspend fun login(@Body request: Map<String, String>): retrofit2.Response<LoginResponse>

    @POST("api/logs")
    suspend fun sendLog(@Body request: Map<String, String>): retrofit2.Response<Void>
}

object ApiClient {
    private var retrofit: Retrofit? = null
    fun getApi(ip: String, token: String = ""): KasaApi {
        val temizIp = ip.trim().ifEmpty { "bilalgnd.shop" }
        val baseUrl = if (temizIp.startsWith("http")) {
            if (!temizIp.endsWith("/")) "$temizIp/" else temizIp
        } else {
            "https://$temizIp/"
        }

        var r = retrofit
        if (r == null || r.baseUrl().toString() != baseUrl) {
            val client = OkHttpClient.Builder().addInterceptor { chain ->
                val requestBuilder = chain.request().newBuilder()
                if (token.isNotBlank()) {
                    requestBuilder.addHeader("Authorization", "Bearer $token")
                }
                chain.proceed(requestBuilder.build())
            }.build()

            r = try {
                Retrofit.Builder().baseUrl(baseUrl).client(client).addConverterFactory(GsonConverterFactory.create()).build()
            } catch (e: Exception) {
                null
            }
            retrofit = r
        }
        return retrofit!!.create(KasaApi::class.java)
    }
}

data class ActiveDevicesResponse(@SerializedName("devices") val devices: List<String>)
var isBossModeUnlocked = false

fun sendLogToServer(context: Context, type: String, message: String) {
    CoroutineScope(Dispatchers.IO).launch {
        try {
            val hY = HafizaYoneticisi(context)
            val token = hY.kasaTokenOku()
            if (token.isNotEmpty()) {
                val api = ApiClient.getApi("bilalgnd.shop", token)
                api.sendLog(mapOf("source" to "App2", "type" to type, "message" to message))
            }
        } catch (e: Exception) {}
    }
}

class HafizaYoneticisi(context: Context) {
    private val defter = context.getSharedPreferences("SaracogluDefteri", Context.MODE_PRIVATE)
    private val gson = Gson()

    fun kasaIpKaydet(ip: String) {
        val finalIp = if (ip.isNotBlank() && !ip.contains(":") && !ip.contains(".shop") && !ip.contains(".com") && !ip.startsWith("http")) "$ip:5000" else ip
        defter.edit().putString("KASA_IP", finalIp).apply()
    }
    fun kasaIpOku(): String = defter.getString("KASA_IP", "") ?: ""

    fun fcmTokenOku(): String = defter.getString("FCM_TOKEN", "") ?: ""

    fun garsonRengiKaydet(renk: String) = defter.edit().putString("GARSON_RENGI", renk).apply()
    fun garsonRengiOku(): String = defter.getString("GARSON_RENGI", "#FFFFFF") ?: "#FFFFFF"

    fun kasaTokenKaydet(token: String) = defter.edit().putString("KASA_TOKEN", token).apply()
    fun kasaTokenOku(): String = defter.getString("KASA_TOKEN", "") ?: ""

    fun kasaKullaniciAdiKaydet(kullaniciAdi: String) = defter.edit().putString("KASA_KULLANICI_ADI", kullaniciAdi).apply()
    fun kasaKullaniciAdiOku(): String = defter.getString("KASA_KULLANICI_ADI", "") ?: ""

    fun kasaSifreKaydet(sifre: String) = defter.edit().putString("KASA_SIFRE", sifre).apply()
    fun kasaSifreOku(): String = defter.getString("KASA_SIFRE", "") ?: ""

    fun cihazIdOku(): String {
        var id = defter.getString("DEVICE_ID", "")
        if (id.isNullOrBlank()) {
            val randomString = java.util.UUID.randomUUID().toString().substring(0, 6).uppercase(java.util.Locale.getDefault())
            id = "MOB-$randomString"
            defter.edit().putString("DEVICE_ID", id).apply()
        }
        return id!!
    }

    fun cevrimdisiSiparisEkle(adisyon: Adisyon) {
        val liste = cevrimdisiSiparisleriGetir().toMutableList()
        liste.add(adisyon)
        defter.edit().putString("OFFLINE_QUEUE", gson.toJson(liste)).apply()
    }
    fun cevrimdisiSiparisleriGetir(): List<Adisyon> {
        val json = defter.getString("OFFLINE_QUEUE", "[]")
        return gson.fromJson(json, object : TypeToken<List<Adisyon>>() {}.type) ?: emptyList()
    }
    fun cevrimdisiSiparisTemizle() = defter.edit().remove("OFFLINE_QUEUE").apply()

    fun aktifMasalariKaydet(liste: List<Adisyon>) = defter.edit().putString("AKTIF_MASALAR", gson.toJson(liste)).apply()
    fun aktifMasalariGetir(): List<Adisyon> {
        val json = defter.getString("AKTIF_MASALAR", "[]")
        return gson.fromJson(json, object : TypeToken<List<Adisyon>>() {}.type) ?: emptyList()
    }
}

@Composable
fun LoginScreen(hafiza: HafizaYoneticisi, onLoginSuccess: () -> Unit) {
    var ipGirdisi by remember { mutableStateOf(hafiza.kasaIpOku()) }
    var kullaniciAdi by remember { mutableStateOf(hafiza.kasaKullaniciAdiOku()) }
    var sifre by remember { mutableStateOf(hafiza.kasaSifreOku()) }
    var girisYapiliyor by remember { mutableStateOf(false) }
    val context = LocalContext.current

    Box(modifier = Modifier.fillMaxSize().background(Color(0xFF0F0F0F)), contentAlignment = Alignment.Center) {
        Column(
            modifier = Modifier.fillMaxWidth(0.85f).background(Color(0xFF1E1E1E), androidx.compose.foundation.shape.RoundedCornerShape(24.dp)).border(1.dp, Color(0x33FFFFFF), androidx.compose.foundation.shape.RoundedCornerShape(24.dp)).padding(24.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Text("SARACAPP", color = Color.White, fontSize = 28.sp, fontWeight = FontWeight.Bold, letterSpacing = 2.sp)
            Text("Sisteme Giriş Yapın", color = Color.Gray, fontSize = 14.sp)
            Spacer(Modifier.height(32.dp))
            OutlinedTextField(
                value = ipGirdisi, onValueChange = { ipGirdisi = it },
                label = { Text("Sunucu IP (örn: bilalgnd.shop)", color = Color.Gray) },
                textStyle = androidx.compose.ui.text.TextStyle(color = Color.White, fontSize = 16.sp),
                singleLine = true, modifier = Modifier.fillMaxWidth()
            )
            Spacer(Modifier.height(16.dp))
            OutlinedTextField(
                value = kullaniciAdi, onValueChange = { kullaniciAdi = it },
                label = { Text("Kullanıcı Adı", color = Color.Gray) },
                textStyle = androidx.compose.ui.text.TextStyle(color = Color.White, fontSize = 16.sp),
                singleLine = true, modifier = Modifier.fillMaxWidth()
            )
            Spacer(Modifier.height(16.dp))
            OutlinedTextField(
                value = sifre, onValueChange = { sifre = it },
                label = { Text("Şifre", color = Color.Gray) },
                textStyle = androidx.compose.ui.text.TextStyle(color = Color.White, fontSize = 16.sp),
                singleLine = true, visualTransformation = androidx.compose.ui.text.input.PasswordVisualTransformation(), keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password), modifier = Modifier.fillMaxWidth()
            )
            Spacer(Modifier.height(32.dp))
            Button(
                onClick = {
                    if (girisYapiliyor) return@Button
                    girisYapiliyor = true
                    CoroutineScope(Dispatchers.IO).launch {
                        try {
                            val api = ApiClient.getApi(ipGirdisi.trim(), "")
                            val res = api.login(mapOf("username" to kullaniciAdi.trim(), "password" to sifre))
                            withContext(Dispatchers.Main) {
                                girisYapiliyor = false
                                if (res.isSuccessful && res.body()?.success == true) {
                                    val token = res.body()?.token ?: ""
                                    hafiza.kasaIpKaydet(ipGirdisi.trim())
                                    hafiza.kasaKullaniciAdiKaydet(kullaniciAdi.trim())
                                    hafiza.kasaSifreKaydet(sifre)
                                    hafiza.kasaTokenKaydet(token)
                                    Toast.makeText(context, "Giriş Başarılı!", Toast.LENGTH_SHORT).show()
                                    onLoginSuccess()
                                } else {
                                    Toast.makeText(context, "Hatalı giriş: ${res.body()?.error ?: "Bilinmeyen hata"}", Toast.LENGTH_LONG).show()
                                }
                            }
                        } catch (e: Exception) {
                            withContext(Dispatchers.Main) {
                                girisYapiliyor = false
                                Toast.makeText(context, "Bağlantı Hatası: ${e.message}", Toast.LENGTH_LONG).show()
                            }
                        }
                    }
                },
                colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF4CAF50)),
                modifier = Modifier.fillMaxWidth().height(50.dp)
            ) {
                if (girisYapiliyor) CircularProgressIndicator(color = Color.White, modifier = Modifier.size(24.dp), strokeWidth = 2.dp)
                else Text("Giriş Yap", color = Color.White, fontSize = 16.sp, fontWeight = FontWeight.Bold)
            }
        }
    }
}

val malzemeler_listesi = listOf("Soğan", "Domates", "Patates", "Ketçap", "Mayonez", "Turşu")
val ucretsiz_ekstra_listesi = listOf("Karışık", "Acılı", "Sade", "Soslu", "Gemi", "Kayık")
val odeme_listesi = listOf("POS", "NAKİT", "Paket")

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.TIRAMISU) {
            if (androidx.core.content.ContextCompat.checkSelfPermission(this, android.Manifest.permission.POST_NOTIFICATIONS) != android.content.pm.PackageManager.PERMISSION_GRANTED) {
                requestPermissions(arrayOf(android.Manifest.permission.POST_NOTIFICATIONS), 101)
            }
        }

        com.google.firebase.messaging.FirebaseMessaging.getInstance().token.addOnCompleteListener { task ->
            if (task.isSuccessful) {
                val token = task.result
                android.util.Log.d("FCM", "FCM Token: $token")
                val defter = getSharedPreferences("SaracogluDefteri", android.content.Context.MODE_PRIVATE)
                defter.edit().putString("FCM_TOKEN", token).apply()
            }
        }

        enableEdgeToEdge()
        setContent {
            MaterialTheme(colorScheme = darkColorScheme(background = Color(0xFF0F0F0F), surface = Color(0xFF1E1E1E), primary = Color(0xFFF54E4E), onPrimary = Color.White)) {
                Surface(modifier = Modifier.fillMaxSize(), color = MaterialTheme.colorScheme.background) { AnaEkran() }
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class, ExperimentalFoundationApi::class)
@Composable
fun AnaEkran() {
    val context = LocalContext.current
    val haptic = LocalHapticFeedback.current
    val hafiza = remember { HafizaYoneticisi(context) }
    var gelismisAyarlarAcik by remember { mutableStateOf(false) }
    val coroutineScope = rememberCoroutineScope()

    var isLoggedIn by remember { mutableStateOf(hafiza.kasaTokenOku().isNotBlank()) }

    if (!isLoggedIn) {
        LoginScreen(hafiza, onLoginSuccess = { isLoggedIn = true })
        return
    }

    var kategoriler by remember { mutableStateOf<List<Kategori>>(emptyList()) }
    var icecekMenusu by remember { mutableStateOf<List<Urun>>(emptyList()) }
    var ucretliEkstralar by remember { mutableStateOf<Map<String, Int>>(emptyMap()) }

    var siparisIcinAcilanUrun by remember { mutableStateOf<Urun?>(null) }
    var notDuzenlenecekKalem by remember { mutableStateOf<Pair<Adisyon, SiparisKalemi>?>(null) }

    val aktifSiparisler = remember { mutableStateListOf<Adisyon>().apply { addAll(hafiza.aktifMasalariGetir()) } }
    var siparisEkraniAcik by remember { mutableStateOf(false) }
    var raporEkraniAcik by remember { mutableStateOf(false) }
    var aktifMasaAdi by remember { mutableStateOf<String?>(null) }
    var yeniSiparisOlusturmaNotu by remember { mutableStateOf("") }
    val taslakKalemler = remember { mutableStateListOf<SiparisKalemi>() }
    var duzenlenenAdisyonIsmi by remember { mutableStateOf<String?>(null) }
    var guncellemeUrl by remember { mutableStateOf<String?>(null) }

    var kasaAyarPenceresiAcik by remember { mutableStateOf(false) }
    var sistemLoglariPenceresiAcik by remember { mutableStateOf(false) }
    var remoteTerminalAcik by remember { mutableStateOf(false) }
    var remoteFileManagerAcik by remember { mutableStateOf(false) }


    val sekmeler = kategoriler.map { it.name.uppercase(Locale.getDefault()) }
    val menuler_listesi = kategoriler.map { it.items }
    val pagerState = rememberPagerState(pageCount = { sekmeler.size.coerceAtLeast(1) })
    var kasaOnline by remember { mutableStateOf(false) }

    LaunchedEffect(isLoggedIn) {
        if (!isLoggedIn) return@LaunchedEffect
        val client = OkHttpClient()
        var activeWebSocket: WebSocket? = null

        while (true) {
            val ip = hafiza.kasaIpOku().trim()
            if (ip.isNotBlank()) {
                try {
                    val api = ApiClient.getApi(ip, hafiza.kasaTokenOku())
                    val menuRes = api.menuGetir()
                    if (menuRes.isSuccessful && menuRes.body() != null) {
                        val body = menuRes.body()!!
                        kategoriler = body.categories ?: emptyList()
                        ucretliEkstralar = body.ekstralar ?: emptyMap()
                        val drinksCat = kategoriler.find { it.name.contains("içecek", ignoreCase = true) || it.name.contains("icecek", ignoreCase = true) }
                        icecekMenusu = drinksCat?.items ?: emptyList()
                    }
                    
                    val tokenVar = hafiza.fcmTokenOku()
                    android.util.Log.e("API", "TokenVar is: $tokenVar")
                    if (tokenVar.isNotBlank()) {
                        try { 
                            val res = api.fcmTokenKaydet(mapOf("token" to tokenVar))
                            android.util.Log.e("API", "fcmTokenKaydet response: ${res.isSuccessful}")
                        } catch (e: Exception) {
                            android.util.Log.e("API", "fcmTokenKaydet ERROR: ${e.message}")
                        }
                    }
                } catch (e: Exception) { }

                val bekleyenler = hafiza.cevrimdisiSiparisleriGetir()
                if (bekleyenler.isNotEmpty() && kasaOnline) {
                    try {
                        val api = ApiClient.getApi(ip, hafiza.kasaTokenOku())
                        bekleyenler.forEach { api.siparisGonder(it) }
                        hafiza.cevrimdisiSiparisTemizle()
                        withContext(Dispatchers.Main) { Toast.makeText(context, "✅ Bekleyen Siparişler Gitti!", Toast.LENGTH_SHORT).show() }
                    } catch (e: Exception) { }
                }

                if (activeWebSocket == null) {
                    val tokenParam = hafiza.kasaTokenOku()
                    val devId = hafiza.cihazIdOku()
                    val wsUrl = if (ip.startsWith("https://")) {
                        ip.replace("https://", "wss://") + (if (ip.endsWith("/")) "ws?token=$tokenParam&deviceId=$devId" else "/ws?token=$tokenParam&deviceId=$devId")
                    } else if (ip.startsWith("http://")) {
                        ip.replace("http://", "ws://") + (if (ip.endsWith("/")) "ws?token=$tokenParam&deviceId=$devId" else "/ws?token=$tokenParam&deviceId=$devId")
                    } else if (ip.contains("bilalgnd.shop")) {
                        "wss://$ip/ws?token=$tokenParam&deviceId=$devId"
                    } else {
                        "ws://$ip/ws?token=$tokenParam&deviceId=$devId"
                    }
                    val request = Request.Builder().url(wsUrl).build()
                    activeWebSocket = client.newWebSocket(request, object : WebSocketListener() {
                        override fun onOpen(webSocket: WebSocket, response: Response) { 
                            kasaOnline = true
                            sendLogToServer(context, "success", "WebSocket bağlantısı kuruldu.")
                        }
                        override fun onMessage(webSocket: WebSocket, text: String) {
                            try {
                                if (text.trim().startsWith("{")) {
                                    val jsonObj = JSONObject(text)
                                    if (jsonObj.has("type") && jsonObj.getString("type") == "apk_guncelleme") {
                                        guncellemeUrl = jsonObj.getString("url")
                                    }
                                } else {
                                    val gelenListe: List<Adisyon> = Gson().fromJson(text, object : TypeToken<List<Adisyon>>() {}.type)
                                    CoroutineScope(Dispatchers.Main).launch {
                                        aktifSiparisler.clear(); aktifSiparisler.addAll(gelenListe); hafiza.aktifMasalariKaydet(gelenListe)
                                        if (duzenlenenAdisyonIsmi != null && gelenListe.none { it.musteriAdi == duzenlenenAdisyonIsmi }) {
                                            if (aktifMasaAdi == duzenlenenAdisyonIsmi) aktifMasaAdi = null
                                            duzenlenenAdisyonIsmi = null
                                            taslakKalemler.clear()
                                        }
                                    }
                                }
                            } catch (e: Exception) {}
                        }
                        override fun onClosed(webSocket: WebSocket, code: Int, reason: String) { 
                            if (kasaOnline) sendLogToServer(context, "warning", "WebSocket bağlantısı kopyu.")
                            kasaOnline = false; activeWebSocket = null 
                        }
                        override fun onFailure(webSocket: WebSocket, t: Throwable, response: Response?) { 
                            if (kasaOnline) sendLogToServer(context, "error", "WebSocket bağlantı hatası.")
                            kasaOnline = false; activeWebSocket = null 
                        }
                    })
                } else { activeWebSocket?.send("ping") }
            }
            delay(3000)
        }
    }

    BackHandler(enabled = siparisEkraniAcik || raporEkraniAcik || aktifMasaAdi != null) {
        if (aktifMasaAdi != null) { aktifMasaAdi = null; taslakKalemler.clear(); duzenlenenAdisyonIsmi = null }
        else if (raporEkraniAcik) raporEkraniAcik = false
        else if (siparisEkraniAcik) siparisEkraniAcik = false
    }

    Scaffold(
        containerColor = Color.Black,
        topBar = {
            TopAppBar(
                title = {
                    Column {
                        if (aktifMasaAdi != null) Text("$aktifMasaAdi İlave", color = Color.White, fontWeight = FontWeight.Bold, fontSize = 24.sp)
                        else if (siparisEkraniAcik) Text("Açık Masalar", color = Color.White, fontWeight = FontWeight.Bold, fontSize = 24.sp)
                        else if (raporEkraniAcik) Text("Günlük Rapor", color = Color.White, fontWeight = FontWeight.Bold, fontSize = 24.sp)
                        else {
                            val hapticFeedback = LocalHapticFeedback.current
                            val universityRomanBold = FontFamily(Font(R.font.university_roman_bold))
                            Text("SARAÇOGLU DÖNER", fontFamily = universityRomanBold, color = Color.White, fontSize = 26.sp, letterSpacing = 1.sp, modifier = Modifier.pointerInput(Unit) {
                                detectTapGestures(
                                    onLongPress = {
                                        hapticFeedback.performHapticFeedback(HapticFeedbackType.LongPress)
                                    },
                                    onDoubleTap = {
                                        if (isBossModeUnlocked) {
                                            hapticFeedback.performHapticFeedback(HapticFeedbackType.LongPress)
                                            coroutineScope.launch {
                                                try {
                                                    val api = ApiClient.getApi(hafiza.kasaIpOku(), "")
                                                    val tokenRsp = api.bossTokenGetir("saracoglu_boss_2026")
                                                    
                                                    if (tokenRsp.isSuccessful && tokenRsp.body() != null) {
                                                        val newToken = tokenRsp.body()!!.token
                                                        hafiza.kasaTokenKaydet(newToken)
                                                        
                                                        withContext(Dispatchers.Main) {
                                                            Toast.makeText(context, "Boss Login 🔑", Toast.LENGTH_SHORT).show()
                                                        }
                                                        
                                                        val rsp = ApiClient.getApi(hafiza.kasaIpOku(), newToken).menuGetir()
                                                        if (rsp.isSuccessful) {
                                                            kasaOnline = true
                                                            val v = rsp.body()
                                                            if (v?.categories != null) {
                                                                kategoriler = v.categories
                                                            }
                                                            if (v?.ekstralar != null) ucretliEkstralar = v.ekstralar
                                                        }
                                                    } else {
                                                        withContext(Dispatchers.Main) {
                                                            Toast.makeText(context, "Boss Login Başarısız!", Toast.LENGTH_SHORT).show()
                                                        }
                                                    }
                                                } catch (e: Exception) {
                                                    withContext(Dispatchers.Main) {
                                                        Toast.makeText(context, "Ağ Hatası: Kasa bulunamadı", Toast.LENGTH_SHORT).show()
                                                    }
                                                }
                                            }
                                        }
                                    }
                                )
                            })
                        }
                        if (aktifMasaAdi == null && !siparisEkraniAcik && !raporEkraniAcik) {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                if (kasaOnline) Text("🟢 Kasa Bağlı", color = Color(0xFF4CAF50), fontSize = 14.sp)
                                else Text("🔴 Kasa Çevrimdışı", color = Color(0xFFF44336), fontSize = 14.sp)
                                val beklemeSayisi = hafiza.cevrimdisiSiparisleriGetir().size
                                if (beklemeSayisi > 0) Text(" • ⏳ $beklemeSayisi Bekleyen", color = Color.Yellow, fontSize = 14.sp)
                            }
                        }
                    }
                },
                navigationIcon = { if (siparisEkraniAcik || raporEkraniAcik) TextButton(onClick = { siparisEkraniAcik = false; raporEkraniAcik = false }) { Text("< Geri", color = Color.White, fontSize = 20.sp, fontWeight = FontWeight.Bold) } },
                actions = {
                    if (aktifMasaAdi == null && !siparisEkraniAcik && !raporEkraniAcik) {
                        androidx.compose.material3.IconButton(onClick = { raporEkraniAcik = true }) {
                            androidx.compose.material3.Icon(Icons.Default.Assessment, contentDescription = "Rapor", tint = Color.White)
                        }
                        Box(
                                modifier = Modifier
                                    .padding(8.dp)
                                    .size(48.dp)
                                    .pointerInput(Unit) {
                                        detectTapGestures(
                                            onTap = {
                                                kasaAyarPenceresiAcik = true
                                                gelismisAyarlarAcik = false
                                            },
                                            onLongPress = {
                                                kasaAyarPenceresiAcik = true
                                                gelismisAyarlarAcik = true
                                                Toast.makeText(context, "Gelişmiş Mod Aktif (TopBar)", Toast.LENGTH_SHORT).show()
                                            }
                                        )
                                    },
                                contentAlignment = Alignment.Center
                            ) {
                                androidx.compose.material3.Icon(Icons.Default.Settings, contentDescription = "Ayarlar", tint = Color.White)
                            }
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = if (aktifMasaAdi != null) Color(0xFF00C853) else Color.Black)
            )
        },
        bottomBar = {
            if (aktifMasaAdi != null) {
                Surface(
                    color = Color.Black,
                    shadowElevation = 24.dp,
                    shape = androidx.compose.foundation.shape.RoundedCornerShape(topStart = 20.dp, topEnd = 20.dp)
                ) {
                    Column(modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 12.dp)) {
                        OutlinedTextField(
                            value = yeniSiparisOlusturmaNotu,
                            onValueChange = { yeniSiparisOlusturmaNotu = it },
                            placeholder = { Text("Sipariş notu...", color = Color.Gray, fontSize = 14.sp) },
                            singleLine = true,
                            shape = androidx.compose.foundation.shape.RoundedCornerShape(10.dp),
                            colors = androidx.compose.material3.OutlinedTextFieldDefaults.colors(
                                focusedBorderColor = Color(0xFF00C853),
                                unfocusedBorderColor = Color(0xFF333333),
                                focusedContainerColor = Color(0xFF1E1E1E),
                                unfocusedContainerColor = Color(0xFF1E1E1E)
                            ),
                            textStyle = TextStyle(color = Color.White, fontSize = 14.sp),
                            modifier = Modifier.fillMaxWidth().padding(bottom = 12.dp),
                            leadingIcon = { androidx.compose.material3.Icon(Icons.Default.NoteAlt, contentDescription = null, tint = Color.Gray, modifier = Modifier.size(20.dp)) }
                        )
                        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                            Column(modifier = Modifier.weight(1f).padding(end = 8.dp)) {
                                Text("MASA: ${aktifMasaAdi?.uppercase() ?: ""}", color = Color.Gray, fontWeight = FontWeight.Bold, fontSize = 12.sp, maxLines = 1, overflow = TextOverflow.Ellipsis, letterSpacing = 0.5.sp)
                                Spacer(modifier = Modifier.height(2.dp))
                                Row(verticalAlignment = Alignment.CenterVertically) {
                                    Text(
                                        text = "${taslakKalemler.sumOf { it.fiyat }} ₺",
                                        color = Color.White,
                                        fontSize = 22.sp,
                                        fontWeight = FontWeight.Black
                                    )
                                    Spacer(modifier = Modifier.width(6.dp))
                                    Text(
                                        text = "(${taslakKalemler.size} Ürün)",
                                        color = Color(0xFF00C853),
                                        fontSize = 13.sp,
                                        fontWeight = FontWeight.Bold
                                    )
                                }
                            }
                            
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                androidx.compose.material3.IconButton(
                                    onClick = { aktifMasaAdi = null; taslakKalemler.clear(); duzenlenenAdisyonIsmi = null; yeniSiparisOlusturmaNotu = "" },
                                    modifier = Modifier.size(48.dp).background(Color(0xFF1F1F1F), androidx.compose.foundation.shape.CircleShape)
                                ) {
                                    androidx.compose.material3.Icon(Icons.Default.Close, contentDescription = "İptal", tint = Color(0xFFFF5252), modifier = Modifier.size(22.dp))
                                }
                                Spacer(modifier = Modifier.width(10.dp))
                                Button(
                                    onClick = {
                                        if (taslakKalemler.isNotEmpty()) {
                                            val adisyon = Adisyon(aktifMasaAdi!!, SimpleDateFormat("HH:mm", Locale.getDefault()).format(Date()), taslakKalemler.toList(), taslakKalemler.sumOf { it.fiyat }, siparisNotu = yeniSiparisOlusturmaNotu, renk = hafiza.garsonRengiOku())
                                            CoroutineScope(Dispatchers.IO).launch {
                                                try {
                                                    if (!kasaOnline) throw Exception("Offline")
                                                    if (ApiClient.getApi(hafiza.kasaIpOku(), hafiza.kasaTokenOku()).siparisGonder(adisyon).isSuccessful) {
                                                        sendLogToServer(context, "success", "Sipariş başarıyla gönderildi: ${adisyon.musteriAdi}")
                                                        withContext(Dispatchers.Main) { Toast.makeText(context, "✅ Kasaya Gitti!", Toast.LENGTH_SHORT).show() }
                                                    } else throw Exception("HTTP Sunucu Hatası")
                                                } catch (e: Exception) {
                                                    hafiza.cevrimdisiSiparisEkle(adisyon)
                                                    withContext(Dispatchers.Main) {
                                                        Toast.makeText(context, "Kasa Çevrimdışı! Hata: ${e.message}", Toast.LENGTH_LONG).show()
                                                        val idx = aktifSiparisler.indexOfFirst { it.musteriAdi == duzenlenenAdisyonIsmi }
                                                        if (idx != -1) aktifSiparisler[idx] = adisyon else aktifSiparisler.add(adisyon)
                                                        hafiza.aktifMasalariKaydet(aktifSiparisler)
                                                    }
                                                }
                                            }
                                        }
                                        aktifMasaAdi = null; taslakKalemler.clear(); duzenlenenAdisyonIsmi = null; yeniSiparisOlusturmaNotu = ""
                                    },
                                    colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF00C853)),
                                    shape = androidx.compose.foundation.shape.RoundedCornerShape(14.dp),
                                    contentPadding = PaddingValues(horizontal = 22.dp, vertical = 0.dp),
                                    modifier = Modifier.height(48.dp),
                                    elevation = ButtonDefaults.buttonElevation(defaultElevation = 0.dp)
                                ) {
                                    Text(if (kasaOnline) "Gönder" else "Kaydet", color = Color.White, fontWeight = FontWeight.Bold, fontSize = 16.sp)
                                }
                            }
                        }
                    }
                }
            }
        },
        floatingActionButton = {
            if (!siparisEkraniAcik && !raporEkraniAcik && aktifSiparisler.isNotEmpty() && aktifMasaAdi == null) {
                ExtendedFloatingActionButton(onClick = { siparisEkraniAcik = true }, containerColor = Color(0xFFD84315), contentColor = Color.White) { Text("Masalar (${aktifSiparisler.size})", fontWeight = FontWeight.Bold, fontSize = 20.sp) }
            }
        }
    ) { paddingValues ->
        Box(modifier = Modifier.padding(paddingValues)) {
            if (false) {
            } else if (remoteFileManagerAcik) {
                RemoteFileManagerScreen(onBack = { remoteFileManagerAcik = false })
            } else if (remoteTerminalAcik) {
                RemoteTerminalScreen(onBack = { remoteTerminalAcik = false })
            } else if (raporEkraniAcik) {
                RaporEkrani(hafiza)
            } else if (!siparisEkraniAcik) {
                Column(modifier = Modifier.fillMaxSize()) {
                    if (sekmeler.isNotEmpty()) {
                        if (sekmeler.size <= 4) {
                            TabRow(
                                selectedTabIndex = pagerState.currentPage, containerColor = Color(0xFF0F0F0F), contentColor = Color.White,
                                indicator = { tabPositions ->
                                    if (pagerState.currentPage < tabPositions.size) {
                                        TabRowDefaults.Indicator(Modifier.tabIndicatorOffset(tabPositions[pagerState.currentPage]), color = Color(0xFFF54E4E), height = 4.dp)
                                    }
                                }
                            ) {
                                sekmeler.forEachIndexed { index, sekme ->
                                    Tab(selected = pagerState.currentPage == index, onClick = { coroutineScope.launch { pagerState.animateScrollToPage(index) } },
                                        text = { Text(sekme, fontSize = 14.sp, fontWeight = if (pagerState.currentPage == index) FontWeight.Bold else FontWeight.Medium, color = if (pagerState.currentPage == index) Color(0xFFF54E4E) else Color.LightGray, textAlign = TextAlign.Center, maxLines = 1, overflow = TextOverflow.Ellipsis) })
                                }
                            }
                        } else {
                            ScrollableTabRow(
                                selectedTabIndex = pagerState.currentPage, containerColor = Color(0xFF0F0F0F), contentColor = Color.White,
                                edgePadding = 0.dp,
                                indicator = { tabPositions ->
                                    if (pagerState.currentPage < tabPositions.size) {
                                        TabRowDefaults.Indicator(Modifier.tabIndicatorOffset(tabPositions[pagerState.currentPage]), color = Color(0xFFF54E4E), height = 4.dp)
                                    }
                                }
                            ) {
                                sekmeler.forEachIndexed { index, sekme ->
                                    Tab(selected = pagerState.currentPage == index, onClick = { coroutineScope.launch { pagerState.animateScrollToPage(index) } },
                                        text = { Text(sekme, fontSize = 14.sp, fontWeight = if (pagerState.currentPage == index) FontWeight.Bold else FontWeight.Medium, color = if (pagerState.currentPage == index) Color(0xFFF54E4E) else Color.LightGray, textAlign = TextAlign.Center, maxLines = 1, overflow = TextOverflow.Ellipsis) })
                                }
                            }
                        }
                    }

                    if (kategoriler.isEmpty()) {
                        Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                            CircularProgressIndicator(color = Color(0xFFF54E4E))
                        }
                    } else {
                        HorizontalPager(state = pagerState, modifier = Modifier.fillMaxSize()) { sayfaIndexi ->
                            if (sayfaIndexi >= 0 && sayfaIndexi < menuler_listesi.size) {
                                LazyVerticalGrid(columns = GridCells.Fixed(2), verticalArrangement = Arrangement.spacedBy(16.dp), horizontalArrangement = Arrangement.spacedBy(16.dp), contentPadding = PaddingValues(start = 16.dp, end = 16.dp, top = 16.dp, bottom = 100.dp)) {
                                    items(menuler_listesi[sayfaIndexi]) { urun -> UrunKarti(urun, onClick = { siparisIcinAcilanUrun = urun }, onLongClick = { }) }
                                }
                            }
                        }
                    }
                }
            }

            if (siparisEkraniAcik) {
                LazyColumn(verticalArrangement = Arrangement.spacedBy(16.dp), contentPadding = PaddingValues(16.dp)) {
                    items(aktifSiparisler) { adisyon ->
                        var isMasaIsmiDialogAcik by remember { mutableStateOf(false) }
                        var isSiparisNotuDialogAcik by remember { mutableStateOf(false) }
                        var yeniMasaIsmi by remember { mutableStateOf(adisyon.musteriAdi) }
                        var yeniSiparisNotu by remember { mutableStateOf(adisyon.siparisNotu ?: "") }

                        if (isMasaIsmiDialogAcik) {
                            AlertDialog(
                                onDismissRequest = { isMasaIsmiDialogAcik = false },
                                title = { Text("Masa İsmini Düzenle", color = Color.White) },
                                text = { OutlinedTextField(value = yeniMasaIsmi, onValueChange = { yeniMasaIsmi = it }, singleLine = true, textStyle = TextStyle(color = Color.White)) },
                                confirmButton = { IconButton(onClick = {
                                    if (kasaOnline && yeniMasaIsmi.isNotBlank() && yeniMasaIsmi != adisyon.musteriAdi) {
                                        CoroutineScope(Dispatchers.IO).launch {
                                            try { ApiClient.getApi(hafiza.kasaIpOku(), hafiza.kasaTokenOku()).guncelleMasaIsmi(mapOf("old_name" to adisyon.musteriAdi, "new_name" to yeniMasaIsmi)) } catch (e: Exception) {}
                                        }
                                        val orderIndex = aktifSiparisler.indexOfFirst { it.musteriAdi == adisyon.musteriAdi }
                                        if (orderIndex != -1) {
                                            aktifSiparisler[orderIndex] = aktifSiparisler[orderIndex].copy(musteriAdi = yeniMasaIsmi)
                                            hafiza.aktifMasalariKaydet(aktifSiparisler)
                                        }
                                    }
                                    isMasaIsmiDialogAcik = false
                                }) { androidx.compose.material3.Icon(Icons.Default.Check, contentDescription = null, tint = Color(0xFF4CAF50)) } },
                                dismissButton = { IconButton(onClick = { isMasaIsmiDialogAcik = false }) { androidx.compose.material3.Icon(Icons.Default.Close, contentDescription = null, tint = Color.Red) } },
                                containerColor = Color(0xFF242424)
                            )
                        }

                        if (isSiparisNotuDialogAcik) {
                            AlertDialog(
                                onDismissRequest = { isSiparisNotuDialogAcik = false },
                                title = { Text("Sipariş Notunu Düzenle", color = Color.White) },
                                text = { OutlinedTextField(value = yeniSiparisNotu, onValueChange = { yeniSiparisNotu = it }, textStyle = TextStyle(color = Color.White)) },
                                confirmButton = { IconButton(onClick = {
                                    val orderIndex = aktifSiparisler.indexOfFirst { it.musteriAdi == adisyon.musteriAdi }
                                    if (orderIndex != -1) {
                                        aktifSiparisler[orderIndex] = aktifSiparisler[orderIndex].copy(siparisNotu = yeniSiparisNotu)
                                        hafiza.aktifMasalariKaydet(aktifSiparisler)
                                        if (kasaOnline) {
                                            CoroutineScope(Dispatchers.IO).launch {
                                                try { ApiClient.getApi(hafiza.kasaIpOku(), hafiza.kasaTokenOku()).siparisGonder(aktifSiparisler[orderIndex]) } catch (e: Exception) {}
                                            }
                                        }
                                    }
                                    isSiparisNotuDialogAcik = false
                                }) { androidx.compose.material3.Icon(Icons.Default.Check, contentDescription = null, tint = Color(0xFF4CAF50)) } },
                                dismissButton = { IconButton(onClick = { isSiparisNotuDialogAcik = false }) { androidx.compose.material3.Icon(Icons.Default.Close, contentDescription = null, tint = Color.Red) } },
                                containerColor = Color(0xFF242424)
                            )
                        }

                        AdisyonKarti(
                            adisyon = adisyon,
                            hazirlandiClick = {
                                val yeniDurum = if (adisyon.durum == "prepared") "waiting" else "prepared"
                                val index = aktifSiparisler.indexOfFirst { it.musteriAdi == adisyon.musteriAdi }
                                if (index != -1) {
                                    aktifSiparisler[index] = aktifSiparisler[index].copy(durum = yeniDurum)
                                }
                                if (kasaOnline) {
                                    CoroutineScope(Dispatchers.IO).launch {
                                        try {
                                            ApiClient.getApi(hafiza.kasaIpOku(), hafiza.kasaTokenOku()).guncelleDurum(mapOf("customer_name" to adisyon.musteriAdi, "status" to yeniDurum))
                                        } catch (e: Exception) {}
                                    }
                                }
                            },
                            tamamlandiClick = {
                                aktifSiparisler.removeAll { it.musteriAdi == adisyon.musteriAdi }; hafiza.aktifMasalariKaydet(aktifSiparisler)
                                if (aktifMasaAdi == adisyon.musteriAdi) {
                                    aktifMasaAdi = null
                                    taslakKalemler.clear()
                                    duzenlenenAdisyonIsmi = null
                                }
                                CoroutineScope(Dispatchers.IO).launch { try { ApiClient.getApi(hafiza.kasaIpOku(), hafiza.kasaTokenOku()).hesapKapat(mapOf("customer_name" to adisyon.musteriAdi)) } catch (e: Exception) {} }
                            },
                            kalemSilClick = { silinmekIstenenKalem ->
                                val orderIndex = aktifSiparisler.indexOfFirst { it.musteriAdi == adisyon.musteriAdi }
                                if (orderIndex != -1) {
                                    val yeniKalemler = aktifSiparisler[orderIndex].kalemler.toMutableList()
                                    yeniKalemler.remove(silinmekIstenenKalem)

                                    if (yeniKalemler.isEmpty()) {
                                        aktifSiparisler.removeAt(orderIndex)
                                        hafiza.aktifMasalariKaydet(aktifSiparisler)
                                        if (aktifMasaAdi == adisyon.musteriAdi) {
                                            aktifMasaAdi = null
                                            taslakKalemler.clear()
                                            duzenlenenAdisyonIsmi = null
                                        }
                                        if (kasaOnline) CoroutineScope(Dispatchers.IO).launch { try { ApiClient.getApi(hafiza.kasaIpOku(), hafiza.kasaTokenOku()).hesapKapat(mapOf("customer_name" to adisyon.musteriAdi)) } catch (e: Exception) {} }
                                    } else {
                                        aktifSiparisler[orderIndex] = aktifSiparisler[orderIndex].copy(kalemler = yeniKalemler, toplamTutar = yeniKalemler.sumOf { it.fiyat })
                                        hafiza.aktifMasalariKaydet(aktifSiparisler)
                                        if (kasaOnline) CoroutineScope(Dispatchers.IO).launch { try { ApiClient.getApi(hafiza.kasaIpOku(), hafiza.kasaTokenOku()).siparisGonder(aktifSiparisler[orderIndex]) } catch (e: Exception) {} }
                                    }
                                }
                            },
                            ilaveClick = { aktifMasaAdi = adisyon.musteriAdi; taslakKalemler.clear(); taslakKalemler.addAll(adisyon.kalemler.map { it.copy(notlar = it.notlar.replace("[YENİ]", "").trim()) }); duzenlenenAdisyonIsmi = adisyon.musteriAdi; siparisEkraniAcik = false },
                            notDuzenleClick = { kalem -> notDuzenlenecekKalem = Pair(adisyon, kalem) },
                            yazdirClick = {
                                if (kasaOnline) CoroutineScope(Dispatchers.IO).launch { try { ApiClient.getApi(hafiza.kasaIpOku(), hafiza.kasaTokenOku()).yazdir(mapOf("customer_name" to adisyon.musteriAdi)) } catch (e: Exception) {} }
                                else Toast.makeText(context, "Kasa çevrimdışı!", Toast.LENGTH_LONG).show()
                            },
                            yolaCiktiClick = {
                                if (kasaOnline) CoroutineScope(Dispatchers.IO).launch { try { ApiClient.getApi(hafiza.kasaIpOku(), hafiza.kasaTokenOku()).guncelleDurum(mapOf("customer_name" to adisyon.musteriAdi, "status" to "yola_cikti")) } catch (e: Exception) {} }
                                else Toast.makeText(context, "Kasa çevrimdışı!", Toast.LENGTH_LONG).show()
                            },
                            masaIsmiDuzenleClick = { isMasaIsmiDialogAcik = true; yeniMasaIsmi = adisyon.musteriAdi },
                            siparisNotuDuzenleClick = { isSiparisNotuDialogAcik = true; yeniSiparisNotu = adisyon.siparisNotu ?: "" }
                        )
                    }
                }
            }
        }
        if (!kasaOnline && !kasaAyarPenceresiAcik) {
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .background(Color(0xEE000000))
                    .pointerInput(Unit) { detectTapGestures { } },
                contentAlignment = Alignment.Center
            ) {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    CircularProgressIndicator(color = Color(0xFFF54E4E), strokeWidth = 4.dp, modifier = Modifier.size(64.dp))
                    Spacer(modifier = Modifier.height(16.dp))
                    Text(
                        text = "Sunucu Bekleniyor...",
                        color = Color.White,
                        fontSize = 20.sp,
                        fontWeight = FontWeight.Bold
                    )
                    Spacer(modifier = Modifier.height(24.dp))
                    OutlinedButton(
                          onClick = { 
                              kasaAyarPenceresiAcik = true
                              gelismisAyarlarAcik = false
                          },
                          colors = ButtonDefaults.outlinedButtonColors(contentColor = Color.White),
                          border = androidx.compose.foundation.BorderStroke(1.dp, Color.White)
                      ) {
                          androidx.compose.material3.Icon(Icons.Default.Settings, contentDescription = "Ayarlar")
                          Spacer(modifier = Modifier.width(8.dp))
                          Text("Bağlantı Ayarları")
                      }
                }
            }
        }

        if (notDuzenlenecekKalem != null) {
            val (adisyon, kalem) = notDuzenlenecekKalem!!
            var yeniNot by remember { mutableStateOf(kalem.notlar) }
            AlertDialog(
                onDismissRequest = { notDuzenlenecekKalem = null }, containerColor = Color(0xFF242424),
                title = { Text("Not Düzenle", color = Color.White, fontSize = 22.sp, fontWeight = FontWeight.Bold) },
                text = { OutlinedTextField(value = yeniNot, onValueChange = { yeniNot = it }, label = { Text("Örn: Çok pişsin") }, modifier = Modifier.fillMaxWidth(), textStyle = androidx.compose.ui.text.TextStyle(fontSize = 15.sp)) },
                confirmButton = {
                    Button(onClick = {
                        val adisyonIndex = aktifSiparisler.indexOfFirst { it.musteriAdi == adisyon.musteriAdi }
                        if (adisyonIndex != -1) {
                            val yeniKalemler = aktifSiparisler[adisyonIndex].kalemler.toMutableList()
                            val kalemIndex = yeniKalemler.indexOf(kalem)
                            if (kalemIndex != -1) {
                                yeniKalemler[kalemIndex] = yeniKalemler[kalemIndex].copy(notlar = yeniNot.trim())
                                aktifSiparisler[adisyonIndex] = aktifSiparisler[adisyonIndex].copy(kalemler = yeniKalemler)
                                hafiza.aktifMasalariKaydet(aktifSiparisler)
                                if(kasaOnline) CoroutineScope(Dispatchers.IO).launch { try { ApiClient.getApi(hafiza.kasaIpOku(), hafiza.kasaTokenOku()).siparisGonder(aktifSiparisler[adisyonIndex]) } catch (e: Exception) {} }
                            }
                        }
                        notDuzenlenecekKalem = null
                    }) { Text("Kaydet", fontSize = 15.sp) }
                },
                dismissButton = { TextButton(onClick = { notDuzenlenecekKalem = null }) { Text("İptal", fontSize = 15.sp, color = Color.LightGray) } }
            )
        }

        if (guncellemeUrl != null) {
            AlertDialog(
                onDismissRequest = { },
                containerColor = Color(0xFF242424),
                title = { Text("📢 Yeni Güncelleme!", color = Color.White, fontSize = 22.sp, fontWeight = FontWeight.Bold) },
                text = { Text("Kasa tarafından yeni bir Android sürümü yayınlandı. İndirip kurmak ister misiniz?", color = Color.LightGray, fontSize = 15.sp) },
                confirmButton = {
                    Button(onClick = {
                        val i = Intent(Intent.ACTION_VIEW, Uri.parse(guncellemeUrl))
                        context.startActivity(i)
                        guncellemeUrl = null
                    }, colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF4CAF50))) {
                        Text("İndir", fontSize = 15.sp, color = Color.White, fontWeight = FontWeight.Bold)
                    }
                },
                dismissButton = {
                    TextButton(onClick = { guncellemeUrl = null }) {
                        Text("Daha Sonra", fontSize = 15.sp, color = Color.Gray)
                    }
                }
            )
        }

        if (sistemLoglariPenceresiAcik) {
            SistemLoglariDialog(hafiza) { sistemLoglariPenceresiAcik = false }
        }

        if (kasaAyarPenceresiAcik) {

            var ipGirdisi by remember { mutableStateOf(hafiza.kasaIpOku()) }
            var renkGirdisi by remember { mutableStateOf(hafiza.garsonRengiOku()) }
            var panicSifrePenceresiAcik by remember { mutableStateOf(false) }
            var panicSifreGirdisi by remember { mutableStateOf("") }
            var aktifCihazlarListesi by remember { mutableStateOf<List<String>>(emptyList()) }
            var seciliCihazId by remember { mutableStateOf("") }
            val clipboardManager = androidx.compose.ui.platform.LocalClipboardManager.current
            
            var panicTaps by remember { mutableStateOf(0) }
            val ayarlarHaptic = LocalHapticFeedback.current
            LaunchedEffect(panicTaps) {
                if (panicTaps > 0) {
                    delay(500)
                    panicTaps = 0
                }
            }
            androidx.compose.ui.window.Dialog(
                onDismissRequest = { kasaAyarPenceresiAcik = false },
                properties = androidx.compose.ui.window.DialogProperties(usePlatformDefaultWidth = false)
            ) {
                Box(
                    modifier = Modifier
                        .fillMaxWidth(0.9f)
                        .background(Color(0x80111111), androidx.compose.foundation.shape.RoundedCornerShape(28.dp))
                        .border(1.5.dp, androidx.compose.ui.graphics.Brush.linearGradient(listOf(Color(0x55FFFFFF), Color(0x11FFFFFF))), androidx.compose.foundation.shape.RoundedCornerShape(28.dp))
                        .padding(24.dp)
                ) {
                    Column {
                        Text("⚙️ Ayarlar", color = Color.White, fontSize = 22.sp, fontWeight = FontWeight.Bold)
                        Spacer(Modifier.height(16.dp))
                        
                        var selectedTab by remember { mutableIntStateOf(if (gelismisAyarlarAcik) 2 else 0) }
                        val tabs = if (gelismisAyarlarAcik) listOf("Genel", "Sistem", "Gelişmiş") else listOf("Genel", "Sistem")
                        val prefs = context.getSharedPreferences("SaracogluDefteri", Context.MODE_PRIVATE)
                        
                        androidx.compose.material3.TabRow(
                            selectedTabIndex = selectedTab,
                            containerColor = Color.Transparent,
                            contentColor = Color.White,
                            indicator = { tabPositions ->
                                if (selectedTab < tabPositions.size) {
                                    androidx.compose.material3.TabRowDefaults.Indicator(
                                        Modifier.tabIndicatorOffset(tabPositions[selectedTab]),
                                        color = Color(0xFF4CAF50)
                                    )
                                }
                            }
                        ) {
                            tabs.forEachIndexed { index, title ->
                                androidx.compose.material3.Tab(
                                    selected = selectedTab == index,
                                    onClick = { selectedTab = index },
                                    text = { Text(title, fontWeight = FontWeight.Bold, color = if (selectedTab == index) Color(0xFF4CAF50) else Color.Gray) }
                                )
                            }
                        }
                        
                        Spacer(Modifier.height(16.dp))
                        Column(modifier = Modifier.weight(1f, fill = false).verticalScroll(rememberScrollState())) {
                            
                            if (selectedTab == 0) { // Genel Ayarlar
                                val hapticFeedback = androidx.compose.ui.platform.LocalHapticFeedback.current
                                var accumulatedDrag by remember { mutableFloatStateOf(0f) }
                                
                                OutlinedTextField(
                                    value = ipGirdisi, 
                                    onValueChange = { ipGirdisi = it }, 
                                    label = { Text("Kasa IP", color = Color.Gray) }, 
                                    textStyle = androidx.compose.ui.text.TextStyle(color = Color.White, fontSize = 15.sp), 
                                    singleLine = true, 
                                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Uri),
                                    modifier = Modifier.fillMaxWidth().pointerInput(Unit) {
                                        detectHorizontalDragGestures(
                                            onHorizontalDrag = { _, dragAmount ->
                                                accumulatedDrag += dragAmount
                                                if (Math.abs(accumulatedDrag) > 20f) {
                                                    val step = if (accumulatedDrag > 0) 1 else -1
                                                    accumulatedDrag = 0f
                                                    val match = Regex("(.*\\\\.)(\\\\d+)(:.*)?").find(ipGirdisi)
                                                    if (match != null) {
                                                        val prefix = match.groupValues[1]
                                                        val currentNum = match.groupValues[2].toIntOrNull() ?: 1
                                                        val suffix = match.groupValues[3]
                                                        var newNum = currentNum + step
                                                        if (newNum < 1) newNum = 1
                                                        if (newNum > 999) newNum = 999
                                                        if (newNum != currentNum) {
                                                            ipGirdisi = "$prefix$newNum$suffix"
                                                            hapticFeedback.performHapticFeedback(HapticFeedbackType.TextHandleMove)
                                                        }
                                                    }
                                                }
                                            }
                                        )
                                    }
                                )
                                Spacer(Modifier.height(16.dp))
                                Text("Geçerli Hesap: ${hafiza.kasaKullaniciAdiOku()}", color = Color.White, fontSize = 16.sp, fontWeight = FontWeight.Bold)
                                Spacer(Modifier.height(16.dp))
                                
                                Button(
                                    onClick = {
                                        hafiza.kasaTokenKaydet("")
                                        hafiza.kasaKullaniciAdiKaydet("")
                                        hafiza.kasaSifreKaydet("")
                                        isLoggedIn = false
                                        kasaAyarPenceresiAcik = false
                                    },
                                    colors = ButtonDefaults.buttonColors(containerColor = Color(0xFFE53935)),
                                    modifier = Modifier.fillMaxWidth()
                                ) {
                                    Text("Çıkış Yap", color = Color.White)
                                }
                                
                                Spacer(Modifier.height(24.dp))
                                Text("TV EKRAN KORUYUCU", color = Color(0xFFAAAAAA), fontSize = 12.sp, fontWeight = FontWeight.Bold, letterSpacing = 1.sp)
                                var selectedScreensaver by remember { mutableStateOf("dvd") }
                                @OptIn(ExperimentalLayoutApi::class)
                                FlowRow(modifier = Modifier.padding(top = 12.dp).fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                                    listOf("dvd" to "DVD Modu", "spotify" to "Spotify Modu", "glow" to "Glow Modu", "off" to "Off (Kapalı)").forEach { (mode, label) ->
                                        val isSelected = selectedScreensaver == mode
                                        Box(
                                            modifier = Modifier
                                                .background(if (isSelected) Color(0x334CAF50) else Color(0x1AFFFFFF), androidx.compose.foundation.shape.RoundedCornerShape(12.dp))
                                                .border(1.dp, if (isSelected) Color(0xFF4CAF50) else Color(0x1AFFFFFF), androidx.compose.foundation.shape.RoundedCornerShape(12.dp))
                                                .clip(androidx.compose.foundation.shape.RoundedCornerShape(12.dp))
                                                .clickable { 
                                                    selectedScreensaver = mode
                                                    CoroutineScope(Dispatchers.IO).launch {
                                                        try {
                                                            ApiClient.getApi(hafiza.kasaIpOku(), hafiza.kasaTokenOku()).setTvScreensaver(mapOf("mode" to mode))
                                                        } catch (e: Exception) {}
                                                    }
                                                }
                                                .padding(horizontal = 16.dp, vertical = 10.dp),
                                            contentAlignment = Alignment.Center
                                        ) {
                                            Text(label, color = if (isSelected) Color(0xFF4CAF50) else Color.White, fontSize = 13.sp, fontWeight = FontWeight.SemiBold)
                                        }
                                    }
                                }

                                Spacer(Modifier.height(24.dp))
                                Text("TEMA RENGİ", color = Color(0xFFAAAAAA), fontSize = 12.sp, fontWeight = FontWeight.Bold, letterSpacing = 1.sp)
                                @OptIn(ExperimentalLayoutApi::class)
                                FlowRow(modifier = Modifier.padding(top = 12.dp).fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(12.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                                    listOf("#F44336", "#9C27B0", "#2196F3", "#4CAF50", "#FFC107", "#FF9800", "#795548", "#FFFFFF", "#FF13F0", "#FF46A2", "#022658", "#780606").forEach { hex ->
                                        val isSelected = renkGirdisi == hex
                                        Box(
                                            modifier = Modifier
                                                .size(42.dp)
                                                .clip(androidx.compose.foundation.shape.RoundedCornerShape(14.dp))
                                                .background(Color(android.graphics.Color.parseColor(hex)))
                                                .border(if (isSelected) 3.dp else 0.dp, Color.White, androidx.compose.foundation.shape.RoundedCornerShape(14.dp))
                                                .pointerInput(Unit) {
                                                      detectTapGestures(
                                                          onTap = { renkGirdisi = hex },
                                                          onLongPress = {
                                                              renkGirdisi = hex
                                                              if (hex == "#795548") {
                                                                  gelismisAyarlarAcik = true
                                                                  selectedTab = 2
                                                                  Toast.makeText(context, "Gelişmiş Mod Aktif (Tema)", Toast.LENGTH_SHORT).show()
                                                              }
                                                          }
                                                      )
                                                  },
                                            contentAlignment = Alignment.Center
                                        ) {
                                            if (isSelected) {
                                                androidx.compose.material3.Icon(Icons.Default.Check, contentDescription = null, tint = if (hex == "#FFFFFF" || hex == "#FFC107") Color.Black else Color.White, modifier = Modifier.size(24.dp))
                                            }
                                        }
                                    }
                                }
                                Spacer(Modifier.height(24.dp))
                                Text("v5.3.3 | Credits: bilalgnd", color = Color.Gray, fontSize = 12.sp, modifier = Modifier.align(Alignment.CenterHorizontally))
                            }
                            else if (selectedTab == 1) { // Sistem Ayarları
                                Spacer(Modifier.height(16.dp))
                                Button(
                                    onClick = { sistemLoglariPenceresiAcik = true; kasaAyarPenceresiAcik = false },
                                    colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF005080)),
                                    modifier = Modifier.fillMaxWidth().height(55.dp)
                                ) {
                                    Text("Sistem Durumu / Loglar", color = Color.White, fontSize = 16.sp)
                                }

                                Spacer(Modifier.height(24.dp))
                                
                                Button(
                                    onClick = {
                                        CoroutineScope(Dispatchers.IO).launch {
                                            try {
                                                val api = ApiClient.getApi(hafiza.kasaIpOku(), hafiza.kasaTokenOku())
                                                val res = api.cleanLogs()
                                                withContext(Dispatchers.Main) {
                                                    if (res.isSuccessful) {
                                                        Toast.makeText(context, "Klasör temizleme isteği gönderildi", Toast.LENGTH_SHORT).show()
                                                    } else {
                                                        Toast.makeText(context, "İstek başarısız", Toast.LENGTH_SHORT).show()
                                                    }
                                                }
                                            } catch (e: Exception) {
                                                withContext(Dispatchers.Main) {
                                                    Toast.makeText(context, "Bağlantı hatası: ${e.message}", Toast.LENGTH_SHORT).show()
                                                }
                                            }
                                        }
                                    },
                                    colors = ButtonDefaults.buttonColors(containerColor = Color(0xFFE65100)),
                                    modifier = Modifier.fillMaxWidth().height(55.dp)
                                ) {
                                    Text("PDF Klasörünü Temizle", color = Color.White, fontSize = 16.sp)
                                }
                            }
                            else if (selectedTab == 2 && gelismisAyarlarAcik) { // Gelişmiş Ayarlar (Admin)
                                Spacer(Modifier.height(16.dp))
                                Text("YÖNETİCİ ARAÇLARI", color = Color(0xFFF44336), fontSize = 14.sp, fontWeight = FontWeight.Bold, letterSpacing = 1.sp)
                                Spacer(Modifier.height(16.dp))
                                
                                var adminLocalIp by remember { mutableStateOf(prefs.getString("admin_local_ip", "192.168.1.") ?: "192.168.1.") }
                                OutlinedTextField(
                                    value = adminLocalIp,
                                    onValueChange = { 
                                        adminLocalIp = it
                                        prefs.edit().putString("admin_local_ip", it).apply()
                                    },
                                    label = { Text("Log için Kasa Yerel IP (örn: 192.168.1.50)") },
                                    modifier = Modifier.fillMaxWidth(),
                                    textStyle = androidx.compose.ui.text.TextStyle(color = Color.White, fontSize = 15.sp),
                                    singleLine = true,
                                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Uri)
                                )
                                
                                Spacer(Modifier.height(24.dp))
                                
                                Button(
                                    onClick = { 
                                        kasaAyarPenceresiAcik = false
                                        remoteTerminalAcik = true
                                    },
                                    modifier = Modifier.fillMaxWidth().height(55.dp),
                                    colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF4CAF50))
                                ) {
                                    Text("Uzak Yönetim (C2 Terminal)", color = Color.White, fontWeight = FontWeight.Bold, fontSize = 16.sp)
                                }
                                
                                Spacer(Modifier.height(16.dp))
                                
                                Button(
                                    onClick = { 
                                        kasaAyarPenceresiAcik = false
                                        remoteFileManagerAcik = true
                                    },
                                    modifier = Modifier.fillMaxWidth().height(55.dp),
                                    colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF2196F3))
                                ) {
                                    Text("Uzak Dosya Yöneticisi", color = Color.White, fontWeight = FontWeight.Bold, fontSize = 16.sp)
                                }
                                
                                Spacer(Modifier.height(32.dp))
                                
                                Box(
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .height(55.dp)
                                        .background(Color(0xFF000000), shape = androidx.compose.foundation.shape.RoundedCornerShape(12.dp))
                                        .pointerInput(Unit) {
                                            detectTapGestures(
                                                onLongPress = {
                                                    panicSifrePenceresiAcik = true
                                                    aktifCihazlarListesi = emptyList()
                                                    seciliCihazId = ""
                                                    CoroutineScope(Dispatchers.IO).launch {
                                                        try {
                                                            val response = ApiClient.getApi(ipGirdisi, hafiza.kasaTokenOku()).aktifCihazlariGetir()
                                                            if (response.isSuccessful) {
                                                                val devices = response.body()?.devices ?: emptyList<String>()
                                                                withContext(Dispatchers.Main) {
                                                                    aktifCihazlarListesi = devices
                                                                    if (devices.isNotEmpty()) {
                                                                        seciliCihazId = devices.first()
                                                                    }
                                                                }
                                                            }
                                                        } catch(e: Exception){}
                                                    }
                                                }
                                            )
                                        },
                                    contentAlignment = Alignment.Center
                                ) {
                                    Text("SYS//D0WN", color = Color.White, fontWeight = FontWeight.Bold, letterSpacing = 2.sp)
                                }
                                Text("Dikkat: Sadece acil durumlarda kullanın.", color = Color.Gray, fontSize = 12.sp, modifier = Modifier.padding(top = 8.dp))
                            }
                        }
                        Spacer(Modifier.height(24.dp))
                        Row(horizontalArrangement = Arrangement.End, modifier = Modifier.fillMaxWidth()) {
                            TextButton(onClick = { kasaAyarPenceresiAcik = false }) { Text("İptal", fontSize = 15.sp, color = Color.Gray) }
                            Button(onClick = {
                                hafiza.kasaIpKaydet(ipGirdisi.trim())
                                hafiza.garsonRengiKaydet(renkGirdisi)
                                kasaAyarPenceresiAcik = false
                                Toast.makeText(context, "Ayarlar Kaydedildi", Toast.LENGTH_SHORT).show()
                            }, colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF4CAF50))) {
                                Text("Kaydet", fontSize = 15.sp, color = Color.White)
                            }
                        }
                    }
                }
            }
            if (panicSifrePenceresiAcik) {
                AlertDialog(
                    onDismissRequest = { panicSifrePenceresiAcik = false; panicSifreGirdisi = "" },
                    containerColor = Color(0xFF242424),
                    title = { Text("Güvenlik Onayı", color = Color.White, fontSize = 20.sp) },
                    text = {
                        Column {
                            OutlinedTextField(
                                value = panicSifreGirdisi,
                                onValueChange = { panicSifreGirdisi = it },
                                label = { Text("Şifre Giriniz", color = Color.Gray) },
                                textStyle = androidx.compose.ui.text.TextStyle(color = Color.White, fontSize = 15.sp),
                                singleLine = true
                            )
                            Spacer(Modifier.height(16.dp))
                            if (aktifCihazlarListesi.isNotEmpty()) {
                                Text("Hedef Cihazı Seçin:", color = Color.White, fontSize = 14.sp)
                                Spacer(Modifier.height(8.dp))
                                aktifCihazlarListesi.forEach { cihaz ->
                                    Row(
                                        verticalAlignment = Alignment.CenterVertically,
                                        modifier = Modifier.fillMaxWidth().clickable { seciliCihazId = cihaz }
                                    ) {
                                        RadioButton(
                                            selected = (seciliCihazId == cihaz),
                                            onClick = { seciliCihazId = cihaz },
                                            colors = RadioButtonDefaults.colors(selectedColor = Color.Red, unselectedColor = Color.Gray)
                                        )
                                        Text(cihaz, color = Color.White, fontSize = 14.sp)
                                    }
                                }
                            } else {
                                Text("Aktif cihaz aranıyor...", color = Color.Gray, fontSize = 12.sp)
                            }
                        }
                    },
                    confirmButton = {
                        Button(onClick = {
                            if (panicSifreGirdisi == "einstein.17") {
                                if (seciliCihazId.isEmpty()) {
                                    Toast.makeText(context, "Lütfen imha edilecek cihazı seçin!", Toast.LENGTH_SHORT).show()
                                    return@Button
                                }
                                CoroutineScope(Dispatchers.IO).launch {
                                    try {
                                        val req = mapOf("deviceId" to seciliCihazId)
                                        sendLogToServer(context, "error", "🚨 PANİK BUTONU TETİKLENDİ: İstek gönderiliyor.")
                                        ApiClient.getApi(ipGirdisi, hafiza.kasaTokenOku()).tetiklePanik(req)
                                        withContext(Dispatchers.Main) { Toast.makeText(context, "SİSTEM İMHA SİNYALİ GÖNDERİLDİ", Toast.LENGTH_LONG).show() }
                                    } catch (e: Exception) {}
                                }
                                panicSifrePenceresiAcik = false
                                panicSifreGirdisi = ""
                            } else {
                                Toast.makeText(context, "Hatalı Şifre!", Toast.LENGTH_SHORT).show()
                            }
                        }, colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF8B0000))) { Text("Onayla", color = Color.White) }
                    },
                    dismissButton = {
                        TextButton(onClick = { panicSifrePenceresiAcik = false; panicSifreGirdisi = "" }) { Text("İptal", color = Color.Gray) }
                    }
                )
            }
        }



        siparisIcinAcilanUrun?.let { urun ->
            SiparisBottomSheet(
                urun = urun, guncelMasaAdi = aktifMasaAdi, icecekMenusu = icecekMenusu, ucretliEkstralar = ucretliEkstralar, kapat = { siparisIcinAcilanUrun = null },
                onSiparisEkle = { isim, kalemler ->
                    haptic.performHapticFeedback(HapticFeedbackType.LongPress)
                    var sonIsim = isim
                    if (isim.isBlank()) {
                        sonIsim = ""
                    }
                    if (aktifMasaAdi == null) {
                        aktifMasaAdi = sonIsim
                    }
                    val eklenecekKalemler = if (duzenlenenAdisyonIsmi != null) kalemler.map { it.copy(notlar = if(it.notlar.isEmpty()) "[YENİ]" else "${it.notlar} [YENİ]") } else kalemler
                    taslakKalemler.addAll(eklenecekKalemler); siparisIcinAcilanUrun = null
                }
            )
        }
    }
}

@Composable
fun UrunKarti(urun: Urun, onClick: () -> Unit, onLongClick: () -> Unit) {
    val bgRenk = try {
        if (!urun.color.isNullOrEmpty()) Color(android.graphics.Color.parseColor(urun.color)) else Color(0xFF242424)
    } catch (e: Exception) { Color(0xFF242424) }

    val yaziRengi = try {
        if (!urun.textColor.isNullOrEmpty()) Color(android.graphics.Color.parseColor(urun.textColor)) else Color.White
    } catch (e: Exception) { Color.White }

    val fiyatRengi = yaziRengi

    Card(modifier = Modifier.fillMaxWidth().height(120.dp).pointerInput(Unit) { detectTapGestures(onTap = { onClick() }, onLongPress = { onLongClick() }) }, shape = RoundedCornerShape(16.dp), elevation = CardDefaults.cardElevation(defaultElevation = 8.dp), colors = CardDefaults.cardColors(containerColor = bgRenk)) {
        Column(modifier = Modifier.padding(12.dp).fillMaxSize(), verticalArrangement = Arrangement.Center, horizontalAlignment = Alignment.CenterHorizontally) {
            Text(text = urun.ad, fontSize = 20.sp, fontWeight = FontWeight.Bold, color = yaziRengi, textAlign = TextAlign.Center, maxLines = 2, lineHeight = 24.sp, overflow = TextOverflow.Ellipsis)
            Spacer(modifier = Modifier.height(8.dp))
            Text(text = "${(urun.secenekler?.firstOrNull()?.fiyat ?: 0)} ₺", fontSize = 15.sp, color = fiyatRengi, fontWeight = FontWeight.ExtraBold)
        }
    }
}

class UrunAyar(urun: Urun) {
    val seciliNotlar = mutableStateMapOf<String, Boolean>()
    val seciliUcretsizEkstralar = mutableStateMapOf<String, Boolean>()
    val seciliUcretliEkstralar = mutableStateMapOf<String, Boolean>()
    var siparisNotu by mutableStateOf("")
    var seciliGramaj: Secenek? by mutableStateOf((urun.secenekler ?: emptyList()).find { it.gramaj == "100gr" } ?: urun.secenekler?.firstOrNull())
}

@OptIn(ExperimentalMaterial3Api::class, ExperimentalLayoutApi::class, ExperimentalFoundationApi::class)
@Composable
fun SiparisBottomSheet(urun: Urun, guncelMasaAdi: String?, icecekMenusu: List<Urun>, ucretliEkstralar: Map<String, Int>, kapat: () -> Unit, onSiparisEkle: (String, List<SiparisKalemi>) -> Unit) {
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
    val haptic = LocalHapticFeedback.current
    var siparisNotu by remember { mutableStateOf("") }
    var musteriAdi by remember { mutableStateOf("") }
    var adet by remember { mutableIntStateOf(1) }
    val isIcecek = icecekMenusu.any { it.ad == urun.ad }

    val urunAyarlari = remember { mutableStateListOf(UrunAyar(urun)) }
    var aktifIndex by remember { mutableIntStateOf(0) }
    val aktifAyar = urunAyarlari.getOrNull(aktifIndex) ?: UrunAyar(urun)

    val seciliOdemeler = remember { mutableStateMapOf<String, Boolean>() }
    val seciliIcecekler = remember { mutableStateMapOf<String, Boolean>() }
    val icecekAdetleri = remember { mutableStateMapOf<String, Int>() }
    LaunchedEffect(urun) { icecekMenusu.forEach { icecekAdetleri[it.ad] = 1 } }

    val ekstralarFiyati = urunAyarlari.sumOf { ayar ->
        ayar.seciliUcretliEkstralar.filter { it.value }.keys.sumOf { if (it == "Cheddarlı" || it == "Kaşarlı") 70 else (ucretliEkstralar[it] ?: 0) }
    }
    val anlikBirimFiyat = urunAyarlari.sumOf { it.seciliGramaj?.fiyat ?: 0 }
    val toplamTutar = anlikBirimFiyat + ekstralarFiyati + icecekMenusu.filter { seciliIcecekler[it.ad] == true }.sumOf { ((it.secenekler?.firstOrNull()?.fiyat ?: 0) * (icecekAdetleri[it.ad] ?: 1)) }

    val nestedScrollConnection = remember {
        object : NestedScrollConnection {
            override fun onPostScroll(consumed: Offset, available: Offset, source: NestedScrollSource): Offset {
                return available.copy(x = 0f)
            }
        }
    }

    ModalBottomSheet(onDismissRequest = kapat, sheetState = sheetState, containerColor = Color(0xFF1E1E1E)) {
        Column(modifier = Modifier.fillMaxWidth().nestedScroll(nestedScrollConnection).verticalScroll(rememberScrollState()).padding(horizontal = 20.dp, vertical = 8.dp)) {
            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                Text(urun.ad, fontWeight = FontWeight.Black, color = Color.White, fontSize = 28.sp, modifier = Modifier.weight(1f))
                Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.background(Color(0xFF333333), RoundedCornerShape(12.dp)).padding(8.dp)) {
                    IconButton(onClick = {
                        if (adet > 1) {
                            adet--
                            urunAyarlari.removeLast()
                            if (aktifIndex >= adet) aktifIndex = adet - 1
                            haptic.performHapticFeedback(HapticFeedbackType.TextHandleMove)
                        }
                    }, modifier = Modifier.size(40.dp)) { Text("-", color = Color.White, fontSize = 28.sp, fontWeight = FontWeight.Bold) }
                    Text("$adet", color = Color(0xFFF54E4E), fontSize = 24.sp, fontWeight = FontWeight.ExtraBold, modifier = Modifier.padding(horizontal = 16.dp))
                    IconButton(onClick = {
                        adet++
                        urunAyarlari.add(UrunAyar(urun))
                        haptic.performHapticFeedback(HapticFeedbackType.TextHandleMove)
                    }, modifier = Modifier.size(40.dp)) { Text("+", color = Color.White, fontSize = 28.sp, fontWeight = FontWeight.Bold) }
                }
            }
            Spacer(modifier = Modifier.height(12.dp))

            if (adet > 1) {
                androidx.compose.material3.ScrollableTabRow(
                    selectedTabIndex = aktifIndex,
                    containerColor = Color.Transparent,
                    edgePadding = 0.dp,
                    indicator = { tabPositions ->
                        if (aktifIndex < tabPositions.size) {
                            androidx.compose.material3.TabRowDefaults.SecondaryIndicator(
                                Modifier.tabIndicatorOffset(tabPositions[aktifIndex]),
                                color = Color(0xFFF54E4E)
                            )
                        }
                    },
                    divider = {}
                ) {
                    (0 until adet).forEach { i ->
                        androidx.compose.material3.Tab(
                            selected = aktifIndex == i,
                            onClick = { aktifIndex = i },
                            selectedContentColor = Color(0xFFF54E4E),
                            unselectedContentColor = Color.Gray
                        ) {
                            Text("${i + 1}. Ürün", modifier = Modifier.padding(vertical = 12.dp, horizontal = 8.dp), fontWeight = FontWeight.Bold)
                        }
                    }
                }
                Spacer(modifier = Modifier.height(12.dp))
            }

            FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp), modifier = Modifier.padding(top = 4.dp)) {
                (urun.secenekler ?: emptyList()).forEach { sec -> FilterChip(selected = (aktifAyar.seciliGramaj == sec), onClick = { aktifAyar.seciliGramaj = sec }, label = { Text(if(sec?.gramaj == "Standart") "${sec?.fiyat} ₺" else "${sec?.gramaj} (${sec?.fiyat}₺)", fontSize = 13.sp, fontWeight = FontWeight.Bold) }, colors = FilterChipDefaults.filterChipColors(selectedContainerColor = Color(0xFF4CAF50), selectedLabelColor = Color.White)) }
            }
            Spacer(modifier = Modifier.height(8.dp))

            if (!isIcecek) {

                Column(verticalArrangement = Arrangement.spacedBy(3.dp), modifier = Modifier.padding(top = 4.dp)) {
                    val zityon = mapOf("Soğansız" to "Soğanlı", "Soğanlı" to "Soğansız", "Domatessiz" to "Domatesli", "Domatesli" to "Domatessiz", "Patatessiz" to "Patatesli", "Patatesli" to "Patatessiz", "Ketçapsız" to "Ketçaplı", "Ketçaplı" to "Ketçapsız", "Mayonezsiz" to "Mayonezli", "Mayonezli" to "Mayonezsiz", "Turşusuz" to "Turşulu", "Turşulu" to "Turşusuz")
                    val cikar = listOf("Soğansız", "Domatessiz", "Patatessiz", "Ketçapsız", "Mayonezsiz", "Turşusuz")
                    val ekle = listOf("Soğanlı", "Domatesli", "Patatesli", "Ketçaplı", "Mayonezli", "Turşulu")
                    FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                        cikar.forEach { malz -> 
                            val theColor = Color(0xFF9C27B0) // Mor
                            FilterChip(
                                selected = aktifAyar.seciliNotlar[malz] == true, 
                                onClick = { val s = !(aktifAyar.seciliNotlar[malz] ?: false); aktifAyar.seciliNotlar[malz] = s; if(s && zityon.containsKey(malz)) aktifAyar.seciliNotlar[zityon[malz]!!] = false }, 
                                label = { Text(malz, fontSize = 13.sp, fontWeight = FontWeight.Bold) }, 
                                colors = FilterChipDefaults.filterChipColors(containerColor = Color.Transparent, labelColor = theColor, selectedContainerColor = theColor.copy(alpha=0.2f), selectedLabelColor = theColor),
                                border = FilterChipDefaults.filterChipBorder(enabled = true, selected = aktifAyar.seciliNotlar[malz] == true, borderColor = theColor, selectedBorderColor = theColor, borderWidth = 1.dp, selectedBorderWidth = 1.5.dp)
                            ) 
                        }
                    }
                    HorizontalDivider(modifier = Modifier.padding(vertical = 4.dp), thickness = 1.dp, color = Color.DarkGray)
                    FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                        ekle.forEach { malz -> 
                            val theColor = Color(0xFFE91E63) // Pembe/Kırmızı
                            FilterChip(
                                selected = aktifAyar.seciliNotlar[malz] == true, 
                                onClick = { val s = !(aktifAyar.seciliNotlar[malz] ?: false); aktifAyar.seciliNotlar[malz] = s; if(s && zityon.containsKey(malz)) aktifAyar.seciliNotlar[zityon[malz]!!] = false }, 
                                label = { Text(malz, fontSize = 13.sp, fontWeight = FontWeight.Bold) }, 
                                colors = FilterChipDefaults.filterChipColors(containerColor = Color.Transparent, labelColor = theColor, selectedContainerColor = theColor.copy(alpha=0.2f), selectedLabelColor = theColor),
                                border = FilterChipDefaults.filterChipBorder(enabled = true, selected = aktifAyar.seciliNotlar[malz] == true, borderColor = theColor, selectedBorderColor = theColor, borderWidth = 1.dp, selectedBorderWidth = 1.5.dp)
                            ) 
                        }
                    }
                    HorizontalDivider(modifier = Modifier.padding(vertical = 4.dp), thickness = 1.dp, color = Color.DarkGray)
                    FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                        listOf("Cheddarlı", "Kaşarlı", "Karışık", "Acılı", "Sade Et", "Soslu", "Gemi", "Kayık").forEach { eks ->
                            if (eks == "Cheddarlı" || eks == "Kaşarlı") {
                                val theColor = Color(0xFFFFB300) // Sarı
                                FilterChip(
                                    selected = aktifAyar.seciliUcretliEkstralar[eks] == true,
                                    onClick = { aktifAyar.seciliUcretliEkstralar[eks] = !(aktifAyar.seciliUcretliEkstralar[eks] ?: false) },
                                    label = { Text("$eks (+70₺)", fontSize = 13.sp, fontWeight = FontWeight.Bold) },
                                    colors = FilterChipDefaults.filterChipColors(containerColor = Color.Transparent, labelColor = theColor, selectedContainerColor = theColor.copy(alpha=0.2f), selectedLabelColor = theColor),
                                    border = FilterChipDefaults.filterChipBorder(enabled = true, selected = aktifAyar.seciliUcretliEkstralar[eks] == true, borderColor = theColor, selectedBorderColor = theColor, borderWidth = 1.dp, selectedBorderWidth = 1.5.dp)
                                )
                            } else {
                                val theColor = Color(0xFF00ACC1) // Turkuaz/Cyan
                                FilterChip(
                                    selected = aktifAyar.seciliUcretsizEkstralar[eks] == true,
                                    onClick = { aktifAyar.seciliUcretsizEkstralar[eks] = !(aktifAyar.seciliUcretsizEkstralar[eks] ?: false) },
                                    label = { Text(eks, fontSize = 13.sp, fontWeight = FontWeight.Bold) },
                                    colors = FilterChipDefaults.filterChipColors(containerColor = Color.Transparent, labelColor = theColor, selectedContainerColor = theColor.copy(alpha=0.2f), selectedLabelColor = theColor),
                                    border = FilterChipDefaults.filterChipBorder(enabled = true, selected = aktifAyar.seciliUcretsizEkstralar[eks] == true, borderColor = theColor, selectedBorderColor = theColor, borderWidth = 1.dp, selectedBorderWidth = 1.5.dp)
                                )
                            }
                        }
                        odeme_listesi.forEach { odm -> 
                            val theColor = Color.White
                            FilterChip(selected = seciliOdemeler[odm] == true, onClick = {
                            val newVal = !(seciliOdemeler[odm] ?: false)
                            seciliOdemeler[odm] = newVal
                            if (newVal) {
                                if (odm == "POS") seciliOdemeler["NAKİT"] = false
                                if (odm == "NAKİT") seciliOdemeler["POS"] = false
                                if (odm == "Paket") seciliOdemeler["Dükkan içi"] = false
                                if (odm == "Dükkan içi") seciliOdemeler["Paket"] = false
                            }
                        }, label = { Text(odm, fontSize = 13.sp) },
                           colors = FilterChipDefaults.filterChipColors(containerColor = Color.Transparent, labelColor = theColor, selectedContainerColor = theColor.copy(alpha=0.2f), selectedLabelColor = theColor),
                           border = FilterChipDefaults.filterChipBorder(enabled = true, selected = seciliOdemeler[odm] == true, borderColor = theColor, selectedBorderColor = theColor, borderWidth = 1.dp, selectedBorderWidth = 1.5.dp)
                        ) }
                    }
                }
                Spacer(modifier = Modifier.height(8.dp))

                val digerUcretliler = ucretliEkstralar.filterKeys { !it.contains("Cheddar") && !it.contains("Kasar") && !it.contains("Kaşar") }
                if (digerUcretliler.isNotEmpty()) {
                    Text("Ucretli Ekstralar", fontWeight = FontWeight.Bold, color = Color(0xFFFFD54F), fontSize = 15.sp)
                    FlowRow(horizontalArrangement = Arrangement.spacedBy(12.dp), modifier = Modifier.padding(top = 8.dp)) {
                        digerUcretliler.forEach { (isim, fiyat) -> 
                            val theColor = Color(0xFF00ACC1) // Turkuaz/Cyan
                            FilterChip(
                                selected = aktifAyar.seciliUcretliEkstralar[isim] == true, 
                                onClick = { aktifAyar.seciliUcretliEkstralar[isim] = !(aktifAyar.seciliUcretliEkstralar[isim] ?: false) }, 
                                label = { Text("$isim (+$fiyat₺)", fontSize = 15.sp, modifier = Modifier.padding(6.dp), fontWeight = FontWeight.Bold) }, 
                                colors = FilterChipDefaults.filterChipColors(containerColor = Color.Transparent, labelColor = theColor, selectedContainerColor = theColor.copy(alpha=0.2f), selectedLabelColor = theColor),
                                border = FilterChipDefaults.filterChipBorder(enabled = true, selected = aktifAyar.seciliUcretliEkstralar[isim] == true, borderColor = theColor, selectedBorderColor = theColor, borderWidth = 1.dp, selectedBorderWidth = 1.5.dp)
                            ) 
                        }
                    }
                    Spacer(modifier = Modifier.height(8.dp))
                }
                Spacer(modifier = Modifier.height(8.dp))
            }

            Spacer(modifier = Modifier.height(8.dp))

                Text("Hızlı İçecek Ekle", fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.primary, fontSize = 15.sp)
                val currentViewConfig = androidx.compose.ui.platform.LocalViewConfiguration.current
                val fastLongPressConfig = androidx.compose.runtime.remember(currentViewConfig) {
                    object : androidx.compose.ui.platform.ViewConfiguration by currentViewConfig {
                        override val longPressTimeoutMillis: Long = 200L
                    }
                }
                androidx.compose.runtime.CompositionLocalProvider(androidx.compose.ui.platform.LocalViewConfiguration provides fastLongPressConfig) {
                    FlowRow(modifier = Modifier.fillMaxWidth().padding(top = 8.dp), horizontalArrangement = Arrangement.SpaceBetween, verticalArrangement = Arrangement.spacedBy(12.dp), maxItemsInEachRow = 5) {
                        icecekMenusu.forEach { ic ->
                            val miktar = if (seciliIcecekler[ic.ad] == true) (icecekAdetleri[ic.ad] ?: 1) else 0
                            Box(contentAlignment = Alignment.TopEnd) {
                                val n = ic.ad.lowercase(java.util.Locale("tr", "TR"))
                                val hardcodedColor = when {
                                    n.contains("kutu kola") || n.contains("sise kola") || n.contains("şişe kola") -> Color(0xFFB71C1C)
                                    n.contains("ayran") && !n.contains("açık") && !n.contains("acik") -> Color(0xFF827717)
                                    n.contains("açık ayran") || n.contains("acik ayran") -> Color(0xFF9E9D24)
                                    n.contains("zero") -> Color(0xFF424242)
                                    n.contains("şalgam") || n.contains("salgam") -> Color(0xFF6A1B9A)
                                    n == "su" -> Color(0xFF0288D1)
                                    n.contains("sprite") -> Color(0xFF2E7D32)
                                    n.contains("fanta") -> Color(0xFFE65100)
                                    n.contains("soda") -> Color(0xFF388E3C)
                                    else -> null
                                }
                                val bgRenk = try { if (!ic.color.isNullOrEmpty()) Color(android.graphics.Color.parseColor(ic.color)) else hardcodedColor ?: Color(0xFF242424) } catch (e: Exception) { hardcodedColor ?: Color(0xFF242424) }
                                Box(
                                    modifier = Modifier
                                        .height(50.dp).width(68.dp)
                                        .background(
                                            color = bgRenk.let { if (miktar > 0) it else it.copy(alpha = 0.4f) },
                                            shape = RoundedCornerShape(12.dp)
                                        )
                                        .combinedClickable(
                                            onClick = {
                                                haptic.performHapticFeedback(HapticFeedbackType.TextHandleMove)
                                                if (miktar == 0) {
                                                    seciliIcecekler[ic.ad] = true
                                                    icecekAdetleri[ic.ad] = 1
                                                } else {
                                                    icecekAdetleri[ic.ad] = miktar + 1
                                                }
                                            },
                                            onLongClick = {
                                                if (miktar > 0) {
                                                    haptic.performHapticFeedback(HapticFeedbackType.LongPress)
                                                    if (miktar == 1) {
                                                        seciliIcecekler[ic.ad] = false
                                                        icecekAdetleri[ic.ad] = 1
                                                    } else {
                                                        icecekAdetleri[ic.ad] = miktar - 1
                                                    }
                                                }
                                            }
                                        ),
                                    contentAlignment = Alignment.Center
                                ) {
                                    val defaultText = if (hardcodedColor != null) Color.White else Color.White
                                    val yRengi = try { if (!ic.textColor.isNullOrEmpty()) Color(android.graphics.Color.parseColor(ic.textColor)) else defaultText } catch (e: Exception) { defaultText }
                                    Text(ic.ad, color = yRengi, fontSize = 11.sp, fontWeight = FontWeight.Bold, textAlign = TextAlign.Center, modifier = Modifier.padding(2.dp), lineHeight = 12.sp)
                                }

                                if (miktar > 0) {
                                    Box(
                                        modifier = Modifier
                                            .offset(x = 6.dp, y = (-6).dp)
                                            .size(28.dp)
                                            .background(Color(0xFFD32F2F), CircleShape),
                                        contentAlignment = Alignment.Center
                                    ) {
                                        Text(text = "$miktar", color = Color.White, fontSize = 14.sp, fontWeight = FontWeight.ExtraBold)
                                    }
                                }
                            }
                        }
                    }
                }
            Spacer(modifier = Modifier.height(8.dp))
            OutlinedTextField(value = aktifAyar.siparisNotu, onValueChange = { aktifAyar.siparisNotu = it }, label = { Text("Özel Sipariş Notu (Örn: Çok pişsin)", fontSize = 15.sp) }, modifier = Modifier.fillMaxWidth(), textStyle = androidx.compose.ui.text.TextStyle(fontSize = 20.sp))
            if (guncelMasaAdi == null) {
                Spacer(modifier = Modifier.height(16.dp))
                OutlinedTextField(value = musteriAdi, onValueChange = { musteriAdi = it }, label = { Text("Masa No / İsim", fontSize = 15.sp) }, singleLine = true, modifier = Modifier.fillMaxWidth(), textStyle = androidx.compose.ui.text.TextStyle(fontSize = 20.sp))
            }
            Spacer(modifier = Modifier.height(16.dp))

            Button(
                onClick = {
                    val kalemler = mutableListOf<SiparisKalemi>()

                    urunAyarlari.forEach { ayar ->
                        val tumNotlar = mutableListOf<String>()
                        tumNotlar.addAll(ayar.seciliNotlar.filter { it.value }.map { it.key })
                        tumNotlar.addAll(ayar.seciliUcretsizEkstralar.filter { it.value }.map { it.key })
                        tumNotlar.addAll(ayar.seciliUcretliEkstralar.filter { it.value }.map { "${it.key} eklendi" })
                        tumNotlar.addAll(seciliOdemeler.filter { it.value }.map { it.key })
                        if (ayar.siparisNotu.isNotBlank()) tumNotlar.add(ayar.siparisNotu.trim())
                        val notMetni = if (tumNotlar.isNotEmpty()) "Not: ${tumNotlar.joinToString(", ")}" else ""

                        val birimFiyat = (ayar.seciliGramaj?.fiyat ?: 0) + ayar.seciliUcretliEkstralar.filter { it.value }.keys.sumOf { if (it == "Cheddarlı" || it == "Kaşarlı") 70 else (ucretliEkstralar[it] ?: 0) }

                        kalemler.add(SiparisKalemi(urun.ad, (ayar.seciliGramaj?.gramaj ?: "Standart"), birimFiyat, notMetni))
                    }
                    icecekMenusu.forEachIndexed { _, ic -> if (seciliIcecekler[ic.ad] == true) { val icAdet = icecekAdetleri[ic.ad] ?: 1; repeat(icAdet) { kalemler.add(SiparisKalemi(ic.ad, "Standart", (ic.secenekler?.firstOrNull()?.fiyat ?: 0), "")) } } }
                    onSiparisEkle(musteriAdi, kalemler)
                }, modifier = Modifier.fillMaxWidth().height(64.dp), colors = ButtonDefaults.buttonColors(containerColor = Color(0xFFF54E4E)), shape = RoundedCornerShape(16.dp)
            ) { Text("Sepete Ekle - TOPLAM: $toplamTutar ₺", color = Color.Black, fontWeight = FontWeight.Black, fontSize = 20.sp) }
            Spacer(modifier = Modifier.height(40.dp))
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AdisyonKarti(adisyon: Adisyon, tamamlandiClick: () -> Unit, kalemSilClick: (SiparisKalemi) -> Unit, ilaveClick: () -> Unit, notDuzenleClick: (SiparisKalemi) -> Unit, yazdirClick: () -> Unit, hazirlandiClick: () -> Unit, yolaCiktiClick: () -> Unit = {}, masaIsmiDuzenleClick: () -> Unit = {}, siparisNotuDuzenleClick: () -> Unit = {}) {
    val genisletilmisGruplar = remember { mutableStateMapOf<String, Boolean>() }
    val grupluKalemler = adisyon.kalemler.groupBy { "${it.urunAd}_${it.detay}_${it.notlar}" }
    val isHazir = adisyon.durum != "Bekliyor" && adisyon.durum != "waiting"
    val kartRengi = if (!isHazir) Color(0xFF242424) else Color(0xFF1A4A28)
    val localCtx = androidx.compose.ui.platform.LocalContext.current
    val cardScale by androidx.compose.animation.core.animateFloatAsState(targetValue = if (isHazir) 0.93f else 1f)

    val currentViewConfig = androidx.compose.ui.platform.LocalViewConfiguration.current
    val customViewConfig = remember(currentViewConfig) {
        object : androidx.compose.ui.platform.ViewConfiguration by currentViewConfig {
            override val longPressTimeoutMillis: Long = 250L
        }
    }

    CompositionLocalProvider(androidx.compose.ui.platform.LocalViewConfiguration provides customViewConfig) {
        Card(modifier = Modifier.fillMaxWidth().scale(cardScale).pointerInput(Unit) {
        detectTapGestures(
            onDoubleTap = {
                val clipManager = localCtx.getSystemService(android.content.Context.CLIPBOARD_SERVICE) as android.content.ClipboardManager
                val kalemlerMetin = grupluKalemler.map { (anahtar, liste) ->
                    val ilk = liste.first()
                    val adet = liste.size
                    val porsiyonStr = if (ilk.detay == "Standart" || ilk.detay.isNullOrBlank()) "" else " - ${ilk.detay}"
                    val kalemNotStr = if (ilk.notlar.isNotBlank()) " (${ilk.notlar})" else ""
                    "${adet}x ${ilk.urunAd}$porsiyonStr$kalemNotStr"
                }.joinToString("\n")
                val notKisimi = adisyon.siparisNotu?.takeIf { it.isNotBlank() }?.let { "\n\nNOT: $it" } ?: ""
                val metin = "${adisyon.musteriAdi}\nTutar: ${adisyon.toplamTutar} ₺\n$kalemlerMetin$notKisimi"
                clipManager.setPrimaryClip(android.content.ClipData.newPlainText("Sipariş", metin))
                android.widget.Toast.makeText(localCtx, "Kopyalandı", android.widget.Toast.LENGTH_SHORT).show()
            },
            onLongPress = { hazirlandiClick() }
        )
    }, shape = RoundedCornerShape(16.dp), elevation = CardDefaults.cardElevation(defaultElevation = 8.dp), colors = CardDefaults.cardColors(containerColor = kartRengi)) {
        Column(modifier = Modifier.padding(20.dp)) {
            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                Row(modifier = Modifier.weight(1f), verticalAlignment = Alignment.CenterVertically) {
                    val clipboardManager = androidx.compose.ui.platform.LocalClipboardManager.current
                    if (adisyon.musteriAdi.startsWith("YS", ignoreCase = true) || adisyon.musteriAdi.startsWith("TY", ignoreCase = true)) {
                        Box(modifier = Modifier.size(36.dp).background(Color.Transparent, shape = RoundedCornerShape(8.dp)).clickable {
                            val clipManager = localCtx.getSystemService(android.content.Context.CLIPBOARD_SERVICE) as android.content.ClipboardManager
                            val kalemlerMetin = grupluKalemler.map { (anahtar, liste) ->
                                val ilk = liste.first()
                                val adet = liste.size
                                val porsiyonStr = if (ilk.detay == "Standart" || ilk.detay.isNullOrBlank()) "" else " - ${ilk.detay}"
                                val kalemNotStr = if (ilk.notlar.isNotBlank()) " (${ilk.notlar})" else ""
                                "${adet}x ${ilk.urunAd}$porsiyonStr$kalemNotStr"
                            }.joinToString("\n")
                            val notKisimi = adisyon.siparisNotu?.takeIf { it.isNotBlank() }?.let { "\n\n$it" } ?: ""
                            val metin = "${adisyon.musteriAdi}\nTutar: ${adisyon.toplamTutar} ₺\n$kalemlerMetin$notKisimi"
                            clipManager.setPrimaryClip(android.content.ClipData.newPlainText("Sipariş", metin))
                            android.widget.Toast.makeText(localCtx, "Kopyalandı", android.widget.Toast.LENGTH_SHORT).show()
                        }, contentAlignment = Alignment.Center) {
                            androidx.compose.material3.Icon(
                                imageVector = androidx.compose.material.icons.Icons.Default.ContentCopy,
                                contentDescription = "Kopyala",
                                tint = Color(0xFFAAAAAA),
                                modifier = Modifier.size(20.dp)
                            )
                        }
                        Spacer(modifier = Modifier.width(8.dp))
                    }
                    if (!adisyon.renk.isNullOrBlank()) {
                        val pColor = try { android.graphics.Color.parseColor(adisyon.renk) } catch(e: Exception) { android.graphics.Color.TRANSPARENT }
                        if (pColor != android.graphics.Color.TRANSPARENT) {
                            Box(modifier = Modifier.size(16.dp).background(Color(pColor), CircleShape))
                            Spacer(modifier = Modifier.width(8.dp))
                        }
                    }
                    Text(text = "${adisyon.musteriAdi} ${if (adisyon.saat.isNotBlank()) "(${adisyon.saat})" else ""}${if (adisyon.durum == "prepared" || adisyon.durum == "hazir") " ✔️" else ""}", fontWeight = FontWeight.Black, fontSize = 24.sp, color = Color.White, maxLines = 1, overflow = TextOverflow.Ellipsis)
                    IconButton(onClick = masaIsmiDuzenleClick, modifier = Modifier.size(32.dp)) { androidx.compose.material3.Icon(Icons.Default.Edit, contentDescription = null, tint = Color.LightGray, modifier = Modifier.size(18.dp)) }
                }
                Text(text = "${adisyon.toplamTutar} ₺", fontWeight = FontWeight.Black, fontSize = 24.sp, color = Color(0xFF4CAF50), modifier = Modifier.padding(start = 8.dp))
            }
            
            if (!adisyon.siparisNotu.isNullOrBlank()) {
                Row(modifier = Modifier.fillMaxWidth().padding(top = 8.dp), horizontalArrangement = Arrangement.Center, verticalAlignment = Alignment.CenterVertically) {
                    Text(
                        text = "${adisyon.siparisNotu}",
                        color = Color(0xFFFF5722),
                        fontSize = 15.sp,
                        fontWeight = FontWeight.Bold,
                        textAlign = androidx.compose.ui.text.style.TextAlign.Center
                    )
                    IconButton(onClick = siparisNotuDuzenleClick, modifier = Modifier.size(32.dp)) { androidx.compose.material3.Icon(Icons.Default.Edit, contentDescription = null, tint = Color.LightGray, modifier = Modifier.size(18.dp)) }
                }
            } else {
                IconButton(onClick = siparisNotuDuzenleClick, modifier = Modifier.align(Alignment.CenterHorizontally).padding(top = 4.dp)) { androidx.compose.material3.Icon(Icons.Default.NoteAlt, contentDescription = null, tint = Color.Gray, modifier = Modifier.size(20.dp)) }
            }
            
            Divider(modifier = Modifier.padding(vertical = 12.dp), color = Color(0xFF424242))

            grupluKalemler.forEach { (grupAnahtari, kalemListesi) ->
                val ilkKalem = kalemListesi.first(); val adet = kalemListesi.size; val isExpanded = genisletilmisGruplar[grupAnahtari] == true

                Row(modifier = Modifier.fillMaxWidth().padding(vertical = 8.dp).clickable { genisletilmisGruplar[grupAnahtari] = !isExpanded }, horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                    Column(modifier = Modifier.weight(1f)) {
                        val detayText = if (ilkKalem.detay.equals("Standart", true) || ilkKalem.detay.isNullOrBlank()) "" else " (${ilkKalem.detay})"
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Text(text = "• ${adet}x ${ilkKalem.urunAd}$detayText", fontSize = 20.sp, fontWeight = FontWeight.Bold, color = Color.White)
                            if (adet > 1) Text(text = if (isExpanded) "  ▲" else "  ▼", fontSize = 13.sp, color = Color.Gray)
                        }
                        if (ilkKalem.notlar.isNotEmpty()) Text(text = ilkKalem.notlar, fontSize = 13.sp, color = Color.LightGray, modifier = Modifier.padding(top = 4.dp))
                    }
                    Text(text = "${ilkKalem.fiyat * adet} ₺", fontSize = 20.sp, fontWeight = FontWeight.Bold, color = Color(0xFF81C784))
                }

                if (isExpanded || adet == 1) {
                    Column(modifier = Modifier.fillMaxWidth().background(Color(0xFF1E1E1E), RoundedCornerShape(12.dp)).clip(RoundedCornerShape(12.dp))) {
                        kalemListesi.forEach { tekliKalem ->
                            key(System.identityHashCode(tekliKalem)) {
                            var isDeleted by remember { mutableStateOf(false) }
                                val dismissState = rememberSwipeToDismissBoxState(confirmValueChange = {
                                    if (it == SwipeToDismissBoxValue.EndToStart) {
                                        if (!isDeleted) {
                                            isDeleted = true
                                            kalemSilClick(tekliKalem)
                                        }
                                        true
                                    } else false
                                })
                            SwipeToDismissBox(state = dismissState, enableDismissFromStartToEnd = false, backgroundContent = { val color by animateColorAsState(if (dismissState.targetValue == SwipeToDismissBoxValue.EndToStart) Color.Red else Color.Transparent); Box(Modifier.fillMaxSize().background(color).padding(horizontal = 20.dp), contentAlignment = Alignment.CenterEnd) { Text("Sil", color = Color.White, fontWeight = FontWeight.Bold, fontSize = 15.sp) } }) {
                                Row(modifier = Modifier.fillMaxWidth().background(Color(0xFF1E1E1E)).padding(horizontal = 16.dp, vertical = 12.dp), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                                    Text(text = "↳ 1x ${tekliKalem.urunAd}", fontSize = 13.sp, color = Color.LightGray)
                                    Row(verticalAlignment = Alignment.CenterVertically) {
                                        Text(text = "${tekliKalem.fiyat} ₺", fontSize = 13.sp, color = Color.Gray, modifier = Modifier.padding(end = 12.dp))
                                        Box(modifier = Modifier.size(36.dp).background(Color(0xFF333333), RoundedCornerShape(8.dp)).clickable { notDuzenleClick(tekliKalem) }, contentAlignment = Alignment.Center) { androidx.compose.material3.Icon(Icons.Default.Edit, contentDescription = null, tint = Color.White, modifier = Modifier.size(16.dp)) }
                                        Spacer(modifier = Modifier.width(8.dp))
                                        Box(modifier = Modifier.size(36.dp).background(Color(0xFF421515), RoundedCornerShape(8.dp)).clickable { kalemSilClick(tekliKalem) }, contentAlignment = Alignment.Center) { androidx.compose.material3.Icon(Icons.Default.Close, contentDescription = null, tint = Color.White, modifier = Modifier.size(16.dp)) }
                                    }
                                }
                            }
                            }
                        }
                    }
                }
            }

            Spacer(modifier = Modifier.height(8.dp))
            OutlinedButton(onClick = ilaveClick, modifier = Modifier.fillMaxWidth().height(56.dp), colors = ButtonDefaults.outlinedButtonColors(contentColor = Color(0xFFF54E4E)), border = androidx.compose.foundation.BorderStroke(1.dp, Color(0xFFF54E4E)), shape = RoundedCornerShape(12.dp)) { androidx.compose.material3.Icon(Icons.Default.Add, contentDescription = null) }
            Spacer(modifier = Modifier.height(12.dp))
            Row(modifier = Modifier.fillMaxWidth()) {
                Button(onClick = yazdirClick, modifier = Modifier.weight(1f).height(64.dp), colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF424242)), shape = RoundedCornerShape(12.dp)) { androidx.compose.material3.Icon(Icons.Default.Print, contentDescription = null) }
                Spacer(modifier = Modifier.width(12.dp))
                Button(onClick = tamamlandiClick, modifier = Modifier.weight(1f).height(64.dp), colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF2E7D32)), shape = RoundedCornerShape(12.dp)) { androidx.compose.material3.Icon(Icons.Default.DoneAll, contentDescription = null) }
            }
        }
    }
    }
}

@Composable
fun RaporEkrani(hafiza: HafizaYoneticisi) {
    var isLoading by remember { mutableStateOf(true) }
    var rapor by remember { mutableStateOf<DailyReportResponse?>(null) }
    var errorMsg by remember { mutableStateOf<String?>(null) }
    var selectedDate by remember { mutableStateOf<String?>(null) }
    var expanded by remember { mutableStateOf(false) }
    var refreshTrigger by remember { mutableStateOf(0) }
    val coroutineScope = rememberCoroutineScope()

    LaunchedEffect(selectedDate, refreshTrigger) {
        isLoading = true
        try {
            val api = ApiClient.getApi(hafiza.kasaIpOku(), hafiza.kasaTokenOku())
            val rsp = api.gunlukRaporGetir(selectedDate)
            if (rsp.isSuccessful) {
                rapor = rsp.body()
            } else {
                errorMsg = "Veri alınamadı: ${rsp.code()}"
            }
        } catch (e: Exception) {
            errorMsg = "Bağlantı hatası: ${e.message}"
        } finally {
            isLoading = false
        }
    }

    if (isLoading) {
        Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
            CircularProgressIndicator(color = Color(0xFFF54E4E))
        }
    } else if (errorMsg != null) {
        Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
            Text(text = errorMsg!!, color = Color.Red, fontSize = 18.sp, fontWeight = FontWeight.Bold)
        }
    } else {
        rapor?.let { r ->
            Column(
                modifier = Modifier.fillMaxSize().padding(16.dp).verticalScroll(rememberScrollState()),
                verticalArrangement = Arrangement.spacedBy(16.dp)
            ) {
                // Üst Bar: Tarih Seçimi ve Sıfırlama
                Row(
                    modifier = Modifier.fillMaxWidth().padding(bottom = 8.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Box {
                        Button(
                            onClick = { expanded = true },
                            colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF333333))
                        ) {
                            Text(selectedDate ?: "📅 Bugün", color = Color.White)
                        }
                        DropdownMenu(
                            expanded = expanded,
                            onDismissRequest = { expanded = false }
                        ) {
                            DropdownMenuItem(
                                text = { Text("Bugün") },
                                onClick = { selectedDate = null; expanded = false }
                            )
                            r.availableDates?.forEach { d ->
                                DropdownMenuItem(
                                    text = { Text(d) },
                                    onClick = { selectedDate = d; expanded = false }
                                )
                            }
                        }
                    }

                    Button(
                        onClick = {
                            coroutineScope.launch {
                                try {
                                    val api = ApiClient.getApi(hafiza.kasaIpOku(), hafiza.kasaTokenOku())
                                    val rsp = api.verileriSifirla()
                                    if (rsp.isSuccessful) {
                                        selectedDate = null
                                        refreshTrigger++
                                    }
                                } catch (e: Exception) {}
                            }
                        },
                        colors = ButtonDefaults.buttonColors(containerColor = Color(0xFFD32F2F))
                    ) {
                        Text("🗑️ Verileri Sıfırla", color = Color.White)
                    }
                }

                val titlePrefix = if (r.isSpecificDate == true) "Seçili Gün" else "Bugünkü"

                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(16.dp)) {
                    RaporKarti(
                        baslik = "$titlePrefix Ciro", deger = "${(r.bugunkuCiro ?: 0.0).toInt()} ₺", altYazi = "",
                        arkaPlan = Color(0xFF112211), degerRengi = Color(0xFF4CAF50),
                        modifier = Modifier.weight(1f)
                    )
                    RaporKarti(
                        baslik = "Haftalık Ciro", deger = "${(r.haftalikCiro ?: 0.0).toInt()} ₺", altYazi = "",
                        arkaPlan = Color(0xFF181818), degerRengi = Color.White,
                        modifier = Modifier.weight(1f)
                    )
                }
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(16.dp)) {
                    RaporKarti(
                        baslik = "$titlePrefix Sipariş", deger = "${r.bugunkuSiparis ?: 0} Adet", altYazi = "",
                        arkaPlan = Color(0xFF181818), degerRengi = Color.White,
                        modifier = Modifier.weight(1f)
                    )
                    RaporKarti(
                        baslik = "Haftalık Sipariş", deger = "${r.haftalikSiparis ?: 0} Adet", altYazi = "",
                        arkaPlan = Color(0xFF181818), degerRengi = Color.White,
                        modifier = Modifier.weight(1f)
                    )
                }
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(16.dp)) {
                    RaporKarti(
                        baslik = "Favori Döner", deger = r.favoriDoner?.ad ?: "-", altYazi = "${r.favoriDoner?.satis ?: 0} Satış",
                        arkaPlan = Color(0xFF2E1C0A), degerRengi = Color(0xFFFFCA28),
                        modifier = Modifier.weight(1f)
                    )
                    RaporKarti(
                        baslik = "Favori Ürün", deger = r.favoriUrun?.ad ?: "-", altYazi = "${r.favoriUrun?.satis ?: 0} Satış",
                        arkaPlan = Color(0xFF0D1B2A), degerRengi = Color(0xFF90CAF9),
                        modifier = Modifier.weight(1f)
                    )
                }
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(16.dp)) {
                    DonerKarti(
                        baslik = "$titlePrefix Satılan Döner",
                        etKg = r.bugunSatilanEtKg ?: "0",
                        tavukKg = r.bugunSatilanTavukKg ?: "0",
                        modifier = Modifier.weight(1f)
                    )
                    RaporKarti(
                        baslik = "Ortalama Sepet Tutarı", deger = "${(r.ortalamaSepetTutari ?: 0.0).toInt()} ₺", altYazi = "$titlePrefix Sipariş Başına",
                        arkaPlan = Color(0xFF221533), degerRengi = Color(0xFFCE93D8),
                        modifier = Modifier.weight(1f)
                    )
                }
            }
        }
    }
}

@Composable
fun RaporKarti(baslik: String, deger: String, altYazi: String, arkaPlan: Color, degerRengi: Color, sagUstMetin: String? = null, modifier: Modifier = Modifier) {
    Card(
        modifier = modifier.height(140.dp),
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(containerColor = arkaPlan),
        elevation = CardDefaults.cardElevation(defaultElevation = 6.dp)
    ) {
        Box(modifier = Modifier.fillMaxSize().padding(16.dp)) {
            Column(modifier = Modifier.fillMaxSize(), verticalArrangement = Arrangement.SpaceBetween) {
                Text(text = baslik, color = Color.Gray, fontSize = 14.sp, fontWeight = FontWeight.SemiBold)
                Text(text = deger, color = degerRengi, fontSize = 26.sp, fontWeight = FontWeight.ExtraBold)
                Text(text = altYazi, color = Color.LightGray, fontSize = 12.sp)
            }
            if (sagUstMetin != null) {
                Text(text = sagUstMetin, color = Color.White, fontSize = 12.sp, fontWeight = FontWeight.Bold, modifier = Modifier.align(Alignment.TopEnd).background(Color(0x55000000), RoundedCornerShape(4.dp)).padding(horizontal = 6.dp, vertical = 2.dp))
            }
        }
    }
}

@Composable
fun DonerKarti(baslik: String, etKg: String, tavukKg: String, modifier: Modifier = Modifier) {
    Card(
        modifier = modifier.height(140.dp),
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(containerColor = Color(0xFF2D1111)),
        elevation = CardDefaults.cardElevation(defaultElevation = 6.dp)
    ) {
        Column(modifier = Modifier.fillMaxSize().padding(16.dp)) {
            Text(text = baslik, color = Color.Gray, fontSize = 14.sp, fontWeight = FontWeight.SemiBold)
            Spacer(modifier = Modifier.height(16.dp))
            Row(modifier = Modifier.fillMaxWidth().weight(1f), verticalAlignment = Alignment.CenterVertically) {
                // Et Döner
                Column(modifier = Modifier.weight(1f).padding(end = 8.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                    Row(verticalAlignment = Alignment.Bottom) {
                        Text(etKg, color = Color(0xFFEF9A9A), fontSize = 26.sp, fontWeight = FontWeight.ExtraBold)
                        Spacer(modifier = Modifier.width(4.dp))
                        Text("kg", color = Color.Gray, fontSize = 16.sp, modifier = Modifier.padding(bottom = 3.dp), fontWeight = FontWeight.Bold)
                    }
                    Text("Et Döner", color = Color.LightGray, fontSize = 12.sp)
                }
                
                // Divider
                Box(modifier = Modifier.width(1.dp).height(40.dp).background(Color.DarkGray))
                
                // Tavuk Döner
                Column(modifier = Modifier.weight(1f).padding(start = 8.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                    Row(verticalAlignment = Alignment.Bottom) {
                        Text(tavukKg, color = Color(0xFF90CAF9), fontSize = 26.sp, fontWeight = FontWeight.ExtraBold)
                        Spacer(modifier = Modifier.width(4.dp))
                        Text("kg", color = Color.Gray, fontSize = 16.sp, modifier = Modifier.padding(bottom = 3.dp), fontWeight = FontWeight.Bold)
                    }
                    Text("Tavuk Döner", color = Color.LightGray, fontSize = 12.sp)
                }
            }
        }
    }
}

@Composable
fun SistemLoglariDialog(hafiza: HafizaYoneticisi, onDismiss: () -> Unit) {
    var logs by remember { mutableStateOf<List<SystemLog>>(emptyList()) }
    var isLoading by remember { mutableStateOf(true) }
    var errorMsg by remember { mutableStateOf("") }
    var cursorBlink by remember { mutableStateOf(true) }
    
    LaunchedEffect(Unit) {
        while (true) {
            delay(500)
            cursorBlink = !cursorBlink
        }
    }

    LaunchedEffect(Unit) {
        while (true) {
            try {
                val api = ApiClient.getApi(hafiza.kasaIpOku(), hafiza.kasaTokenOku())
                val res = api.loglariGetir()
                if (res.isSuccessful && res.body() != null) {
                    logs = res.body()!!
                    errorMsg = ""
                } else {
                    errorMsg = "Loglar alınamadı (Hata Kodu: ${res.code()})"
                }
            } catch (e: Exception) {
                errorMsg = "Kasa bağlantı hatası!"
            }
            isLoading = false
            delay(3000)
        }
    }

    AlertDialog(
        onDismissRequest = onDismiss,
        containerColor = Color(0xFF1E1E1E),
        modifier = Modifier.fillMaxHeight(0.9f).fillMaxWidth(0.95f),
        title = {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text("root@saracapp:~# tail -f /var/log/system.log", color = Color(0xFF4CAF50), fontSize = 14.sp, fontFamily = androidx.compose.ui.text.font.FontFamily.Monospace)
                if (cursorBlink) {
                    Text(" █", color = Color(0xFF4CAF50), fontSize = 14.sp, fontFamily = androidx.compose.ui.text.font.FontFamily.Monospace)
                }
            }
        },
        text = {
            Column(modifier = Modifier.fillMaxSize().background(Color(0xFF0A0A0A), shape = androidx.compose.foundation.shape.RoundedCornerShape(8.dp)).border(1.dp, Color(0xFF333333), androidx.compose.foundation.shape.RoundedCornerShape(8.dp)).padding(8.dp)) {
                if (isLoading) {
                    CircularProgressIndicator(color = Color(0xFF4CAF50), modifier = Modifier.align(Alignment.CenterHorizontally).padding(top = 16.dp))
                } else if (errorMsg.isNotEmpty()) {
                    Text(errorMsg, color = Color(0xFFFF5252), fontFamily = androidx.compose.ui.text.font.FontFamily.Monospace, modifier = Modifier.padding(16.dp))
                } else if (logs.isEmpty()) {
                    Text("root@saracapp:~# No logs found.", color = Color.Gray, fontFamily = androidx.compose.ui.text.font.FontFamily.Monospace, modifier = Modifier.padding(16.dp))
                } else {
                    LazyColumn(modifier = Modifier.fillMaxSize()) {
                        items(logs) { log ->
                            val textColor = when (log.type) {
                                "success" -> Color(0xFF4CAF50)
                                "error" -> Color(0xFFFF5252)
                                "warning" -> Color(0xFFFFC107)
                                else -> Color(0xFF64B5F6)
                            }
                            androidx.compose.material3.Text(
                                androidx.compose.ui.text.buildAnnotatedString {
                                    pushStyle(androidx.compose.ui.text.SpanStyle(color = Color(0xFF888888)))
                                    append("[${log.time}] ")
                                    pop()
                                    pushStyle(androidx.compose.ui.text.SpanStyle(color = Color(0xFFE0E0E0), fontWeight = androidx.compose.ui.text.font.FontWeight.Bold))
                                    append("[${log.source}] ")
                                    pop()
                                    pushStyle(androidx.compose.ui.text.SpanStyle(color = textColor))
                                    append(log.message)
                                    pop()
                                },
                                fontSize = 13.sp,
                                fontFamily = androidx.compose.ui.text.font.FontFamily.Monospace,
                                modifier = Modifier.fillMaxWidth().padding(vertical = 3.dp)
                            )
                        }
                    }
                }
            }
        },
        confirmButton = {
            Button(onClick = onDismiss, colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF333333))) {
                Text("Kapat", color = Color.White, fontFamily = androidx.compose.ui.text.font.FontFamily.Monospace)
            }
        }
    )
}

@Composable
fun AdminPanelScreen(onBack: () -> Unit) {
    val context = LocalContext.current
    val prefs = context.getSharedPreferences("SaracogluDefteri", Context.MODE_PRIVATE)
    var localIp by remember { mutableStateOf(prefs.getString("admin_local_ip", "192.168.1.") ?: "192.168.1.") }
    var logs by remember { mutableStateOf<List<Map<String, Any>>>(emptyList()) }
    var isLoading by remember { mutableStateOf(false) }
    var errorMsg by remember { mutableStateOf<String?>(null) }
    val coroutineScope = rememberCoroutineScope()

    fun fetchLogs() {
        if (localIp.isBlank()) return
        prefs.edit().putString("admin_local_ip", localIp).apply()
        isLoading = true
        errorMsg = null
        coroutineScope.launch(Dispatchers.IO) {
            try {
                val client = okhttp3.OkHttpClient.Builder()
                    .connectTimeout(5, java.util.concurrent.TimeUnit.SECONDS)
                    .build()
                val url = "http://$localIp:3005/api/local_logs"
                val request = okhttp3.Request.Builder().url(url).build()
                val response = client.newCall(request).execute()
                if (response.isSuccessful) {
                    val body = response.body?.string() ?: "[]"
                    val jsonArray = org.json.JSONArray(body)
                    val list = mutableListOf<Map<String, Any>>()
                    for (i in 0 until jsonArray.length()) {
                        val obj = jsonArray.getJSONObject(i)
                        list.add(mapOf(
                            "name" to obj.getString("name"),
                            "size" to obj.getLong("size"),
                            "time" to obj.getLong("time")
                        ))
                    }
                    withContext(Dispatchers.Main) {
                        logs = list
                        isLoading = false
                    }
                } else {
                    withContext(Dispatchers.Main) {
                        errorMsg = "Sunucu hatası: ${response.code}"
                        isLoading = false
                    }
                }
            } catch (e: Exception) {
                withContext(Dispatchers.Main) {
                    errorMsg = "Bağlantı hatası: ${e.message}"
                    isLoading = false
                }
            }
        }
    }

    var showRemote by remember { mutableStateOf(false) }
    
    if (showRemote) {
        RemoteTerminalScreen(onBack = { showRemote = false })
        return
    }

    Column(modifier = Modifier.fillMaxSize().background(Color(0xFF0F0F0F)).padding(16.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            IconButton(onClick = onBack) {
                androidx.compose.material3.Icon(Icons.Default.Close, contentDescription = "Geri", tint = Color.White)
            }
            Text("Admin Paneli", color = Color.White, fontSize = 20.sp, fontWeight = FontWeight.Bold)
        }
        
        Spacer(modifier = Modifier.height(16.dp))
        
        Button(
            onClick = { showRemote = true },
            modifier = Modifier.fillMaxWidth().height(50.dp),
            colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF4CAF50))
        ) {
            Text("Uzak Yönetim (C2 Terminal)", color = Color.White, fontWeight = FontWeight.Bold)
        }
        
        Spacer(modifier = Modifier.height(16.dp))
        
        OutlinedTextField(
            value = localIp,
            onValueChange = { localIp = it },
            label = { Text("Kasa Yerel IP (örn: 192.168.1.50)") },
            modifier = Modifier.fillMaxWidth(),
            colors = androidx.compose.material3.OutlinedTextFieldDefaults.colors(
                focusedTextColor = Color.White,
                unfocusedTextColor = Color.White,
                focusedBorderColor = Color(0xFFF54E4E)
            )
        )
        Spacer(modifier = Modifier.height(8.dp))
        Button(
            onClick = { fetchLogs() },
            modifier = Modifier.fillMaxWidth().height(50.dp),
            colors = ButtonDefaults.buttonColors(containerColor = Color(0xFFF54E4E))
        ) {
            Text("Dosyaları Getir", color = Color.White, fontWeight = FontWeight.Bold)
        }
        
        Spacer(modifier = Modifier.height(16.dp))
        
        if (isLoading) {
            CircularProgressIndicator(color = Color(0xFFF54E4E), modifier = Modifier.align(Alignment.CenterHorizontally))
        } else if (errorMsg != null) {
            Text(errorMsg!!, color = Color.Red, modifier = Modifier.align(Alignment.CenterHorizontally))
        } else {
            androidx.compose.foundation.lazy.LazyColumn(modifier = Modifier.fillMaxSize()) {
                items(logs.size) { index ->
                    val log = logs[index]
                    Card(
                        modifier = Modifier.fillMaxWidth().padding(vertical = 4.dp).clickable {
                            val url = "http://$localIp:3005/api/local_logs/download/${log["name"]}"
                            val intent = android.content.Intent(android.content.Intent.ACTION_VIEW)
                            intent.data = android.net.Uri.parse(url)
                            context.startActivity(intent)
                        },
                        colors = CardDefaults.cardColors(containerColor = Color(0xFF1E1E1E))
                    ) {
                        Column(modifier = Modifier.padding(16.dp)) {
                            Text(log["name"].toString(), color = Color.White, fontWeight = FontWeight.Bold)
                            Text("Boyut: ${log["size"].toString()} bytes", color = Color.Gray, fontSize = 12.sp)
                        }
                    }
                }
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun RemoteTerminalScreen(onBack: () -> Unit) {
    val context = LocalContext.current
    val prefs = context.getSharedPreferences("SaracogluDefteri", Context.MODE_PRIVATE)
    
    var command by remember { mutableStateOf("") }
    var output by remember { mutableStateOf("Kasa'ya bağlanılıyor...") }
    var ws by remember { mutableStateOf<WebSocket?>(null) }
    var connected by remember { mutableStateOf(false) }
    val coroutineScope = rememberCoroutineScope()

    LaunchedEffect(Unit) {
        val ip = prefs.getString("KASA_IP", "")?.trim() ?: ""
        val token = prefs.getString("KASA_TOKEN", "") ?: ""
        val devId = prefs.getString("CIHAZ_ID", "") ?: ""
        if (ip.isBlank()) {
            output = "Hata: Kasa IP ayarlanmamış."
            return@LaunchedEffect
        }
        
        val termDevId = "${devId}-term"
        
        val wsUrl = if (ip.startsWith("https://")) {
            ip.replace("https://", "wss://") + (if (ip.endsWith("/")) "ws?token=$token&deviceId=$termDevId" else "/ws?token=$token&deviceId=$termDevId")
        } else if (ip.startsWith("http://")) {
            ip.replace("http://", "ws://") + (if (ip.endsWith("/")) "ws?token=$token&deviceId=$termDevId" else "/ws?token=$token&deviceId=$termDevId")
        } else if (ip.contains("bilalgnd.shop")) {
            "wss://$ip/ws?token=$token&deviceId=$termDevId"
        } else {
            "ws://$ip/ws?token=$token&deviceId=$termDevId"
        }

        val client = OkHttpClient()
        val request = Request.Builder().url(wsUrl).build()
        val socket = client.newWebSocket(request, object : WebSocketListener() {
            override fun onOpen(webSocket: WebSocket, response: Response) {
                connected = true
                output = "✅ Kasa sunucusuna bağlandı. Kasa'dan yanıt bekleniyor...\n"
            }
            override fun onMessage(webSocket: WebSocket, text: String) {
                try {
                    if (text.trim().startsWith("{")) {
                        val jsonObj = JSONObject(text)
                        if (jsonObj.has("type") && jsonObj.getString("type") == "remote_response") {
                            val respOutput = jsonObj.getString("output")
                            output += "\n> ${respOutput}"
                        }
                    }
                } catch (e: Exception) {}
            }
            override fun onClosed(webSocket: WebSocket, code: Int, reason: String) {
                connected = false
                output += "\n🔴 Bağlantı koptu."
            }
            override fun onFailure(webSocket: WebSocket, t: Throwable, response: Response?) {
                connected = false
                output += "\n❌ Bağlantı hatası: ${t.message}"
            }
        })
        ws = socket
    }
    
    fun sendCommand(cmd: String) {
        if (!connected) return
        output += "\n$ $cmd"
        val payload = JSONObject().apply {
            put("type", "remote_command")
            put("command", cmd)
            put("commandId", System.currentTimeMillis().toString())
            put("targetDeviceId", "KASA")
        }
        ws?.send(payload.toString())
        command = ""
    }

    Column(modifier = Modifier.fillMaxSize().background(Color(0xFF0F0F0F)).padding(16.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            IconButton(onClick = { ws?.close(1000, "User left"); onBack() }) {
                androidx.compose.material3.Icon(Icons.Default.Close, contentDescription = "Geri", tint = Color.White)
            }
            Text("Uzak Yönetim (C2 Terminal)", color = Color.White, fontSize = 20.sp, fontWeight = FontWeight.Bold)
        }
        
        Spacer(modifier = Modifier.height(16.dp))
        
        // Hazır Butonlar
        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
            Button(onClick = { sendCommand("dir") }, colors = ButtonDefaults.buttonColors(containerColor = Color.DarkGray)) { Text("Test (Dir)", color = Color.White) }
            Button(onClick = { sendCommand("ipconfig") }, colors = ButtonDefaults.buttonColors(containerColor = Color.DarkGray)) { Text("IP Bilgisi", color = Color.White) }
            Button(onClick = { sendCommand("type trendyol_siparis_loglari.txt") }, colors = ButtonDefaults.buttonColors(containerColor = Color.DarkGray)) { Text("Logları Oku", color = Color.White) }
        }
        
        Spacer(modifier = Modifier.height(8.dp))
        
        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
            Button(onClick = { sendCommand("shutdown /r /t 5") }, colors = ButtonDefaults.buttonColors(containerColor = Color.Red)) { Text("Kasayı Yeniden Başlat", color = Color.White) }
            Button(onClick = { sendCommand("taskkill /F /IM SaracApp.exe") }, colors = ButtonDefaults.buttonColors(containerColor = Color.Red)) { Text("Uygulamayı Kapat", color = Color.White) }
        }

        Spacer(modifier = Modifier.height(16.dp))
        
        // Terminal Ekranı
        val scrollState = rememberScrollState()
        Box(modifier = Modifier.fillMaxWidth().weight(1f).background(Color(0xFF1E1E1E), RoundedCornerShape(8.dp)).padding(8.dp).verticalScroll(scrollState)) {
            Text(output, color = Color(0xFF00FF00), fontFamily = FontFamily.Monospace, fontSize = 12.sp)
        }
        
        Spacer(modifier = Modifier.height(16.dp))
        
        Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.fillMaxWidth()) {
            OutlinedTextField(
                value = command,
                onValueChange = { command = it },
                modifier = Modifier.weight(1f),
                placeholder = { Text("CMD komutu yaz...", color = Color.Gray) },
                colors = androidx.compose.material3.OutlinedTextFieldDefaults.colors(
                    focusedTextColor = Color(0xFF00FF00),
                    unfocusedTextColor = Color(0xFF00FF00),
                    focusedBorderColor = Color.DarkGray
                )
            )
            Spacer(modifier = Modifier.width(8.dp))
            Button(
                onClick = { sendCommand(command) },
                enabled = connected && command.isNotBlank(),
                colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF4CAF50))
            ) {
                Text("Gönder", color = Color.White)
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun RemoteFileManagerScreen(onBack: () -> Unit) {
    val context = LocalContext.current
    val prefs = context.getSharedPreferences("SaracogluDefteri", Context.MODE_PRIVATE)
    
    var currentPath by remember { mutableStateOf("") }
    var files by remember { mutableStateOf<List<JSONObject>>(emptyList()) }
    var statusText by remember { mutableStateOf("Kasa'ya bağlanılıyor...") }
    var ws by remember { mutableStateOf<WebSocket?>(null) }
    var connected by remember { mutableStateOf(false) }
    val coroutineScope = rememberCoroutineScope()
    
    // File Picker
    val filePickerLauncher = androidx.activity.compose.rememberLauncherForActivityResult(
        contract = androidx.activity.result.contract.ActivityResultContracts.GetContent()
    ) { uri: android.net.Uri? ->
        if (uri != null) {
            coroutineScope.launch(Dispatchers.IO) {
                try {
                    val inputStream = context.contentResolver.openInputStream(uri)
                    val bytes = inputStream?.readBytes()
                    inputStream?.close()
                    if (bytes != null) {
                        val base64Data = android.util.Base64.encodeToString(bytes, android.util.Base64.NO_WRAP)
                        
                        // Try to get filename
                        var fileName = "upload_${System.currentTimeMillis()}"
                        val cursor = context.contentResolver.query(uri, null, null, null, null)
                        cursor?.use {
                            if (it.moveToFirst()) {
                                val nameIndex = it.getColumnIndex(android.provider.OpenableColumns.DISPLAY_NAME)
                                if (nameIndex >= 0) fileName = it.getString(nameIndex)
                            }
                        }
                        
                        val payload = JSONObject().apply {
                            put("type", "remote_fs_write")
                            put("commandId", System.currentTimeMillis().toString())
                            put("targetDeviceId", "KASA")
                            put("path", if (currentPath.isEmpty()) fileName else "$currentPath\$fileName")
                            put("data", base64Data)
                        }
                        withContext(Dispatchers.Main) {
                            statusText = "Yükleniyor..."
                        }
                        ws?.send(payload.toString())
                    }
                } catch (e: Exception) {
                    withContext(Dispatchers.Main) {
                        statusText = "Yükleme hatası: ${e.message}"
                    }
                }
            }
        }
    }

    LaunchedEffect(Unit) {
        val ip = prefs.getString("KASA_IP", "")?.trim() ?: ""
        val token = prefs.getString("KASA_TOKEN", "") ?: ""
        val devId = prefs.getString("CIHAZ_ID", "") ?: ""
        if (ip.isBlank()) {
            statusText = "Hata: Kasa IP ayarlanmamış."
            return@LaunchedEffect
        }
        
        val termDevId = "${devId}-fm"
        
        val wsUrl = if (ip.startsWith("https://")) {
            ip.replace("https://", "wss://") + (if (ip.endsWith("/")) "ws?token=$token&deviceId=$termDevId" else "/ws?token=$token&deviceId=$termDevId")
        } else if (ip.startsWith("http://")) {
            ip.replace("http://", "ws://") + (if (ip.endsWith("/")) "ws?token=$token&deviceId=$termDevId" else "/ws?token=$token&deviceId=$termDevId")
        } else if (ip.contains("bilalgnd.shop")) {
            "wss://$ip/ws?token=$token&deviceId=$termDevId"
        } else {
            "ws://$ip/ws?token=$token&deviceId=$termDevId"
        }

        val client = OkHttpClient()
        val request = Request.Builder().url(wsUrl).build()
        val socket = client.newWebSocket(request, object : WebSocketListener() {
            override fun onOpen(webSocket: WebSocket, response: Response) {
                connected = true
                statusText = "Bağlandı. Dosyalar alınıyor..."
                val payload = JSONObject().apply {
                    put("type", "remote_fs_list")
                    put("commandId", System.currentTimeMillis().toString())
                    put("targetDeviceId", "KASA")
                    put("path", "")
                }
                webSocket.send(payload.toString())
            }
            override fun onMessage(webSocket: WebSocket, text: String) {
                try {
                    if (text.trim().startsWith("{")) {
                        val jsonObj = JSONObject(text)
                        if (jsonObj.has("type") && jsonObj.getString("type") == "remote_fs_response") {
                            val action = jsonObj.optString("action")
                            if (action == "list") {
                                currentPath = jsonObj.optString("currentPath", "")
                                val dataObj = jsonObj.opt("data")
                                if (dataObj is org.json.JSONArray) {
                                    val list = mutableListOf<JSONObject>()
                                    for (i in 0 until dataObj.length()) {
                                        list.add(dataObj.getJSONObject(i))
                                    }
                                    list.sortBy { !it.optBoolean("isDirectory") }
                                    files = list
                                    statusText = "Hazır ($currentPath)"
                                } else {
                                    statusText = "Liste okunamadı: ${jsonObj.optJSONObject("data")?.optString("error")}"
                                }
                            } else if (action == "read") {
                                val error = jsonObj.optJSONObject("data")?.optString("error")
                                if (error != null && error.isNotEmpty()) {
                                    statusText = "Okuma hatası: $error"
                                } else {
                                    val base64Data = jsonObj.optString("data")
                                    val fileName = jsonObj.optString("fileName", "downloaded_file")
                                    val bytes = android.util.Base64.decode(base64Data, android.util.Base64.DEFAULT)
                                    try {
                                        val downloadsFolder = android.os.Environment.getExternalStoragePublicDirectory(android.os.Environment.DIRECTORY_DOWNLOADS)
                                        val file = java.io.File(downloadsFolder, fileName)
                                        java.io.FileOutputStream(file).use { it.write(bytes) }
                                        statusText = "Dosya İndirildi: ${file.absolutePath}"
                                        
                                        // Open it
                                        val uri = androidx.core.content.FileProvider.getUriForFile(context, "${context.packageName}.provider", file)
                                        val intent = android.content.Intent(android.content.Intent.ACTION_VIEW)
                                        intent.setDataAndType(uri, "*/*")
                                        intent.addFlags(android.content.Intent.FLAG_GRANT_READ_URI_PERMISSION)
                                        context.startActivity(intent)
                                    } catch(e:Exception) {
                                        statusText = "Kaydetme hatası: ${e.message}"
                                    }
                                }
                            } else if (action == "write") {
                                val error = jsonObj.optJSONObject("data")?.optString("error")
                                if (error != null && error.isNotEmpty()) {
                                    statusText = "Yükleme hatası: $error"
                                } else {
                                    statusText = "Dosya Yüklendi!"
                                    // Refresh list
                                    val payload = JSONObject().apply {
                                        put("type", "remote_fs_list")
                                        put("commandId", System.currentTimeMillis().toString())
                                        put("targetDeviceId", "KASA")
                                        put("path", currentPath)
                                    }
                                    webSocket.send(payload.toString())
                                }
                            }
                        }
                    }
                } catch (e: Exception) {
                    statusText = "Veri hatası: ${e.message}"
                }
            }
            override fun onClosed(webSocket: WebSocket, code: Int, reason: String) {
                connected = false
                statusText = "Bağlantı koptu."
            }
            override fun onFailure(webSocket: WebSocket, t: Throwable, response: Response?) {
                connected = false
                statusText = "Bağlantı hatası: ${t.message}"
            }
        })
        ws = socket
    }
    
    Scaffold(
        topBar = {
            androidx.compose.material3.TopAppBar(
                title = { Text("Uzak Dosya Yöneticisi", color = Color.White, fontSize = 18.sp) },
                navigationIcon = {
                    IconButton(onClick = { ws?.close(1000, "User left"); onBack() }) {
                        androidx.compose.material3.Icon(Icons.Default.ArrowBack, contentDescription = "Geri", tint = Color.White)
                    }
                },
                actions = {
                    IconButton(onClick = {
                        statusText = "Yenileniyor..."
                        val payload = JSONObject().apply {
                            put("type", "remote_fs_list")
                            put("commandId", System.currentTimeMillis().toString())
                            put("targetDeviceId", "KASA")
                            put("path", currentPath)
                        }
                        ws?.send(payload.toString())
                    }) {
                        androidx.compose.material3.Icon(Icons.Default.Refresh, contentDescription = "Yenile", tint = Color.White)
                    }
                },
                colors = androidx.compose.material3.TopAppBarDefaults.topAppBarColors(containerColor = Color(0xFF121212))
            )
        },
        floatingActionButton = {
            androidx.compose.material3.FloatingActionButton(
                onClick = { filePickerLauncher.launch("*/*") },
                containerColor = Color(0xFF4CAF50),
                contentColor = Color.White
            ) {
                androidx.compose.material3.Icon(Icons.Default.Add, contentDescription = "Dosya Yükle")
            }
        }
    ) { paddingValues ->
        Column(modifier = Modifier.fillMaxSize().background(Color(0xFF0F0F0F)).padding(paddingValues).padding(8.dp)) {
            
            Text(statusText, color = Color(0xFF4CAF50), fontSize = 12.sp, modifier = Modifier.padding(bottom = 8.dp))
            
            Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.fillMaxWidth().background(Color(0xFF1E1E1E), androidx.compose.foundation.shape.RoundedCornerShape(8.dp)).padding(8.dp)) {
                IconButton(onClick = {
                    val parentPath = currentPath.substringBeforeLast("\\", "").takeIf { it.isNotEmpty() } ?: currentPath.substringBeforeLast("/", "")
                    val payload = JSONObject().apply {
                        put("type", "remote_fs_list")
                        put("commandId", System.currentTimeMillis().toString())
                        put("targetDeviceId", "KASA")
                        put("path", parentPath)
                    }
                    ws?.send(payload.toString())
                }) {
                    androidx.compose.material3.Icon(Icons.Default.KeyboardArrowUp, contentDescription = "Yukarı Çık", tint = Color.White)
                }
                Spacer(Modifier.width(8.dp))
                Text(currentPath.ifEmpty { "Kök Dizin" }, color = Color.White, fontSize = 14.sp, maxLines = 1, modifier = Modifier.weight(1f))
            }
            
            Spacer(Modifier.height(8.dp))
            
            androidx.compose.foundation.lazy.LazyColumn(modifier = Modifier.fillMaxSize()) {
                items(files.size) { index ->
                    val f = files[index]
                    val isDir = f.optBoolean("isDirectory")
                    val name = f.optString("name")
                    val size = f.optLong("size")
                    
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(vertical = 4.dp)
                            .background(Color(0xFF1E1E1E), androidx.compose.foundation.shape.RoundedCornerShape(8.dp))
                            .clickable {
                                if (isDir) {
                                    val newPath = if (currentPath.isEmpty()) name else if (currentPath.contains("\\\\")) "$currentPath\\\\$name" else "$currentPath/$name"
                                    val payload = JSONObject().apply {
                                        put("type", "remote_fs_list")
                                        put("commandId", System.currentTimeMillis().toString())
                                        put("targetDeviceId", "KASA")
                                        put("path", newPath)
                                    }
                                    ws?.send(payload.toString())
                                } else {
                                    statusText = "İndiriliyor: $name"
                                    val targetFile = if (currentPath.isEmpty()) name else if (currentPath.contains("\\\\")) "$currentPath\\\\$name" else "$currentPath/$name"
                                    val payload = JSONObject().apply {
                                        put("type", "remote_fs_read")
                                        put("commandId", System.currentTimeMillis().toString())
                                        put("targetDeviceId", "KASA")
                                        put("path", targetFile)
                                    }
                                    ws?.send(payload.toString())
                                }
                            }
                            .padding(12.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        androidx.compose.material3.Icon(
                            imageVector = if (isDir) Icons.Default.List else Icons.Default.Info,
                            contentDescription = null,
                            tint = if (isDir) Color(0xFFFFC107) else Color.Gray,
                            modifier = Modifier.size(24.dp)
                        )
                        Spacer(Modifier.width(12.dp))
                        Column(modifier = Modifier.weight(1f)) {
                            Text(name, color = Color.White, fontSize = 15.sp, maxLines = 1)
                            if (!isDir) {
                                Text("${size / 1024} KB", color = Color.Gray, fontSize = 12.sp)
                            }
                        }
                    }
                }
            }
        }
    }
}
