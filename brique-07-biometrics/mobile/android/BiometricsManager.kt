// mobile/android/BiometricsManager.kt
// Android implementation using BiometricPrompt + StrongBox Keystore

package com.molam.biometrics

import android.content.Context
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import androidx.biometric.BiometricManager
import androidx.biometric.BiometricPrompt
import androidx.fragment.app.FragmentActivity
import java.security.KeyPairGenerator
import java.security.KeyStore
import java.security.PrivateKey
import java.security.Signature
import java.util.concurrent.Executor

class BiometricsManager(private val context: Context) {

    private val keyAlias = "molam_biometric_key"
    private val serverURL = "https://api.molam.com"

    /**
     * Check if biometrics are available
     */
    fun isBiometricAvailable(): Boolean {
        val biometricManager = BiometricManager.from(context)
        return when (biometricManager.canAuthenticate(BiometricManager.Authenticators.BIOMETRIC_STRONG)) {
            BiometricManager.BIOMETRIC_SUCCESS -> true
            else -> false
        }
    }

    /**
     * Enroll biometrics
     * Generates keypair in StrongBox (hardware-backed keystore)
     */
    fun enrollBiometrics(
        activity: FragmentActivity,
        executor: Executor,
        onSuccess: () -> Unit,
        onError: (String) -> Unit
    ) {
        try {
            // Step 1: Generate keypair in StrongBox
            val keyPair = generateKeyPair()

            // Step 2: Request enrollment options from server
            requestEnrollmentOptions { result ->
                when (result) {
                    is Result.Success -> {
                        val (options, deviceId) = result.data

                        // Step 3: Get public key
                        val publicKey = keyPair.public.encoded

                        // Step 4: Send to server
                        finishEnrollment(deviceId, publicKey) { finishResult ->
                            when (finishResult) {
                                is Result.Success -> onSuccess()
                                is Result.Error -> onError(finishResult.message)
                            }
                        }
                    }
                    is Result.Error -> onError(result.message)
                }
            }
        } catch (e: Exception) {
            onError("Enrollment failed: ${e.message}")
        }
    }

    /**
     * Verify biometrics (step-up authentication)
     */
    fun verifyBiometrics(
        activity: FragmentActivity,
        executor: Executor,
        onSuccess: () -> Unit,
        onError: (String) -> Unit
    ) {
        // Step 1: Request assertion options from server
        requestAssertionOptions { result ->
            when (result) {
                is Result.Success -> {
                    val challenge = result.data

                    // Step 2: Create BiometricPrompt
                    val promptInfo = BiometricPrompt.PromptInfo.Builder()
                        .setTitle("Verify Identity")
                        .setSubtitle("Use your fingerprint or face")
                        .setNegativeButtonText("Cancel")
                        .setAllowedAuthenticators(BiometricManager.Authenticators.BIOMETRIC_STRONG)
                        .build()

                    val biometricPrompt = BiometricPrompt(activity, executor,
                        object : BiometricPrompt.AuthenticationCallback() {
                            override fun onAuthenticationSucceeded(
                                result: BiometricPrompt.AuthenticationResult
                            ) {
                                super.onAuthenticationSucceeded(result)

                                // Step 3: Sign challenge
                                try {
                                    val signature = signChallenge(challenge)

                                    // Step 4: Send to server
                                    finishAssertion(signature) { assertResult ->
                                        when (assertResult) {
                                            is Result.Success -> onSuccess()
                                            is Result.Error -> onError(assertResult.message)
                                        }
                                    }
                                } catch (e: Exception) {
                                    onError("Signing failed: ${e.message}")
                                }
                            }

                            override fun onAuthenticationError(errorCode: Int, errString: CharSequence) {
                                super.onAuthenticationError(errorCode, errString)
                                onError("Authentication error: $errString")
                            }

                            override fun onAuthenticationFailed() {
                                super.onAuthenticationFailed()
                                onError("Authentication failed")
                            }
                        })

                    biometricPrompt.authenticate(promptInfo)
                }
                is Result.Error -> onError(result.message)
            }
        }
    }

    // MARK: - Private Methods

    private fun generateKeyPair(): java.security.KeyPair {
        val keyPairGenerator = KeyPairGenerator.getInstance(
            KeyProperties.KEY_ALGORITHM_EC,
            "AndroidKeyStore"
        )

        val keyGenSpec = KeyGenParameterSpec.Builder(
            keyAlias,
            KeyProperties.PURPOSE_SIGN or KeyProperties.PURPOSE_VERIFY
        )
            .setDigests(KeyProperties.DIGEST_SHA256)
            .setUserAuthenticationRequired(true)
            .setUserAuthenticationParameters(
                0, // timeout (0 = every use)
                KeyProperties.AUTH_BIOMETRIC_STRONG
            )
            .setIsStrongBoxBacked(true) // Use hardware-backed key (StrongBox on Pixel, Samsung, etc.)
            .build()

        keyPairGenerator.initialize(keyGenSpec)
        return keyPairGenerator.generateKeyPair()
    }

    private fun signChallenge(challenge: ByteArray): ByteArray {
        val keyStore = KeyStore.getInstance("AndroidKeyStore")
        keyStore.load(null)

        val privateKey = keyStore.getKey(keyAlias, null) as PrivateKey

        val signature = Signature.getInstance("SHA256withECDSA")
        signature.initSign(privateKey)
        signature.update(challenge)

        return signature.sign()
    }

    private fun requestEnrollmentOptions(callback: (Result<Pair<Map<String, Any>, String>>) -> Unit) {
        // Network call to server (use Retrofit, OkHttp, etc.)
        // Placeholder implementation
        callback(Result.Success(Pair(emptyMap(), "device-id")))
    }

    private fun finishEnrollment(deviceId: String, publicKey: ByteArray, callback: (Result<Unit>) -> Unit) {
        // Network call to server
        callback(Result.Success(Unit))
    }

    private fun requestAssertionOptions(callback: (Result<ByteArray>) -> Unit) {
        // Network call to server
        callback(Result.Success(ByteArray(32)))
    }

    private fun finishAssertion(signature: ByteArray, callback: (Result<Unit>) -> Unit) {
        // Network call to server
        callback(Result.Success(Unit))
    }

    sealed class Result<out T> {
        data class Success<T>(val data: T) : Result<T>()
        data class Error(val message: String) : Result<Nothing>()
    }
}
