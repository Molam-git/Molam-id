import argon2 from 'argon2';

export function generateOtp() {
    const otpValue = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExp = new Date(Date.now() + 10 * 60 * 1000); // 10 min TTL
    return { otpValue, otpExp };
}

export async function hashOtp(otp: string) {
    return await argon2.hash(otp + process.env.OTP_PEPPER);
}

export async function verifyOtp(otp: string, hash: string) {
    return await argon2.verify(hash, otp + process.env.OTP_PEPPER);
}
