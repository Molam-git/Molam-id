/**
 * Molam Auth SDK - Android (Kotlin)
 * Universal authentication SDK for Molam ID
 *
 * Version: 1.0.0
 * Author: Molam
 */

package com.molam.auth

import android.content.Context
import android.content.SharedPreferences
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKeys
import kotlinx.coroutines.*
import okhttp3.*
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONObject
import java.io.IOException
import java.util.*

data class MolamAuthConfig(
    val baseUrl: String,
    val apiKey: String? = null,
    val autoRefresh: Boolean = true
)

data class LoginRequest(
    val identifier: String,
    val password: String,
    val deviceId: String? = null,
    val deviceType: String = "android"
)

data class AuthResponse(
    val accessToken: String,
    val refreshToken: String,
    val expiresIn: Int,
    val tokenType: String,
    val user: User
) {
    data class User(
        val id: String,
        val email: String?,
        val phoneE164: String?
    )
}

class MolamAuth private constructor(
    private val context: Context,
    private val config: MolamAuthConfig
) {
    private val prefs: SharedPreferences
    private val client = OkHttpClient()
    private var refreshJob: Job? = null

    init {
        val masterKeyAlias = MasterKeys.getOrCreate(MasterKeys.AES256_GCM_SPEC)
        prefs = EncryptedSharedPreferences.create(
            "molam_auth_prefs",
            masterKeyAlias,
            context,
            EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
            EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
        )
    }

    companion object {
        @Volatile
        private var instance: MolamAuth? = null

        fun init(context: Context, config: MolamAuthConfig): MolamAuth {
            return instance ?: synchronized(this) {
                instance ?: MolamAuth(context.applicationContext, config).also { instance = it }
            }
        }

        fun getInstance(): MolamAuth {
            return instance ?: throw IllegalStateException("MolamAuth not initialized. Call init() first.")
        }
    }

    // MARK: - Public API

    suspend fun login(request: LoginRequest): Result<AuthResponse> = withContext(Dispatchers.IO) {
        val deviceId = request.deviceId ?: getOrCreateDeviceId()

        val json = JSONObject().apply {
            put("identifier", request.identifier)
            put("password", request.password)
            put("device_id", deviceId)
            put("device_type", request.deviceType)
        }

        val result = makeRequest("/api/id/auth/login", json)

        result.fold(
            onSuccess = { response ->
                val authResponse = parseAuthResponse(response)
                setTokens(authResponse.accessToken, authResponse.refreshToken)

                if (config.autoRefresh) {
                    scheduleRefresh(authResponse.expiresIn)
                }

                Result.success(authResponse)
            },
            onFailure = { error ->
                Result.failure(error)
            }
        )
    }

    suspend fun refresh(): Result<AuthResponse> = withContext(Dispatchers.IO) {
        val refreshToken = getRefreshToken()
            ?: return@withContext Result.failure(Exception("No refresh token available"))

        val json = JSONObject().apply {
            put("refresh_token", refreshToken)
        }

        val result = makeRequest("/api/id/auth/refresh", json)

        result.fold(
            onSuccess = { response ->
                val authResponse = parseAuthResponse(response)
                setTokens(authResponse.accessToken, authResponse.refreshToken)

                if (config.autoRefresh) {
                    scheduleRefresh(authResponse.expiresIn)
                }

                Result.success(authResponse)
            },
            onFailure = { error ->
                clearTokens()
                Result.failure(error)
            }
        )
    }

    suspend fun logout(sessionId: String? = null): Result<Unit> = withContext(Dispatchers.IO) {
        val accessToken = getAccessToken()

        if (accessToken != null) {
            val json = JSONObject().apply {
                sessionId?.let { put("session_id", it) }
            }

            makeAuthenticatedRequest("/api/id/auth/logout", json, accessToken)
        }

        clearTokens()
        refreshJob?.cancel()
        refreshJob = null

        Result.success(Unit)
    }

    fun getAccessToken(): String? {
        return prefs.getString("access_token", null)
    }

    fun getRefreshToken(): String? {
        return prefs.getString("refresh_token", null)
    }

    fun isAuthenticated(): Boolean {
        return getAccessToken() != null
    }

    suspend fun authenticatedRequest(
        path: String,
        json: JSONObject,
        method: String = "POST"
    ): Result<String> = withContext(Dispatchers.IO) {
        val accessToken = getAccessToken()
            ?: return@withContext Result.failure(Exception("Not authenticated"))

        val result = makeAuthenticatedRequest(path, json, accessToken, method)

        // Auto-refresh on 401
        if (result.isFailure && result.exceptionOrNull()?.message?.contains("401") == true) {
            if (config.autoRefresh) {
                val refreshResult = refresh()
                if (refreshResult.isSuccess) {
                    val newToken = getAccessToken()!!
                    return@withContext makeAuthenticatedRequest(path, json, newToken, method)
                }
            }
        }

        result
    }

    // MARK: - Private Methods

    private fun setTokens(accessToken: String, refreshToken: String) {
        prefs.edit().apply {
            putString("access_token", accessToken)
            putString("refresh_token", refreshToken)
            apply()
        }
    }

    private fun clearTokens() {
        prefs.edit().apply {
            remove("access_token")
            remove("refresh_token")
            apply()
        }
    }

    private fun scheduleRefresh(expiresIn: Int) {
        refreshJob?.cancel()

        val refreshIn = maxOf((expiresIn - 60) * 1000L, 0L)

        refreshJob = CoroutineScope(Dispatchers.IO).launch {
            delay(refreshIn)
            refresh()
        }
    }

    private fun getOrCreateDeviceId(): String {
        val key = "device_id"
        var deviceId = prefs.getString(key, null)

        if (deviceId == null) {
            deviceId = "android-${UUID.randomUUID()}"
            prefs.edit().putString(key, deviceId).apply()
        }

        return deviceId
    }

    private suspend fun makeRequest(
        path: String,
        json: JSONObject,
        method: String = "POST"
    ): Result<String> = suspendCancellableCoroutine { continuation ->
        val url = "${config.baseUrl}$path"

        val requestBuilder = Request.Builder()
            .url(url)
            .addHeader("Content-Type", "application/json")

        config.apiKey?.let {
            requestBuilder.addHeader("X-API-Key", it)
        }

        val body = json.toString().toRequestBody("application/json".toMediaType())

        when (method) {
            "POST" -> requestBuilder.post(body)
            "PUT" -> requestBuilder.put(body)
            "PATCH" -> requestBuilder.patch(body)
            "DELETE" -> requestBuilder.delete(body)
            else -> requestBuilder.post(body)
        }

        client.newCall(requestBuilder.build()).enqueue(object : Callback {
            override fun onFailure(call: Call, e: IOException) {
                continuation.resumeWith(Result.failure(e))
            }

            override fun onResponse(call: Call, response: Response) {
                if (response.isSuccessful) {
                    val responseBody = response.body?.string() ?: ""
                    continuation.resumeWith(Result.success(responseBody))
                } else {
                    continuation.resumeWith(
                        Result.failure(
                            Exception("HTTP ${response.code}: ${response.message}")
                        )
                    )
                }
            }
        })
    }

    private suspend fun makeAuthenticatedRequest(
        path: String,
        json: JSONObject,
        accessToken: String,
        method: String = "POST"
    ): Result<String> = suspendCancellableCoroutine { continuation ->
        val url = "${config.baseUrl}$path"

        val requestBuilder = Request.Builder()
            .url(url)
            .addHeader("Content-Type", "application/json")
            .addHeader("Authorization", "Bearer $accessToken")

        val body = json.toString().toRequestBody("application/json".toMediaType())

        when (method) {
            "POST" -> requestBuilder.post(body)
            "PUT" -> requestBuilder.put(body)
            "PATCH" -> requestBuilder.patch(body)
            "DELETE" -> requestBuilder.delete(body)
            else -> requestBuilder.post(body)
        }

        client.newCall(requestBuilder.build()).enqueue(object : Callback {
            override fun onFailure(call: Call, e: IOException) {
                continuation.resumeWith(Result.failure(e))
            }

            override fun onResponse(call: Call, response: Response) {
                if (response.isSuccessful) {
                    val responseBody = response.body?.string() ?: ""
                    continuation.resumeWith(Result.success(responseBody))
                } else {
                    continuation.resumeWith(
                        Result.failure(
                            Exception("HTTP ${response.code}: ${response.message}")
                        )
                    )
                }
            }
        })
    }

    private fun parseAuthResponse(jsonString: String): AuthResponse {
        val json = JSONObject(jsonString)
        val userJson = json.getJSONObject("user")

        return AuthResponse(
            accessToken = json.getString("access_token"),
            refreshToken = json.getString("refresh_token"),
            expiresIn = json.getInt("expires_in"),
            tokenType = json.getString("token_type"),
            user = AuthResponse.User(
                id = userJson.getString("id"),
                email = userJson.optString("email").takeIf { it.isNotEmpty() },
                phoneE164 = userJson.optString("phone_e164").takeIf { it.isNotEmpty() }
            )
        )
    }
}
