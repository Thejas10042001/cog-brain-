import React from 'react';
import { motion } from 'motion/react';
import { ICONS } from '../../constants';

export const TermsOfService: React.FC = () => {
  return (
    <div className="max-w-4xl mx-auto py-12 px-6 space-y-12 text-slate-300">
      <section className="space-y-4">
        <h1 className="text-4xl font-black text-white uppercase tracking-tighter">Terms of Engagement</h1>
        <p className="text-slate-400 font-medium italic">Effective Date: March 13, 2026</p>
        <div className="h-1 w-24 bg-indigo-600 rounded-full" />
      </section>

      <section className="space-y-6">
        <h2 className="text-xl font-bold text-white uppercase tracking-widest flex items-center gap-3">
          <ICONS.Document className="w-5 h-5 text-indigo-500" />
          1. Acceptance of Protocol
        </h2>
        <p className="leading-relaxed">
          By accessing the SpikedGPT Neural Sales Protocol, you agree to be bound by these Terms of Engagement. This is a professional-grade strategic tool designed for high-stakes sales environments.
        </p>
      </section>

      <section className="space-y-6">
        <h2 className="text-xl font-bold text-white uppercase tracking-widest flex items-center gap-3">
          <ICONS.Brain className="w-5 h-5 text-indigo-500" />
          2. Intellectual Property
        </h2>
        <p className="leading-relaxed">
          SpikedGPT owns the underlying neural architectures, UI/UX designs, and proprietary algorithms. You own all <strong>outputs</strong> generated from your specific data inputs, including Strategic Roadmaps, Objection Defense scripts, and Simulation Transcripts.
        </p>
      </section>

      <section className="space-y-6">
        <h2 className="text-xl font-bold text-white uppercase tracking-widest flex items-center gap-3">
          <ICONS.Shield className="w-5 h-5 text-indigo-500" />
          3. Responsible AI Usage
        </h2>
        <p className="leading-relaxed">
          Users are prohibited from using SpikedGPT to generate deceptive, harmful, or illegal content. The tool is designed for ethical strategic preparation and professional development.
        </p>
      </section>

      <section className="space-y-6">
        <h2 className="text-xl font-bold text-white uppercase tracking-widest flex items-center gap-3">
          <ICONS.Efficiency className="w-5 h-5 text-indigo-500" />
          4. Service Availability
        </h2>
        <p className="leading-relaxed">
          While we strive for 99.9% uptime of our Neural Nodes, we do not guarantee uninterrupted access. Maintenance windows are typically scheduled during low-traffic periods (UTC 02:00-04:00).
        </p>
      </section>

      <section className="space-y-6">
        <h2 className="text-xl font-bold text-white uppercase tracking-widest flex items-center gap-3">
          <ICONS.Lock className="w-5 h-5 text-indigo-500" />
          5. Termination
        </h2>
        <p className="leading-relaxed">
          We reserve the right to suspend accounts that violate our security protocols or engage in unauthorized scraping of our neural models.
        </p>
      </section>

      <footer className="pt-12 border-t border-slate-800 text-sm text-slate-500 italic">
        Questions regarding these terms? Contact legal@spikedgpt.ai
      </footer>
    </div>
  );
};
