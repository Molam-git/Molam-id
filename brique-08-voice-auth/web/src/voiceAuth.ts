/**
 * Voice Authentication SDK for Web
 * Usage:
 *
 * import { VoiceAuth } from './voiceAuth';
 *
 * const voice = new VoiceAuth('https://api.molam.com', token);
 * await voice.enroll('fr_SN');
 * await voice.verify();
 */

export class VoiceAuth {
  private baseUrl: string;
  private token: string;
  private mediaRecorder: MediaRecorder | null = null;
  private audioChunks: Blob[] = [];

  constructor(baseUrl: string, token: string) {
    this.baseUrl = baseUrl;
    this.token = token;
  }

  /**
   * Enroll user voice
   */
  async enroll(locale: string = 'fr_SN'): Promise<void> {
    // Step 1: Begin enrollment
    const beginResp = await fetch(`${this.baseUrl}/v1/voice/enroll/begin`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.token}`,
      },
      body: JSON.stringify({ locale }),
    });

    if (!beginResp.ok) {
      throw new Error(`Enrollment failed: ${beginResp.statusText}`);
    }

    const { phrase, reqId } = await beginResp.json();

    // Step 2: Show phrase to user and record
    console.log(`Please say: "${phrase}"`);
    const audioBlob = await this.recordAudio(5000); // 5 seconds

    // Step 3: Upload audio
    const base64 = await this.blobToBase64(audioBlob);
    const uploadResp = await fetch(`${this.baseUrl}/v1/voice/upload`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.token}`,
      },
      body: JSON.stringify({
        reqId,
        base64,
        mime: audioBlob.type,
      }),
    });

    if (!uploadResp.ok) {
      throw new Error(`Upload failed: ${uploadResp.statusText}`);
    }

    const { key } = await uploadResp.json();

    // Step 4: Finish enrollment
    const finishResp = await fetch(`${this.baseUrl}/v1/voice/enroll/finish`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.token}`,
      },
      body: JSON.stringify({
        reqId,
        key,
        locale,
        channel: 'web',
        phrase,
      }),
    });

    if (!finishResp.ok) {
      const error = await finishResp.json();
      throw new Error(`Enrollment failed: ${error.error}`);
    }

    console.log('✅ Voice enrolled successfully!');
  }

  /**
   * Verify user voice
   */
  async verify(locale: string = 'fr_SN'): Promise<{ similarity: number; spoofing: number }> {
    // Step 1: Begin verification
    const beginResp = await fetch(`${this.baseUrl}/v1/voice/assert/begin`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.token}`,
      },
      body: JSON.stringify({ locale }),
    });

    if (!beginResp.ok) {
      throw new Error(`Verification failed: ${beginResp.statusText}`);
    }

    const { phrase, reqId } = await beginResp.json();

    // Step 2: Show phrase to user and record
    console.log(`Please say: "${phrase}"`);
    const audioBlob = await this.recordAudio(5000); // 5 seconds

    // Step 3: Upload audio
    const base64 = await this.blobToBase64(audioBlob);
    const uploadResp = await fetch(`${this.baseUrl}/v1/voice/upload`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.token}`,
      },
      body: JSON.stringify({
        reqId,
        base64,
        mime: audioBlob.type,
      }),
    });

    if (!uploadResp.ok) {
      throw new Error(`Upload failed: ${uploadResp.statusText}`);
    }

    const { key } = await uploadResp.json();

    // Step 4: Finish verification
    const finishResp = await fetch(`${this.baseUrl}/v1/voice/assert/finish`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.token}`,
      },
      body: JSON.stringify({
        reqId,
        key,
        channel: 'web',
      }),
    });

    if (!finishResp.ok) {
      const error = await finishResp.json();
      throw new Error(`Verification failed: ${error.error}`);
    }

    const result = await finishResp.json();
    console.log('✅ Voice verified successfully!', result);
    return result;
  }

  /**
   * Record audio from microphone
   */
  private async recordAudio(durationMs: number): Promise<Blob> {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

    this.mediaRecorder = new MediaRecorder(stream, {
      mimeType: 'audio/webm',
    });

    this.audioChunks = [];

    return new Promise((resolve, reject) => {
      this.mediaRecorder!.ondataavailable = (event) => {
        this.audioChunks.push(event.data);
      };

      this.mediaRecorder!.onstop = () => {
        const audioBlob = new Blob(this.audioChunks, { type: 'audio/webm' });
        stream.getTracks().forEach(track => track.stop());
        resolve(audioBlob);
      };

      this.mediaRecorder!.onerror = (error) => {
        reject(error);
      };

      this.mediaRecorder!.start();

      setTimeout(() => {
        this.mediaRecorder!.stop();
      }, durationMs);
    });
  }

  /**
   * Convert Blob to Base64
   */
  private async blobToBase64(blob: Blob): Promise<string> {
    const arrayBuffer = await blob.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);
    let binary = '';
    for (let i = 0; i < uint8Array.byteLength; i++) {
      binary += String.fromCharCode(uint8Array[i]);
    }
    return btoa(binary);
  }

  /**
   * Get user preferences
   */
  async getPreferences(): Promise<any> {
    const resp = await fetch(`${this.baseUrl}/v1/voice/prefs`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${this.token}`,
      },
    });

    if (!resp.ok) {
      throw new Error(`Failed to get preferences: ${resp.statusText}`);
    }

    return resp.json();
  }

  /**
   * Update user preferences
   */
  async updatePreferences(prefs: any): Promise<void> {
    const resp = await fetch(`${this.baseUrl}/v1/voice/prefs`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.token}`,
      },
      body: JSON.stringify(prefs),
    });

    if (!resp.ok) {
      throw new Error(`Failed to update preferences: ${resp.statusText}`);
    }
  }

  /**
   * Revoke voice credentials
   */
  async revoke(): Promise<void> {
    const resp = await fetch(`${this.baseUrl}/v1/voice/credentials`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${this.token}`,
      },
    });

    if (!resp.ok) {
      throw new Error(`Failed to revoke credentials: ${resp.statusText}`);
    }

    console.log('✅ Voice credentials revoked');
  }
}
