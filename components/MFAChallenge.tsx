import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ICONS } from '../constants';

interface MFAChallengeProps {
  uid: string;
  email: string;
  methods: string[];
  primaryMethod: string;
  onVerify: (method: string, code: string, rememberDevice: boolean) => Promise<void>;
  onCancel: () => void;
}

export const MFAChallenge: React.FC<MFAChallengeProps> = ({ 
  uid, 
  email, 
  methods, 
  primaryMethod, 
  onVerify, 
  onCancel 
}) => {
  const [method, setMethod] = useState(primaryMethod);
  const [code, setCode] = useState("");
  const [rememberDevice, setRememberDevice] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [otpSent, setOtpSent] = useState(false);

  useEffect(() => {
    if (method === 'email' && !otpSent) {
      handleSendEmailOtp();
    }
  }, [method]);

  const handleSendEmailOtp = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/mfa/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid, email })
      });
      if (!res.ok) throw new Error('Failed to send OTP');
      setOtpSent(true);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await onVerify(method, code, rememberDevice);
    } catch (err: any) {
      setError(err.message || 'Verification failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="text-center space-y-2">
        <div className="flex justify-center mb-4">
          <div className="p-4 bg-indigo-600 text-white rounded-2xl shadow-xl">
            <ICONS.Security className="w-8 h-8" />
          </div>
        </div>
        <h3 className="text-2xl font-black text-white uppercase tracking-tight">Neural Verification</h3>
        <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">Multi-Factor Protocol Active</p>
      </div>

      <div className="flex gap-2 p-1 bg-slate-800 rounded-2xl">
        {methods.map(m => (
          <button
            key={m}
            onClick={() => { setMethod(m); setOtpSent(false); setError(null); }}
            className={`flex-1 py-3 text-[9px] font-black uppercase tracking-widest rounded-xl transition-all ${method === m ? 'bg-slate-700 text-indigo-400 shadow-lg' : 'text-slate-500 hover:text-slate-400'}`}
          >
            {m === 'totp' ? 'Authenticator' : m === 'email' ? 'Email OTP' : 'Backup Code'}
          </button>
        ))}
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="space-y-3">
          <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] ml-4">
            {method === 'totp' ? 'Authenticator Code' : method === 'email' ? 'Email Verification Code' : 'Recovery Code'}
          </label>
          <input
            type="text"
            required
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            className="w-full px-8 py-5 bg-slate-800/50 border-2 border-slate-700 rounded-[2rem] text-center text-2xl tracking-[0.5em] focus:border-indigo-400 outline-none transition-all font-black text-white placeholder:text-slate-700"
            placeholder="000000"
            maxLength={method === 'backup' ? 12 : 6}
          />
        </div>

        {method === 'email' && (
          <div className="text-center">
            <button 
              type="button"
              onClick={handleSendEmailOtp}
              disabled={loading}
              className="text-[9px] font-black text-indigo-500 uppercase tracking-widest hover:text-indigo-400 disabled:opacity-50"
            >
              Resend Code {loading && '...'}
            </button>
          </div>
        )}

        <div className="flex items-center gap-3 px-4">
          <input 
            type="checkbox" 
            id="remember" 
            checked={rememberDevice}
            onChange={(e) => setRememberDevice(e.target.checked)}
            className="w-4 h-4 rounded border-slate-700 bg-slate-800 text-indigo-600 focus:ring-indigo-500"
          />
          <label htmlFor="remember" className="text-[10px] font-black text-slate-400 uppercase tracking-widest cursor-pointer">
            Trust this device for 30 days
          </label>
        </div>

        {error && (
          <div className="p-4 bg-rose-900/20 border border-rose-900/30 rounded-2xl text-rose-400 text-[10px] font-black text-center">
            {error}
          </div>
        )}

        <div className="flex gap-4">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 py-5 bg-slate-800 text-slate-400 rounded-[2rem] font-black text-[10px] uppercase tracking-widest hover:bg-slate-700 transition-all"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="flex-[2] py-5 bg-white text-slate-900 rounded-[2rem] font-black text-[10px] uppercase tracking-[0.3em] shadow-2xl hover:bg-slate-100 disabled:opacity-50 transition-all"
          >
            {loading ? 'Verifying...' : 'Verify Protocol'}
          </button>
        </div>
      </form>
    </div>
  );
};
