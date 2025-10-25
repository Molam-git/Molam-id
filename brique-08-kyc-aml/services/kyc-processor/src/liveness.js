// liveness.js - face match & liveness check (mock)
import fetch from 'node-fetch';

export async function faceMatch(selfieKey, idImageKey) {
  // download images from s3 and call face-match provider
  // return score 0-100

  if (process.env.USE_MOCK_LIVENESS === 'true') {
    console.log('Using mock face match');
    return {
      score: 92.3,
      matched: true,
      confidence: 90.0
    };
  }

  // Real implementation: call vendor API (AWS Rekognition, Face++, etc.)
  // const resp = await fetch(process.env.FACE_MATCH_URL, {...});
  // return resp.json();

  return { score: 85.0, matched: true, confidence: 85.0 };
}

export async function runLiveness(selfieKey) {
  // if video-based liveness use vendor; for still-image run heuristics

  if (process.env.USE_MOCK_LIVENESS === 'true') {
    console.log('Using mock liveness check');
    return {
      result: 'pass',
      confidence: 90.0,
      score: 90.0
    };
  }

  // Real implementation: call liveness detection API
  // const resp = await fetch(process.env.LIVENESS_URL, {...});
  // return resp.json();

  return { result: 'pass', confidence: 80.0, score: 80.0 };
}
