import React from 'react';
import { motion } from 'motion/react';
import { ICONS } from '../constants';
import { AnimatedGuide } from './AnimatedGuide';

interface HelpItem {
  subtitle: string;
  text: string;
  points?: string[];
}

interface HelpSection {
  id: 'getting-started' | 'strategy-lab' | 'simulations' | 'intelligence-tools';
  title: string;
  icon: React.ReactNode;
  description: string;
  content: HelpItem[];
}

const HELP_SECTIONS: HelpSection[] = [
  {
    id: 'getting-started',
    title: 'Neural Nexus Setup',
    icon: <ICONS.Efficiency className="w-5 h-5" />,
    description: 'Establish the foundation of your deal intelligence through high-fidelity context ingestion.',
    content: [
      {
        subtitle: 'Step 1: Context Configuration',
        text: 'Navigate to the "Settings" node to define the operational landscape of your deal.',
        points: [
          'Define the Seller Profile: Your company, value prop, and team.',
          'Define the Client Profile: Target organization, industry, and pain points.',
          'Set Strategic Goals: What does a "Win" look like for this specific engagement?'
        ]
      },
      {
        subtitle: 'Step 2: Strategic Ingestion',
        text: 'Upload the documentary intelligence that will ground the AI in your specific reality.',
        points: [
          'Supported Formats: PDF, TXT, and DOCX files.',
          'Recommended Content: Case studies, product briefs, and previous meeting notes.',
          'Click "Synthesize Neural Core" to begin the cognitive parsing process.'
        ]
      }
    ]
  },
  {
    id: 'strategy-lab',
    title: 'Strategy Lab',
    icon: <ICONS.Brain className="w-5 h-5" />,
    description: 'Generate and refine elite enterprise sales strategies based on your neural core.',
    content: [
      {
        subtitle: 'Step 1: Strategy Synthesis',
        text: 'Review the AI-generated strategic framework designed to penetrate the target account.',
        points: [
          'Executive Summary: A high-level overview of the winning approach.',
          'Strategic Pillars: The three core themes that will drive your value.',
          'Competitive Wedge: How to specifically displace the incumbent or alternative.'
        ]
      },
      {
        subtitle: 'Step 2: Neural Refinement',
        text: 'Iterate on the strategy to ensure it perfectly matches the evolving deal dynamics.',
        points: [
          'Use the "Neural Refinement" input to provide specific feedback.',
          'Identify and neutralize buyer resistance using the Objection Defense module.',
          'Export the strategy for team alignment and stakeholder reviews.'
        ]
      }
    ]
  },
  {
    id: 'simulations',
    title: 'Simulations & Avatars',
    icon: <ICONS.Sparkles className="w-5 h-5" />,
    description: 'Test your strategy against high-fidelity AI buyer personas in real-time.',
    content: [
      {
        subtitle: 'Step 1: Stage-Specific Training',
        text: 'Master the critical phases of the enterprise sales cycle.',
        points: [
          'Ice Breakers: Build rapport and establish credibility in seconds.',
          'Pricing & Value: Defend your premium position against budget pressure.',
          'Legal & Procurement: Navigate the final hurdles of the deal.'
        ]
      },
      {
        subtitle: 'Step 2: Persona Engagement',
        text: 'Engage in dialogue with the industry\'s most sophisticated AI buyer avatars.',
        points: [
          'Avatar 1.0 (The Skeptic): Test your logic against a high-pressure CIO.',
          'Avatar 2.0 (The Committee): Manage a multi-stakeholder negotiation simulation.',
          'Receive real-time sentiment analysis and tactical feedback on your delivery.'
        ]
      }
    ]
  },
  {
    id: 'intelligence-tools',
    title: 'Intelligence Tools',
    icon: <ICONS.SpikedGPT className="w-5 h-5" />,
    description: 'Leverage the full power of the Neural Protocol to optimize every touchpoint.',
    content: [
      {
        subtitle: 'Spiked GPT: The Answering Engine',
        text: 'Query the cognitive core for instant, grounded answers to any deal-related question.',
        points: [
          'Extract specific data points from hundreds of pages of context.',
          'Generate email drafts, follow-up notes, and executive summaries.',
          'Ask for "Winning Plays" based on the current deal state.'
        ]
      },
      {
        subtitle: 'Grooming Lab & Studio',
        text: 'Ensure your vocal presence matches the strength of your strategic intelligence.',
        points: [
          'Grooming Lab: Receive an elite audit on tone, pacing, and grammar.',
          'Studio: Generate professional-grade audio samples of your winning pitches.',
          'Practice until your delivery is flawless and authoritative.'
        ]
      }
    ]
  }
];

export const HelpCenter: React.FC = () => {
  return (
    <div className="px-4 md:px-8 py-12 space-y-12 w-full max-w-7xl mx-auto">
      <div className="space-y-4 mb-12">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-red-600 text-white rounded-2xl flex items-center justify-center font-black text-2xl shadow-xl shadow-red-600/20">
            !
          </div>
          <h1 className="text-5xl font-black text-white tracking-tighter uppercase">Protocol <span className="text-red-600">Manual</span></h1>
        </div>
        <p className="text-slate-400 font-medium max-w-2xl text-lg">
          Master the SPIKED AI Neural Sales Intelligence Protocol. This guide provides the operational framework for each node in the system.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-12">
        {HELP_SECTIONS.map((section, idx) => (
          <motion.div
            key={section.id}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: idx * 0.1 }}
            className="glass-dark rounded-[3rem] p-8 md:p-12 border border-slate-800/50 hover:border-red-600/30 transition-all group overflow-hidden relative"
          >
            {/* Background Glow */}
            <div className="absolute -top-24 -right-24 w-64 h-64 bg-red-600/5 blur-[100px] rounded-full" />
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-start relative z-10">
              <div className="space-y-8">
                <div className="flex items-center gap-6">
                  <div className="w-16 h-16 bg-slate-800 rounded-3xl flex items-center justify-center text-red-600 group-hover:scale-110 transition-transform shadow-inner">
                    {section.icon}
                  </div>
                  <div>
                    <h2 className="text-3xl font-black text-white tracking-tight uppercase">{section.title}</h2>
                    <p className="text-slate-500 text-xs font-bold uppercase tracking-widest mt-1">{section.description}</p>
                  </div>
                </div>

                <div className="space-y-10">
                  {section.content.map((item, i) => (
                    <div key={i} className="space-y-4">
                      <div className="flex items-center gap-3">
                        <div className="w-1 h-4 bg-red-600 rounded-full" />
                        <h3 className="text-white text-sm font-black uppercase tracking-widest">{item.subtitle}</h3>
                      </div>
                      <p className="text-slate-400 text-sm leading-relaxed font-medium pl-4">
                        {item.text}
                      </p>
                      {item.points && (
                        <ul className="space-y-3 pl-8">
                          {item.points.map((point, pIdx) => (
                            <li key={pIdx} className="flex items-start gap-3 text-xs text-slate-500 font-bold group/point">
                              <ICONS.Check className="w-3 h-3 text-red-600 mt-0.5 shrink-0 group-hover/point:scale-125 transition-transform" />
                              <span className="group-hover/point:text-slate-300 transition-colors">{point}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-6">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em]">Neural Visualization</span>
                  <div className="flex gap-1">
                    <div className="w-1.5 h-1.5 rounded-full bg-red-600 animate-pulse" />
                    <div className="w-1.5 h-1.5 rounded-full bg-slate-700" />
                    <div className="w-1.5 h-1.5 rounded-full bg-slate-700" />
                  </div>
                </div>
                <AnimatedGuide type={section.id} />
                <div className="p-6 bg-slate-900/50 rounded-2xl border border-slate-800">
                  <h4 className="text-[10px] font-black text-red-600 uppercase tracking-widest mb-3">Pro Tip: Elite Performance</h4>
                  <p className="text-[11px] text-slate-400 font-bold leading-relaxed italic">
                    "The Neural Protocol is most effective when grounded in high-fidelity context. Always ensure your documents are current and your client profiles are detailed before initiating a simulation."
                  </p>
                </div>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="mt-24 p-12 rounded-[3rem] bg-gradient-to-br from-red-600/10 to-transparent border border-red-600/20 flex flex-col md:flex-row items-center justify-between gap-12 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-red-600/50 to-transparent" />
        <div className="space-y-4 relative z-10">
          <h3 className="text-3xl font-black text-white tracking-tight uppercase">Need further assistance?</h3>
          <p className="text-slate-400 font-medium max-w-xl">Our neural support nodes are standing by to assist with complex strategic configurations and protocol implementation.</p>
        </div>
        <button 
          onClick={() => window.open(window.location.origin + '?page=support', '_blank')}
          className="px-12 py-5 bg-red-600 text-white text-xs font-black uppercase tracking-[0.2em] rounded-2xl hover:bg-red-500 transition-all shadow-2xl shadow-red-600/40 active:scale-95 shrink-0"
        >
          Contact Neural Support
        </button>
      </div>

      <div className="pt-12 border-t border-slate-800 flex flex-col md:flex-row justify-between items-center gap-6 opacity-50">
        <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">© 2026 SPIKED AI // Neural Sales Intelligence Protocol</span>
        <div className="flex gap-8">
          <button className="text-[10px] font-black text-slate-500 uppercase tracking-widest hover:text-red-600 transition-colors">Privacy Policy</button>
          <button className="text-[10px] font-black text-slate-500 uppercase tracking-widest hover:text-red-600 transition-colors">Terms of Service</button>
          <button className="text-[10px] font-black text-slate-500 uppercase tracking-widest hover:text-red-600 transition-colors">Security Audit</button>
        </div>
      </div>
    </div>
  );
};
