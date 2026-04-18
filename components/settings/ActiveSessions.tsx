import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Monitor, Smartphone, Globe, Shield, LogOut, Clock, MapPin, CheckCircle2 } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface Session {
  sessionId: string;
  deviceName: string;
  ipAddress: string;
  location: string;
  userAgent: string;
  createdAt: any;
  lastActive: any;
  isCurrent: boolean;
  isRevoked: boolean;
  expiresAt: any;
  deviceId: string;
}

export const ActiveSessions: React.FC = () => {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchSessions = async () => {
    try {
      const res = await fetch('/api/auth/sessions');
      const data = await res.json();
      if (data.sessions) {
        setSessions(data.sessions.sort((a: Session, b: Session) => (a.isCurrent ? -1 : 1)));
      }
    } catch (e) {
      console.error('Failed to fetch sessions');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSessions();
  }, []);

  const handleRevoke = async (sessionId: string) => {
    if (!confirm('Are you sure you want to terminate this session?')) return;
    try {
      const res = await fetch('/api/auth/sessions/revoke', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId })
      });
      if (res.ok) {
        setSessions(prev => prev.filter(s => s.sessionId !== sessionId));
      }
    } catch (e) {
      console.error('Revoke failed');
    }
  };

  const handleRevokeOthers = async () => {
    if (!confirm('Are you sure you want to terminate all other sessions?')) return;
    try {
      const res = await fetch('/api/auth/sessions/revoke-others', {
        method: 'POST'
      });
      if (res.ok) {
        setSessions(prev => prev.filter(s => s.isCurrent));
      }
    } catch (e) {
      console.error('Revoke others failed');
    }
  };

  const formatLastActive = (date: any) => {
    if (!date) return 'Unknown';
    const last = date.seconds ? new Date(date.seconds * 1000) : new Date(date);
    const now = new Date();
    const diff = Math.floor((now.getTime() - last.getTime()) / 60000);
    
    if (diff < 1) return 'Just now';
    if (diff < 60) return `${diff} min ago`;
    if (diff < 1440) return `${Math.floor(diff / 60)} hours ago`;
    return last.toLocaleDateString();
  };

  const getDeviceIcon = (deviceName: string) => {
    const lower = deviceName.toLowerCase();
    if (lower.includes('mobile') || lower.includes('android') || lower.includes('iphone')) return <Smartphone className="w-5 h-5" />;
    return <Monitor className="w-5 h-5" />;
  };

  if (loading) return (
    <div className="flex items-center justify-center p-12">
      <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
    </div>
  );

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h3 className="text-xl font-black text-white uppercase tracking-tight">Active Access Sessions</h3>
          <p className="text-slate-400 text-sm font-medium">Manage your active neural connection nodes across devices.</p>
        </div>
        <button 
          onClick={handleRevokeOthers}
          className="px-6 py-3 bg-rose-500/10 text-rose-400 text-[10px] font-black uppercase tracking-widest rounded-xl border border-rose-500/20 hover:bg-rose-500/20 transition-all"
        >
          Terminate All Other Sessions
        </button>
      </div>

      <div className="grid gap-4">
        <AnimatePresence mode='popLayout'>
          {sessions.map((session) => (
            <motion.div
              key={session.sessionId}
              layout
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className={cn(
                "p-6 bg-slate-900/50 border rounded-3xl group transition-all duration-300",
                session.isCurrent ? "border-indigo-500/30 bg-indigo-500/5" : "border-slate-800 hover:border-slate-700"
              )}
            >
              <div className="flex items-center justify-between gap-6">
                <div className="flex items-center gap-6">
                  <div className={cn(
                    "w-14 h-14 rounded-2xl flex items-center justify-center transition-all duration-300",
                    session.isCurrent ? "bg-indigo-500/20 text-indigo-400" : "bg-slate-800 text-slate-400 group-hover:bg-slate-750"
                  )}>
                    {getDeviceIcon(session.deviceName)}
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-3">
                      <h4 className="text-white font-black uppercase tracking-wider">{session.deviceName}</h4>
                      {session.isCurrent && (
                        <span className="flex items-center gap-1.5 px-2 py-0.5 bg-indigo-500/10 text-indigo-400 text-[8px] font-black uppercase rounded-md border border-indigo-500/20 shadow-sm shadow-indigo-500/5">
                          <CheckCircle2 className="w-2.5 h-2.5" />
                          This Device
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-400 font-medium">
                      <div className="flex items-center gap-1.5 text-slate-500">
                        <MapPin className="w-3 h-3" />
                        {session.location} ({session.ipAddress})
                      </div>
                      <div className="flex items-center gap-1.5 text-slate-500">
                        <Clock className="w-3 h-3" />
                        Last active: {formatLastActive(session.lastActive)}
                      </div>
                    </div>
                  </div>
                </div>

                {!session.isCurrent && (
                  <button 
                    onClick={() => handleRevoke(session.sessionId)}
                    className="p-3 bg-slate-800 text-slate-400 rounded-xl hover:bg-rose-500/10 hover:text-rose-400 transition-all duration-300"
                    title="Terminate Session"
                  >
                    <LogOut className="w-5 h-5" />
                  </button>
                )}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      <div className="flex items-center gap-3 p-6 bg-amber-500/5 border border-amber-500/10 rounded-3xl">
        <Shield className="w-5 h-5 text-amber-400 shrink-0" />
        <p className="text-xs text-amber-200/60 font-medium">
          If you notice any suspicious nodes that you don't recognize, terminate them immediately and update your neural access credentials.
        </p>
      </div>
    </div>
  );
};
