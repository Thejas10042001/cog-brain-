import React from 'react';
import { motion } from 'motion/react';
import { ICONS } from '../../constants';

export const SecurityAudit: React.FC = () => {
  return (
    <div className="max-w-4xl mx-auto py-12 px-6 space-y-12 text-slate-300">
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-4xl font-black text-white uppercase tracking-tighter">Security Infrastructure Report</h1>
          <div className="bg-emerald-500/10 border border-emerald-500/30 px-4 py-1 rounded-full flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">Status: Hardened</span>
          </div>
        </div>
        <p className="text-slate-400 font-medium italic">Audit Cycle: Q1 2026 | Certified by NeuralSec Labs</p>
        <div className="h-1 w-24 bg-indigo-600 rounded-full" />
      </section>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <AuditStat label="Encryption" value="AES-256-GCM" sub="At Rest & Transit" />
        <AuditStat label="Auth Protocol" value="OAuth 2.0" sub="Multi-Factor Ready" />
        <AuditStat label="Data Residency" value="Isolated" sub="Per-Tenant Buckets" />
      </div>

      <section className="space-y-8">
        <h2 className="text-xl font-bold text-white uppercase tracking-widest flex items-center gap-3">
          <ICONS.Shield className="w-5 h-5 text-indigo-500" />
          Core Security Pillars
        </h2>
        
        <div className="space-y-6">
          <SecurityPillar 
            title="Neural Isolation"
            desc="Each simulation session runs in a sandboxed environment. Strategic context is injected into the model via ephemeral memory slots that are purged immediately upon session termination."
          />
          <SecurityPillar 
            title="SOC 2 Type II Compliance"
            desc="Our infrastructure is hosted on Google Cloud Platform (GCP), inheriting world-class physical and network security controls. We undergo quarterly penetration testing by third-party security firms."
          />
          <SecurityPillar 
            title="PII Redaction Engine"
            desc="Before documents are processed by our intelligence nodes, our proprietary scrubbing engine identifies and masks sensitive PII (Personally Identifiable Information) unless explicitly permitted by the user."
          />
        </div>
      </section>

      <section className="bg-slate-900/50 border border-slate-800 rounded-[2rem] p-8 space-y-6">
        <h3 className="text-lg font-black text-white uppercase tracking-widest">Vulnerability Disclosure</h3>
        <p className="text-sm leading-relaxed">
          We maintain an active Bug Bounty program. If you discover a security flaw in our Neural Protocol, please report it to <strong>security@spikedgpt.ai</strong>. We offer rewards for verified critical vulnerabilities.
        </p>
        <div className="flex items-center gap-4 pt-4">
          <div className="flex -space-x-2">
            {[1, 2, 3].map(i => (
              <div key={i} className="w-8 h-8 rounded-full border-2 border-slate-900 bg-slate-800 flex items-center justify-center text-[10px] font-bold text-slate-400">
                {i === 1 ? 'GCP' : i === 2 ? 'ISO' : 'SOC'}
              </div>
            ))}
          </div>
          <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">Certified Infrastructure</span>
        </div>
      </section>
    </div>
  );
};

const AuditStat = ({ label, value, sub }: { label: string, value: string, sub: string }) => (
  <div className="bg-slate-900/50 border border-slate-800 p-6 rounded-2xl space-y-1">
    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{label}</p>
    <p className="text-xl font-black text-white tracking-tight">{value}</p>
    <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest">{sub}</p>
  </div>
);

const SecurityPillar = ({ title, desc }: { title: string, desc: string }) => (
  <div className="flex gap-6">
    <div className="mt-1 w-1.5 h-1.5 rounded-full bg-indigo-500 shrink-0" />
    <div className="space-y-2">
      <h4 className="text-sm font-black text-white uppercase tracking-widest">{title}</h4>
      <p className="text-sm text-slate-400 leading-relaxed font-medium">{desc}</p>
    </div>
  </div>
);
