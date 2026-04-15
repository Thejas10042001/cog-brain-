// @ts-ignore
import { authenticator } from 'otplib';
import qrcode from 'qrcode';
import nodemailer from 'nodemailer';
import bcrypt from 'bcryptjs';
import { UAParser } from 'ua-parser-js';
import crypto from 'crypto';

// TOTP Configuration
authenticator.options = {
  window: 1, // Allow 1 step before/after
};

export const generateTOTPSecret = (userEmail: string) => {
  const secret = authenticator.generateSecret();
  const otpauth = authenticator.keyuri(userEmail, 'SalesGPT', secret);
  return { secret, otpauth };
};

export const verifyTOTP = (token: string, secret: string) => {
  return authenticator.verify({ token, secret });
};

export const generateQRCode = async (otpauth: string) => {
  return await qrcode.toDataURL(otpauth);
};

export const generateEmailOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

export const sendEmailOTP = async (email: string, otp: string) => {
  // In a real app, you'd use real credentials.
  // For this demo, we'll log it and try to send if credentials exist.
  console.log(`Sending OTP ${otp} to ${email}`);
  
  if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT) || 587,
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    await transporter.sendMail({
      from: '"SalesGPT Security" <security@salesgpt.ai>',
      to: email,
      subject: "Your MFA Verification Code",
      text: `Your verification code is: ${otp}. It expires in 5 minutes.`,
      html: `<b>Your verification code is: ${otp}</b><p>It expires in 5 minutes.</p>`,
    });
  }
};

export const hashBackupCodes = async (codes: string[]) => {
  return await Promise.all(codes.map(code => bcrypt.hash(code, 10)));
};

export const verifyBackupCode = async (code: string, hashedCodes: string[]) => {
  for (let i = 0; i < hashedCodes.length; i++) {
    if (await bcrypt.compare(code, hashedCodes[i])) {
      return i;
    }
  }
  return null;
};

export const getDeviceInfo = (userAgent: string, ip: string) => {
  const parser = new UAParser(userAgent);
  const result = parser.getResult();
  return {
    deviceName: `${result.browser.name || 'Unknown Browser'} on ${result.os.name || 'Unknown OS'}`,
    location: ip === '::1' || ip === '127.0.0.1' ? 'Localhost' : 'Remote IP: ' + ip,
    deviceId: Buffer.from(`${userAgent}-${ip}`).toString('base64').slice(0, 16)
  };
};

export const generateDeviceToken = () => {
  return crypto.randomBytes(32).toString('hex');
};

export const hashDeviceToken = (token: string) => {
  return crypto.createHash('sha256').update(token).digest('hex');
};
