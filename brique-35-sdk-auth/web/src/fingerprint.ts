/**
 * Device fingerprinting - Privacy-aware, minimal data collection
 */

export async function buildFingerprint(): Promise<any> {
  // Lightweight, privacy-aware fingerprint
  const nav = typeof navigator !== 'undefined' ? navigator : ({} as any);
  const win = typeof window !== 'undefined' ? window : null;

  const fp: any = {
    ua: nav.userAgent || 'node',
    lang: nav.language || 'en',
    platform: (nav as any).platform || 'unknown',
    tz: getTimezone(),
  };

  // Add screen info only in browser
  if (win && typeof screen !== 'undefined') {
    fp.screen = {
      w: screen.width,
      h: screen.height,
      dpr: devicePixelRatio || 1,
    };
  }

  // Add hardware concurrency if available
  if (nav.hardwareConcurrency) {
    fp.cores = nav.hardwareConcurrency;
  }

  return fp;
}

function getTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return 'UTC';
  }
}

/**
 * Get geolocation if permission granted (optional)
 */
export async function getGeolocation(): Promise<{ lat: number; lng: number } | null> {
  if (typeof navigator === 'undefined' || !navigator.geolocation) {
    return null;
  }

  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
      },
      () => resolve(null),
      { timeout: 5000, maximumAge: 60000 }
    );
  });
}
