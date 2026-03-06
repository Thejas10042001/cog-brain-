
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { loginUser } from '../services/firebaseService';
import { ICONS } from '../constants';

export const Auth: React.FC = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const SUPPORT_LINK = "https://www.spiked.ai/contact-sales";

  // Welcome message removed
  useEffect(() => {
    // Voice assistant disabled
  }, []);

  const mapAuthError = (code: string) => {
    switch (code) {
      case 'auth/invalid-credential':
        return 'Invalid email or password. Please verify your credentials.';
      case 'auth/user-not-found':
        return 'No account found with this email identifier.';
      case 'auth/wrong-password':
        return 'The password entered is incorrect.';
      case 'auth/weak-password':
        return 'Password protocol requires at least 6 characters.';
      case 'auth/email-already-in-use':
        return 'A profile already exists with this email.';
      case 'auth/invalid-email':
        return 'The provided email identifier is invalid.';
      case 'auth/too-many-requests':
        return 'Access temporarily restricted due to multiple failed attempts.';
      default:
        return 'Neural link failed. Please verify your connection and credentials.';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isLogin) return; // Prevent any submission attempt for registration

    setError(null);

    if (password.length < 6) {
      setError("Password must be at least 6 characters long.");
      return;
    }

    setLoading(true);

    try {
      await loginUser(email, password);
    } catch (err: any) {
      console.error("Auth Error:", err);
      const mappedError = mapAuthError(err.code);
      setError(mappedError);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 px-4 py-12 transition-colors duration-500 relative overflow-hidden">
      {/* Background Accents */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-indigo-500/10 dark:bg-indigo-500/5 rounded-full blur-[120px] pointer-events-none"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-rose-500/10 dark:bg-rose-500/5 rounded-full blur-[120px] pointer-events-none"></div>

      <div className="w-full max-w-md relative z-10">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center space-y-6 mb-12"
        >
          <div className="flex justify-center mb-8">
            <motion.div 
              whileHover={{ rotate: 180, scale: 1.1 }}
              className="w-20 h-20 bg-red-600 text-white rounded-[2rem] flex items-center justify-center font-black text-4xl shadow-[0_20px_50px_rgba(220,38,38,0.3)]"
            >
              !
            </motion.div>
          </div>
          <h2 className="text-6xl font-black tracking-tighter text-white uppercase leading-none">
            SPIKED<span className="text-red-600 drop-shadow-[0_0_15px_rgba(220,38,38,0.4)]">AI</span>
          </h2>
          <p className="text-[11px] font-black text-slate-500 uppercase tracking-[0.5em] mt-4">
            Neural Sales Intelligence Protocol
          </p>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1 }}
          className="bg-slate-900/80 backdrop-blur-2xl p-12 rounded-[4rem] shadow-[0_40px_100px_rgba(0,0,0,0.3)] border border-slate-800/50 relative overflow-hidden"
        >
          <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-indigo-500 via-purple-500 to-rose-500 opacity-50"></div>

          <div className="flex p-1.5 bg-slate-800/50 rounded-[2rem] mb-12 border border-slate-700/50">
            <button 
              onClick={() => { setIsLogin(true); setError(null); }}
              className={`flex-1 py-4 text-[10px] font-black uppercase tracking-widest rounded-[1.5rem] transition-all duration-300 ${isLogin ? 'bg-slate-700 text-indigo-400 shadow-xl scale-[1.02]' : 'text-slate-400 hover:text-slate-300'}`}
            >
              Neural Access
            </button>
            <button 
              onClick={() => { setIsLogin(false); setError(null); }}
              className={`flex-1 py-4 text-[10px] font-black uppercase tracking-widest rounded-[1.5rem] transition-all duration-300 ${!isLogin ? 'bg-slate-700 text-indigo-400 shadow-xl scale-[1.02]' : 'text-slate-400 hover:text-slate-300'}`}
            >
              Join the Core
            </button>
          </div>

          <AnimatePresence mode="wait">
            {isLogin ? (
              <motion.form 
                key="login"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                onSubmit={handleSubmit} 
                className="space-y-8"
              >
                <div className="space-y-3">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] ml-4">Neural Identifier</label>
                  <div className="relative group">
                    <div className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors">
                      <ICONS.User className="w-5 h-5" />
                    </div>
                    <input 
                      type="email" 
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full pl-16 pr-8 py-5 bg-slate-800/50 border-2 border-slate-700 rounded-[2rem] text-sm focus:border-indigo-400 outline-none transition-all font-bold text-white placeholder:text-slate-600 shadow-inner"
                      placeholder="architect@spikedai.io"
                    />
                  </div>
                </div>

                <div className="space-y-3">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] ml-4">Secure Protocol Key</label>
                  <div className="relative group">
                    <div className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors">
                      <ICONS.Brain className="w-5 h-5" />
                    </div>
                    <input 
                      type="password" 
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full pl-16 pr-8 py-5 bg-slate-800/50 border-2 border-slate-700 rounded-[2rem] text-sm focus:border-indigo-400 outline-none transition-all font-bold text-white placeholder:text-slate-600 shadow-inner"
                      placeholder="••••••••"
                    />
                  </div>
                  <div className="flex justify-between items-center px-4">
                    <p className="text-[9px] text-slate-400 font-bold italic">Min 6 characters required.</p>
                    <a 
                      href={SUPPORT_LINK} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-[9px] font-black text-indigo-500 uppercase tracking-widest hover:text-indigo-700 transition-colors"
                    >
                      Forgot Key?
                    </a>
                  </div>
                </div>

                {error && (
                  <motion.div 
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-6 bg-rose-50 dark:bg-rose-900/20 border border-rose-100 dark:border-rose-900/30 rounded-2xl text-rose-600 dark:text-rose-400 text-[11px] font-black text-center leading-relaxed shadow-sm"
                  >
                    {error}
                  </motion.div>
                )}

                <motion.button 
                  whileHover={{ scale: 1.02, y: -2 }}
                  whileTap={{ scale: 0.98 }}
                  type="submit"
                  disabled={loading}
                  className="w-full py-6 bg-white text-slate-900 rounded-[2rem] font-black text-sm uppercase tracking-[0.3em] shadow-2xl hover:bg-slate-100 disabled:opacity-50 flex items-center justify-center gap-4 transition-all"
                >
                  {loading ? (
                    <div className="w-6 h-6 border-3 border-white/30 border-t-white dark:border-slate-900/30 dark:border-t-slate-900 rounded-full animate-spin"></div>
                  ) : (
                    <>Initiate Neural Link <ICONS.Play className="w-4 h-4" /></>
                  )}
                </motion.button>
              </motion.form>
            ) : (
              <motion.div 
                key="register"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-8 py-4"
              >
                 <div className="p-10 bg-indigo-50/50 dark:bg-indigo-900/10 border border-indigo-100 dark:border-indigo-800 rounded-[3rem] text-center space-y-8 shadow-inner">
                    <div className="flex justify-center">
                      <div className="p-6 bg-indigo-600 text-white rounded-[2rem] shadow-2xl shadow-indigo-200 dark:shadow-none">
                        <ICONS.Shield className="w-10 h-10" />
                      </div>
                    </div>
                    <div className="space-y-3">
                      <h3 className="text-2xl font-black text-slate-900 dark:text-white tracking-tighter uppercase">Access Restricted</h3>
                      <p className="text-[10px] text-indigo-600 dark:text-indigo-400 font-black uppercase tracking-[0.4em]">Elite Managed Onboarding</p>
                    </div>
                    <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed font-bold italic">
                      Direct profile instantiation is currently restricted to verified enterprise partners. 
                      To provision your cognitive intelligence core, please coordinate with our Sales Engineering team.
                    </p>
                    <div className="pt-4">
                      <motion.a 
                        whileHover={{ scale: 1.02, y: -2 }}
                        whileTap={{ scale: 0.98 }}
                        href={SUPPORT_LINK}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-full py-6 bg-indigo-600 text-white rounded-[2rem] font-black text-xs uppercase tracking-[0.3em] shadow-2xl shadow-indigo-200 dark:shadow-none hover:bg-indigo-700 transition-all flex items-center justify-center gap-4"
                      >
                        <ICONS.Sparkles className="w-5 h-5" />
                        Coordinate Access
                      </motion.a>
                    </div>
                 </div>

                 <div className="flex items-center gap-4 justify-center text-slate-400">
                    <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_10px_rgba(16,185,129,0.5)]"></div>
                    <span className="text-[10px] font-black uppercase tracking-[0.4em]">Neural Integrity Grounded</span>
                 </div>
              </motion.div>
            )}
          </AnimatePresence>
          
          {isLogin && !error && (
            <div className="mt-12 pt-8 border-t border-slate-50 dark:border-slate-800 text-center">
               <p className="text-[9px] text-slate-400 font-black uppercase tracking-[0.3em] mb-4">Neural Support Protocol</p>
               <a 
                 href={SUPPORT_LINK}
                 target="_blank"
                 rel="noopener noreferrer"
                 className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest hover:text-indigo-800 transition-colors border-b border-indigo-200 dark:border-indigo-900 pb-1"
               >
                 Contact Intelligence Core
               </a>
            </div>
          )}
        </motion.div>

        <motion.p 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="text-center text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.5em] pt-12"
        >
          Grounded Data Privacy v3.1 • End-to-End Encryption
        </motion.p>
      </div>
    </div>
  );
};
