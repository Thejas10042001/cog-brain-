import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ICONS } from '../constants';
import { User } from '../services/firebaseService';
import { doc, onSnapshot, getFirestore } from 'firebase/firestore';

interface SecuritySettingsProps {
  user: User;
}

export const SecuritySettings: React.FC<SecuritySettingsProps> = ({ user }) => {
  const [userData, setUserData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [setupStep, setSetupStep] = useState<'idle' | 'totp_qr' | 'backup_codes'>('idle');
  const [qrCode, setQrCode] = useState("");
  const [totpSecret, setTotpSecret] = useState("");
  const [totpCode, setTotpCode] = useState("");
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [currentDeviceId, setCurrentDeviceId] = useState<string | null>(null);

  const db = getFirestore();

  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'users', user.uid), (doc) => {
      setUserData(doc.data());
      setLoading(false);
    });

    fetch('/api/mfa/current-device')
      .then(res => res.json())
      .then(data => setCurrentDeviceId(data.deviceId))
      .catch(err => console.error('Failed to fetch current device info'));

    return () => unsub();
  }, [user.uid]);

  const handleStartTotpSetup = async () => {
    setError(null);
    try {
      const res = await fetch('/api/mfa/setup-totp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid: user.uid, email: user.email })
      });
      const data = await res.json();
      setQrCode(data.qrCode);
      setTotpSecret(data.secret);
      setSetupStep('totp_qr');
    } catch (err: any) {
      setError('Failed to start setup');
    }
  };

  const handleFinalizeTotp = async () => {
    setError(null);
    try {
      const res = await fetch('/api/mfa/finalize-totp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid: user.uid, code: totpCode })
      });
      if (!res.ok) throw new Error('Invalid verification code');
      const data = await res.json();
      if (data.backupCodes) {
        setBackupCodes(data.backupCodes);
        setSetupStep('backup_codes');
      } else {
        setSetupStep('idle');
      }
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleSetupEmail = async () => {
    setError(null);
    try {
      const res = await fetch('/api/mfa/setup-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid: user.uid })
      });
      const data = await res.json();
      if (data.backupCodes) {
        setBackupCodes(data.backupCodes);
        setSetupStep('backup_codes');
      }
    } catch (err: any) {
      setError('Failed to enable Email MFA');
    }
  };

  const handleSetPrimary = async (method: string) => {
    try {
      await fetch('/api/mfa/set-primary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid: user.uid, method })
      });
    } catch (err) {
      console.error('Failed to set primary method');
    }
  };

  const handleDisableMfa = async () => {
    if (!window.confirm('Are you sure you want to disable MFA? This will reduce your account security.')) return;
    try {
      await fetch('/api/mfa/disable', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid: user.uid })
      });
    } catch (err) {
      console.error('Failed to disable MFA');
    }
  };

  const handleRemoveDevice = async (deviceId: string) => {
    try {
      await fetch('/api/mfa/remove-device', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid: user.uid, deviceId })
      });
    } catch (err) {
      console.error('Failed to remove device');
    }
  };

  if (loading) return <div className="p-12 text-center text-slate-500 font-black uppercase tracking-widest">Loading Security Protocol...</div>;

  const mfaMethods = userData?.mfa?.methods || [];
  const primaryMethod = userData?.mfa?.primaryMethod;

  return (
    <div className="max-w-4xl mx-auto p-8 space-y-12">
      <div className="space-y-4">
        <h2 className="text-4xl font-black text-white uppercase tracking-tight">Security Protocol</h2>
        <p className="text-slate-400 font-bold">Manage your multi-factor authentication and trusted devices.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* MFA Status Card */}
        <div className="bg-slate-900/50 border border-slate-800 rounded-[3rem] p-10 space-y-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className={`p-3 rounded-2xl ${userData?.mfa?.enabled ? 'bg-emerald-500/20 text-emerald-500' : 'bg-slate-800 text-slate-500'}`}>
                <ICONS.Security className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-black text-white uppercase tracking-widest text-sm">MFA Status</h3>
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                  {userData?.mfa?.enabled ? 'Active Protocol' : 'Inactive Protocol'}
                </p>
              </div>
            </div>
            <div className={`px-4 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${userData?.mfa?.enabled ? 'bg-emerald-500/10 text-emerald-500' : 'bg-slate-800 text-slate-500'}`}>
              {userData?.mfa?.enabled ? 'Enabled' : 'Disabled'}
            </div>
          </div>

          <AnimatePresence mode="wait">
            {setupStep === 'idle' && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
                <div className="space-y-4">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Available Methods</p>
                  
                  {/* Authenticator App Method */}
                  <div className="p-6 bg-slate-800/50 rounded-3xl border border-slate-700 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <ICONS.Smartphone className="w-5 h-5 text-slate-400" />
                      <div>
                        <p className="text-[11px] font-black text-white uppercase">Authenticator App</p>
                        <p className="text-[9px] text-slate-500 font-bold">Google/Microsoft Authenticator</p>
                      </div>
                    </div>
                    {mfaMethods.includes('totp') ? (
                      <div className="flex items-center gap-2">
                        {primaryMethod === 'totp' ? (
                          <span className="text-[8px] font-black text-emerald-500 uppercase tracking-widest bg-emerald-500/10 px-2 py-1 rounded-md">Primary</span>
                        ) : (
                          <button onClick={() => handleSetPrimary('totp')} className="text-[8px] font-black text-indigo-400 uppercase tracking-widest hover:text-indigo-300 transition-colors">Set Primary</button>
                        )}
                        <ICONS.Check className="w-4 h-4 text-emerald-500" />
                      </div>
                    ) : (
                      <button onClick={handleStartTotpSetup} className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-indigo-700 transition-all">Setup</button>
                    )}
                  </div>

                  {/* Email OTP Method */}
                  <div className="p-6 bg-slate-800/50 rounded-3xl border border-slate-700 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <ICONS.Mail className="w-5 h-5 text-slate-400" />
                      <div>
                        <p className="text-[11px] font-black text-white uppercase">Email OTP</p>
                        <p className="text-[9px] text-slate-500 font-bold">Verification code via email</p>
                      </div>
                    </div>
                    {mfaMethods.includes('email') ? (
                      <div className="flex items-center gap-2">
                        {primaryMethod === 'email' ? (
                          <span className="text-[8px] font-black text-emerald-500 uppercase tracking-widest bg-emerald-500/10 px-2 py-1 rounded-md">Primary</span>
                        ) : (
                          <button onClick={() => handleSetPrimary('email')} className="text-[8px] font-black text-indigo-400 uppercase tracking-widest hover:text-indigo-300 transition-colors">Set Primary</button>
                        )}
                        <ICONS.Check className="w-4 h-4 text-emerald-500" />
                      </div>
                    ) : (
                      <button onClick={handleSetupEmail} className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-indigo-700 transition-all">Setup</button>
                    )}
                  </div>
                </div>

                {userData?.mfa?.enabled && (
                  <button 
                    onClick={handleDisableMfa}
                    className="w-full py-5 bg-rose-900/20 text-rose-500 border border-rose-900/30 rounded-[2rem] font-black text-[10px] uppercase tracking-[0.3em] hover:bg-rose-900/30 transition-all"
                  >
                    Disable MFA Protocol
                  </button>
                )}
              </motion.div>
            )}

            {setupStep === 'totp_qr' && (
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-8 text-center">
                <p className="text-sm text-slate-300 font-bold">Scan this QR code with your Authenticator app (Google/Microsoft).</p>
                <div className="flex justify-center p-4 bg-white rounded-[2rem] shadow-2xl">
                  <img src={qrCode} alt="TOTP QR Code" className="w-48 h-48" />
                </div>
                
                <div className="space-y-2">
                  <p className="text-[9px] text-slate-500 font-black uppercase tracking-widest">Or enter key manually</p>
                  <div className="p-4 bg-slate-800/50 rounded-2xl border border-slate-700 flex items-center justify-between">
                    <code className="text-xs font-mono text-indigo-400 font-bold">{totpSecret}</code>
                    <button 
                      onClick={() => {
                        navigator.clipboard.writeText(totpSecret);
                        // Optional: Show a "Copied!" toast or state
                      }}
                      className="p-2 text-slate-500 hover:text-white transition-colors"
                    >
                      <ICONS.Copy className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="space-y-4">
                  <input 
                    type="text"
                    placeholder="Enter 6-digit code"
                    value={totpCode}
                    onChange={(e) => setTotpCode(e.target.value)}
                    className="w-full px-8 py-5 bg-slate-800/50 border-2 border-slate-700 rounded-[2rem] text-center text-xl tracking-[0.5em] focus:border-indigo-400 outline-none transition-all font-black text-white"
                  />
                  {error && <p className="text-rose-500 text-[10px] font-black uppercase">{error}</p>}
                  <div className="flex gap-4">
                    <button onClick={() => setSetupStep('idle')} className="flex-1 py-4 bg-slate-800 text-slate-400 rounded-[1.5rem] font-black text-[10px] uppercase tracking-widest">Cancel</button>
                    <button onClick={handleFinalizeTotp} className="flex-1 py-4 bg-white text-slate-900 rounded-[1.5rem] font-black text-[10px] uppercase tracking-widest">Verify</button>
                  </div>
                </div>
              </motion.div>
            )}

            {setupStep === 'backup_codes' && (
              <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="space-y-8">
                <div className="p-8 bg-amber-500/10 border border-amber-500/20 rounded-[2rem] space-y-4">
                  <div className="flex items-center gap-3 text-amber-500">
                    <ICONS.Alert className="w-5 h-5" />
                    <h4 className="font-black text-[11px] uppercase tracking-widest">Save Backup Codes</h4>
                  </div>
                  <p className="text-[10px] text-slate-400 leading-relaxed">If you lose your authenticator app, these codes are the ONLY way to recover your account. Store them securely.</p>
                  <div className="grid grid-cols-2 gap-2">
                    {backupCodes.map(code => (
                      <code key={code} className="p-3 bg-slate-900 rounded-xl text-xs font-mono text-white text-center">{code}</code>
                    ))}
                  </div>
                </div>
                <button 
                  onClick={() => setSetupStep('idle')}
                  className="w-full py-5 bg-white text-slate-900 rounded-[2rem] font-black text-[10px] uppercase tracking-[0.3em]"
                >
                  I have saved these codes
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Trusted Devices Card */}
        <div className="bg-slate-900/50 border border-slate-800 rounded-[3rem] p-10 space-y-8">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-indigo-500/20 text-indigo-500 rounded-2xl">
              <ICONS.Monitor className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-black text-white uppercase tracking-widest text-sm">Trusted Devices</h3>
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Devices bypassing MFA</p>
            </div>
          </div>

          <div className="space-y-4 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
            {userData?.trustedDevices?.length > 0 ? (
              userData.trustedDevices.map((device: any) => (
                <div key={device.deviceId} className={`p-6 bg-slate-800/30 rounded-3xl border flex items-center justify-between group transition-all ${device.deviceId === currentDeviceId ? 'border-indigo-500/50 bg-indigo-500/5' : 'border-slate-800'}`}>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <p className="text-[11px] font-black text-white uppercase tracking-tight">{device.deviceName}</p>
                      {device.deviceId === currentDeviceId && (
                        <span className="px-2 py-0.5 bg-indigo-500/20 text-indigo-400 text-[7px] font-black uppercase tracking-widest rounded-md">Current</span>
                      )}
                    </div>
                    <p className="text-[9px] text-slate-500 font-bold">{device.location} • Last used: {new Date(device.lastUsed).toLocaleDateString()}</p>
                  </div>
                  <button 
                    onClick={() => handleRemoveDevice(device.deviceId)}
                    className="p-2 text-slate-600 hover:text-rose-500 transition-colors opacity-0 group-hover:opacity-100"
                  >
                    <ICONS.X className="w-4 h-4" />
                  </button>
                </div>
              ))
            ) : (
              <div className="text-center py-12 space-y-4">
                <ICONS.Shield className="w-12 h-12 text-slate-800 mx-auto" />
                <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest">No Trusted Devices Found</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
