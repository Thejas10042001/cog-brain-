import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ICONS } from '../../constants';
import { 
  fetchUserSettings, 
  updateUserSettings, 
  uploadProfilePicture, 
  logActivity,
  changeUserPassword,
  verifyUserEmail,
  deleteUserAccount,
  fetchActivityLogs,
  fetchDocumentsFromFirebase,
  deleteDocumentFromFirebase
} from '../../services/firebaseService';
import { UserSettings, ActivityLog, StoredDocument, UserPreferences } from '../../types';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { ActiveSessions } from './ActiveSessions';
import { LegalModal } from '../LegalModal';
import { LEGAL_CONTENT } from '../legal/LegalContent';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

type SettingsTab = 'profile' | 'security' | 'pin' | 'data' | 'integrations' | 'notifications' | 'activity' | 'advanced' | 'legal';

export const AccountSettings: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const [activeTab, setActiveTab] = useState<SettingsTab>('profile');
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ message: string, type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    const loadSettings = async () => {
      const data = await fetchUserSettings();
      setSettings(data);
      setLoading(false);
    };
    loadSettings();
  }, []);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleUpdateSettings = async (newSettings: Partial<UserSettings>) => {
    if (!settings) return;
    setSaving(true);
    const updated = { ...settings, ...newSettings };
    const success = await updateUserSettings(updated);
    if (success) {
      setSettings(updated);
      showToast('Settings updated successfully');
    } else {
      showToast('Failed to update settings', 'error');
    }
    setSaving(false);
  };

  const sidebarItems = [
    { id: 'profile', label: 'Profile', icon: ICONS.User },
    { id: 'security', label: 'Security', icon: ICONS.Lock },
    { id: 'pin', label: 'PIN System', icon: ICONS.Shield },
    { id: 'data', label: 'Data & Privacy', icon: ICONS.Database },
    { id: 'integrations', label: 'Integrations', icon: ICONS.Efficiency },
    { id: 'notifications', label: 'Notifications', icon: ICONS.Bell },
    { id: 'activity', label: 'Activity Logs', icon: ICONS.History },
    { id: 'advanced', label: 'Advanced', icon: ICONS.Settings },
    { id: 'legal', label: 'Legal', icon: ICONS.Document },
  ];

  const [isTermsOpen, setIsTermsOpen] = useState(false);
  const [isPrivacyOpen, setIsPrivacyOpen] = useState(false);
  const [hasConsented, setHasConsented] = useState(settings?.privacy.acceptedTerms && settings?.privacy.acceptedPrivacyPolicy);

  useEffect(() => {
    if (settings) {
      setHasConsented(settings.privacy.acceptedTerms && settings.privacy.acceptedPrivacyPolicy);
    }
  }, [settings]);

  const handleConsentUpdate = async (checked: boolean) => {
    if (!settings) return;
    try {
      const newPrivacy = {
        ...settings.privacy,
        acceptedTerms: checked,
        acceptedPrivacyPolicy: checked,
        consentTimestamp: Date.now()
      };
      const success = await updateUserSettings({ privacy: newPrivacy });
      if (success) {
        setHasConsented(checked);
        logActivity({
          type: 'security',
          action: checked ? 'Accepted Legal Agreements' : 'Revoked Legal Agreements'
        });
      }
    } catch (err) {
      console.error('Failed to update consent:', err);
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 z-[100] bg-slate-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-slate-800 border-t-indigo-600 rounded-full animate-spin" />
          <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest animate-pulse">Loading Neural Preferences...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[100] bg-slate-950 flex flex-col md:flex-row overflow-hidden">
      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className={cn(
              "fixed top-8 left-1/2 -translate-x-1/2 z-[110] px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-3 border backdrop-blur-xl",
              toast.type === 'success' ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" : "bg-rose-500/10 border-rose-500/20 text-rose-400"
            )}
          >
            <div className={cn("w-2 h-2 rounded-full animate-pulse", toast.type === 'success' ? "bg-emerald-500" : "bg-rose-500")} />
            <span className="text-[10px] font-black uppercase tracking-widest">{toast.message}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <div className="w-full md:w-80 bg-slate-900 border-r border-slate-800 flex flex-col shrink-0">
        <div className="p-8 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-600/20">
              <ICONS.Settings className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-black text-white uppercase tracking-tight">Settings</h1>
              <p className="text-[9px] font-black text-slate-500 uppercase tracking-[0.2em]">Neural Protocol v3.2</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="md:hidden p-2 hover:bg-slate-800 rounded-xl transition-colors"
          >
            <ICONS.X className="w-6 h-6 text-slate-400" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar">
          {sidebarItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id as SettingsTab)}
              className={cn(
                "w-full flex items-center gap-4 px-6 py-4 rounded-2xl transition-all group relative overflow-hidden",
                activeTab === item.id 
                  ? "bg-indigo-600 text-white shadow-xl shadow-indigo-600/20" 
                  : "text-slate-400 hover:text-white hover:bg-slate-800"
              )}
            >
              <item.icon className={cn("w-5 h-5 transition-colors", activeTab === item.id ? "text-white" : "text-slate-500 group-hover:text-indigo-400")} />
              <span className="text-xs font-black uppercase tracking-widest">{item.label}</span>
              {activeTab === item.id && (
                <motion.div 
                  layoutId="active-tab-indicator"
                  className="absolute left-0 top-0 bottom-0 w-1 bg-white"
                />
              )}
            </button>
          ))}
        </nav>

        <div className="p-8 border-t border-slate-800">
          <button 
            onClick={onClose}
            className="w-full py-4 bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-black uppercase tracking-widest rounded-2xl transition-all flex items-center justify-center gap-3"
          >
            <ICONS.ArrowLeft className="w-4 h-4" />
            Return to Console
          </button>
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto bg-slate-950 custom-scrollbar relative">
        <div className="max-w-4xl mx-auto p-8 md:p-16">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
            >
              {activeTab === 'profile' && settings && (
                <ProfileTab settings={settings} onUpdate={handleUpdateSettings} showToast={showToast} />
              )}
              {activeTab === 'security' && settings && (
                <SecurityTab settings={settings} onUpdate={handleUpdateSettings} showToast={showToast} />
              )}
              {activeTab === 'pin' && settings && (
                <PinTab settings={settings} onUpdate={handleUpdateSettings} showToast={showToast} />
              )}
              {activeTab === 'data' && settings && (
                <DataPrivacyTab 
                  settings={settings} 
                  onUpdate={handleUpdateSettings} 
                  showToast={showToast}
                  onOpenTerms={() => setIsTermsOpen(true)}
                  onOpenPrivacy={() => setIsPrivacyOpen(true)}
                  hasConsented={hasConsented}
                  onConsentUpdate={handleConsentUpdate}
                />
              )}
              {activeTab === 'integrations' && settings && (
                <IntegrationsTab settings={settings} onUpdate={handleUpdateSettings} showToast={showToast} />
              )}
              {activeTab === 'notifications' && settings && (
                <NotificationsTab settings={settings} onUpdate={handleUpdateSettings} showToast={showToast} />
              )}
              {activeTab === 'activity' && (
                <ActivityTab showToast={showToast} />
              )}
              {activeTab === 'advanced' && settings && (
                <AdvancedTab settings={settings} onUpdate={handleUpdateSettings} showToast={showToast} />
              )}
              {activeTab === 'legal' && settings && (
                <LegalTab 
                  settings={settings} 
                  onUpdate={handleUpdateSettings} 
                  showToast={showToast}
                  onOpenTerms={() => setIsTermsOpen(true)}
                  onOpenPrivacy={() => setIsPrivacyOpen(true)}
                  hasConsented={hasConsented}
                  onConsentUpdate={handleConsentUpdate}
                />
              )}
            </motion.div>
          </AnimatePresence>

          {/* Legal Modals */}
          <LegalModal 
            isOpen={isTermsOpen} 
            onClose={() => setIsTermsOpen(false)} 
            title="Neural Terms of Service" 
            content={LEGAL_CONTENT.terms}
            onAccept={!hasConsented ? () => handleConsentUpdate(true) : undefined}
          />
          <LegalModal 
            isOpen={isPrivacyOpen} 
            onClose={() => setIsPrivacyOpen(false)} 
            title="Neural Privacy Protocol" 
            content={LEGAL_CONTENT.privacy}
            onAccept={!hasConsented ? () => handleConsentUpdate(true) : undefined}
          />
        </div>
      </div>
    </div>
  );
};

// --- SUB-COMPONENTS ---

const ProfileTab: React.FC<{ settings: UserSettings, onUpdate: (s: Partial<UserSettings>) => void, showToast: (m: string, t?: 'success' | 'error') => void }> = ({ settings, onUpdate, showToast }) => {
  const [formData, setFormData] = useState(settings.profile);
  const [uploading, setUploading] = useState(false);
  const [verificationCooldown, setVerificationCooldown] = useState(0);

  useEffect(() => {
    if (verificationCooldown > 0) {
      const timer = setTimeout(() => setVerificationCooldown(prev => prev - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [verificationCooldown]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdate({ profile: formData });
    logActivity({ type: 'security', action: 'Updated profile details' });
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const url = await uploadProfilePicture(file);
    if (url) {
      setFormData(prev => ({ ...prev, photoURL: url }));
      onUpdate({ profile: { ...formData, photoURL: url } });
      showToast('Profile picture updated');
    } else {
      showToast('Upload failed', 'error');
    }
    setUploading(false);
  };

  return (
    <div className="space-y-12">
      <header className="space-y-4">
        <h2 className="text-4xl font-black text-white uppercase tracking-tighter">Profile Management</h2>
        <p className="text-slate-400 text-lg font-medium">Calibrate your neural identity and professional parameters.</p>
      </header>

      <form onSubmit={handleSubmit} className="space-y-8">
        <div className="flex flex-col md:flex-row items-center gap-8 p-8 bg-slate-900/50 border border-slate-800 rounded-[2.5rem]">
          <div className="relative group">
            <div className="w-32 h-32 rounded-[2rem] bg-slate-800 border-2 border-slate-700 flex items-center justify-center text-white font-black text-4xl shadow-2xl overflow-hidden">
              {formData.photoURL ? (
                <img src={formData.photoURL} alt="Profile" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
              ) : (
                formData.name?.[0] || 'U'
              )}
              {uploading && (
                <div className="absolute inset-0 bg-slate-950/60 flex items-center justify-center">
                  <div className="w-8 h-8 border-2 border-white border-t-transparent rounded-full animate-spin" />
                </div>
              )}
            </div>
            <label className="absolute -bottom-2 -right-2 w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg border-2 border-slate-900 cursor-pointer hover:bg-indigo-500 transition-colors">
              <ICONS.Camera className="w-5 h-5 text-white" />
              <input type="file" className="hidden" accept="image/*" onChange={handlePhotoUpload} disabled={uploading} />
            </label>
          </div>
          <div className="flex-1 space-y-2 text-center md:text-left">
            <h3 className="text-xl font-black text-white uppercase tracking-tight">{formData.name || 'Neural Agent'}</h3>
            <p className="text-slate-500 text-xs font-black uppercase tracking-widest">{formData.role || 'Unassigned Role'}</p>
            <p className="text-slate-500 text-[10px] font-medium">{formData.email}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-4">Full Name</label>
            <input 
              type="text" 
              value={formData.name}
              onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
              className="w-full bg-slate-900 border border-slate-800 rounded-2xl px-6 py-4 text-white font-medium focus:border-indigo-500 outline-none transition-all"
              placeholder="Enter full name"
            />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-4">Phone Number</label>
            <input 
              type="tel" 
              value={formData.phone}
              onChange={e => setFormData(prev => ({ ...prev, phone: e.target.value }))}
              className="w-full bg-slate-900 border border-slate-800 rounded-2xl px-6 py-4 text-white font-medium focus:border-indigo-500 outline-none transition-all"
              placeholder="+1 (555) 000-0000"
            />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-4">Role / Title</label>
            <input 
              type="text" 
              value={formData.role}
              onChange={e => setFormData(prev => ({ ...prev, role: e.target.value }))}
              className="w-full bg-slate-900 border border-slate-800 rounded-2xl px-6 py-4 text-white font-medium focus:border-indigo-500 outline-none transition-all"
              placeholder="e.g. Strategic Sales Director"
            />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-4">Organization</label>
            <input 
              type="text" 
              value={formData.organization || ''}
              onChange={e => setFormData(prev => ({ ...prev, organization: e.target.value }))}
              className="w-full bg-slate-900 border border-slate-800 rounded-2xl px-6 py-4 text-white font-medium focus:border-indigo-500 outline-none transition-all"
              placeholder="Company Name"
            />
          </div>
        </div>

        <div className="pt-8 flex items-center justify-between gap-4">
          <button 
            type="button"
            disabled={verificationCooldown > 0}
            onClick={async () => {
              if (verificationCooldown > 0) return;
              const success = await verifyUserEmail();
              if (success) {
                showToast('Verification email sent');
                setVerificationCooldown(60); // 60 second cooldown
              } else {
                showToast('Failed to send email. Please wait before retrying.', 'error');
              }
            }}
            className={cn(
              "px-8 py-4 bg-slate-900 border border-slate-800 text-slate-400 text-[10px] font-black uppercase tracking-widest rounded-2xl transition-all",
              verificationCooldown > 0 ? "opacity-50 cursor-not-allowed" : "hover:text-white hover:bg-slate-800"
            )}
          >
            {verificationCooldown > 0 ? `Retry in ${verificationCooldown}s` : 'Verify Email Address'}
          </button>
          <button 
            type="submit"
            className="px-12 py-4 bg-indigo-600 text-white text-[10px] font-black uppercase tracking-widest rounded-2xl hover:bg-indigo-500 transition-all shadow-xl shadow-indigo-600/20"
          >
            Save Neural Identity
          </button>
        </div>
      </form>
    </div>
  );
};

const SecurityTab: React.FC<{ settings: UserSettings, onUpdate: (s: Partial<UserSettings>) => void, showToast: (m: string, t?: 'success' | 'error') => void }> = ({ settings, onUpdate, showToast }) => {
  const [currentPass, setCurrentPass] = useState('');
  const [newPass, setNewPass] = useState('');
  const [confirmPass, setConfirmPass] = useState('');
  const [changingPass, setChangingPass] = useState(false);

  // MFA Setup State
  const [isSettingUpMfa, setIsSettingUpMfa] = useState(false);
  const [mfaQrCode, setMfaQrCode] = useState<string | null>(null);
  const [mfaVerificationCode, setMfaVerificationCode] = useState('');
  const [verifyingMfa, setVerifyingMfa] = useState(false);

  const startMfaSetup = async () => {
    try {
      const res = await fetch('/api/mfa/setup');
      const data = await res.json();
      if (data.qrCode) {
        setMfaQrCode(data.qrCode);
        setIsSettingUpMfa(true);
      } else {
        showToast('Failed to initialize MFA setup', 'error');
      }
    } catch (err) {
      showToast('Neural link failed during MFA setup', 'error');
    }
  };

  const handleVerifyAndEnableMfa = async () => {
    if (mfaVerificationCode.length !== 6) {
      showToast('Neural code must be 6 digits', 'error');
      return;
    }
    setVerifyingMfa(true);
    try {
      const res = await fetch('/api/mfa/verify-and-enable', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: mfaVerificationCode })
      });
      const data = await res.json();
      if (data.success) {
        onUpdate({ security: { ...settings.security, mfaEnabled: true, mfaType: 'authenticator' } });
        showToast('Multi-Factor Authentication Enabled');
        logActivity({ type: 'security', action: 'Enabled MFA (Authenticator)' });
        setIsSettingUpMfa(false);
        setMfaQrCode(null);
        setMfaVerificationCode('');
      } else {
        showToast(data.error || 'Invalid verification code', 'error');
      }
    } catch (err) {
      showToast('Verification failed', 'error');
    } finally {
      setVerifyingMfa(false);
    }
  };

  const handleDisableMfa = async () => {
    if (!confirm('Are you sure you want to disable MFA? This will reduce your account security.')) return;
    try {
      const res = await fetch('/api/mfa/disable', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        onUpdate({ security: { ...settings.security, mfaEnabled: false } });
        showToast('MFA Disabled', 'success');
        logActivity({ type: 'security', action: 'Disabled MFA' });
      }
    } catch (err) {
      showToast('Failed to disable MFA', 'error');
    }
  };

  const handlePassChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPass !== confirmPass) {
      showToast('Passwords do not match', 'error');
      return;
    }
    setChangingPass(true);
    try {
      await changeUserPassword(currentPass, newPass);
      showToast('Password updated successfully');
      setCurrentPass('');
      setNewPass('');
      setConfirmPass('');
      logActivity({ type: 'security', action: 'Changed account password' });
    } catch (err: any) {
      showToast(err.message || 'Failed to update password', 'error');
    }
    setChangingPass(false);
  };

  return (
    <div className="space-y-16">
      <header className="space-y-4">
        <h2 className="text-4xl font-black text-white uppercase tracking-tighter">Security & Authentication</h2>
        <p className="text-slate-400 text-lg font-medium">Harden your defensive perimeter and manage access nodes.</p>
      </header>

      {/* Password Change */}
      <section className="space-y-8">
        <div className="flex items-center gap-4">
          <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center">
            <ICONS.Lock className="w-4 h-4 text-indigo-400" />
          </div>
          <h3 className="text-xl font-black text-white uppercase tracking-tight">Change Password</h3>
        </div>

        <form onSubmit={handlePassChange} className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-4">Current Password</label>
            <input 
              type="password" 
              value={currentPass}
              onChange={e => setCurrentPass(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 rounded-2xl px-6 py-4 text-white font-medium focus:border-indigo-500 outline-none transition-all"
              placeholder="••••••••"
            />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-4">New Password</label>
            <input 
              type="password" 
              value={newPass}
              onChange={e => setNewPass(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 rounded-2xl px-6 py-4 text-white font-medium focus:border-indigo-500 outline-none transition-all"
              placeholder="••••••••"
            />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-4">Confirm New Password</label>
            <input 
              type="password" 
              value={confirmPass}
              onChange={e => setConfirmPass(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 rounded-2xl px-6 py-4 text-white font-medium focus:border-indigo-500 outline-none transition-all"
              placeholder="••••••••"
            />
          </div>
          <div className="md:col-span-3 flex justify-end">
            <button 
              type="submit"
              disabled={changingPass}
              className="px-12 py-4 bg-indigo-600 text-white text-[10px] font-black uppercase tracking-widest rounded-2xl hover:bg-indigo-500 transition-all disabled:opacity-50"
            >
              {changingPass ? 'Updating...' : 'Update Password'}
            </button>
          </div>
        </form>
      </section>

      {/* MFA */}
      <section className="p-8 bg-slate-900/50 border border-slate-800 rounded-[2.5rem] space-y-8">
        <div className="flex items-center justify-between gap-8">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <h3 className="text-xl font-black text-white uppercase tracking-tight">Multi-Factor Authentication</h3>
              {settings.security.mfaEnabled && (
                <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-400 text-[8px] font-black uppercase rounded-md border border-emerald-500/20">Active</span>
              )}
            </div>
            <p className="text-slate-400 text-sm font-medium">Add an extra layer of security using an authenticator app (Google Authenticator, Authy, etc.).</p>
          </div>
          
          {!isSettingUpMfa && (
            <button 
              onClick={() => settings.security.mfaEnabled ? handleDisableMfa() : startMfaSetup()}
              className={cn(
                "px-8 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap",
                settings.security.mfaEnabled 
                  ? "bg-rose-500/10 text-rose-400 border border-rose-500/20 hover:bg-rose-500/20" 
                  : "bg-indigo-600 text-white hover:bg-indigo-500"
              )}
            >
              {settings.security.mfaEnabled ? 'Disable MFA' : 'Enable MFA'}
            </button>
          )}
        </div>

        {isSettingUpMfa && mfaQrCode && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="p-8 bg-slate-900 border border-slate-800 rounded-3xl space-y-8"
          >
            <div className="flex flex-col md:flex-row gap-12 items-center">
              <div className="p-4 bg-white rounded-2xl shadow-2xl">
                <img src={mfaQrCode} alt="MFA QR Code" className="w-48 h-48" />
              </div>
              <div className="space-y-6 flex-1">
                <div className="space-y-2">
                  <h4 className="text-sm font-black text-white uppercase tracking-widest">Step 1: Scan QR Code</h4>
                  <p className="text-xs text-slate-400 leading-relaxed font-medium">Open your authenticator app (like Google Authenticator or Authy) and scan this QR code to add your Spiked AI account.</p>
                </div>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <h4 className="text-sm font-black text-white uppercase tracking-widest">Step 2: Verify Access</h4>
                    <input 
                      type="text"
                      maxLength={6}
                      value={mfaVerificationCode}
                      onChange={e => setMfaVerificationCode(e.target.value.replace(/\D/g, ''))}
                      placeholder="000000"
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl px-6 py-4 text-white font-black text-2xl tracking-[0.5em] text-center focus:border-indigo-500 outline-none transition-all"
                    />
                  </div>
                  <div className="flex gap-4">
                    <button 
                      onClick={handleVerifyAndEnableMfa}
                      disabled={verifyingMfa || mfaVerificationCode.length !== 6}
                      className="flex-1 py-4 bg-indigo-600 text-white text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-indigo-500 transition-all disabled:opacity-50"
                    >
                      {verifyingMfa ? 'Verifying...' : 'Verify & Enable'}
                    </button>
                    <button 
                      onClick={() => { setIsSettingUpMfa(false); setMfaQrCode(null); }}
                      className="px-6 py-4 bg-slate-800 text-slate-400 text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-slate-700 transition-all"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </section>

      {/* Active Sessions */}
      <ActiveSessions />
    </div>
  );
};

const PinTab: React.FC<{ settings: UserSettings, onUpdate: (s: Partial<UserSettings>) => void, showToast: (m: string, t?: 'success' | 'error') => void }> = ({ settings, onUpdate, showToast }) => {
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [recoveryQuestion, setRecoveryQuestion] = useState(settings.pin.recoveryQuestion || '');
  const [recoveryAnswer, setRecoveryAnswer] = useState('');

  const questions = [
    "What was the name of your first pet?",
    "In what city were you born?",
    "What is your mother's maiden name?",
    "What was your first car?",
    "What is your favorite book?"
  ];

  const handleSavePin = (e: React.FormEvent) => {
    e.preventDefault();
    if (pin.length < 4 || pin.length > 6) {
      showToast('PIN must be 4-6 digits', 'error');
      return;
    }
    if (pin !== confirmPin) {
      showToast('PINs do not match', 'error');
      return;
    }
    if (!recoveryQuestion || !recoveryAnswer) {
      showToast('Recovery question and answer required', 'error');
      return;
    }

    // In a real app, we would hash the pin and answer here
    onUpdate({ 
      pin: { 
        ...settings.pin, 
        hashedPin: pin, // Mock hashing
        recoveryQuestion,
        recoveryAnswerHash: recoveryAnswer // Mock hashing
      } 
    });
    showToast('Neural PIN system initialized');
    logActivity({ type: 'security', action: 'Updated Neural PIN settings' });
  };

  return (
    <div className="space-y-12">
      <header className="space-y-4">
        <h2 className="text-4xl font-black text-white uppercase tracking-tighter">PIN Management System</h2>
        <p className="text-slate-400 text-lg font-medium">Secure sensitive operations with a secondary neural PIN.</p>
      </header>

      <form onSubmit={handleSavePin} className="space-y-12">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-4">New PIN (4-6 digits)</label>
            <input 
              type="password" 
              maxLength={6}
              value={pin}
              onChange={e => setPin(e.target.value.replace(/\D/g, ''))}
              className="w-full bg-slate-900 border border-slate-800 rounded-2xl px-6 py-4 text-white font-black text-2xl tracking-[1em] text-center focus:border-indigo-500 outline-none transition-all"
              placeholder="••••"
            />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-4">Confirm PIN</label>
            <input 
              type="password" 
              maxLength={6}
              value={confirmPin}
              onChange={e => setConfirmPin(e.target.value.replace(/\D/g, ''))}
              className="w-full bg-slate-900 border border-slate-800 rounded-2xl px-6 py-4 text-white font-black text-2xl tracking-[1em] text-center focus:border-indigo-500 outline-none transition-all"
              placeholder="••••"
            />
          </div>
        </div>

        <div className="space-y-8 p-8 bg-slate-900/50 border border-slate-800 rounded-[2.5rem]">
          <div className="flex items-center gap-4">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center">
              <ICONS.Shield className="w-4 h-4 text-indigo-400" />
            </div>
            <h3 className="text-xl font-black text-white uppercase tracking-tight">Recovery Protocol</h3>
          </div>

          <div className="space-y-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-4">Security Question</label>
              <select 
                value={recoveryQuestion}
                onChange={e => setRecoveryQuestion(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-2xl px-6 py-4 text-white font-medium focus:border-indigo-500 outline-none transition-all appearance-none"
              >
                <option value="">Select a question</option>
                {questions.map((q, i) => <option key={`${q}-${i}`} value={q}>{q}</option>)}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-4">Answer</label>
              <input 
                type="text" 
                value={recoveryAnswer}
                onChange={e => setRecoveryAnswer(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-2xl px-6 py-4 text-white font-medium focus:border-indigo-500 outline-none transition-all"
                placeholder="Enter your secret answer"
              />
            </div>
          </div>
        </div>

        <div className="flex justify-end">
          <button 
            type="submit"
            className="px-12 py-4 bg-indigo-600 text-white text-[10px] font-black uppercase tracking-widest rounded-2xl hover:bg-indigo-500 transition-all shadow-xl shadow-indigo-600/20"
          >
            Initialize PIN Protocol
          </button>
        </div>
      </form>
    </div>
  );
};

const DataPrivacyTab: React.FC<{ 
  settings: UserSettings, 
  onUpdate: (s: Partial<UserSettings>) => void, 
  showToast: (m: string, t?: 'success' | 'error') => void,
  onOpenTerms: () => void,
  onOpenPrivacy: () => void,
  hasConsented?: boolean,
  onConsentUpdate: (checked: boolean) => void
}> = ({ settings, onUpdate, showToast, onOpenTerms, onOpenPrivacy, hasConsented, onConsentUpdate }) => {
  const [docs, setDocs] = useState<StoredDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    const loadDocs = async () => {
      const data = await fetchDocumentsFromFirebase();
      setDocs(data);
      setLoading(false);
    };
    loadDocs();
  }, []);

  const handleDeleteDoc = async (id: string) => {
    const success = await deleteDocumentFromFirebase(id);
    if (success) {
      setDocs(prev => prev.filter(d => d.id !== id));
      showToast('Intelligence node purged');
      logActivity({ type: 'upload', action: 'Deleted document' });
    }
  };

  const handleExportData = () => {
    const data = JSON.stringify(settings, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `spiked_neural_data_${Date.now()}.json`;
    a.click();
    showToast('Neural data exported');
    logActivity({ type: 'security', action: 'Exported user data' });
  };

  const handleDeleteAccount = async () => {
    try {
      await deleteUserAccount();
      window.location.reload();
    } catch (err: any) {
      showToast(err.message || 'Failed to delete account', 'error');
    }
  };

  return (
    <div className="space-y-16">
      <header className="space-y-4">
        <h2 className="text-4xl font-black text-white uppercase tracking-tighter">Data & Privacy Controls</h2>
        <p className="text-slate-400 text-lg font-medium">Manage your intelligence repository and sovereignty parameters.</p>
      </header>

      {/* Storage Usage */}
      <section className="p-8 bg-slate-900/50 border border-slate-800 rounded-[2.5rem] space-y-6">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <h3 className="text-xl font-black text-white uppercase tracking-tight">Neural Storage Usage</h3>
            <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest">Cognitive Compute Quota</p>
          </div>
          <p className="text-xl font-black text-indigo-400">42.5 MB / 500 MB</p>
        </div>
        <div className="h-3 bg-slate-800 rounded-full overflow-hidden">
          <motion.div 
            initial={{ width: 0 }}
            animate={{ width: '8.5%' }}
            className="h-full bg-indigo-600 shadow-[0_0_15px_rgba(79,70,229,0.5)]"
          />
        </div>
      </section>

      {/* Documents List */}
      <section className="space-y-8">
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-black text-white uppercase tracking-tight">Intelligence Nodes</h3>
          <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{docs.length} Nodes Stored</span>
        </div>

        <div className="space-y-4">
          {loading ? (
            <div className="py-12 flex justify-center">
              <div className="w-8 h-8 border-2 border-slate-800 border-t-indigo-600 rounded-full animate-spin" />
            </div>
          ) : docs.length > 0 ? (
            docs.slice(0, 5).map(doc => (
              <div key={doc.id} className="flex items-center justify-between p-6 bg-slate-900 border border-slate-800 rounded-2xl group">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center">
                    <ICONS.Document className="w-5 h-5 text-slate-500" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-white">{doc.name}</p>
                    <p className="text-[10px] font-medium text-slate-500">{new Date(doc.timestamp).toLocaleDateString()}</p>
                  </div>
                </div>
                <button 
                  onClick={() => handleDeleteDoc(doc.id)}
                  className="p-2 opacity-0 group-hover:opacity-100 hover:bg-rose-500/10 text-slate-500 hover:text-rose-500 rounded-lg transition-all"
                >
                  <ICONS.Trash className="w-4 h-4" />
                </button>
              </div>
            ))
          ) : (
            <div className="py-12 text-center bg-slate-900/30 border border-dashed border-slate-800 rounded-2xl">
              <p className="text-slate-500 text-xs font-medium italic">No intelligence nodes found in repository.</p>
            </div>
          )}
        </div>
      </section>

      {/* Privacy Toggles */}
      <section className="space-y-6">
        <div className="p-8 bg-slate-900 border border-slate-800 rounded-[2.5rem] space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <h3 className="text-xl font-black text-white uppercase tracking-tight">Protocol Consent Status</h3>
              <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest">Neural Legal Integration</p>
            </div>
            {hasConsented ? (
              <div className="flex items-center gap-2 text-emerald-400">
                <ICONS.Shield className="w-4 h-4" />
                <span className="text-xs font-black uppercase tracking-widest">Active</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-rose-500">
                <ICONS.Alert className="w-4 h-4" />
                <span className="text-xs font-black uppercase tracking-widest">Awaiting Consent</span>
              </div>
            )}
          </div>
          
          <div className="pt-4 border-t border-slate-800 flex flex-wrap gap-4">
            <button onClick={onOpenTerms} className="text-indigo-400 text-[10px] font-black uppercase hover:underline">Full Terms of Service</button>
            <span className="text-slate-800">•</span>
            <button onClick={onOpenPrivacy} className="text-emerald-400 text-[10px] font-black uppercase hover:underline">Neural Privacy Policy</button>
          </div>

          <label className="flex items-start gap-4 cursor-pointer mt-4">
            <div className="relative flex items-center mt-1">
              <input 
                type="checkbox"
                checked={!!hasConsented}
                onChange={(e) => onConsentUpdate(e.target.checked)}
                className="peer h-5 w-5 opacity-0 absolute cursor-pointer"
              />
              <div className="h-5 w-5 rounded-md border border-slate-700 peer-checked:bg-indigo-600 peer-checked:border-indigo-600 transition-all flex items-center justify-center">
                <ICONS.Check className="w-3 h-3 text-white opacity-0 peer-checked:opacity-100 transition-opacity" />
              </div>
            </div>
            <p className="text-[10px] font-medium text-slate-400 uppercase tracking-widest">Update agreement to neural intelligence framework protocols.</p>
          </label>
        </div>
        <div className="flex items-center justify-between p-8 bg-slate-900 border border-slate-800 rounded-[2.5rem]">
          <div className="space-y-1">
            <h3 className="text-lg font-black text-white uppercase tracking-tight">Data Sharing Protocol</h3>
            <p className="text-slate-400 text-xs font-medium">Allow anonymized data to improve global neural models.</p>
          </div>
          <button 
            onClick={() => onUpdate({ privacy: { ...settings.privacy, dataSharing: !settings.privacy.dataSharing } })}
            className={cn(
              "w-14 h-8 rounded-full transition-all relative",
              settings.privacy.dataSharing ? "bg-indigo-600" : "bg-slate-700"
            )}
          >
            <motion.div 
              animate={{ x: settings.privacy.dataSharing ? 28 : 4 }}
              className="absolute top-1 w-6 h-6 bg-white rounded-full shadow-lg"
            />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <button 
            onClick={handleExportData}
            className="p-8 bg-slate-900 border border-slate-800 rounded-[2.5rem] text-left hover:border-indigo-500/50 transition-all group"
          >
            <div className="w-10 h-10 bg-indigo-500/10 rounded-xl flex items-center justify-center mb-4 group-hover:bg-indigo-600 transition-all">
              <ICONS.Download className="w-5 h-5 text-indigo-400 group-hover:text-white" />
            </div>
            <h4 className="text-lg font-black text-white uppercase tracking-tight mb-1">Export Neural Data</h4>
            <p className="text-slate-500 text-xs font-medium">Download a full JSON archive of your account data.</p>
          </button>

          <button 
            onClick={() => setShowDeleteConfirm(true)}
            className="p-8 bg-slate-900 border border-slate-800 rounded-[2.5rem] text-left hover:border-rose-500/50 transition-all group"
          >
            <div className="w-10 h-10 bg-rose-500/10 rounded-xl flex items-center justify-center mb-4 group-hover:bg-rose-600 transition-all">
              <ICONS.Trash className="w-5 h-5 text-rose-400 group-hover:text-white" />
            </div>
            <h4 className="text-lg font-black text-white uppercase tracking-tight mb-1 text-rose-500">Purge Account</h4>
            <p className="text-slate-500 text-xs font-medium">Permanently delete your account and all intelligence nodes.</p>
          </button>
        </div>
      </section>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {showDeleteConfirm && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowDeleteConfirm(false)}
              className="absolute inset-0 bg-slate-950/90 backdrop-blur-md"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-md bg-slate-900 border border-rose-500/30 rounded-[3rem] p-12 text-center space-y-8 shadow-2xl"
            >
              <div className="w-20 h-20 bg-rose-500/10 rounded-[2rem] flex items-center justify-center mx-auto">
                <ICONS.Trash className="w-10 h-10 text-rose-500" />
              </div>
              <div className="space-y-2">
                <h3 className="text-2xl font-black text-white uppercase tracking-tight">Permanent Purge?</h3>
                <p className="text-slate-400 text-sm font-medium leading-relaxed">This action is irreversible. All your intelligence nodes, simulations, and neural history will be permanently deleted from our servers.</p>
              </div>
              <div className="flex flex-col gap-3">
                <button 
                  onClick={handleDeleteAccount}
                  className="w-full py-4 bg-rose-600 text-white text-[10px] font-black uppercase tracking-widest rounded-2xl hover:bg-rose-500 transition-all shadow-xl shadow-rose-600/20"
                >
                  Confirm Permanent Purge
                </button>
                <button 
                  onClick={() => setShowDeleteConfirm(false)}
                  className="w-full py-4 bg-slate-800 text-slate-300 text-[10px] font-black uppercase tracking-widest rounded-2xl hover:bg-slate-700 transition-all"
                >
                  Abort Protocol
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

const IntegrationsTab: React.FC<{ settings: UserSettings, onUpdate: (s: Partial<UserSettings>) => void, showToast: (m: string, t?: 'success' | 'error') => void }> = ({ settings, onUpdate, showToast }) => {
  return (
    <div className="space-y-16">
      <header className="space-y-4">
        <h2 className="text-4xl font-black text-white uppercase tracking-tighter">Integrations Management</h2>
        <p className="text-slate-400 text-lg font-medium">Connect your external intelligence sources and neural calendars.</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Google Drive */}
        <div className="p-8 bg-slate-900 border border-slate-800 rounded-[2.5rem] space-y-8">
          <div className="flex items-center justify-between">
            <div className="w-12 h-12 bg-slate-800 rounded-2xl flex items-center justify-center">
              <ICONS.Folder className="w-6 h-6 text-indigo-400" />
            </div>
            <span className={cn(
              "px-3 py-1 text-[8px] font-black uppercase rounded-full border",
              settings.integrations.googleDrive.connected 
                ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" 
                : "bg-slate-800 text-slate-500 border-slate-700"
            )}>
              {settings.integrations.googleDrive.connected ? 'Connected' : 'Disconnected'}
            </span>
          </div>
          <div className="space-y-2">
            <h3 className="text-xl font-black text-white uppercase tracking-tight">Google Drive</h3>
            <p className="text-slate-400 text-xs font-medium leading-relaxed">Import intelligence nodes directly from your cloud storage.</p>
          </div>
          <div className="pt-4 border-t border-slate-800 flex items-center justify-between">
            <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">
              Last Sync: {settings.integrations.googleDrive.lastSync ? new Date(settings.integrations.googleDrive.lastSync).toLocaleString() : 'Never'}
            </p>
            <button 
              onClick={() => {
                onUpdate({ integrations: { ...settings.integrations, googleDrive: { connected: !settings.integrations.googleDrive.connected, lastSync: Date.now() } } });
                showToast(settings.integrations.googleDrive.connected ? 'Drive disconnected' : 'Drive connected');
                logActivity({ type: 'integration', action: `${!settings.integrations.googleDrive.connected ? 'Connected' : 'Disconnected'} Google Drive` });
              }}
              className={cn(
                "px-6 py-3 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all",
                settings.integrations.googleDrive.connected 
                  ? "bg-slate-800 text-slate-300 hover:bg-slate-700" 
                  : "bg-indigo-600 text-white hover:bg-indigo-500"
              )}
            >
              {settings.integrations.googleDrive.connected ? 'Disconnect' : 'Connect'}
            </button>
          </div>
        </div>

        {/* Google Calendar */}
        <div className="p-8 bg-slate-900 border border-slate-800 rounded-[2.5rem] space-y-8">
          <div className="flex items-center justify-between">
            <div className="w-12 h-12 bg-slate-800 rounded-2xl flex items-center justify-center">
              <ICONS.Calendar className="w-6 h-6 text-indigo-400" />
            </div>
            <span className={cn(
              "px-3 py-1 text-[8px] font-black uppercase rounded-full border",
              settings.integrations.googleCalendar.connected 
                ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" 
                : "bg-slate-800 text-slate-500 border-slate-700"
            )}>
              {settings.integrations.googleCalendar.connected ? 'Connected' : 'Disconnected'}
            </span>
          </div>
          <div className="space-y-2">
            <h3 className="text-xl font-black text-white uppercase tracking-tight">Google Calendar</h3>
            <p className="text-slate-400 text-xs font-medium leading-relaxed">Sync strategy sessions and meeting contexts automatically.</p>
          </div>
          <div className="pt-4 border-t border-slate-800 flex items-center justify-between">
            <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">
              Last Sync: {settings.integrations.googleCalendar.lastSync ? new Date(settings.integrations.googleCalendar.lastSync).toLocaleString() : 'Never'}
            </p>
            <button 
              onClick={() => {
                onUpdate({ integrations: { ...settings.integrations, googleCalendar: { connected: !settings.integrations.googleCalendar.connected, lastSync: Date.now() } } });
                showToast(settings.integrations.googleCalendar.connected ? 'Calendar disconnected' : 'Calendar connected');
                logActivity({ type: 'integration', action: `${!settings.integrations.googleCalendar.connected ? 'Connected' : 'Disconnected'} Google Calendar` });
              }}
              className={cn(
                "px-6 py-3 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all",
                settings.integrations.googleCalendar.connected 
                  ? "bg-slate-800 text-slate-300 hover:bg-slate-700" 
                  : "bg-indigo-600 text-white hover:bg-indigo-500"
              )}
            >
              {settings.integrations.googleCalendar.connected ? 'Disconnect' : 'Connect'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const NotificationsTab: React.FC<{ settings: UserSettings, onUpdate: (s: Partial<UserSettings>) => void, showToast: (m: string, t?: 'success' | 'error') => void }> = ({ settings, onUpdate, showToast }) => {
  const handleToggle = (key: keyof UserPreferences['notifications']) => {
    onUpdate({ 
      preferences: { 
        ...settings.preferences, 
        notifications: { 
          ...settings.preferences.notifications, 
          [key]: !settings.preferences.notifications[key] 
        } 
      } 
    });
    showToast('Notification preferences updated');
  };

  const notificationItems = [
    { id: 'email', label: 'Email Notifications', desc: 'Receive strategic updates via your registered email.', icon: ICONS.Mail },
    { id: 'inApp', label: 'In-App Notifications', desc: 'Real-time alerts within the SPIKED AI console.', icon: ICONS.Bell },
    { id: 'onSimulationComplete', label: 'Simulation Completed', desc: 'Get notified when a neural simulation report is ready.', icon: ICONS.Efficiency },
    { id: 'onNewRecommendations', label: 'New Recommendations', desc: 'Alerts for AI-generated strategic insights.', icon: ICONS.Brain },
    { id: 'onErrors', label: 'System Errors & Failures', desc: 'Critical alerts regarding ingestion or synthesis failures.', icon: ICONS.Alert },
  ];

  return (
    <div className="space-y-12">
      <header className="space-y-4">
        <h2 className="text-4xl font-black text-white uppercase tracking-tighter">Notification Settings</h2>
        <p className="text-slate-400 text-lg font-medium">Configure how you receive neural alerts and strategic updates.</p>
      </header>

      <div className="space-y-4">
        {notificationItems.map(item => (
          <div key={item.id} className="flex items-center justify-between p-8 bg-slate-900 border border-slate-800 rounded-[2.5rem] group hover:border-indigo-500/30 transition-all">
            <div className="flex items-center gap-6">
              <div className="w-12 h-12 bg-slate-800 rounded-2xl flex items-center justify-center group-hover:bg-indigo-600 transition-all">
                <item.icon className="w-6 h-6 text-slate-500 group-hover:text-white" />
              </div>
              <div className="space-y-1">
                <h3 className="text-lg font-black text-white uppercase tracking-tight">{item.label}</h3>
                <p className="text-slate-500 text-xs font-medium">{item.desc}</p>
              </div>
            </div>
            <button 
              onClick={() => handleToggle(item.id as keyof UserPreferences['notifications'])}
              className={cn(
                "w-14 h-8 rounded-full transition-all relative",
                settings.preferences.notifications[item.id as keyof UserPreferences['notifications']] ? "bg-indigo-600" : "bg-slate-700"
              )}
            >
              <motion.div 
                animate={{ x: settings.preferences.notifications[item.id as keyof UserPreferences['notifications']] ? 28 : 4 }}
                className="absolute top-1 w-6 h-6 bg-white rounded-full shadow-lg"
              />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

const ActivityTab: React.FC<{ showToast: (m: string, t?: 'success' | 'error') => void }> = ({ showToast }) => {
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadLogs = async () => {
      const data = await fetchActivityLogs(50);
      setLogs(data);
      setLoading(false);
    };
    loadLogs();
  }, []);

  const getIcon = (type: ActivityLog['type']) => {
    switch (type) {
      case 'simulation': return ICONS.Efficiency;
      case 'upload': return ICONS.Document;
      case 'login': return ICONS.User;
      case 'security': return ICONS.Lock;
      case 'integration': return ICONS.Efficiency;
      default: return ICONS.History;
    }
  };

  return (
    <div className="space-y-12">
      <header className="space-y-4">
        <h2 className="text-4xl font-black text-white uppercase tracking-tighter">Activity & Insights</h2>
        <p className="text-slate-400 text-lg font-medium">Review your neural history and operational metrics.</p>
      </header>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[
          { label: 'Simulations Run', value: '124', icon: ICONS.Efficiency, color: 'text-indigo-400' },
          { label: 'Nodes Uploaded', value: '86', icon: ICONS.Document, color: 'text-emerald-400' },
          { label: 'Time Spent', value: '42h', icon: ICONS.History, color: 'text-amber-400' },
        ].map(stat => (
          <div key={stat.label} className="p-8 bg-slate-900 border border-slate-800 rounded-[2.5rem] space-y-4">
            <div className="w-10 h-10 bg-slate-800 rounded-xl flex items-center justify-center">
              <stat.icon className={cn("w-5 h-5", stat.color)} />
            </div>
            <div className="space-y-1">
              <p className="text-3xl font-black text-white tracking-tight">{stat.value}</p>
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{stat.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Logs List */}
      <div className="space-y-6">
        <h3 className="text-xl font-black text-white uppercase tracking-tight">Neural Activity Log</h3>
        <div className="space-y-4">
          {loading ? (
            <div className="py-12 flex justify-center">
              <div className="w-8 h-8 border-2 border-slate-800 border-t-indigo-600 rounded-full animate-spin" />
            </div>
          ) : logs.length > 0 ? (
            logs.map(log => {
              const Icon = getIcon(log.type);
              return (
                <div key={log.id} className="flex items-center gap-6 p-6 bg-slate-900 border border-slate-800 rounded-2xl">
                  <div className="w-10 h-10 bg-slate-800 rounded-xl flex items-center justify-center shrink-0">
                    <Icon className="w-5 h-5 text-slate-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-white truncate">{log.action}</p>
                    <p className="text-[10px] font-medium text-slate-500">{new Date(log.timestamp).toLocaleString()}</p>
                  </div>
                  <div className="px-3 py-1 bg-slate-800 text-[8px] font-black text-slate-400 uppercase rounded-md border border-slate-700">
                    {log.type}
                  </div>
                </div>
              );
            })
          ) : (
            <div className="py-12 text-center bg-slate-900/30 border border-dashed border-slate-800 rounded-2xl">
              <p className="text-slate-500 text-xs font-medium italic">No activity logs recorded.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const AdvancedTab: React.FC<{ settings: UserSettings, onUpdate: (s: Partial<UserSettings>) => void, showToast: (m: string, t?: 'success' | 'error') => void }> = ({ settings, onUpdate, showToast }) => {
  return (
    <div className="space-y-16">
      <header className="space-y-4">
        <h2 className="text-4xl font-black text-white uppercase tracking-tighter">Advanced Features</h2>
        <p className="text-slate-400 text-lg font-medium">Calibrate experimental protocols and workspace defaults.</p>
      </header>

      <div className="space-y-12">
        {/* Workspace Selection */}
        <section className="space-y-8">
          <div className="flex items-center gap-4">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center">
              <ICONS.Efficiency className="w-4 h-4 text-indigo-400" />
            </div>
            <h3 className="text-xl font-black text-white uppercase tracking-tight">Default Workspace</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { id: 'simulation', label: 'Simulation Lab', desc: 'High-stakes avatar roleplay.' },
              { id: 'grooming', label: 'Grooming Lab', desc: 'Vocal and behavioral calibration.' },
              { id: 'testing', label: 'Testing / Handsfree', desc: 'Automated strategic verification.' },
            ].map(workspace => (
              <button
                key={workspace.id}
                onClick={() => {
                  onUpdate({ preferences: { ...settings.preferences, defaultWorkspace: workspace.id as any } });
                  showToast(`Default workspace set to ${workspace.label}`);
                }}
                className={cn(
                  "p-8 bg-slate-900 border rounded-[2.5rem] text-left transition-all group",
                  settings.preferences.defaultWorkspace === workspace.id 
                    ? "border-indigo-600 shadow-xl shadow-indigo-600/10" 
                    : "border-slate-800 hover:border-slate-700"
                )}
              >
                <div className={cn(
                  "w-10 h-10 rounded-xl flex items-center justify-center mb-6 transition-all",
                  settings.preferences.defaultWorkspace === workspace.id ? "bg-indigo-600 text-white" : "bg-slate-800 text-slate-500 group-hover:bg-slate-700"
                )}>
                  <ICONS.Efficiency className="w-5 h-5" />
                </div>
                <h4 className="text-lg font-black text-white uppercase tracking-tight mb-2">{workspace.label}</h4>
                <p className="text-slate-500 text-[10px] font-medium leading-relaxed">{workspace.desc}</p>
              </button>
            ))}
          </div>
        </section>

        {/* Experimental Features */}
        <section className="p-8 bg-slate-900/50 border border-slate-800 rounded-[2.5rem] flex items-center justify-between gap-8">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <h3 className="text-xl font-black text-white uppercase tracking-tight">Experimental Protocols</h3>
              <span className="px-2 py-0.5 bg-amber-500/10 text-amber-400 text-[8px] font-black uppercase rounded-md border border-amber-500/20">BETA</span>
            </div>
            <p className="text-slate-400 text-sm font-medium">Enable early-access features and neural prototypes. May be unstable.</p>
          </div>
          <button 
            onClick={() => onUpdate({ preferences: { ...settings.preferences, experimentalFeatures: !settings.preferences.experimentalFeatures } })}
            className={cn(
              "w-14 h-8 rounded-full transition-all relative",
              settings.preferences.experimentalFeatures ? "bg-amber-500" : "bg-slate-700"
            )}
          >
            <motion.div 
              animate={{ x: settings.preferences.experimentalFeatures ? 28 : 4 }}
              className="absolute top-1 w-6 h-6 bg-white rounded-full shadow-lg"
            />
          </button>
        </section>
      </div>
    </div>
  );
};

interface LegalTabProps {
  settings: UserSettings;
  onUpdate: (s: Partial<UserSettings>) => void;
  showToast: (m: string, t?: 'success' | 'error') => void;
  onOpenTerms: () => void;
  onOpenPrivacy: () => void;
  hasConsented?: boolean;
  onConsentUpdate: (checked: boolean) => void;
}

const LegalTab: React.FC<LegalTabProps> = ({ 
  settings, 
  onUpdate, 
  showToast, 
  onOpenTerms, 
  onOpenPrivacy,
  hasConsented,
  onConsentUpdate
}) => {
  return (
    <div className="space-y-16">
      <header className="space-y-4">
        <h2 className="text-4xl font-black text-white uppercase tracking-tighter">Legal & Consent</h2>
        <p className="text-slate-400 text-lg font-medium">Review operational agreements and neural privacy policies.</p>
      </header>

      <div className="space-y-12">
        <div className="p-8 bg-slate-900 border border-slate-800 rounded-[2.5rem] space-y-10">
          <div className="space-y-6">
            <h3 className="text-2xl font-black text-white uppercase tracking-tight">Neural Intelligence Framework</h3>
            <p className="text-slate-400 text-base leading-relaxed">
              By utilizing the SPIKED AI protocol, you acknowledge that all intelligence synthesis is grounded in your proprietary data. We maintain a zero-trust architecture to ensure your data sovereignty and privacy.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <button 
              onClick={onOpenTerms}
              className="p-6 bg-slate-800/40 border border-slate-700/50 rounded-2xl hover:border-indigo-500/50 hover:bg-slate-800/60 transition-all text-left group"
            >
              <ICONS.Document className="w-6 h-6 text-indigo-400 mb-4 group-hover:scale-110 transition-transform" />
              <p className="text-sm font-bold text-white uppercase tracking-tight">Terms of Service</p>
              <p className="text-[10px] text-slate-500 mt-1 uppercase tracking-widest font-black">Neural Intelligence Protocol</p>
              <span className="inline-flex items-center gap-1.5 text-indigo-400 text-[10px] font-black uppercase mt-4">
                Read Full Context <ICONS.ArrowRight className="w-3 h-3" />
              </span>
            </button>

            <button 
              onClick={onOpenPrivacy}
              className="p-6 bg-slate-800/40 border border-slate-700/50 rounded-2xl hover:border-emerald-500/50 hover:bg-slate-800/60 transition-all text-left group"
            >
              <ICONS.Shield className="w-6 h-6 text-emerald-400 mb-4 group-hover:scale-110 transition-transform" />
              <p className="text-sm font-bold text-white uppercase tracking-tight">Privacy Policy</p>
              <p className="text-[10px] text-slate-500 mt-1 uppercase tracking-widest font-black">Neural Shield Directive</p>
              <span className="inline-flex items-center gap-1.5 text-emerald-400 text-[10px] font-black uppercase mt-4">
                View Protection Protocols <ICONS.ArrowRight className="w-3 h-3" />
              </span>
            </button>
          </div>

          <div className="pt-10 border-t border-slate-800 space-y-8">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 p-6 bg-slate-950/50 rounded-2xl border border-slate-800/50">
              <div className="flex items-start gap-4 cursor-pointer group flex-1">
                <div className="relative flex items-center mt-1">
                  <input 
                    type="checkbox"
                    checked={!!hasConsented}
                    onChange={(e) => onConsentUpdate(e.target.checked)}
                    className="peer h-5 w-5 opacity-0 absolute cursor-pointer"
                  />
                  <div className="h-6 w-6 rounded-lg border-2 border-slate-700 peer-checked:bg-indigo-600 peer-checked:border-indigo-600 transition-all flex items-center justify-center">
                    <ICONS.Check className="w-4 h-4 text-white opacity-0 peer-checked:opacity-100 transition-opacity" />
                  </div>
                </div>
                <div>
                  <p className="text-sm font-bold text-white uppercase tracking-tight">Acknowledge Legal Framework</p>
                  <p className="text-[10px] text-slate-500 mt-1 uppercase tracking-widest font-black">Mandatory for Protocol Access</p>
                </div>
              </div>

              <div className="text-right">
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Last Protocol Update</p>
                <p className="text-xs font-bold text-indigo-400">April 17, 2026</p>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                System Consent Timestamp: {settings.privacy.consentTimestamp ? new Date(settings.privacy.consentTimestamp).toLocaleString() : 'Not Recorded'}
              </p>
              {hasConsented && (
                <div className="flex items-center gap-2 text-emerald-400">
                  <ICONS.Shield className="w-4 h-4" />
                  <span className="text-[10px] font-black uppercase tracking-widest">Neural Compliance Active</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
