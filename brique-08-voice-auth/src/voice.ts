export async function enrollBegin(locale: string) {
  const r = await fetch("/v1/voice/enroll/begin", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ locale }) });
  return r.json();
}
export async function uploadAudio(reqId: string, blob: Blob) {
  const base64 = await blobToBase64(blob);
  const r = await fetch("/v1/voice/upload", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reqId, base64, mime: blob.type }) });
  return r.json();
}
export async function enrollFinish(reqId: string, key: string, locale: string, phrase: string) {
  const r = await fetch("/v1/voice/enroll/finish", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reqId, key, locale, phrase }) });
  return r.json();
}
export async function assertBegin() {
  const r = await fetch("/v1/voice/assert/begin", { method: "POST" });
  return r.json();
}
export async function assertFinish(reqId: string, key: string) {
  const r = await fetch("/v1/voice/assert/finish", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reqId, key }) });
  return r.json();
}
async function blobToBase64(blob: Blob) {
  const arr = new Uint8Array(await blob.arrayBuffer());
  let s = ""; arr.forEach((b) => s += String.fromCharCode(b));
  return btoa(s);
}
