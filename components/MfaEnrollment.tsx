
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ICONS } from '../constants';
import { 
  generateTotpSecret, 
  finalizeTotpEnrollment, 
  getUserMfaFactors, 
  unenrollMfaFactor,
  getAuthInstance 
} from '../services/firebaseService';
import QRCode from 'qrcode';

export const MfaEnrollment: React.FC = () => {
  const [mfaFactors, setMfaFactors] = useState<any[]>([]);
  const [isEnrolling, setIsEnrolling] = useState(false);
  const [secret, setSecret] = useState<any>(null);
  const [qrCodeUrl, setQrCodeUrl] = useState<string>("");
  const [verificationCode, setVerificationCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const auth = getAuthInstance();
  const user = auth?.currentUser;

  useEffect(() => {
    if (user) {
      loadMfaFactors();
    }
  }, [user]);

  const loadMfaFactors = async () => {
    if (!user) return;
    try {
      const factors = await getUserMfaFactors(user);
      setMfaFactors(factors);
    } catch (err) {
      console.error("Error loading MFA factors:", err);
    }
  };

  const startEnrollment = async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const totpSecret = await generateTotpSecret(user);
      setSecret(totpSecret);
      
      // Generate QR code
      const otpauthUrl = totpSecret.generateQrCodeUrl(user.email || 'user', 'SpikedAI');
      const qrDataUrl = await QRCode.toDataURL(otpauthUrl);
      setQrCodeUrl(qrDataUrl);
      
      setIsEnrolling(true);
    } catch (err: any) {
      console.error("Enrollment Error:", err);
      setError("Failed to initiate MFA enrollment. " + (err.message || ""));
    } finally {
      setLoading(false);
    }
  };

  const handleFinalizeEnrollment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !secret) return;
    setLoading(true);
    setError(null);
    try {
      await finalizeTotpEnrollment(user, secret, verificationCode);
      setSuccess("MFA successfully enabled! Your account is now protected with TOTP.");
      setIsEnrolling(false);
      setSecret(null);
      setQrCodeUrl("");
      setVerificationCode("");
      loadMfaFactors();
    } catch (err: any) {
      console.error("Finalize Error:", err);
      setError("Verification failed. Please check the code and try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleUnenroll = async (factorUid: string) => {
    if (!user || !window.confirm("Are you sure you want to disable MFA? This will reduce your account security.")) return;
    setLoading(true);
    setError(null);
    try {
      await unenrollMfaFactor(user, factorUid);
      setSuccess("MFA has been disabled.");
      loadMfaFactors();
    } catch (err: any) {
      console.error("Unenroll Error:", err);
      setError("Failed to disable MFA.");
    } finally {
      setLoading(false);
    }
  };

  if (!user) return null;

  return (
    <div className="p-8 bg-slate-900/50 backdrop-blur-xl border border-slate-800 rounded-[2.5rem] shadow-2xl">
      <div className="flex items-center gap-4 mb-8">
        <div className="p-3 bg-indigo-600/20 text-indigo-400 rounded-2xl">
          <ICONS.Shield className="w-6 h-6" />
        </div>
        <div>
          <h3 className="text-xl font-black text-white uppercase tracking-tight">Security Protocol</h3>
          <p className="text-[10px] text-slate-500 font-black uppercase tracking-[0.3em]">Multi-Factor Authentication</p>
        </div>
      </div>

      {error && (
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl text-rose-400 text-xs font-bold text-center"
        >
          {error}
        </motion.div>
      )}

      {success && (
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl text-emerald-400 text-xs font-bold text-center"
        >
          {success}
        </motion.div>
      )}

      <div className="space-y-6">
        {mfaFactors.length > 0 ? (
          <div className="space-y-4">
            <p className="text-sm text-slate-400 font-medium">Active Authentication Factors:</p>
            {mfaFactors.map((factor) => (
              <div key={factor.uid} className="flex items-center justify-between p-5 bg-slate-800/50 border border-slate-700 rounded-2xl">
                <div className="flex items-center gap-4">
                  <div className="p-2 bg-emerald-500/20 text-emerald-400 rounded-lg">
                    <ICONS.Check className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-white">{factor.displayName || 'Authenticator App'}</p>
                    <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest">{factor.factorId === 'totp' ? 'TOTP Authenticator' : 'Phone SMS'}</p>
                  </div>
                </div>
                <button 
                  onClick={() => handleUnenroll(factor.uid)}
                  disabled={loading}
                  className="px-4 py-2 text-[10px] font-black text-rose-500 uppercase tracking-widest hover:bg-rose-500/10 rounded-xl transition-colors"
                >
                  Disable
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 space-y-6">
            <div className="flex justify-center">
              <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center text-slate-500">
                <ICONS.Lock className="w-8 h-8" />
              </div>
            </div>
            <div className="space-y-2">
              <p className="text-sm text-slate-300 font-bold">MFA is currently disabled</p>
              <p className="text-xs text-slate-500 leading-relaxed">
                Add an extra layer of security to your account by requiring a code from an authenticator app when you sign in.
              </p>
            </div>
            {!isEnrolling && (
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={startEnrollment}
                disabled={loading}
                className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-[0.3em] shadow-xl hover:bg-indigo-700 transition-all"
              >
                {loading ? "Initializing..." : "Enable TOTP MFA"}
              </motion.button>
            )}
          </div>
        )}

        <AnimatePresence>
          {isEnrolling && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="space-y-8 pt-6 border-t border-slate-800"
            >
              <div className="space-y-4 text-center">
                <h4 className="text-sm font-black text-white uppercase tracking-widest">Setup Authenticator</h4>
                <p className="text-xs text-slate-400">Scan this QR code with Google Authenticator or Authy.</p>
                
                <div className="flex justify-center p-4 bg-white rounded-3xl inline-block mx-auto">
                  {qrCodeUrl ? (
                    <img src={qrCodeUrl} alt="MFA QR Code" className="w-48 h-48" />
                  ) : (
                    <div className="w-48 h-48 flex items-center justify-center text-slate-400">
                      <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                    </div>
                  )}
                </div>

                <div className="p-4 bg-slate-800/50 rounded-2xl border border-slate-700">
                  <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest mb-2">Manual Entry Key</p>
                  <code className="text-xs font-mono text-indigo-400 break-all">{secret?.secretKey}</code>
                </div>
              </div>

              <form onSubmit={handleFinalizeEnrollment} className="space-y-6">
                <div className="space-y-3">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] ml-4">Verification Code</label>
                  <input 
                    type="text"
                    required
                    value={verificationCode}
                    onChange={(e) => setVerificationCode(e.target.value)}
                    className="w-full px-8 py-4 bg-slate-800 border-2 border-slate-700 rounded-2xl text-center text-xl tracking-[0.5em] focus:border-indigo-500 outline-none transition-all font-black text-white"
                    placeholder="000000"
                    maxLength={6}
                  />
                </div>

                <div className="flex gap-4">
                  <button 
                    type="button"
                    onClick={() => setIsEnrolling(false)}
                    className="flex-1 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest hover:text-slate-300 transition-colors"
                  >
                    Cancel
                  </button>
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    type="submit"
                    disabled={loading || verificationCode.length !== 6}
                    className="flex-[2] py-4 bg-white text-slate-900 rounded-2xl font-black text-[10px] uppercase tracking-[0.3em] shadow-xl hover:bg-slate-100 transition-all"
                  >
                    {loading ? "Verifying..." : "Verify & Enable"}
                  </motion.button>
                </div>
              </form>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};
