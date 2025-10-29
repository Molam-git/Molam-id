import sharp from "sharp";
import { S3Client, GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { Pool } from "pg";

export async function processAvatar(db: Pool, s3: S3Client, bucket: string, key: string) {
    const src = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
    const buf = await src.Body!.transformToByteArray();

    const variants = {
        "200x200": await sharp(buf).resize(200, 200).jpeg({ quality: 85 }).toBuffer(),
        "512x512": await sharp(buf).resize(512, 512).jpeg({ quality: 85 }).toBuffer()
    };

    const variantKeys: Record<string, string> = {};
    for (const [size, vb] of Object.entries(variants)) {
        const vKey = key.replace("original", size);
        await s3.send(new PutObjectCommand({ Bucket: bucket, Key: vKey, Body: vb, ContentType: "image/jpeg" }));
        variantKeys[size] = vKey;
    }

    await db.query(
        `UPDATE molam_media_assets SET status='ready', variants=$2, updated_at=NOW()
     WHERE storage_key=$1`,
        [key, variantKeys]
    );
}