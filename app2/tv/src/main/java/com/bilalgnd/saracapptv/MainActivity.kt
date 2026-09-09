package com.bilalgnd.saracapptv

import android.annotation.SuppressLint
import android.content.Context
import android.content.SharedPreferences
import android.graphics.Bitmap
import android.graphics.Color
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.view.KeyEvent
import android.view.View
import android.view.WindowInsets
import android.view.WindowInsetsController
import android.view.WindowManager
import android.webkit.WebChromeClient
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Button
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import com.google.zxing.BarcodeFormat
import com.google.zxing.MultiFormatWriter
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONObject
import java.net.InetSocketAddress
import java.net.Socket
import java.util.concurrent.TimeUnit

class MainActivity : AppCompatActivity() {

    private lateinit var webView: WebView
    private lateinit var statusBadge: LinearLayout
    private lateinit var statusDot: View
    private lateinit var statusText: TextView
    private lateinit var pairingOverlay: LinearLayout
    private lateinit var qrImageView: ImageView
    private lateinit var txtPairCode: TextView
    private lateinit var btnSkipPairing: Button

    private lateinit var prefs: SharedPreferences
    private val httpClient = OkHttpClient.Builder()
        .connectTimeout(4, TimeUnit.SECONDS)
        .readTimeout(4, TimeUnit.SECONDS)
        .build()

    private val scope = CoroutineScope(Dispatchers.Main + Job())
    private var healthCheckJob: Job? = null
    private var pairPollJob: Job? = null

    private val cloudBaseUrl = "https://bilalgnd.shop"
    private var isUsingLocalFailover = false
    private var activeSessionId: String? = null
    private var lastBackPressTime: Long = 0

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        hideSystemUI()

        setContentView(R.layout.activity_main)

        prefs = getSharedPreferences("sarac_tv_prefs", Context.MODE_PRIVATE)

        webView = findViewById(R.id.webView)
        statusBadge = findViewById(R.id.statusBadge)
        statusDot = findViewById(R.id.statusDot)
        statusText = findViewById(R.id.statusText)
        pairingOverlay = findViewById(R.id.pairingOverlay)
        qrImageView = findViewById(R.id.qrImageView)
        txtPairCode = findViewById(R.id.txtPairCode)
        btnSkipPairing = findViewById(R.id.btnSkipPairing)

        btnSkipPairing.setOnClickListener {
            pairingOverlay.visibility = View.GONE
            loadBestUrl()
        }

        setupWebView()

        val isPaired = prefs.getBoolean("is_paired", false)
        if (!isPaired) {
            startPairingFlow()
        } else {
            loadBestUrl()
        }

        startHealthMonitor()
    }

    override fun onResume() {
        super.onResume()
        hideSystemUI()
    }

    private fun hideSystemUI() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            window.insetsController?.let { controller ->
                controller.hide(WindowInsets.Type.statusBars() or WindowInsets.Type.navigationBars())
                controller.systemBarsBehavior = WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
            }
        } else {
            @Suppress("DEPRECATION")
            window.decorView.systemUiVisibility = (
                View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                or View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                or View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                or View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                or View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                or View.SYSTEM_UI_FLAG_FULLSCREEN
            )
        }
    }

    @SuppressLint("SetJavaScriptEnabled")
    private fun setupWebView() {
        val s = webView.settings
        s.javaScriptEnabled = true
        s.domStorageEnabled = true
        s.databaseEnabled = true
        s.loadsImagesAutomatically = true
        s.mediaPlaybackRequiresUserGesture = false
        s.cacheMode = WebSettings.LOAD_DEFAULT
        s.useWideViewPort = true
        s.loadWithOverviewMode = true
        s.userAgentString = s.userAgentString + " SaracAppTV/1.0.0"

        webView.setLayerType(View.LAYER_TYPE_HARDWARE, null)
        webView.setBackgroundColor(Color.parseColor("#080A0F"))

        webView.webViewClient = object : WebViewClient() {
            override fun onReceivedError(view: WebView?, request: WebResourceRequest?, error: WebResourceError?) {
                super.onReceivedError(view, request, error)
                if (request?.isForMainFrame == true) {
                    val failingUrl = request.url.toString()
                    if (failingUrl.startsWith(cloudBaseUrl) && !isUsingLocalFailover) {
                        tryLocalFailover()
                    }
                }
            }

            override fun onPageFinished(view: WebView?, url: String?) {
                super.onPageFinished(view, url)
                updateStatusBadge()
            }
        }

        webView.webChromeClient = WebChromeClient()
    }

    private fun loadBestUrl() {
        val cachedLocalIp = prefs.getString("kasa_local_ip", "") ?: ""
        if (isInternetAvailable()) {
            isUsingLocalFailover = false
            webView.loadUrl("$cloudBaseUrl/tv-sarac")
            updateStatusBadge()
        } else if (cachedLocalIp.isNotEmpty()) {
            isUsingLocalFailover = true
            webView.loadUrl("http://$cachedLocalIp:3005/tv-sarac")
            updateStatusBadge()
        } else {
            discoverKasaAndLoad()
        }
    }

    private fun tryLocalFailover() {
        val cachedLocalIp = prefs.getString("kasa_local_ip", "") ?: ""
        if (cachedLocalIp.isNotEmpty()) {
            isUsingLocalFailover = true
            webView.loadUrl("http://$cachedLocalIp:3005/tv-sarac")
            updateStatusBadge()
        } else {
            discoverKasaAndLoad()
        }
    }

    private fun discoverKasaAndLoad() {
        scope.launch(Dispatchers.IO) {
            val foundIp = scanLocalSubnetForKasa()
            withContext(Dispatchers.Main) {
                if (foundIp != null) {
                    prefs.edit().putString("kasa_local_ip", foundIp).apply()
                    isUsingLocalFailover = true
                    webView.loadUrl("http://$foundIp:3005/tv-sarac")
                    updateStatusBadge()
                } else {
                    statusDot.setBackgroundColor(Color.parseColor("#F44336"))
                    statusText.text = "Bağlantı Yok (Bekleniyor...)"
                }
            }
        }
    }

    private fun scanLocalSubnetForKasa(): String? {
        val candidate = prefs.getString("kasa_local_ip", "192.168.1.50") ?: "192.168.1.50"
        if (isPortOpen(candidate, 3005, 1000)) return candidate

        // Common router / static IPs
        val commonIps = listOf("192.168.1.35", "192.168.1.100", "192.168.1.2", "192.168.1.10", "192.168.0.50")
        for (ip in commonIps) {
            if (isPortOpen(ip, 3005, 500)) return ip
        }
        return null
    }

    private fun isPortOpen(ip: String, port: Int, timeoutMs: Int): Boolean {
        return try {
            Socket().use { socket ->
                socket.connect(InetSocketAddress(ip, port), timeoutMs)
                true
            }
        } catch (_: Exception) {
            false
        }
    }

    private fun updateStatusBadge() {
        if (!isUsingLocalFailover) {
            statusDot.setBackgroundColor(Color.parseColor("#4CAF50"))
            statusText.text = "Bulut (Online)"
        } else {
            statusDot.setBackgroundColor(Color.parseColor("#FFB300"))
            val kasaIp = prefs.getString("kasa_local_ip", "Yerel")
            statusText.text = "Yerel Wi-Fi ($kasaIp)"
        }
    }

    private fun startHealthMonitor() {
        healthCheckJob?.cancel()
        healthCheckJob = scope.launch(Dispatchers.IO) {
            while (isActive) {
                delay(12000)
                val cloudOnline = checkUrlReachable("$cloudBaseUrl/api/orders")
                withContext(Dispatchers.Main) {
                    if (cloudOnline && isUsingLocalFailover) {
                        // Cloud restored!
                        isUsingLocalFailover = false
                        webView.loadUrl("$cloudBaseUrl/tv-sarac")
                        updateStatusBadge()
                    } else if (!cloudOnline && !isUsingLocalFailover) {
                        tryLocalFailover()
                    }
                }
            }
        }
    }

    private fun checkUrlReachable(url: String): Boolean {
        return try {
            val req = Request.Builder().url(url).head().build()
            val res = httpClient.newCall(req).execute()
            res.isSuccessful
        } catch (_: Exception) {
            false
        }
    }

    private fun isInternetAvailable(): Boolean {
        val cm = getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
        val activeNetwork = cm.activeNetwork ?: return false
        val caps = cm.getNetworkCapabilities(activeNetwork) ?: return false
        return caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
    }

    // --- QR PAIRING FLOW ---
    private fun startPairingFlow() {
        pairingOverlay.visibility = View.VISIBLE
        scope.launch(Dispatchers.IO) {
            val targetBase = if (isInternetAvailable()) cloudBaseUrl else {
                val ip = prefs.getString("kasa_local_ip", "192.168.1.50")
                "http://$ip:3005"
            }

            try {
                val req = Request.Builder()
                    .url("$targetBase/api/tv/session")
                    .post("{}".toRequestBody("application/json".toMediaType()))
                    .build()
                val resp = httpClient.newCall(req).execute()
                val body = resp.body?.string() ?: ""
                val json = JSONObject(body)
                val sessionId = json.optString("sessionId")
                val qrPayload = json.optString("qrPayload")

                activeSessionId = sessionId
                val qrBmp = generateQrBitmap(qrPayload, 512, 512)

                withContext(Dispatchers.Main) {
                    qrImageView.setImageBitmap(qrBmp)
                    txtPairCode.text = "Oturum: ${sessionId.takeLast(6).uppercase()}"
                }

                pollPairingStatus(targetBase, sessionId)
            } catch (e: Exception) {
                withContext(Dispatchers.Main) {
                    txtPairCode.text = "Oturum oluşturulamadı: ${e.message}"
                }
            }
        }
    }

    private fun pollPairingStatus(baseUrl: String, sessionId: String) {
        pairPollJob?.cancel()
        pairPollJob = scope.launch(Dispatchers.IO) {
            while (isActive) {
                delay(2000)
                try {
                    val req = Request.Builder()
                        .url("$baseUrl/api/tv/session/$sessionId")
                        .get()
                        .build()
                    val res = httpClient.newCall(req).execute()
                    val body = res.body?.string() ?: ""
                    val json = JSONObject(body)
                    if (json.optString("status") == "approved") {
                        val token = json.optString("token")
                        val shopId = json.optString("shopId", "sarac")
                        val localIp = json.optString("localIp", "")

                        prefs.edit()
                            .putBoolean("is_paired", true)
                            .putString("tv_token", token)
                            .putString("tv_shop_id", shopId)
                            .putString("kasa_local_ip", localIp)
                            .apply()

                        withContext(Dispatchers.Main) {
                            pairingOverlay.visibility = View.GONE
                            Toast.makeText(this@MainActivity, "🎉 TV Başarıyla Eşlendi!", Toast.LENGTH_LONG).show()
                            loadBestUrl()
                        }
                        break
                    }
                } catch (_: Exception) {}
            }
        }
    }

    private fun generateQrBitmap(content: String, width: Int, height: Int): Bitmap {
        val bitMatrix = MultiFormatWriter().encode(content, BarcodeFormat.QR_CODE, width, height)
        val bmp = Bitmap.createBitmap(width, height, Bitmap.Config.RGB_565)
        for (x in 0 until width) {
            for (y in 0 until height) {
                bmp.setPixel(x, y, if (bitMatrix.get(x, y)) Color.BLACK else Color.WHITE)
            }
        }
        return bmp
    }

    override fun onKeyDown(keyCode: Int, event: KeyEvent?): Boolean {
        if (keyCode == KeyEvent.KEYCODE_MENU) {
            startPairingFlow()
            return true
        }
        if (keyCode == KeyEvent.KEYCODE_BACK) {
            val now = System.currentTimeMillis()
            if (now - lastBackPressTime < 2000) {
                finish()
            } else {
                lastBackPressTime = now
                Toast.makeText(this, "Çıkmak için tekrar 'Geri' tuşuna basın", Toast.LENGTH_SHORT).show()
            }
            return true
        }
        return super.onKeyDown(keyCode, event)
    }

    override fun onDestroy() {
        healthCheckJob?.cancel()
        pairPollJob?.cancel()
        super.onDestroy()
    }
}
