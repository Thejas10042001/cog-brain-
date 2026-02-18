
import React, { useState } from 'react';
import { loginUser } from '../services/firebaseService';
import { ICONS } from '../constants';

export const Auth: React.FC = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const SUPPORT_LINK = "https://www.spiked.ai/contact-sales";

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
      setError(mapAuthError(err.code));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4 py-12">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center space-y-4">
          <div className="flex justify-center mb-6">
            <div className="w-16 h-16 bg-red-600 text-white rounded-xl flex items-center justify-center font-black text-4xl shadow-2xl animate-in zoom-in-50 duration-700">
              !
            </div>
          </div>
          <h2 className="text-5xl font-black tracking-tighter text-slate-900">
            SPIKED<span className="text-red-600">AI</span>
          </h2>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.3em]">
            Cognitive Intelligence Brain Simulation
          </p>
        </div>

        <div className="bg-white p-10 rounded-[3rem] shadow-2xl border border-slate-100 animate-in fade-in slide-in-from-bottom-8 duration-500">
          <div className="flex p-1 bg-slate-50 rounded-2xl mb-8">
            <button 
              onClick={() => { setIsLogin(true); setError(null); }}
              className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${isLogin ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
            >
              Login
            </button>
            <button 
              onClick={() => { setIsLogin(false); setError(null); }}
              className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${!isLogin ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
            >
              Join the Core
            </button>
          </div>

          {isLogin ? (
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Email Identifier</label>
                <input 
                  type="email" 
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-6 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl text-sm focus:border-indigo-500 outline-none transition-all font-semibold text-slate-800"
                  placeholder="architect@spikedai.io"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Secure Protocol Key</label>
                <input 
                  type="password" 
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-6 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl text-sm focus:border-indigo-500 outline-none transition-all font-semibold text-slate-800"
                  placeholder="••••••••"
                />
                <div className="flex justify-between items-center px-1">
                  <p className="text-[9px] text-slate-400 italic">Minimum 6 characters required.</p>
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
                <div className="space-y-4 animate-in fade-in slide-in-from-top-2">
                  <div className="p-4 bg-rose-50 border border-rose-100 rounded-xl text-rose-600 text-[10px] font-bold text-center">
                    {error}
                  </div>
                  
                  <div className="p-6 bg-indigo-50 border border-indigo-100 rounded-2xl text-center space-y-3">
                    <p className="text-[10px] font-bold text-indigo-700 uppercase tracking-tight">
                      Unable to log in? Contact Spiked AI support team
                    </p>
                    <a 
                      href={SUPPORT_LINK}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 px-6 py-2.5 bg-white border border-indigo-200 text-indigo-600 rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-indigo-600 hover:text-white hover:border-indigo-600 transition-all shadow-sm"
                    >
                      <ICONS.Search className="w-3 h-3" />
                      Contact Support Team
                    </a>
                  </div>
                </div>
              )}

              <button 
                type="submit"
                disabled={loading}
                className="w-full py-5 bg-indigo-600 text-white rounded-[1.5rem] font-black text-sm uppercase tracking-[0.2em] shadow-2xl shadow-indigo-200 hover:bg-indigo-700 hover:scale-[1.02] active:scale-95 disabled:opacity-50 flex items-center justify-center gap-3"
              >
                {loading ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                ) : (
                  'Initiate Link'
                )}
              </button>
            </form>
          ) : (
            <div className="space-y-8 py-4 animate-in fade-in zoom-in-95 duration-500">
               <div className="p-8 bg-indigo-50 border border-indigo-100 rounded-[2.5rem] text-center space-y-6">
                  <div className="flex justify-center">
                    <div className="p-4 bg-indigo-600 text-white rounded-2xl shadow-xl">
                      <ICONS.Shield className="w-8 h-8" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-xl font-black text-slate-900 tracking-tight">Provisioning Restricted</h3>
                    <p className="text-xs text-indigo-700 font-bold uppercase tracking-widest">Protocol: Elite Managed Access</p>
                  </div>
                  <p className="text-sm text-slate-600 leading-relaxed font-medium">
                    Direct profile instantiation is currently restricted to verified enterprise partners. 
                    To provision your cognitive intelligence core, please coordinate with our <strong>Sales Engineering team</strong> for tailored onboarding.
                  </p>
                  <div className="pt-4">
                    <a 
                      href={SUPPORT_LINK}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full py-5 bg-indigo-600 text-white rounded-[1.5rem] font-black text-xs uppercase tracking-[0.25em] shadow-2xl shadow-indigo-200 hover:bg-indigo-700 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-4"
                    >
                      <ICONS.Sparkles className="w-4 h-4" />
                      Coordinate with Sales Team
                    </a>
                  </div>
               </div>

               <div className="flex items-center gap-3 justify-center text-slate-400">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
                  <span className="text-[9px] font-black uppercase tracking-widest">Ensuring Grounded Data Integrity</span>
               </div>
            </div>
          )}
          
          {isLogin && !error && (
            <div className="mt-8 pt-6 border-t border-slate-50 text-center">
               <p className="text-[10px] text-slate-400 font-bold mb-3">NEED ASSISTANCE?</p>
               <a 
                 href={SUPPORT_LINK}
                 target="_blank"
                 rel="noopener noreferrer"
                 className="text-[9px] font-black text-slate-500 uppercase tracking-[0.2em] hover:text-indigo-600 transition-colors"
               >
                 Contact Spiked AI Support
               </a>
            </div>
          )}
        </div>

        <p className="text-center text-[9px] font-black text-slate-400 uppercase tracking-[0.4em] pt-4">
          Grounded Data Privacy v3.1 • End-to-End Encryption
        </p>
      </div>
    </div>
  );
};
