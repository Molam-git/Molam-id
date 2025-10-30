export const config = {
  serviceName: "id-profile",
  port: parseInt(process.env.PORT || "3017", 10),
  database: {
    url: process.env.DATABASE_URL || "postgresql://localhost:5432/molam_id"
  },
  jwt: {
    publicKey: process.env.JWT_PUBLIC_KEY || ""
  },
  s3: {
    region: process.env.AWS_REGION || "eu-west-1",
    bucket: process.env.AVATAR_BUCKET || "molam-avatars"
  }
};
