import { authenticator } from 'otplib';
import qrcode from 'qrcode';

/**
 * MFA Service (NEURAL SECURITY PROTOCOL)
 * Handles generation and verification of TOTP tokens using otplib.
 */

export interface MfaSetupResponse {
  secret: string;
  qrCode: string;
}

export const generateMfaSecret = async (email: string): Promise<MfaSetupResponse> => {
  const secret = authenticator.generateSecret();
  const otpauth = authenticator.keyuri(email, 'Spiked AI', secret);
  const qrCode = await qrcode.toDataURL(otpauth);
  
  return { secret, qrCode };
};

export const verifyMfaToken = (token: string, secret: string): boolean => {
  try {
    return authenticator.verify({ token, secret });
  } catch (error) {
    console.error('MFA Verification failed:', error);
    return false;
  }
};

export const generateCurrentToken = (secret: string): string => {
  return authenticator.generate(secret);
};
