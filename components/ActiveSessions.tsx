import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ICONS } from '../constants';

interface Session {
  id: string;
  deviceName: string;
  ipAddress: string;
  location: string;
  lastActive: string;
  isCurrent: boolean;
  createdAt: string;
}

export const ActiveSessions: React.FC = () => {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSessions = async () => {
    try {
      const res = await fetch('/api/sessions');
      if (!res.ok) throw new Error('Failed to fetch sessions');
      const data = await res.json();
      setSessions(data.sessions);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRevoke = async (sessionId: string) => {
    try {
      const res = await fetch('/api/sessions/revoke', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId })
      });
      if (!res.ok) throw new Error('Failed to revoke session');
      setSessions(prev => prev.filter(s => s.id !== sessionId));
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleRevokeOthers = async () => {
    if (!confirm('Are you sure you want to log out from all other devices?')) return;
    try {
      const res = await fetch('/api/sessions/revoke-others', {
        method: 'POST'
      });
      if (!res.ok) throw new Error('Failed to revoke others');
      setSessions(prev => prev.filter(s => s.isCurrent));
    } catch (err: any) {
      alert(err.message);
    }
  };

  useEffect(() => {
    fetchSessions();
    const interval = setInterval(fetchSessions, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, []);

  // Heartbeat
  useEffect(() => {
    const heartbeat = () => fetch('/api/sessions/heartbeat', { method: 'POST' }).catch(() => {});
    const interval = setInterval(heartbeat, 60000); // 1 minute heartbeat
    heartbeat();
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="py-12 flex flex-col items-center gap-4">
        <div className="w-8 h-8 border-2 border-slate-800 border-t-indigo-600 rounded-full animate-spin" />
        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest animate-pulse">Scanning Active Nodes...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 bg-rose-500/10 border border-rose-500/20 rounded-2xl text-center">
        <p className="text-rose-400 text-xs font-black uppercase tracking-widest">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center">
            <ICONS.History className="w-4 h-4 text-indigo-400" />
          </div>
          <h3 className="text-xl font-black text-white uppercase tracking-tight">Active Sessions</h3>
        </div>
        {sessions.length > 1 && (
          <button 
            onClick={handleRevokeOthers}
            className="text-[10px] font-black text-rose-500 uppercase tracking-widest hover:text-rose-400 transition-colors"
          >
            Logout from all other devices
          </button>
        )}
      </div>

      <div className="space-y-4">
        <AnimatePresence mode="popLayout">
          {sessions.map((session) => (
            <motion.div 
              key={session.id}
              layout
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="flex items-center justify-between p-6 bg-slate-900 border border-slate-800 rounded-2xl group hover:border-slate-700 transition-all shadow-xl shadow-black/20"
            >
              <div className="flex items-center gap-4">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${session.isCurrent ? 'bg-indigo-600/20 text-indigo-400' : 'bg-slate-800 text-slate-500'}`}>
                  {session.deviceName.toLowerCase().includes('mobile') || session.deviceName.toLowerCase().includes('phone') ? (
                    <ICONS.Smartphone className="w-6 h-6" />
                  ) : (
                    <ICONS.Monitor className="w-6 h-6" />
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-bold text-white uppercase tracking-tight">{session.deviceName}</p>
                    {session.isCurrent && (
                      <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-400 text-[8px] font-black uppercase rounded-md border border-emerald-500/20">This device</span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-1">
                    <p className="text-[10px] font-medium text-slate-500 flex items-center gap-1.5">
                      <ICONS.MapPin className="w-3 h-3" />
                      {session.location}
                    </p>
                    <span className="w-1 h-1 rounded-full bg-slate-800" />
                    <p className="text-[10px] font-medium text-slate-500 flex items-center gap-1.5">
                      <ICONS.History className="w-3 h-3" />
                      {session.isCurrent ? 'Active now' : `Last active ${new Date(session.lastActive).toLocaleTimeString()}`}
                    </p>
                  </div>
                  <p className="text-[9px] font-medium text-slate-600 mt-1 uppercase tracking-widest">IP: {session.ipAddress}</p>
                </div>
              </div>
              {!session.isCurrent && (
                <button 
                  onClick={() => handleRevoke(session.id)}
                  className="p-3 bg-rose-500/5 hover:bg-rose-500 text-slate-500 hover:text-white rounded-xl transition-all border border-rose-500/10"
                  title="Revoke session"
                >
                  <ICONS.LogOut className="w-4 h-4" />
                </button>
              )}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
};
