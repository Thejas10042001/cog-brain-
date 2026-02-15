
import React, { useState } from 'react';
import { MeetingContext, CustomerPersonaType, StoredDocument } from '../types';
import { ICONS } from '../constants';

interface MeetingContextConfigProps {
  context: MeetingContext;
  onContextChange: (context: MeetingContext) => void;
  documents?: StoredDocument[];
}

export const MeetingContextConfig: React.FC<MeetingContextConfigProps> = ({ context, onContextChange, documents = [] }) => {
  const handleChange = (field: keyof MeetingContext, value: any) => {
    onContextChange({ ...context, [field]: value });
  };

  return (
    <div className="space-y-10">
      <section className="bg-white p-10 rounded-[3rem] shadow-2xl shadow-slate-200/50 border border-slate-100">
        <div className="flex items-center gap-3 mb-10">
          <div className="p-2 bg-red-600 text-white rounded-xl"><ICONS.Shield /></div>
          <h3 className="text-xl font-bold">Deal Grounding Settings</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
          <div className="space-y-6">
            <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em] ml-2">Entity Data</h4>
            <div className="grid grid-cols-1 gap-5">
              <PremiumInput label="Seller Organization" value={context.sellerCompany} onChange={v => handleChange('sellerCompany', v)} placeholder="e.g. Your Company" />
              <PremiumInput label="Prospect Organization" value={context.clientCompany} onChange={v => handleChange('clientCompany', v)} placeholder="e.g. Client Ltd." />
            </div>
          </div>
          <div className="space-y-6">
            <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em] ml-2">Simulation Targets</h4>
            <div className="grid grid-cols-1 gap-5">
              <PremiumInput label="Target Product" value={context.targetProducts} onChange={v => handleChange('targetProducts', v)} placeholder="e.g. Enterprise SaaS" />
              <PremiumInput label="Meeting Objective" value={context.meetingFocus} onChange={v => handleChange('meetingFocus', v)} placeholder="e.g. Discovery Meeting" />
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em] ml-2">Executive Summary Overview</h4>
          <textarea 
            value={context.executiveSnapshot}
            onChange={(e) => handleChange('executiveSnapshot', e.target.value)}
            className="w-full p-8 bg-slate-50 border border-slate-100 rounded-[2rem] text-sm focus:ring-4 focus:ring-red-500/10 focus:border-red-600 outline-none transition-all h-32 resize-none leading-relaxed font-medium"
            placeholder="Provide a high-level briefing of the deal current status..."
          />
        </div>
      </section>

      <section className="bg-white p-10 rounded-[3rem] shadow-2xl shadow-slate-200/50 border border-slate-100">
        <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em] ml-2 mb-8">Target Buyer Persona</h4>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <PersonaCard active={context.persona === 'Balanced'} onClick={() => handleChange('persona', 'Balanced')} label="Balanced" icon={<ICONS.Document />} />
          <PersonaCard active={context.persona === 'Technical'} onClick={() => handleChange('persona', 'Technical')} label="Technical" icon={<ICONS.Brain />} />
          <PersonaCard active={context.persona === 'Financial'} onClick={() => handleChange('persona', 'Financial')} label="Financial" icon={<ICONS.ROI />} />
          <PersonaCard active={context.persona === 'Business Executives'} onClick={() => handleChange('persona', 'Business Executives')} label="Executive" icon={<ICONS.Trophy />} />
        </div>
      </section>
    </div>
  );
};

const PremiumInput = ({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder: string }) => (
  <div className="space-y-2">
    <label className="text-[9px] font-black uppercase text-slate-500 tracking-widest ml-4">{label}</label>
    <input 
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm focus:ring-4 focus:ring-red-500/10 focus:border-red-600 outline-none transition-all font-bold text-slate-900"
    />
  </div>
);

const PersonaCard = ({ active, onClick, label, icon }: { active: boolean; onClick: () => void; label: string; icon: React.ReactNode }) => (
  <button 
    onClick={onClick}
    className={`p-8 rounded-[2rem] border-2 transition-all flex flex-col items-center gap-4 text-center ${active ? 'bg-red-600 border-red-600 text-white shadow-xl shadow-red-200' : 'bg-slate-50 border-slate-100 hover:border-red-200 text-slate-400'}`}
  >
    <div className={`p-4 rounded-xl ${active ? 'bg-white/20' : 'bg-white shadow-sm'}`}>{icon}</div>
    <span className="text-[10px] font-black uppercase tracking-widest">{label}</span>
  </button>
);
