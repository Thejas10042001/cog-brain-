import React from 'react';
import { motion } from 'motion/react';
import { ICONS } from '../constants';

const HELP_SECTIONS = [
  {
    id: 'getting-started',
    title: 'Getting Started',
    icon: <ICONS.Efficiency className="w-5 h-5" />,
    content: [
      {
        subtitle: 'Neural Nexus Setup',
        text: 'The first step in any strategic engagement is configuring your context. Navigate to "Settings" to define the seller and client landscape. Upload relevant documents (PDFs, text files) to ground the AI in your specific deal reality.'
      },
      {
        subtitle: 'Strategic Ingestion',
        text: 'Once documents are uploaded, click "Synthesize Neural Core". This process parses your documentary intelligence to establish a high-fidelity knowledge base for all subsequent simulations.'
      }
    ]
  },
  {
    id: 'strategy-lab',
    title: 'Strategy Lab',
    icon: <ICONS.Brain className="w-5 h-5" />,
    content: [
      {
        subtitle: 'Synthesis & Refinement',
        text: 'The Strategy Lab generates high-impact enterprise sales strategies. Review the Executive Summary, Strategic Pillars, and Competitive Wedge. Use the "Neural Refinement" input to iterate on the strategy based on specific stakeholder needs.'
      },
      {
        subtitle: 'Objection Defense',
        text: 'Identify potential friction points and leverage pre-calculated strategic counters to neutralize buyer resistance before it manifests.'
      }
    ]
  },
  {
    id: 'simulations',
    title: 'Simulations & Avatars',
    icon: <ICONS.Sparkles className="w-5 h-5" />,
    content: [
      {
        subtitle: 'Stage Simulation',
        text: 'Master specific phases of the sales cycle (Ice Breakers, Pricing, Legal). Each stage presents unique challenges and requires tailored tactical responses.'
      },
      {
        subtitle: 'Avatar 1.0 & 2.0',
        text: 'Engage in real-time dialogue with AI-driven buyer personas. Avatar 1.0 focuses on a skeptical CIO, while 2.0 allows you to test your strategy against a full buying committee (CFO, IT Director, etc.).'
      }
    ]
  },
  {
    id: 'intelligence-tools',
    title: 'Intelligence Tools',
    icon: <ICONS.SpikedGPT className="w-5 h-5" />,
    content: [
      {
        subtitle: 'Spiked GPT',
        text: 'A grounded answering engine for any deal-related question. Query the cognitive core to extract winning strategies and precise data points from your uploaded context.'
      },
      {
        subtitle: 'Grooming Lab',
        text: 'Practice your delivery and receive an elite audit on tone, grammar, and pacing. Ensure your vocal presence matches the strength of your strategy.'
      },
      {
        subtitle: 'Studio',
        text: 'Generate professional-grade audio samples of your winning pitches to establish a baseline for elite delivery.'
      }
    ]
  }
];

export const HelpCenter: React.FC = () => {
  return (
    <div className="px-4 md:px-8 py-12 space-y-12 w-full max-w-7xl mx-auto">
      <div className="space-y-4 mb-12">
        <h1 className="text-5xl font-black text-white tracking-tighter uppercase">Documentation <span className="text-indigo-500">&</span> Help</h1>
        <p className="text-slate-400 font-medium max-w-2xl">
          Master the SPIKED AI Neural Sales Intelligence Protocol. This guide provides the operational framework for each node in the system.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {HELP_SECTIONS.map((section, idx) => (
          <motion.div
            key={section.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.1 }}
            className="glass-dark rounded-[2rem] p-8 border border-slate-800/50 hover:border-indigo-500/30 transition-all group"
          >
            <div className="flex items-center gap-4 mb-8">
              <div className="w-12 h-12 bg-slate-800 rounded-2xl flex items-center justify-center text-indigo-400 group-hover:scale-110 transition-transform">
                {section.icon}
              </div>
              <h2 className="text-2xl font-black text-white tracking-tight uppercase">{section.title}</h2>
            </div>

            <div className="space-y-8">
              {section.content.map((item, i) => (
                <div key={i} className="space-y-2">
                  <h3 className="text-indigo-400 text-[10px] font-black uppercase tracking-widest">{item.subtitle}</h3>
                  <p className="text-slate-400 text-sm leading-relaxed font-medium">
                    {item.text}
                  </p>
                </div>
              ))}
            </div>
          </motion.div>
        ))}
      </div>

      <div className="mt-16 p-8 rounded-[2rem] bg-indigo-600/10 border border-indigo-500/20 flex flex-col md:flex-row items-center justify-between gap-8">
        <div className="space-y-2">
          <h3 className="text-xl font-black text-white tracking-tight uppercase">Need further assistance?</h3>
          <p className="text-slate-400 text-sm font-medium">Our neural support nodes are standing by to assist with complex strategic configurations.</p>
        </div>
        <button 
          onClick={() => window.open(window.location.origin + '?page=support', '_blank')}
          className="px-8 py-4 bg-indigo-600 text-white text-[10px] font-black uppercase tracking-widest rounded-2xl hover:bg-indigo-500 transition-all shadow-xl shadow-indigo-600/20 active:scale-95"
        >
          Contact Support
        </button>
      </div>
    </div>
  );
};
