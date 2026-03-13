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
  id: 'getting-started' | 'strategy-lab' | 'simulations' | 'assessment' | 'gpt' | 'grooming' | 'studio';
  title: string;
  icon: React.ReactNode;
  description: string;
  content: HelpItem[];
}

const HELP_SECTIONS: HelpSection[] = [
  {
    id: 'getting-started',
    title: 'Neural Nexus Setup',
    icon: <ICONS.Shield className="w-5 h-5" />,
    description: 'Establish the foundation of your deal intelligence through high-fidelity context ingestion.',
    content: [
      {
        subtitle: 'Step 1: Context Configuration',
        text: 'Navigate to the "Settings" node to define the operational landscape of your deal. This is the most critical phase as it defines the AI\'s perspective.',
        points: [
          'Seller Profile: Detail your company\'s unique value proposition, specific team members involved, and any internal constraints.',
          'Client Profile: Identify the target organization\'s industry, current pain points, and decision-making hierarchy.',
          'Strategic Goals: Define clear, measurable outcomes for the engagement (e.g., "Secure POC by Q3").',
          'Deal Stage: Specify if you are in Discovery, Solutioning, or Final Negotiation.'
        ]
      },
      {
        subtitle: 'Step 2: Strategic Ingestion',
        text: 'Upload the documentary intelligence that will ground the AI in your specific reality. The system uses RAG (Retrieval-Augmented Generation) to ensure accuracy.',
        points: [
          'Supported Formats: PDF, TXT, and DOCX files up to 50MB.',
          'Recommended Content: Case studies, product briefs, previous meeting transcripts, and competitor analysis.',
          'Synthesize Neural Core: This process parses your documents into a vector database for high-speed retrieval.',
          'Verification: Ensure all uploaded documents are listed in the "Library" section for active use.'
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
        text: 'Review the AI-generated strategic framework designed to penetrate the target account using the "Neural Analysis" module.',
        points: [
          'Executive Summary: A 30,000ft view of the winning approach and key messaging.',
          'Strategic Pillars: Three core themes that differentiate your solution from competitors.',
          'Competitive Wedge: Specific tactical points to displace incumbents or neutralize alternatives.',
          'Stakeholder Map: Identification of Champions, Economic Buyers, and potential Detractors.'
        ]
      },
      {
        subtitle: 'Step 2: Neural Refinement',
        text: 'Iterate on the strategy to ensure it perfectly matches the evolving deal dynamics using real-time feedback loops.',
        points: [
          'Neural Refinement Input: Provide specific feedback or new deal developments to update the strategy.',
          'Objection Defense: Pre-emptively identify and neutralize buyer resistance with scripted responses.',
          'Value Alignment: Ensure every strategic point maps directly to a client pain point identified in Step 1.',
          'Export & Share: Distribute the strategy to your team for unified execution.'
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
        text: 'Master the critical phases of the enterprise sales cycle through targeted simulation modules.',
        points: [
          'Ice Breakers: Practice building rapport and establishing credibility in the first 5 minutes.',
          'Pricing & Value: Defend your premium position against budget-conscious procurement teams.',
          'Legal & Procurement: Navigate the final hurdles of the deal with confidence.',
          'Custom Scenarios: Create unique situations based on your specific deal challenges.'
        ]
      },
      {
        subtitle: 'Step 2: Persona Engagement',
        text: 'Engage in natural dialogue with the industry\'s most sophisticated AI buyer avatars.',
        points: [
          'Avatar 1.0 (The Skeptic): A high-pressure CIO who demands technical proof and ROI.',
          'Avatar 2.0 (The Committee): A multi-stakeholder negotiation simulation with conflicting interests.',
          'Real-time Sentiment: Monitor the "Sentiment Tracker" to see how your words impact the buyer\'s mood.',
          'Tactical Feedback: Receive a post-simulation audit on your performance and areas for growth.'
        ]
      }
    ]
  },
  {
    id: 'assessment',
    title: 'Assessment Lab',
    icon: <ICONS.Check className="w-5 h-5" />,
    description: 'Evaluate your strategic readiness and knowledge of the deal dynamics.',
    content: [
      {
        subtitle: 'Step 1: Strategic Evaluation',
        text: 'Launch a comprehensive assessment to test your understanding of the client\'s pain points and your own strategy.',
        points: [
          'Situational Scenarios: Respond to complex, deal-specific questions that test your tactical agility.',
          'Knowledge Check: Verify your alignment with the strategic playbook generated in the Strategy Lab.',
          'Scorecard: Receive a detailed breakdown of your strategic strengths and weaknesses.',
          'Remediation: Get specific recommendations on which modules to revisit based on your score.'
        ]
      }
    ]
  },
  {
    id: 'gpt',
    title: 'Spiked GPT',
    icon: <ICONS.SpikedGPT className="w-5 h-5" />,
    description: 'Leverage the full power of the Neural Protocol to optimize every touchpoint.',
    content: [
      {
        subtitle: 'Spiked GPT: The Answering Engine',
        text: 'Query the cognitive core for instant, grounded answers to any deal-related question using our proprietary LLM wrapper.',
        points: [
          'Contextual Retrieval: Extract specific data points from hundreds of pages of uploaded context.',
          'Content Generation: Create email drafts, follow-up notes, and executive summaries in seconds.',
          'Winning Plays: Ask for tactical advice based on the current deal state and competitor profiles.',
          'Audit Trail: All queries are logged for team learning and strategy consistency.'
        ]
      }
    ]
  },
  {
    id: 'grooming',
    title: 'Grooming Lab',
    icon: <ICONS.Brain className="w-5 h-5" />,
    description: 'Audit your vocal presence and delivery for maximum authority.',
    content: [
      {
        subtitle: 'Grooming Lab: Vocal Audit',
        text: 'Ensure your vocal presence matches the strength of your strategic intelligence through deep audio analysis.',
        points: [
          'Tone & Pacing: Receive an elite audit on your delivery speed, pitch variance, and confidence levels.',
          'Grammar & Clarity: Identify and eliminate filler words, weak language, or industry jargon.',
          'Confidence Score: Get a numerical rating of your perceived authority during the pitch.',
          'Iterative Practice: Re-record and compare audits to track your vocal improvement over time.'
        ]
      }
    ]
  },
  {
    id: 'studio',
    title: 'Studio',
    icon: <ICONS.Mic className="w-5 h-5" />,
    description: 'Generate professional-grade audio samples of your winning pitches.',
    content: [
      {
        subtitle: 'Studio: Voice Synthesis',
        text: 'Convert your written scripts into high-quality, natural-sounding audio using neural voice cloning.',
        points: [
          'Record Sample: Initialize your personal neural voice profile with a 30-second recording.',
          'Script to Speech: Paste your winning pitch scripts to generate authoritative audio samples.',
          'Fine-tune: Adjust emotion, emphasis, and pauses for maximum psychological impact.',
          'Library: Store and manage your generated audio for practice or client-facing presentations.'
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

