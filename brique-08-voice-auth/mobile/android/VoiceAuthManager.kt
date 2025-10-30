package com.molam.voiceauth

import android.content.Context
import android.media.MediaRecorder
import android.util.Base64
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONObject
import java.io.File
import java.util.UUID

/**
 * Voice Authentication Manager for Android
 *
 * Usage:
 * val voiceAuth = VoiceAuthManager(context, "https://api.molam.com", token)
 * voiceAuth.enroll("fr_SN") { success, error -> ... }
 * voiceAuth.verify("fr_SN") { similarity, spoofing, error -> ... }
 */

class VoiceAuthManager(
    private val context: Context,
    private val baseURL: String,
    private val token: String
) {
    private val client = OkHttpClient()
    private var mediaRecorder: MediaRecorder? = null
    private var recordingFile: File? = null

    // MARK: - Enrollment

    suspend fun enroll(locale: String = "fr_SN"): Result<Unit> = withContext(Dispatchers.IO) {
        try {
            // Step 1: Begin enrollment
            val beginData = beginEnroll(locale)
            val phrase = beginData.getString("phrase")
            val reqId = beginData.getString("reqId")

            println("Please say: \"$phrase\"")

            // Step 2: Record audio
            val audioData = recordAudio(5000) // 5 seconds

            // Step 3: Upload
            val key = uploadAudio(reqId, audioData)

            // Step 4: Finish
            finishEnroll(reqId, key, locale, phrase)

            println("✅ Voice enrolled successfully!")
            Result.success(Unit)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    private suspend fun beginEnroll(locale: String): JSONObject = withContext(Dispatchers.IO) {
        val json = JSONObject().apply {
            put("locale", locale)
        }

        val request = Request.Builder()
            .url("$baseURL/v1/voice/enroll/begin")
            .post(json.toString().toRequestBody("application/json".toMediaType()))
            .addHeader("Authorization", "Bearer $token")
            .build()

        client.newCall(request).execute().use { response ->
            if (!response.isSuccessful) throw Exception("Enrollment failed: ${response.code}")
            JSONObject(response.body?.string() ?: throw Exception("Empty response"))
        }
    }

    private suspend fun finishEnroll(
        reqId: String,
        key: String,
        locale: String,
        phrase: String
    ) = withContext(Dispatchers.IO) {
        val json = JSONObject().apply {
            put("reqId", reqId)
            put("key", key)
            put("locale", locale)
            put("channel", "mobile_app")
            put("phrase", phrase)
        }

        val request = Request.Builder()
            .url("$baseURL/v1/voice/enroll/finish")
            .post(json.toString().toRequestBody("application/json".toMediaType()))
            .addHeader("Authorization", "Bearer $token")
            .build()

        client.newCall(request).execute().use { response ->
            if (!response.isSuccessful) throw Exception("Enrollment failed: ${response.code}")
        }
    }

    // MARK: - Verification

    suspend fun verify(locale: String = "fr_SN"): Result<Pair<Double, Double>> =
        withContext(Dispatchers.IO) {
            try {
                // Step 1: Begin verification
                val beginData = beginVerify(locale)
                val phrase = beginData.getString("phrase")
                val reqId = beginData.getString("reqId")

                println("Please say: \"$phrase\"")

                // Step 2: Record audio
                val audioData = recordAudio(5000) // 5 seconds

                // Step 3: Upload
                val key = uploadAudio(reqId, audioData)

                // Step 4: Finish
                val result = finishVerify(reqId, key)
                val similarity = result.getDouble("similarity")
                val spoofing = result.getDouble("spoofing")

                println("✅ Voice verified! Similarity: $similarity, Spoofing: $spoofing")
                Result.success(Pair(similarity, spoofing))
            } catch (e: Exception) {
                Result.failure(e)
            }
        }

    private suspend fun beginVerify(locale: String): JSONObject = withContext(Dispatchers.IO) {
        val json = JSONObject().apply {
            put("locale", locale)
        }

        val request = Request.Builder()
            .url("$baseURL/v1/voice/assert/begin")
            .post(json.toString().toRequestBody("application/json".toMediaType()))
            .addHeader("Authorization", "Bearer $token")
            .build()

        client.newCall(request).execute().use { response ->
            if (!response.isSuccessful) throw Exception("Verification failed: ${response.code}")
            JSONObject(response.body?.string() ?: throw Exception("Empty response"))
        }
    }

    private suspend fun finishVerify(reqId: String, key: String): JSONObject =
        withContext(Dispatchers.IO) {
            val json = JSONObject().apply {
                put("reqId", reqId)
                put("key", key)
                put("channel", "mobile_app")
            }

            val request = Request.Builder()
                .url("$baseURL/v1/voice/assert/finish")
                .post(json.toString().toRequestBody("application/json".toMediaType()))
                .addHeader("Authorization", "Bearer $token")
                .build()

            client.newCall(request).execute().use { response ->
                if (!response.isSuccessful) throw Exception("Verification failed: ${response.code}")
                JSONObject(response.body?.string() ?: throw Exception("Empty response"))
            }
        }

    // MARK: - Audio Recording

    private suspend fun recordAudio(durationMs: Long): ByteArray = withContext(Dispatchers.IO) {
        val outputFile = File(context.cacheDir, "voice_${UUID.randomUUID()}.3gp")
        recordingFile = outputFile

        mediaRecorder = MediaRecorder().apply {
            setAudioSource(MediaRecorder.AudioSource.MIC)
            setOutputFormat(MediaRecorder.OutputFormat.THREE_GPP)
            setAudioEncoder(MediaRecorder.AudioEncoder.AMR_NB)
            setOutputFile(outputFile.absolutePath)
            prepare()
            start()
        }

        // Wait for recording duration
        kotlinx.coroutines.delay(durationMs)

        mediaRecorder?.apply {
            stop()
            release()
        }
        mediaRecorder = null

        val audioData = outputFile.readBytes()
        outputFile.delete()
        audioData
    }

    // MARK: - Upload

    private suspend fun uploadAudio(reqId: String, audioData: ByteArray): String =
        withContext(Dispatchers.IO) {
            val base64 = Base64.encodeToString(audioData, Base64.NO_WRAP)

            val json = JSONObject().apply {
                put("reqId", reqId)
                put("base64", base64)
                put("mime", "audio/3gp")
            }

            val request = Request.Builder()
                .url("$baseURL/v1/voice/upload")
                .post(json.toString().toRequestBody("application/json".toMediaType()))
                .addHeader("Authorization", "Bearer $token")
                .build()

            client.newCall(request).execute().use { response ->
                if (!response.isSuccessful) throw Exception("Upload failed: ${response.code}")
                val result = JSONObject(response.body?.string() ?: throw Exception("Empty response"))
                result.getString("key")
            }
        }

    // MARK: - Cleanup

    fun cleanup() {
        mediaRecorder?.release()
        mediaRecorder = null
        recordingFile?.delete()
    }
}
