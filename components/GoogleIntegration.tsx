import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { googleService, CalendarEvent } from '../services/googleService';
import { ICONS } from '../constants';

export const GoogleIntegration: React.FC = () => {
  const [isConnected, setIsConnected] = useState(false);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const checkStatus = async () => {
    try {
      const status = await googleService.getAuthStatus();
      setIsConnected(status);
      if (status) {
        fetchEvents();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchEvents = async () => {
    try {
      const upcoming = await googleService.getUpcomingEvents();
      setEvents(upcoming);
    } catch (err) {
      setError('Failed to load calendar events');
    }
  };

  const handleConnect = async () => {
    const url = await googleService.getAuthUrl();
    const width = 600;
    const height = 700;
    const left = window.screenX + (window.outerWidth - width) / 2;
    const top = window.screenY + (window.outerHeight - height) / 2;
    
    const authWindow = window.open(
      url,
      'google_oauth',
      `width=${width},height=${height},left=${left},top=${top}`
    );

    if (!authWindow) {
      alert('Please allow popups to connect your Google account');
      return;
    }

    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'OAUTH_AUTH_SUCCESS') {
        setIsConnected(true);
        fetchEvents();
        window.removeEventListener('message', handleMessage);
      }
    };

    window.addEventListener('message', handleMessage);
  };

  const handleLogout = async () => {
    await googleService.logout();
    setIsConnected(false);
    setEvents([]);
  };

  useEffect(() => {
    checkStatus();
  }, []);

  if (loading) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between bg-slate-900/50 p-6 rounded-3xl border border-slate-800">
        <div className="flex items-center gap-4">
          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${isConnected ? 'bg-emerald-500/10 text-emerald-500' : 'bg-slate-800 text-slate-400'}`}>
            <ICONS.Calendar className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-lg font-black text-white uppercase tracking-tight">Google Workspace</h3>
            <p className="text-slate-400 text-xs font-medium">
              {isConnected ? 'Neural link established with Google Calendar & Gmail' : 'Connect to sync meetings and send reports'}
            </p>
          </div>
        </div>
        
        {isConnected ? (
          <button 
            onClick={handleLogout}
            className="px-6 py-3 bg-slate-800 text-slate-400 text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-rose-900/30 hover:text-rose-500 transition-all"
          >
            Disconnect
          </button>
        ) : (
          <button 
            onClick={handleConnect}
            className="px-6 py-3 bg-indigo-600 text-white text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-indigo-500 transition-all shadow-lg shadow-indigo-600/20"
          >
            Connect Google
          </button>
        )}
      </div>

      <AnimatePresence>
        {isConnected && events.length > 0 && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="space-y-4"
          >
            <div className="flex items-center justify-between px-2">
              <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Upcoming Intelligence Sessions</h4>
              <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">{events.length} Meetings Found</span>
            </div>
            
            <div className="grid gap-3">
              {events.map((event) => {
                const startTime = event.start.dateTime ? new Date(event.start.dateTime) : null;
                const isToday = startTime && startTime.toDateString() === new Date().toDateString();
                
                return (
                  <div key={event.id} className={`p-4 rounded-2xl border transition-all ${isToday ? 'bg-indigo-600/10 border-indigo-500/30 shadow-lg shadow-indigo-600/5' : 'bg-slate-900 border-slate-800'}`}>
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <h5 className="text-sm font-black text-white">{event.summary}</h5>
                          {isToday && (
                            <span className="px-2 py-0.5 bg-indigo-600 text-[8px] font-black text-white uppercase tracking-widest rounded-full">Today</span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 text-[10px] font-medium text-slate-400">
                          <div className="flex items-center gap-1">
                            <ICONS.Clock className="w-3 h-3" />
                            {startTime ? startTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'All Day'}
                          </div>
                          {event.location && (
                            <div className="flex items-center gap-1">
                              <ICONS.Map className="w-3 h-3" />
                              <span className="truncate max-w-[150px]">{event.location}</span>
                            </div>
                          )}
                        </div>
                      </div>
                      
                      {isToday && (
                        <button className="px-4 py-2 bg-indigo-600 text-white text-[9px] font-black uppercase tracking-widest rounded-xl hover:bg-indigo-500 transition-all shadow-md shadow-indigo-600/20">
                          Prepare Now
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
