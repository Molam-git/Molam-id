package com.molam.id

import android.content.Context
import android.os.Build
import androidx.work.*
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.*
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONObject
import java.io.IOException
import java.util.*
import java.util.concurrent.TimeUnit

class MolamIdClient(
    private val context: Context,
    private val baseUrl: String,
    private val heartbeatIntervalMin: Long = 15
) {
    private val store: TokenStore = SecureTokenStore(context)
    private val client = OkHttpClient.Builder()
        .readTimeout(30, TimeUnit.SECONDS)
        .writeTimeout(30, TimeUnit.SECONDS)
        .connectTimeout(30, TimeUnit.SECONDS)
        .build()

    // Callbacks
    var onAnomaly: ((kind: String, severity: String, details: Any?) -> Unit)? = null
    var onTokenUpdate: ((tokens: Tokens?) -> Unit)? = null
    var onError: ((error: Exception) -> Unit)? = null

    // Metrics
    private var metrics = Metrics()

    data class Metrics(
        var loginAttempts: Int = 0,
        var refreshes: Int = 0,
        var heartbeatsSent: Int = 0,
        var revocations: Int = 0
    )

    // ============================================================================
    // AUTHENTICATION
    // ============================================================================

    suspend fun signup(
        email: String? = null,
        phone: String? = null,
        password: String,
        locale: String? = null,
        country: String? = null
    ): JSONObject = withContext(Dispatchers.IO) {
        val body = JSONObject().apply {
            email?.let { put("email", it) }
            phone?.let { put("phone", it) }
            put("password", password)
            locale?.let { put("locale", it) }
            country?.let { put("country", it) }
        }

        post("/api/id/auth/signup", body)
    }

    suspend fun login(identifier: String, password: String): Tokens = withContext(Dispatchers.IO) {
        metrics.loginAttempts++

        val body = JSONObject().apply {
            put("identifier", identifier)
            put("password", password)
            put("device", devicePayload())
        }

        val response = post("/api/id/auth/login", body)
        val tokens = adaptTokens(response)

        store.save(tokens)
        onTokenUpdate?.invoke(tokens)
        scheduleHeartbeat()

        tokens
    }

    suspend fun refresh(): Tokens = withContext(Dispatchers.IO) {
        metrics.refreshes++

        val currentTokens = store.load() ?: throw MolamIdException("not_authenticated")

        val body = JSONObject().apply {
            put("refresh_token", currentTokens.refreshToken)
        }

        val response = post("/api/id/auth/refresh", body)
        val newTokens = Tokens(
            accessToken = response.getString("access_token"),
            refreshToken = response.getString("refresh_token"),
            expiresAt = System.currentTimeMillis() + response.optLong("expires_in", 900) * 1000,
            sessionId = currentTokens.sessionId
        )

        store.save(newTokens)
        onTokenUpdate?.invoke(newTokens)

        newTokens
    }

    suspend fun logout(revokeAll: Boolean = false): Unit = withContext(Dispatchers.IO) {
        val tokens = store.load() ?: return@withContext

        try {
            val path = if (revokeAll) "/api/id/sessions/revoke_all" else "/api/id/sessions/${tokens.sessionId}/revoke"
            postAuth(path, JSONObject())
            metrics.revocations++
        } catch (e: Exception) {
            // Ignore errors during logout
        }

        cancelHeartbeat()
        store.save(null)
        onTokenUpdate?.invoke(null)
    }

    // ============================================================================
    // SESSION MANAGEMENT
    // ============================================================================

    suspend fun mySessions(): List<JSONObject> = withContext(Dispatchers.IO) {
        val response = getAuth("/api/id/sessions/me")
        val sessions = response.optJSONArray("sessions") ?: return@withContext emptyList()

        List(sessions.length()) { i -> sessions.getJSONObject(i) }
    }

    suspend fun revokeSession(sessionId: String): Unit = withContext(Dispatchers.IO) {
        postAuth("/api/id/sessions/$sessionId/revoke", JSONObject())
        metrics.revocations++
    }

    suspend fun revokeAllSessions(): Unit = withContext(Dispatchers.IO) {
        postAuth("/api/id/sessions/revoke_all", JSONObject())
        metrics.revocations++
    }

    // ============================================================================
    // HEARTBEAT
    // ============================================================================

    private fun scheduleHeartbeat() {
        val workRequest = PeriodicWorkRequestBuilder<HeartbeatWorker>(
            heartbeatIntervalMin,
            TimeUnit.MINUTES
        )
            .setConstraints(
                Constraints.Builder()
                    .setRequiredNetworkType(NetworkType.CONNECTED)
                    .build()
            )
            .addTag(TAG_HEARTBEAT)
            .build()

        WorkManager.getInstance(context).enqueueUniquePeriodicWork(
            WORK_HEARTBEAT,
            ExistingPeriodicWorkPolicy.UPDATE,
            workRequest
        )
    }

    private fun cancelHeartbeat() {
        WorkManager.getInstance(context).cancelUniqueWork(WORK_HEARTBEAT)
    }

    internal suspend fun heartbeat() = withContext(Dispatchers.IO) {
        val tokens = ensureFreshToken()
        val body = JSONObject().apply {
            put("session_id", tokens.sessionId)
        }

        postAuth("/api/id/sessions/heartbeat", body)
        metrics.heartbeatsSent++
    }

    // ============================================================================
    // USSD
    // ============================================================================

    suspend fun ussdBind(msisdn: String, countryCode: String? = null): Unit = withContext(Dispatchers.IO) {
        val body = JSONObject().apply {
            put("msisdn", msisdn)
            put("country_code", countryCode ?: "auto")
        }

        postAuth("/api/id/ussd/bind", body)
    }

    // ============================================================================
    // USER INFO
    // ============================================================================

    suspend fun isAuthenticated(): Boolean {
        val tokens = store.load() ?: return false

        return if (tokens.isExpired()) {
            try {
                refresh()
                true
            } catch (e: Exception) {
                false
            }
        } else {
            true
        }
    }

    fun getMetrics(): Map<String, Int> = mapOf(
        "loginAttempts" to metrics.loginAttempts,
        "refreshes" to metrics.refreshes,
        "heartbeatsSent" to metrics.heartbeatsSent,
        "revocations" to metrics.revocations
    )

    // ============================================================================
    // HELPERS
    // ============================================================================

    private fun devicePayload(): JSONObject = JSONObject().apply {
        put("fingerprint", JSONObject().apply {
            put("brand", Build.BRAND)
            put("model", Build.MODEL)
            put("sdk", Build.VERSION.SDK_INT)
            put("tz", TimeZone.getDefault().id)
        })
    }

    private fun adaptTokens(response: JSONObject): Tokens {
        val expiresIn = response.optLong("expires_in", 900)
        return Tokens(
            accessToken = response.getString("access_token"),
            refreshToken = response.getString("refresh_token"),
            expiresAt = System.currentTimeMillis() + expiresIn * 1000,
            sessionId = response.getString("session_id")
        )
    }

    private suspend fun ensureFreshToken(): Tokens {
        var tokens = store.load() ?: throw MolamIdException("not_authenticated")

        val skew = 30_000L // 30 seconds
        if (System.currentTimeMillis() >= tokens.expiresAt - skew) {
            tokens = refresh()
        }

        return tokens
    }

    // ============================================================================
    // HTTP METHODS
    // ============================================================================

    private fun getAuth(path: String): JSONObject {
        val tokens = store.load() ?: throw MolamIdException("not_authenticated")

        val request = Request.Builder()
            .url("$baseUrl$path")
            .get()
            .addHeader("Authorization", "Bearer ${tokens.accessToken}")
            .build()

        return execute(request)
    }

    private fun post(path: String, body: JSONObject): JSONObject {
        val request = Request.Builder()
            .url("$baseUrl$path")
            .post(body.toString().toRequestBody(MEDIA_TYPE_JSON))
            .addHeader("Content-Type", "application/json")
            .build()

        return execute(request)
    }

    private fun postAuth(path: String, body: JSONObject): JSONObject {
        val tokens = store.load() ?: throw MolamIdException("not_authenticated")

        val request = Request.Builder()
            .url("$baseUrl$path")
            .post(body.toString().toRequestBody(MEDIA_TYPE_JSON))
            .addHeader("Content-Type", "application/json")
            .addHeader("Authorization", "Bearer ${tokens.accessToken}")
            .build()

        return execute(request)
    }

    private fun execute(request: Request): JSONObject {
        client.newCall(request).execute().use { response ->
            // Check for rate limiting
            if (response.code == 429) {
                throw MolamIdException("rate_limited")
            }

            // Check for anomaly header
            response.header("x-molam-anomaly")?.let { anomalyHeader ->
                try {
                    val anomaly = JSONObject(anomalyHeader)
                    onAnomaly?.invoke(
                        kind = anomaly.getString("kind"),
                        severity = anomaly.getString("severity"),
                        details = anomaly.opt("details")
                    )
                } catch (e: Exception) {
                    // Ignore parse errors
                }
            }

            // Handle success
            if (response.isSuccessful) {
                val bodyString = response.body?.string() ?: "{}"
                return if (bodyString.isBlank()) JSONObject() else JSONObject(bodyString)
            }

            // Handle authentication errors
            if (response.code == 401) {
                store.save(null)
                onTokenUpdate?.invoke(null)
                cancelHeartbeat()
                throw MolamIdException("unauthorized")
            }

            throw MolamIdException("http_${response.code}: ${response.body?.string()}")
        }
    }

    companion object {
        private val MEDIA_TYPE_JSON = "application/json; charset=utf-8".toMediaType()
        private const val TAG_HEARTBEAT = "molam_id_heartbeat"
        private const val WORK_HEARTBEAT = "molam_id_heartbeat_work"
    }
}

// ============================================================================
// EXCEPTIONS
// ============================================================================

class MolamIdException(message: String) : Exception(message)

// ============================================================================
// HEARTBEAT WORKER
// ============================================================================

class HeartbeatWorker(
    context: Context,
    params: WorkerParameters
) : CoroutineWorker(context, params) {

    override suspend fun doWork(): Result {
        // Note: In production, you'd need to pass baseUrl from WorkData
        // or store it in SharedPreferences
        return try {
            val store = SecureTokenStore(applicationContext)
            val tokens = store.load() ?: return Result.success()

            // Simplified heartbeat - in production, use full client
            val client = OkHttpClient()
            val body = JSONObject().apply {
                put("session_id", tokens.sessionId)
            }.toString()

            val request = Request.Builder()
                .url("${inputData.getString("baseUrl")}/api/id/sessions/heartbeat")
                .post(body.toRequestBody("application/json".toMediaType()))
                .addHeader("Authorization", "Bearer ${tokens.accessToken}")
                .build()

            client.newCall(request).execute().close()
            Result.success()
        } catch (e: Exception) {
            Result.retry()
        }
    }
}
