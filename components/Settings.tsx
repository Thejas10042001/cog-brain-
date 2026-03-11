import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { ICONS } from '../constants';
import { fetchUserSessions, endSession, changePassword } from '../services/firebaseService';

interface SettingsProps {
  user: any;
}

export const Settings: React.FC<SettingsProps> = ({ user }) => {
  const [sessions, setSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [newPassword, setNewPassword] = useState('');
  const [passwordStatus, setPasswordStatus] = useState<{ type: 'success' | 'error' | null, message: string }>({ type: null, message: '' });

  useEffect(() => {
    loadSessions();
  }, []);

  const loadSessions = async () => {
    setLoading(true);
    const data = await fetchUserSessions();
    setSessions(data);
    setLastUpdated(new Date());
    setLoading(false);
  };

  const handleTerminateSession = async (sessionId: string) => {
    await endSession(sessionId);
    loadSessions();
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 6) {
      setPasswordStatus({ type: 'error', message: 'Password must be at least 6 characters.' });
      return;
    }
    try {
      await changePassword(newPassword);
      setPasswordStatus({ type: 'success', message: 'Password updated successfully.' });
      setNewPassword('');
    } catch (error: any) {
      setPasswordStatus({ type: 'error', message: error.message || 'Failed to update password.' });
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 p-8 md:p-16 font-sans">
      <div className="max-w-4xl mx-auto space-y-12">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-8 border-b border-slate-800 pb-12">
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-indigo-600 text-white rounded-2xl flex items-center justify-center font-black text-2xl shadow-xl shadow-indigo-600/20">
                <ICONS.Settings className="w-6 h-6" />
              </div>
              <h1 className="text-5xl font-black text-white tracking-tighter uppercase">Account <span className="text-indigo-600">Settings</span></h1>
            </div>
            <div className="flex flex-col gap-1">
              <p className="text-slate-500 font-bold uppercase tracking-[0.3em] text-xs">Security & Device Management // {user?.email}</p>
              <p className="text-[9px] font-black text-slate-600 uppercase tracking-widest">Last Synced: {lastUpdated.toLocaleTimeString()}</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-12">
          {/* Device Management */}
          <section className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-black text-white uppercase tracking-tight">Logged-in Devices</h2>
              <button 
                onClick={loadSessions}
                className="p-2 hover:bg-slate-900 rounded-lg transition-colors text-slate-500 hover:text-indigo-400"
              >
                <ICONS.Refresh className="w-5 h-5" />
              </button>
            </div>

            <div className="glass-dark rounded-[2.5rem] border border-slate-800/50 overflow-hidden">
              {loading ? (
                <div className="p-12 flex justify-center">
                  <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : sessions.length === 0 ? (
                <div className="p-12 text-center text-slate-500 font-bold uppercase tracking-widest text-xs">
                  No active sessions found.
                </div>
              ) : (
                <div className="divide-y divide-slate-800">
                  {sessions.map((session) => (
                    <div key={session.id} className="p-8 flex flex-col md:flex-row md:items-center justify-between gap-6 hover:bg-slate-900/30 transition-colors">
                      <div className="flex items-start gap-6">
                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${session.status === 'active' ? 'bg-green-500/10 text-green-500' : 'bg-slate-800 text-slate-500'}`}>
                          {session.deviceName?.includes('PC') || session.deviceName?.includes('Mac') ? (
                            <ICONS.Monitor className="w-6 h-6" />
                          ) : (
                            <ICONS.Smartphone className="w-6 h-6" />
                          )}
                        </div>
                        <div className="space-y-1">
                          <div className="flex items-center gap-3">
                            <h3 className="text-lg font-black text-white uppercase tracking-tight">{session.deviceName || 'Unknown Device'}</h3>
                            {session.status === 'active' ? (
                              <span className="px-2 py-0.5 bg-green-500 text-white text-[8px] font-black uppercase tracking-widest rounded-full">Active</span>
                            ) : (
                              <span className="px-2 py-0.5 bg-slate-800 text-slate-500 text-[8px] font-black uppercase tracking-widest rounded-full">Offline</span>
                            )}
                          </div>
                          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest font-mono truncate max-w-xs md:max-w-md">
                            {session.userAgent}
                          </p>
                          <div className="flex flex-wrap gap-4 pt-2">
                            <div className="flex items-center gap-2">
                              <span className="text-[9px] font-black text-slate-600 uppercase">Login:</span>
                              <span className="text-[10px] font-bold text-slate-400">{new Date(session.startTime).toLocaleString()}</span>
                            </div>
                            {session.endTime && (
                              <div className="flex items-center gap-2">
                                <span className="text-[9px] font-black text-slate-600 uppercase">Logout:</span>
                                <span className="text-[10px] font-bold text-slate-400">{new Date(session.endTime).toLocaleString()}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      {session.status === 'active' && (
                        <button 
                          onClick={() => handleTerminateSession(session.id)}
                          className="px-6 py-3 bg-red-600/10 text-red-500 hover:bg-red-600 hover:text-white text-[10px] font-black uppercase tracking-widest rounded-xl transition-all border border-red-600/20"
                        >
                          Logout Device
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>

          {/* Security Settings */}
          <section className="space-y-6">
            <h2 className="text-2xl font-black text-white uppercase tracking-tight">Security Protocol</h2>
            
            <div className="glass-dark p-8 rounded-[2.5rem] border border-slate-800/50">
              <form onSubmit={handleChangePassword} className="space-y-6 max-w-md">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-2">New Neural Password</label>
                  <div className="relative">
                    <input 
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full bg-slate-900 border border-slate-800 rounded-2xl px-5 py-4 text-sm focus:outline-none focus:border-indigo-500 transition-all"
                    />
                    <ICONS.Lock className="absolute right-5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600" />
                  </div>
                </div>

                {passwordStatus.type && (
                  <motion.div 
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`p-4 rounded-xl text-xs font-bold ${passwordStatus.type === 'success' ? 'bg-green-500/10 text-green-500 border border-green-500/20' : 'bg-red-500/10 text-red-500 border border-red-500/20'}`}
                  >
                    {passwordStatus.message}
                  </motion.div>
                )}

                <button 
                  type="submit"
                  className="w-full py-4 bg-indigo-600 text-white text-xs font-black uppercase tracking-[0.2em] rounded-2xl hover:bg-indigo-500 transition-all shadow-xl shadow-indigo-600/20 active:scale-95"
                >
                  Update Protocol Password
                </button>
              </form>
            </div>
          </section>
        </div>

        {/* Footer */}
        <div className="pt-12 border-t border-slate-800 flex flex-col md:flex-row justify-between items-center gap-6 opacity-50">
          <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">© 2026 Neural Sales Intelligence. Protocol Secure.</span>
        </div>
      </div>
    </div>
  );
};
