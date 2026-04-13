
import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ICONS } from '../constants';
import { logoutUser, User, fetchAppUpdates, markUpdateAsRead, seedInitialUpdates } from '../services/firebaseService';
import { googleService, CalendarEvent } from '../services/googleService';
import { AppUpdate } from '../types';

interface HeaderProps {
  user?: User | null;
  zoom: number;
  onZoomChange: (newZoom: number) => void;
  textZoom: number;
  onTextZoomChange: (newZoom: number) => void;
  darkMode: boolean;
  onStartTour?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ 
  user, 
  zoom, 
  onZoomChange, 
  textZoom, 
  onTextZoomChange,
  darkMode,
  onStartTour
}) => {
  const [showUtility, setShowUtility] = useState(false);
  const [showProfileDropdown, setShowProfileDropdown] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [updates, setUpdates] = useState<AppUpdate[]>([]);
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);
  const [selectedUpdate, setSelectedUpdate] = useState<AppUpdate | null>(null);
  const [isCalendarConnected, setIsCalendarConnected] = useState(false);
  const [activeMagnifierTab, setActiveMagnifierTab] = useState<'simulation' | 'typography'>('simulation');
  const utilityRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);
  const notificationRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (user) {
      loadUpdates();
      checkCalendarStatus();
    }
  }, [user]);

  const loadUpdates = async () => {
    await seedInitialUpdates();
    const fetchedUpdates = await fetchAppUpdates();
    setUpdates(fetchedUpdates.slice(0, 6));
  };

  const checkCalendarStatus = async () => {
    try {
      const status = await googleService.getAuthStatus();
      setIsCalendarConnected(status);
      if (status) {
        const events = await googleService.getUpcomingEvents();
        setCalendarEvents(events);
      }
    } catch (error) {
      console.error("Calendar status check failed:", error);
    }
  };

  const handleMarkAsRead = async (id: string) => {
    const success = await markUpdateAsRead(id);
    if (success) {
      setUpdates(prev => prev.map(u => u.id === id ? { ...u, isRead: true } : u));
    }
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (utilityRef.current && !utilityRef.current.contains(event.target as Node)) {
        setShowUtility(false);
      }
      if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
        setShowProfileDropdown(false);
      }
      if (notificationRef.current && !notificationRef.current.contains(event.target as Node)) {
        setShowNotifications(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const unreadCount = updates.filter(u => !u.isRead).length;

  return (
    <header className="fixed top-0 left-0 right-0 z-50 glass border-b border-slate-800/50 h-20 transition-all duration-500">
      <div className="w-full px-12 h-full flex items-center justify-between max-w-[1800px] mx-auto">
        <div className="flex flex-col items-start leading-none group cursor-pointer">
          <div className="flex items-center gap-4">
            <motion.div 
              whileHover={{ rotate: 180, scale: 1.1 }}
              className="w-10 h-10 bg-red-600 text-white rounded-[1.25rem] flex items-center justify-center font-black text-2xl shadow-[0_10px_30px_rgba(220,38,38,0.4)]"
            >
              !
            </motion.div>
            <span className="font-black text-3xl tracking-tighter text-white uppercase">
              SPIKED<span className="text-red-600 drop-shadow-[0_0_15px_rgba(220,38,38,0.4)]">AI</span>
            </span>
          </div>
          <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.5em] mt-2 ml-1 hidden md:block">
            Neural Sales Intelligence Protocol
          </span>
        </div>

        <div className="flex items-center gap-6">
          {user && (
            <div className="relative" ref={profileRef}>
              <motion.button 
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setShowProfileDropdown(!showProfileDropdown)}
                className="hidden lg:flex items-center gap-4 bg-slate-800/50 backdrop-blur-sm px-5 py-2 rounded-2xl border border-slate-700/50 transition-all shadow-sm hover:shadow-md hover:bg-slate-800"
              >
                <div className="flex flex-col items-end">
                  <span className="text-[8px] font-black uppercase text-indigo-400 tracking-widest">Neural Link Active</span>
                  <span className="text-[11px] font-black text-slate-200 truncate max-w-[150px]">{user.email}</span>
                </div>
                <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-white font-black text-xs shadow-lg">
                  {user.email?.[0].toUpperCase()}
                </div>
                <ICONS.ChevronDown className={`w-4 h-4 text-slate-400 transition-transform duration-300 ${showProfileDropdown ? 'rotate-180' : ''}`} />
              </motion.button>

              <AnimatePresence>
                {showProfileDropdown && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                    className="absolute right-0 mt-4 w-64 bg-slate-900 border border-slate-800 rounded-[2rem] shadow-2xl overflow-hidden z-50"
                  >
                    <div className="p-4 border-b border-slate-800 bg-slate-800/30">
                      <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Authenticated User</p>
                      <p className="text-xs font-bold text-white truncate">{user.email}</p>
                    </div>
                    <div className="p-2">
                      <button 
                        onClick={() => {
                          onStartTour?.();
                          setShowProfileDropdown(false);
                        }}
                        className="w-full flex items-center gap-3 px-4 py-3 text-indigo-400 hover:text-indigo-300 hover:bg-indigo-900/20 rounded-xl transition-all group"
                      >
                        <ICONS.Sparkles className="w-4 h-4 text-indigo-500 group-hover:text-indigo-400" />
                        <span className="text-xs font-bold">Start Onboarding Tour</span>
                      </button>
                      <button className="w-full flex items-center gap-3 px-4 py-3 text-slate-300 hover:text-white hover:bg-slate-800 rounded-xl transition-all group">
                        <ICONS.Settings className="w-4 h-4 text-slate-500 group-hover:text-indigo-400" />
                        <span className="text-xs font-bold">Account Settings</span>
                      </button>
                      <button 
                        onClick={() => {
                          setShowNotifications(true);
                          setShowProfileDropdown(false);
                        }}
                        className="w-full flex items-center gap-3 px-4 py-3 text-slate-300 hover:text-white hover:bg-slate-800 rounded-xl transition-all group"
                      >
                        <ICONS.Bell className="w-4 h-4 text-slate-500 group-hover:text-indigo-400" />
                        <span className="text-xs font-bold">Notifications</span>
                        {unreadCount > 0 && (
                          <span className="ml-auto w-5 h-5 rounded-full bg-red-500 text-[10px] font-black flex items-center justify-center text-white shadow-[0_0_10px_rgba(239,68,68,0.5)]">
                            {unreadCount}
                          </span>
                        )}
                      </button>
                    </div>
                    <div className="p-2 border-t border-slate-800 bg-slate-800/10">
                      <button 
                        onClick={() => logoutUser()}
                        className="w-full flex items-center gap-3 px-4 py-3 text-rose-400 hover:text-rose-300 hover:bg-rose-900/20 rounded-xl transition-all group"
                      >
                        <ICONS.LogOut className="w-4 h-4 text-rose-500/50 group-hover:text-rose-500" />
                        <span className="text-xs font-bold">Disconnect Link</span>
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}

          <div className="relative" ref={utilityRef}>
            <motion.button 
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setShowUtility(!showUtility)}
              className={`w-11 h-11 rounded-2xl flex items-center justify-center transition-all border shadow-sm ${showUtility ? 'bg-indigo-600 border-indigo-700 text-white shadow-none' : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'}`}
              title="Cognitive Magnifier"
            >
              <ICONS.Efficiency className="w-6 h-6" />
            </motion.button>

            <AnimatePresence>
              {showUtility && (
                <motion.div 
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.95 }}
                  className="absolute right-0 mt-4 w-80 bg-slate-900 border border-slate-800 rounded-[2.5rem] shadow-2xl overflow-hidden z-50"
                >
                  {/* Tab Switcher */}
                  <div className="flex border-b border-slate-800 p-2 gap-2 bg-slate-800/50">
                    <button 
                      onClick={() => setActiveMagnifierTab('simulation')}
                      className={`flex-1 py-3 px-3 rounded-2xl text-[9px] font-black uppercase tracking-widest transition-all ${activeMagnifierTab === 'simulation' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-slate-300'}`}
                    >
                      Simulation Scale
                    </button>
                    <button 
                      onClick={() => setActiveMagnifierTab('typography')}
                      className={`flex-1 py-3 px-3 rounded-2xl text-[9px] font-black uppercase tracking-widest transition-all ${activeMagnifierTab === 'typography' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-slate-300'}`}
                    >
                      Text Intelligence
                    </button>
                  </div>

                  <div className="p-8 space-y-8">
                    {activeMagnifierTab === 'simulation' ? (
                      <div className="space-y-5">
                        <div className="flex items-center justify-between">
                           <h5 className="text-[10px] font-black uppercase text-slate-500 tracking-[0.2em]">Viewport Magnifier</h5>
                           <span className="text-sm font-black text-indigo-400">{zoom}%</span>
                        </div>
                        <div className="flex items-center gap-3">
                           <button 
                             onClick={() => onZoomChange(Math.max(50, zoom - 10))}
                             className="flex-1 flex items-center justify-center py-3 bg-slate-800 hover:bg-slate-700 rounded-2xl transition-colors border border-slate-700"
                           >
                             <ICONS.ZoomOut className="w-4 h-4 text-slate-400" />
                           </button>
                           <button 
                             onClick={() => onZoomChange(100)}
                             className="px-5 py-3 bg-indigo-600 text-[10px] font-black text-white rounded-2xl shadow-lg hover:bg-indigo-700 transition-colors"
                           >
                             RESET
                           </button>
                           <button 
                             onClick={() => onZoomChange(Math.min(200, zoom + 10))}
                             className="flex-1 flex items-center justify-center py-3 bg-slate-800 hover:bg-slate-700 rounded-2xl transition-colors border border-slate-700"
                           >
                             <ICONS.ZoomIn className="w-4 h-4 text-slate-400" />
                           </button>
                        </div>
                        <p className="text-[10px] text-slate-500 font-bold italic text-center leading-relaxed">Scales the <strong>entire brain simulation</strong> viewport including layout and assets.</p>
                      </div>
                    ) : (
                      <div className="space-y-5">
                        <div className="flex items-center justify-between">
                           <h5 className="text-[10px] font-black uppercase text-slate-500 tracking-[0.2em]">Text Intelligence Focus</h5>
                           <span className="text-sm font-black text-indigo-400">{textZoom}%</span>
                        </div>
                        <div className="flex items-center gap-3">
                           <button 
                             onClick={() => onTextZoomChange(Math.max(80, textZoom - 10))}
                             className="flex-1 flex items-center justify-center py-3 bg-slate-800 hover:bg-slate-700 rounded-2xl transition-colors border border-slate-700"
                           >
                             <ICONS.ZoomOut className="w-4 h-4 text-slate-400" />
                           </button>
                           <button 
                             onClick={() => onTextZoomChange(100)}
                             className="px-5 py-3 bg-indigo-600 text-[10px] font-black text-white rounded-2xl shadow-lg hover:bg-indigo-700 transition-colors"
                           >
                             RESET
                           </button>
                           <button 
                             onClick={() => onTextZoomChange(Math.min(250, textZoom + 10))}
                             className="flex-1 flex items-center justify-center py-3 bg-slate-800 hover:bg-slate-700 rounded-2xl transition-colors border border-slate-700"
                           >
                             <ICONS.ZoomIn className="w-4 h-4 text-slate-400" />
                           </button>
                        </div>
                        <p className="text-[10px] text-slate-500 font-bold italic text-center leading-relaxed">Increases <strong>typography readability</strong> only. UI containers and layout remain static.</p>
                      </div>
                    )}
                  </div>
                  <div className="p-5 bg-slate-800/50 text-center border-t border-slate-800">
                     <p className="text-[9px] font-black uppercase text-slate-500 tracking-[0.4em]">Neural Interface v3.1</p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Notifications Overlay */}
          <div className="relative" ref={notificationRef}>
            <motion.button 
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setShowNotifications(!showNotifications)}
              className={`w-11 h-11 rounded-2xl flex items-center justify-center transition-all border shadow-sm ${showNotifications ? 'bg-indigo-600 border-indigo-700 text-white shadow-none' : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'}`}
              title="Intelligence Notifications"
            >
              <div className="relative">
                <ICONS.Bell className="w-6 h-6" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full border-2 border-slate-900 shadow-[0_0_10px_rgba(239,68,68,0.5)]"></span>
                )}
              </div>
            </motion.button>

            <AnimatePresence>
              {showNotifications && (
                <motion.div 
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.95 }}
                  className="absolute right-0 mt-4 w-[400px] bg-slate-900 border border-slate-800 rounded-[2.5rem] shadow-2xl overflow-hidden z-50"
                >
                  <div className="p-6 border-b border-slate-800 bg-slate-800/30 flex items-center justify-between">
                    <div>
                      <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em]">Neural Updates</h4>
                      <p className="text-xs font-bold text-white">System Intelligence Feed</p>
                    </div>
                    <div className="flex items-center gap-2">
                       <div className="px-2 py-1 bg-indigo-900/40 border border-indigo-500/30 rounded-lg text-[8px] font-black text-indigo-400 uppercase">
                         {updates.length} Updates
                       </div>
                    </div>
                  </div>

                  <div className="max-h-[500px] overflow-y-auto custom-scrollbar">
                    {/* Calendar Section */}
                    <div className="p-4 bg-indigo-950/20 border-b border-slate-800">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <ICONS.Calendar className="w-3 h-3 text-indigo-400" />
                          <span className="text-[9px] font-black text-indigo-400 uppercase tracking-widest">Upcoming Strategy Sessions</span>
                        </div>
                        {!isCalendarConnected && (
                          <button 
                            onClick={async () => {
                              const url = await googleService.getAuthUrl();
                              window.open(url, 'google_oauth', 'width=600,height=600');
                            }}
                            className="text-[8px] font-black text-indigo-500 hover:text-indigo-400 uppercase underline"
                          >
                            Connect Google
                          </button>
                        )}
                      </div>
                      
                      {isCalendarConnected ? (
                        <div className="space-y-2">
                          {calendarEvents.length > 0 ? (
                            calendarEvents.slice(0, 3).map(event => (
                              <div key={event.id} className="flex items-center gap-3 p-2 bg-slate-800/40 rounded-xl border border-slate-700/30">
                                <div className="w-8 h-8 rounded-lg bg-indigo-600/20 flex flex-col items-center justify-center text-indigo-400">
                                  <span className="text-[8px] font-black leading-none">
                                    {event.start.dateTime ? new Date(event.start.dateTime).getDate() : ''}
                                  </span>
                                  <span className="text-[6px] font-black uppercase">
                                    {event.start.dateTime ? new Date(event.start.dateTime).toLocaleString('default', { month: 'short' }) : ''}
                                  </span>
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-[10px] font-bold text-white truncate">{event.summary}</p>
                                  <p className="text-[8px] text-slate-500 font-medium">
                                    {event.start.dateTime ? new Date(event.start.dateTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'All Day'}
                                  </p>
                                </div>
                              </div>
                            ))
                          ) : (
                            <p className="text-[10px] text-slate-500 italic text-center py-2">No upcoming meetings detected.</p>
                          )}
                        </div>
                      ) : (
                        <div className="text-center py-4 bg-slate-800/20 rounded-2xl border border-dashed border-slate-700">
                          <p className="text-[10px] text-slate-500 font-bold mb-2">Google Calendar Not Linked</p>
                          <button 
                            onClick={async () => {
                              const url = await googleService.getAuthUrl();
                              window.open(url, 'google_oauth', 'width=600,height=600');
                            }}
                            className="px-4 py-2 bg-indigo-600 text-[8px] font-black text-white rounded-lg hover:bg-indigo-700 transition-all"
                          >
                            LINK NEURAL CALENDAR
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Updates List */}
                    <div className="p-2 space-y-1">
                      {updates.map(update => (
                        <button
                          key={update.id}
                          onClick={() => {
                            setSelectedUpdate(update);
                            handleMarkAsRead(update.id);
                          }}
                          className={`w-full p-4 rounded-2xl text-left transition-all group relative ${update.isRead ? 'hover:bg-slate-800/50' : 'bg-indigo-900/10 hover:bg-indigo-900/20 border border-indigo-500/20'}`}
                        >
                          {!update.isRead && (
                            <span className="absolute top-4 right-4 w-2 h-2 bg-indigo-500 rounded-full animate-pulse shadow-[0_0_10px_rgba(99,102,241,0.5)]"></span>
                          )}
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-[8px] font-black text-indigo-400 uppercase tracking-widest">{update.version || 'v3.x'}</span>
                            <span className="text-[8px] text-slate-600 font-bold">•</span>
                            <span className="text-[8px] text-slate-500 font-bold">{new Date(update.timestamp).toLocaleDateString()}</span>
                          </div>
                          <h5 className={`text-xs font-black uppercase tracking-tight mb-1 ${update.isRead ? 'text-slate-300' : 'text-white'}`}>
                            {update.title}
                          </h5>
                          <p className="text-[10px] text-slate-500 font-medium line-clamp-2 leading-relaxed">
                            {update.description}
                          </p>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="p-4 bg-slate-800/50 text-center border-t border-slate-800">
                    <p className="text-[8px] font-black uppercase text-slate-600 tracking-[0.4em]">Neural Feed v3.2.0</p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Detailed Update Modal */}
            <AnimatePresence>
              {selectedUpdate && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
                  <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={() => setSelectedUpdate(null)}
                    className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm"
                  />
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.9, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.9, y: 20 }}
                    className="relative w-full max-w-lg bg-slate-900 border border-slate-800 rounded-[3rem] shadow-2xl overflow-hidden"
                  >
                    <div className="p-10 space-y-8">
                      <div className="flex items-center justify-between">
                        <div className="space-y-2">
                          <div className="flex items-center gap-3">
                            <span className="px-3 py-1 bg-indigo-600 text-[10px] font-black text-white rounded-full uppercase tracking-widest">
                              {selectedUpdate.version}
                            </span>
                            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                              {new Date(selectedUpdate.timestamp).toLocaleDateString()}
                            </span>
                          </div>
                          <h2 className="text-3xl font-black text-white uppercase tracking-tighter leading-none">
                            {selectedUpdate.title}
                          </h2>
                        </div>
                        <button 
                          onClick={() => setSelectedUpdate(null)}
                          className="w-12 h-12 rounded-2xl bg-slate-800 flex items-center justify-center text-slate-400 hover:text-white transition-all"
                        >
                          <ICONS.X className="w-6 h-6" />
                        </button>
                      </div>

                      <div className="space-y-6">
                        <div className="h-1 w-20 bg-indigo-600 rounded-full" />
                        <p className="text-slate-300 text-lg font-medium leading-relaxed">
                          {selectedUpdate.detailedInfo}
                        </p>
                      </div>

                      <div className="pt-8 border-t border-slate-800 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                          <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Neural Integrity Verified</span>
                        </div>
                        <button 
                          onClick={() => setSelectedUpdate(null)}
                          className="px-8 py-4 bg-indigo-600 text-white text-[10px] font-black uppercase tracking-widest rounded-2xl hover:bg-indigo-700 transition-all active:scale-95 shadow-xl shadow-indigo-900/20"
                        >
                          Acknowledge Update
                        </button>
                      </div>
                    </div>
                  </motion.div>
                </div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </header>
  );
};
