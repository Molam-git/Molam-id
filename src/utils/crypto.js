import bcrypt from "bcrypt";
import crypto from "crypto";

const SALT_ROUNDS = 10;

export async function hashPassword(password) {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function verifyPassword(password, hash) {
  return bcrypt.compare(password, hash);
}

export function generateRefreshToken() {
  return crypto.randomBytes(32).toString("hex");
}

export async function hashRefreshToken(token) {
  return bcrypt.hash(token, SALT_ROUNDS);
}

export async function verifyRefreshToken(token, hash) {
  return bcrypt.compare(token, hash);
}

export function generateMolamId() {
  const random = Math.floor(Math.random() * 100000000).toString().padStart(8, "0");
  return `MOLAM-SN-${random}`;
}