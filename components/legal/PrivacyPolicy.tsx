import React from 'react';
import { motion } from 'motion/react';
import { ICONS } from '../../constants';

export const PrivacyPolicy: React.FC = () => {
  return (
    <div className="max-w-4xl mx-auto py-12 px-6 space-y-12 text-slate-300">
      <section className="space-y-4">
        <h1 className="text-4xl font-black text-white uppercase tracking-tighter">Privacy Protocol</h1>
        <p className="text-slate-400 font-medium italic">Last Updated: March 13, 2026</p>
        <div className="h-1 w-24 bg-indigo-600 rounded-full" />
      </section>

      <section className="space-y-6">
        <h2 className="text-xl font-bold text-white uppercase tracking-widest flex items-center gap-3">
          <ICONS.Shield className="w-5 h-5 text-indigo-500" />
          Data Sovereignty
        </h2>
        <p className="leading-relaxed">
          At SpikedGPT, we operate on a principle of <strong>Zero-Knowledge Intelligence</strong>. Your strategic data, client documents, and meeting recordings are treated as sovereign assets. We do not sell, rent, or trade your data to third parties.
        </p>
      </section>

      <section className="space-y-6">
        <h2 className="text-xl font-bold text-white uppercase tracking-widest flex items-center gap-3">
          <ICONS.Brain className="w-5 h-5 text-indigo-500" />
          Neural Processing Context
        </h2>
        <p className="leading-relaxed">
          When you upload documents to the Neural Library, they are processed using isolated compute instances. We use advanced LLMs (including Gemini 1.5 Pro and Flash) to synthesize strategic insights. Your data is used <strong>exclusively</strong> to calibrate your specific simulations and is not used to train global models.
        </p>
      </section>

      <section className="space-y-6">
        <h2 className="text-xl font-bold text-white uppercase tracking-widest flex items-center gap-3">
          <ICONS.Lock className="w-5 h-5 text-indigo-500" />
          Information Collection
        </h2>
        <ul className="list-disc pl-6 space-y-3">
          <li><strong>Authentication Data:</strong> Managed via Firebase Auth (Google/Email).</li>
          <li><strong>Strategic Assets:</strong> Documents, KYC files, and meeting transcripts stored in encrypted Firestore buckets.</li>
          <li><strong>Audio Samples:</strong> Temporary voice synthesis data used for real-time simulations.</li>
        </ul>
      </section>

      <section className="space-y-6">
        <h2 className="text-xl font-bold text-white uppercase tracking-widest flex items-center gap-3">
          <ICONS.Check className="w-5 h-5 text-indigo-500" />
          Your Rights
        </h2>
        <p className="leading-relaxed">
          You maintain full control over your data. You can purge your Neural Library, delete your account, or export your strategic roadmaps at any time through the Settings interface.
        </p>
      </section>

      <footer className="pt-12 border-t border-slate-800 text-sm text-slate-500 italic">
        For privacy-related inquiries, contact our Data Protection Officer at privacy@spikedgpt.ai
      </footer>
    </div>
  );
};
