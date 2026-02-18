import React, { useState } from 'react';
import { loginUser } from '../services/firebaseService';
import { ICONS } from '../constants';

export const Auth: React.FC = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const SUPPORT_LINK = "https://www.google.com";

  const mapAuthError = (code: string) => {
    switch (code) {
      case 'auth/invalid-credential': return 'Invalid credentials. Please verify your entries.';
      case 'auth/user-not-found': return 'Profile not identified.';
      case 'auth/wrong-password': return 'Incorrect password protocol.';
      case 'auth/too-many-requests': return 'Access temporarily restricted.';
      default: return 'Link failed. Check connectivity.';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isLogin) return;
    setError(null);
    if (password.length < 6) {
      setError("Min 6 characters required.");
      return;
    }
    setLoading(true);
    try {
      await loginUser(email, password);
    } catch (err: any) {
      setError(mapAuthError(err.code));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4 py-12">
      <div className="w-full max-w-md space-y-10">
        <div className="text-center space-y-6">
          <div className="flex justify-center">
            <div className="w-20 h-20 bg-indigo-600 text-white rounded-[2rem] flex items-center justify-center shadow-2xl animate-in zoom-in-50 duration-700">
              <ICONS.Shield className="w-10 h-10" />
            </div>
          </div>
          <div className="space-y-2">
            <h2 className="text-4xl font-black tracking-tight text-slate-900 uppercase">Enterprise Login</h2>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.4em]">Strategic Intelligence Access</p>
          </div>
        </div>

        <div className="bg-white p-10 rounded-[3rem] shadow-2xl border border-slate-100 animate-in fade-in slide-in-from-bottom-8 duration-500">
          <div className="flex p-1 bg-slate-50 rounded-2xl mb-10">
            <button 
              onClick={() => { setIsLogin(true); setError(null); }}
              className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${isLogin ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
            >
              Sign In
            </button>
            <button 
              onClick={() => { setIsLogin(false); setError(null); }}
              className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${!isLogin ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
            >
              Request Entry
            </button>
          </div>

          {isLogin ? (
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Email Identifier</label>
                <input 
                  type="email" required value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-6 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl text-sm focus:border-indigo-500 outline-none transition-all font-semibold text-slate-800"
                  placeholder="name@company.com"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Secure Protocol Key</label>
                <input 
                  type="password" required value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-6 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl text-sm focus:border-indigo-500 outline-none transition-all font-semibold text-slate-800"
                  placeholder="••••••••"
                />
              </div>

              {error && <div className="p-4 bg-rose-50 border border-rose-100 rounded-xl text-rose-600 text-[10px] font-bold text-center">{error}</div>}

              <button 
                type="submit" disabled={loading}
                className="w-full py-5 bg-indigo-600 text-white rounded-[1.5rem] font-black text-sm uppercase tracking-[0.2em] shadow-2xl shadow-indigo-200 hover:bg-indigo-700 transition-all flex items-center justify-center gap-3 disabled:opacity-50"
              >
                {loading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> : 'Authorize Entry'}
              </button>
            </form>
          ) : (
            <div className="p-8 bg-indigo-50 border border-indigo-100 rounded-[2.5rem] text-center space-y-6">
              <div className="p-4 bg-indigo-600 text-white rounded-2xl shadow-xl inline-block"><ICONS.Shield className="w-8 h-8" /></div>
              <h3 className="text-xl font-black text-slate-900 tracking-tight">Access Restricted</h3>
              <p className="text-sm text-slate-600 leading-relaxed font-medium">Internal provisioning required. Contact your systems administrator to authorize this profile.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};