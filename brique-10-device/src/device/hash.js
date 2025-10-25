// hash.js - Device fingerprint hashing (privacy-first)
import crypto from 'crypto';
import { deviceCfg } from './config.js';

/**
 * Canonicalize fingerprint for stable hashing
 * DO NOT store raw identifiers - only hash
 */
export function canonicalizeFingerprint(fp) {
  const canonical = {
    platform: fp.platform || '',
    model: fp.model || '',
    os_name: fp.os_name || '',
    os_version: fp.os_version || '',
    vendor_ids: {
      android_adid: fp.android_adid ? sha256(fp.android_adid) : null,
      android_serial: fp.android_serial ? sha256(fp.android_serial) : null,
      idfv: fp.idfv ? sha256(fp.idfv) : null,
      web_uid: fp.web_uid ? sha256(fp.web_uid) : null
    },
    network: {
      radio: fp.radio || '',
      carrier: fp.carrier || ''
    },
    sensors: fp.sensors ? sanitizeList(fp.sensors) : [],
    screen: fp.screen || '',
    tz: fp.tz || '',
    locale: fp.locale || ''
  };
  return canonical;
}

/**
 * Hash fingerprint with salt/pepper
 * Returns Buffer (BYTEA compatible)
 */
export function fingerprintHash(canonical) {
  const json = JSON.stringify(canonical);
  const salt = deviceCfg.hashPepper;
  return crypto.createHash('sha256').update(salt + ':' + json).digest();
}

function sanitizeList(a) {
  if (!Array.isArray(a)) return [];
  return a.slice(0, 16);
}

function sha256(s) {
  return crypto.createHash('sha256').update(s).digest('hex');
}
