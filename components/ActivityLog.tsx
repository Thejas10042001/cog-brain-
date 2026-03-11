import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { ICONS } from '../constants';
import { fetchUserSessions, fetchUserActivities, User } from '../services/firebaseService';

interface ActivityLogProps {
  user: User | null;
}

export const ActivityLog: React.FC<ActivityLogProps> = ({ user }) => {
  const [sessions, setSessions] = useState<any[]>([]);
  const [activities, setActivities] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [activeTab, setActiveTab] = useState<'sessions' | 'activities'>('sessions');

  useEffect(() => {
    const loadData = async () => {
      if (!user) return;
      setLoading(true);
      const [s, a] = await Promise.all([
        fetchUserSessions(),
        fetchUserActivities()
      ]);
      setSessions(s);
      // Filter out high-frequency minor events like navigation
      setActivities(a.filter(act => act.type !== 'node_navigation'));
      setLastUpdated(new Date());
      setLoading(false);
    };
    loadData();
  }, [user]);

  const formatDate = (ms: number) => {
    const date = new Date(ms);
    return date.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: '2-digit'
    });
  };

  const formatTime = (ms: number) => {
    const date = new Date(ms);
    return date.toLocaleTimeString('en-GB', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatDuration = (ms: number) => {
    if (!ms) return 'Active';
    const minutes = Math.floor(ms / 60000);
    const hours = Math.floor(minutes / 60);
    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    }
    return `${minutes}m`;
  };

  const formatDetails = (details: string, type: string) => {
    try {
      const data = JSON.parse(details);
      switch (type) {
        case 'login':
          return `Secure access established for ${data.email}`;
        case 'logout':
          return `Neural link terminated`;
        case 'node_navigation':
          return `Transitioned from ${data.from} to ${data.to}`;
        case 'analysis_run':
          return `Synthesized intelligence for ${data.context || 'Unknown Prospect'} using ${data.docCount || 0} documents`;
        case 'document_upload':
          return `Injected ${data.count || 1} new data assets into neural core`;
        case 'audio_generation':
          return `Synthesized ${data.track || 'strategic'} briefing using ${data.voice || 'Neural'} persona`;
        case 'practice_session_start':
          return `Initiated simulation with ${data.persona || 'Balanced'} at ${data.difficulty || 'Medium'} difficulty`;
        case 'practice_session_end':
          return `Simulation complete. Score: ${Math.round(data.score || 0)}% // Mode: ${data.mode || 'Roleplay'}`;
        case 'gpt_query':
          return `Queried SalesGPT: "${(data.query || '').substring(0, 40)}${(data.query || '').length > 40 ? '...' : ''}"`;
        default:
          return details;
      }
    } catch (e) {
      return details;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center">
        <div className="w-12 h-12 border-4 border-slate-800 border-t-red-600 rounded-full animate-spin"></div>
        <p className="mt-4 text-[10px] font-black uppercase text-slate-500 tracking-widest">Retrieving Neural Logs...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 p-8 md:p-16 font-sans">
      <div className="max-w-6xl mx-auto space-y-12">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-8 border-b border-slate-800 pb-12">
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-red-600 text-white rounded-2xl flex items-center justify-center font-black text-2xl shadow-xl shadow-red-600/20">
                <ICONS.Shield className="w-6 h-6" />
              </div>
              <h1 className="text-5xl font-black text-white tracking-tighter uppercase">Activity <span className="text-red-600">Audit</span></h1>
            </div>
            <div className="flex flex-col gap-1">
              <p className="text-slate-500 font-bold uppercase tracking-[0.3em] text-xs">Neural Sales Intelligence Protocol // User Log</p>
              <p className="text-[9px] font-black text-slate-600 uppercase tracking-widest">Last Synced: {lastUpdated.toLocaleTimeString()}</p>
            </div>
          </div>
          
          <div className="bg-slate-900/50 p-6 rounded-3xl border border-slate-800 flex items-center gap-6">
            <div className="w-12 h-12 rounded-full bg-indigo-600 flex items-center justify-center text-white font-black text-xl">
              {user?.email?.[0].toUpperCase()}
            </div>
            <div>
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Authenticated Subject</p>
              <p className="text-sm font-bold text-white">{user?.email}</p>
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="glass-dark p-10 rounded-[3rem] border border-slate-800/50 relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:opacity-20 transition-opacity">
              <ICONS.Clock className="w-16 h-16" />
            </div>
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] mb-4">Total Neural Engagement</p>
            <div className="flex items-baseline gap-2">
              <p className="text-6xl font-black text-white tracking-tighter">
                {Math.floor(sessions.reduce((acc, s) => acc + (s.duration || 0), 0) / 3600000)}
              </p>
              <p className="text-xl font-black text-slate-500 uppercase tracking-widest">Hours</p>
            </div>
            <p className="text-[10px] font-bold text-slate-600 uppercase mt-4 tracking-widest">
              {Math.floor((sessions.reduce((acc, s) => acc + (s.duration || 0), 0) % 3600000) / 60000)} Minutes Total
            </p>
          </div>

          <div className="glass-dark p-10 rounded-[3rem] border border-slate-800/50 relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:opacity-20 transition-opacity">
              <ICONS.Brain className="w-16 h-16" />
            </div>
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] mb-4">Strategic Milestones</p>
            <p className="text-6xl font-black text-white tracking-tighter">{activities.length}</p>
            <p className="text-[10px] font-bold text-slate-600 uppercase mt-4 tracking-widest">Major Actions Logged</p>
          </div>

          <div className="glass-dark p-10 rounded-[3rem] border border-slate-800/50 relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:opacity-20 transition-opacity">
              <ICONS.Monitor className="w-16 h-16" />
            </div>
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] mb-4">Active Sessions</p>
            <p className="text-6xl font-black text-white tracking-tighter">{sessions.length}</p>
            <p className="text-[10px] font-bold text-slate-600 uppercase mt-4 tracking-widest">Total Login Events</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-4 border-b border-slate-800">
          <button 
            onClick={() => setActiveTab('sessions')}
            className={`pb-4 px-4 text-[10px] font-black uppercase tracking-widest transition-all relative ${activeTab === 'sessions' ? 'text-red-600' : 'text-slate-500 hover:text-slate-300'}`}
          >
            Session History
            {activeTab === 'sessions' && <motion.div layoutId="tab" className="absolute bottom-0 left-0 right-0 h-1 bg-red-600" />}
          </button>
          <button 
            onClick={() => setActiveTab('activities')}
            className={`pb-4 px-4 text-[10px] font-black uppercase tracking-widest transition-all relative ${activeTab === 'activities' ? 'text-red-600' : 'text-slate-500 hover:text-slate-300'}`}
          >
            Strategic Milestones
            {activeTab === 'activities' && <motion.div layoutId="tab" className="absolute bottom-0 left-0 right-0 h-1 bg-red-600" />}
          </button>
        </div>

        {/* Content */}
        <div className="space-y-4">
          {activeTab === 'sessions' ? (
            <div className="space-y-4">
              {sessions.map((session, idx) => (
                <motion.div 
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  key={session.id}
                  className="glass-dark p-6 rounded-2xl border border-slate-800/50 flex items-center justify-between hover:border-slate-700 transition-all group"
                >
                  <div className="flex items-center gap-6">
                    <div className="w-10 h-10 bg-slate-800 rounded-xl flex items-center justify-center text-slate-500 group-hover:text-red-600 transition-colors">
                      <ICONS.Clock className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-white">{formatDate(session.startTime)}</p>
                      <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                        {formatTime(session.startTime)} — {session.endTime ? formatTime(session.endTime) : 'Active'}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-black text-slate-400 uppercase tracking-widest">{formatDuration(session.duration)}</p>
                    <p className="text-[9px] font-bold text-slate-600 uppercase">Duration</p>
                  </div>
                </motion.div>
              ))}
            </div>
          ) : (
            <div className="space-y-4">
              {activities.map((activity, idx) => (
                <motion.div 
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  key={activity.id}
                  className="glass-dark p-6 rounded-2xl border border-slate-800/50 flex items-center justify-between hover:border-slate-700 transition-all group"
                >
                  <div className="flex items-center gap-6">
                    <div className="w-10 h-10 bg-slate-800 rounded-xl flex items-center justify-center text-slate-500 group-hover:text-indigo-400 transition-colors">
                      {activity.type === 'login' ? <ICONS.Shield className="w-5 h-5" /> : <ICONS.Brain className="w-5 h-5" />}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-bold text-white capitalize">{activity.type.replace('_', ' ')}</p>
                        <span className="px-2 py-0.5 bg-slate-800 text-[8px] font-black text-slate-400 rounded uppercase tracking-widest">Node: {activity.node}</span>
                      </div>
                      <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                        {formatDate(activity.timestamp)} @ {formatTime(activity.timestamp)}
                      </p>
                    </div>
                  </div>
                  <div className="text-right max-w-[400px]">
                    <p className="text-[10px] font-bold text-slate-400 group-hover:text-slate-200 transition-colors leading-relaxed">
                      {formatDetails(activity.details, activity.type)}
                    </p>
                    <p className="text-[9px] font-black text-slate-600 uppercase mt-1">Audit Log Fact</p>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
