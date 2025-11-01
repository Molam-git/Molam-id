package com.molam.id

import android.content.Context
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey
import com.squareup.moshi.Moshi
import com.squareup.moshi.kotlin.reflect.KotlinJsonAdapterFactory

data class Tokens(
    val accessToken: String,
    val refreshToken: String,
    val expiresAt: Long,
    val sessionId: String
) {
    fun isExpired(): Boolean = System.currentTimeMillis() >= expiresAt
}

interface TokenStore {
    fun load(): Tokens?
    fun save(tokens: Tokens?)
}

class SecureTokenStore(context: Context) : TokenStore {
    private val masterKey = MasterKey.Builder(context)
        .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
        .build()

    private val sharedPreferences = EncryptedSharedPreferences.create(
        context,
        "molam_id_tokens",
        masterKey,
        EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
        EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
    )

    private val moshi = Moshi.Builder()
        .add(KotlinJsonAdapterFactory())
        .build()
    private val adapter = moshi.adapter(Tokens::class.java)

    override fun load(): Tokens? {
        val json = sharedPreferences.getString(KEY_TOKENS, null) ?: return null
        return try {
            adapter.fromJson(json)
        } catch (e: Exception) {
            null
        }
    }

    override fun save(tokens: Tokens?) {
        if (tokens == null) {
            sharedPreferences.edit().remove(KEY_TOKENS).apply()
        } else {
            val json = adapter.toJson(tokens)
            sharedPreferences.edit().putString(KEY_TOKENS, json).apply()
        }
    }

    companion object {
        private const val KEY_TOKENS = "tokens"
    }
}
