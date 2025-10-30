import request from "supertest";
import { app } from "../src/server";

describe("Voice Auth", () => {
  it("should enroll then assert", async () => {
    const token = await getUserJWT(); // helper
    const b = await request(app).post("/v1/voice/enroll/begin").set("Authorization", `Bearer ${token}`).send({ locale: "fr_SN" }).expect(200);
    const reqId = b.body.reqId;
    // simulate upload (fixture):
    const base64 = Buffer.from("RIFF....WAVEfmt ").toString("base64");
    const up = await request(app).post("/v1/voice/upload").set("Authorization", `Bearer ${token}`).send({ reqId, base64, mime: "audio/wav" }).expect(200);
    await request(app).post("/v1/voice/enroll/finish").set("Authorization", `Bearer ${token}`).send({ reqId, key: up.body.key, locale: "fr_SN" }).expect(200);

    const ab = await request(app).post("/v1/voice/assert/begin").set("Authorization", `Bearer ${token}`).send({}).expect(200);
    const up2 = await request(app).post("/v1/voice/upload").set("Authorization", `Bearer ${token}`).send({ reqId: ab.body.reqId, base64, mime: "audio/wav" }).expect(200);
    await request(app).post("/v1/voice/assert/finish").set("Authorization", `Bearer ${token}`).send({ reqId: ab.body.reqId, key: up2.body.key }).expect(200);
  });
});
