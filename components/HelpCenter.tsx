import React from 'react';
import { motion } from 'motion/react';
import { ICONS } from '../constants';
import { AnimatedGuide } from './AnimatedGuide';

interface HelpItem {
  subtitle: string;
  text: string;
  points?: string[];
  visual?: React.ReactNode;
  details?: {
    what: string;
    why: string;
    where: string;
    how: string;
    dos: string[];
    donts: string[];
    storage: string;
  };
}

interface HelpSection {
  id: 'getting-started' | 'strategy-lab' | 'simulations' | 'intelligence-tools' | 'privacy-policy' | 'terms-of-service' | 'security-audit';
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
        visual: (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="h-3 w-24 bg-red-600/20 rounded-full" />
              <div className="h-3 w-12 bg-slate-800 rounded-full" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="h-12 bg-slate-800 rounded-xl border border-slate-700 flex flex-col p-2 gap-1">
                <div className="h-1.5 w-12 bg-slate-600 rounded-full" />
                <div className="h-2 w-full bg-slate-700 rounded-full" />
              </div>
              <div className="h-12 bg-slate-800 rounded-xl border border-slate-700 flex flex-col p-2 gap-1">
                <div className="h-1.5 w-12 bg-slate-600 rounded-full" />
                <div className="h-2 w-full bg-slate-700 rounded-full" />
              </div>
            </div>
            <div className="h-8 bg-red-600 rounded-xl flex items-center justify-center">
              <div className="h-2 w-20 bg-white/50 rounded-full" />
            </div>
          </div>
        ),
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
        visual: (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-red-600/20 flex items-center justify-center">
                <ICONS.Brain className="w-4 h-4 text-red-600" />
              </div>
              <div className="h-3 w-32 bg-slate-700 rounded-full" />
            </div>
            <div className="space-y-2">
              <div className="h-2 w-full bg-slate-800 rounded-full" />
              <div className="h-2 w-full bg-slate-800 rounded-full" />
              <div className="h-2 w-4/5 bg-slate-800 rounded-full" />
            </div>
            <div className="p-3 bg-red-600/5 border border-red-600/20 rounded-xl">
              <div className="h-1.5 w-20 bg-red-600/40 rounded-full mb-2" />
              <div className="h-2 w-full bg-red-600/10 rounded-full" />
            </div>
          </div>
        ),
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
        subtitle: 'Grooming Lab',
        text: 'Ensure your vocal presence matches the strength of your strategic intelligence.',
        points: [
          'Grooming Lab: Receive an elite audit on tone, pacing, and grammar.',
          'Practice until your delivery is flawless and authoritative.'
        ]
      }
    ]
  },
  {
    id: 'privacy-policy',
    title: 'Privacy Policy',
    icon: <ICONS.Lock className="w-5 h-5" />,
    description: 'Our commitment to your data sovereignty and neural privacy.',
    content: [
      {
        subtitle: 'Neural Data Sovereignty',
        text: 'We treat your sales intelligence as a sacred asset. Your data is never used to train global models.',
        details: {
          what: 'A comprehensive framework governing the collection, processing, and protection of your deal data.',
          why: 'To ensure that your competitive advantages and proprietary sales methods remain exclusively yours.',
          where: 'Data is processed in secure, isolated compute environments with strict residency controls.',
          how: 'Through end-to-end encryption and zero-trust architecture at every layer of the neural stack.',
          dos: [
            'Upload only relevant deal documents.',
            'Use the "Clear Context" feature when a deal is closed.',
            'Review your shared intelligence periodically.'
          ],
          donts: [
            'Do not upload PII (Personally Identifiable Information) of unauthorized third parties.',
            'Do not share your neural access keys with unauthorized personnel.',
            'Do not attempt to bypass data isolation protocols.'
          ],
          storage: 'All intelligence is stored in AES-256 encrypted Firestore buckets, isolated by organization ID. Retention is strictly managed by user-defined policies.'
        }
      }
    ]
  },
  {
    id: 'terms-of-service',
    title: 'Terms of Service',
    icon: <ICONS.Document className="w-5 h-5" />,
    description: 'The operational agreement between you and the SPIKED AI Protocol.',
    content: [
      {
        subtitle: 'Operational Framework',
        text: 'The legal boundaries and usage rights for the SPIKED AI platform.',
        details: {
          what: 'The binding agreement defining the rights, responsibilities, and limitations of using SPIKED AI.',
          why: 'To establish a clear legal foundation for our partnership and protect both parties.',
          where: 'Applicable globally, governed by the jurisdiction specified in your enterprise contract.',
          how: 'By accessing the platform, you agree to the ethical and operational standards defined herein.',
          dos: [
            'Use the platform for professional sales intelligence only.',
            'Report any system anomalies immediately.',
            'Maintain the confidentiality of generated strategies.'
          ],
          donts: [
            'Do not reverse-engineer the neural synthesis engine.',
            'Do not use the platform for malicious social engineering.',
            'Do not exceed your allocated cognitive compute quota.'
          ],
          storage: 'Usage logs and audit trails are maintained for 90 days to ensure compliance and system integrity.'
        }
      }
    ]
  },
  {
    id: 'security-audit',
    title: 'Security Audit',
    icon: <ICONS.Shield className="w-5 h-5" />,
    description: 'Continuous verification of our neural defenses and architectural integrity.',
    content: [
      {
        subtitle: 'Defensive Architecture',
        text: 'Our systems undergo rigorous, continuous auditing to maintain peak security posture.',
        details: {
          what: 'A multi-layered security verification process including penetration testing and code audits.',
          why: 'To proactively identify and neutralize potential vulnerabilities in the neural pipeline.',
          where: 'Conducted across our entire infrastructure, from edge nodes to core synthesis engines.',
          how: 'Through automated vulnerability scanning and quarterly third-party security assessments.',
          dos: [
            'Enable Multi-Factor Authentication (MFA).',
            'Monitor your account activity logs.',
            'Follow the principle of least privilege for team access.'
          ],
          donts: [
            'Do not ignore security alerts from the Neural Feed.',
            'Do not use weak or recycled credentials.',
            'Do not expose API endpoints to public networks.'
          ],
          storage: 'Security telemetry is stored in an immutable, append-only ledger for forensic analysis.'
        }
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
            key={`${section.id}-${idx}`}
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
                    <div key={`${item.subtitle}-${i}`} className="space-y-4">
                      <div className="flex items-center gap-3">
                        <div className="w-1 h-4 bg-red-600 rounded-full" />
                        <h3 className="text-white text-sm font-black uppercase tracking-widest">{item.subtitle}</h3>
                      </div>
                      <p className="text-slate-400 text-sm leading-relaxed font-medium pl-4">
                        {item.text}
                      </p>

                      {item.visual && (
                        <div className="pl-4 mt-6">
                          <div className="rounded-2xl border border-slate-800 overflow-hidden bg-slate-900 shadow-2xl">
                            <div className="px-4 py-2 border-b border-slate-800 bg-slate-800/50 flex items-center gap-2">
                              <div className="flex gap-1">
                                <div className="w-1.5 h-1.5 rounded-full bg-red-500/50" />
                                <div className="w-1.5 h-1.5 rounded-full bg-yellow-500/50" />
                                <div className="w-1.5 h-1.5 rounded-full bg-green-500/50" />
                              </div>
                              <div className="h-2 w-32 bg-slate-700/50 rounded-full" />
                            </div>
                            <div className="p-4">
                              {item.visual}
                            </div>
                          </div>
                          <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-3 text-center">Neural Interface Screenshot // Protocol v4.2</p>
                        </div>
                      )}

                      {item.details && (
                        <div className="pl-4 mt-6 space-y-6">
                          <div className="grid grid-cols-2 gap-4">
                            <div className="p-4 bg-slate-900/50 rounded-xl border border-slate-800">
                              <h4 className="text-[10px] font-black text-red-600 uppercase tracking-widest mb-1">What</h4>
                              <p className="text-xs text-slate-300 leading-relaxed">{item.details.what}</p>
                            </div>
                            <div className="p-4 bg-slate-900/50 rounded-xl border border-slate-800">
                              <h4 className="text-[10px] font-black text-red-600 uppercase tracking-widest mb-1">Why</h4>
                              <p className="text-xs text-slate-300 leading-relaxed">{item.details.why}</p>
                            </div>
                            <div className="p-4 bg-slate-900/50 rounded-xl border border-slate-800">
                              <h4 className="text-[10px] font-black text-red-600 uppercase tracking-widest mb-1">Where</h4>
                              <p className="text-xs text-slate-300 leading-relaxed">{item.details.where}</p>
                            </div>
                            <div className="p-4 bg-slate-900/50 rounded-xl border border-slate-800">
                              <h4 className="text-[10px] font-black text-red-600 uppercase tracking-widest mb-1">How</h4>
                              <p className="text-xs text-slate-300 leading-relaxed">{item.details.how}</p>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-6">
                            <div className="space-y-3">
                              <h4 className="text-[10px] font-black text-green-500 uppercase tracking-widest flex items-center gap-2">
                                <div className="w-1 h-1 rounded-full bg-green-500" />
                                Protocol Dos
                              </h4>
                              <ul className="space-y-2">
                                {item.details.dos.map((doItem, dIdx) => (
                                  <li key={`do-${dIdx}`} className="text-[11px] text-slate-500 flex items-start gap-2">
                                    <span className="text-green-500">+</span> {doItem}
                                  </li>
                                ))}
                              </ul>
                            </div>
                            <div className="space-y-3">
                              <h4 className="text-[10px] font-black text-red-500 uppercase tracking-widest flex items-center gap-2">
                                <div className="w-1 h-1 rounded-full bg-red-500" />
                                Protocol Don'ts
                              </h4>
                              <ul className="space-y-2">
                                {item.details.donts.map((dontItem, dIdx) => (
                                  <li key={`dont-${dIdx}`} className="text-[11px] text-slate-500 flex items-start gap-2">
                                    <span className="text-red-500">×</span> {dontItem}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          </div>

                          <div className="p-4 bg-red-600/5 rounded-xl border border-red-600/20">
                            <h4 className="text-[10px] font-black text-red-600 uppercase tracking-widest mb-2 flex items-center gap-2">
                              <ICONS.Shield className="w-3 h-3" />
                              Data Storage & Encryption
                            </h4>
                            <p className="text-xs text-slate-400 leading-relaxed italic">
                              {item.details.storage}
                            </p>
                          </div>
                        </div>
                      )}

                      {item.points && (
                        <ul className="space-y-3 pl-8">
                          {item.points.map((point, pIdx) => (
                            <li key={`${point.slice(0, 20)}-${pIdx}`} className="flex items-start gap-3 text-xs text-slate-500 font-bold group/point">
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
          <button 
            onClick={() => document.getElementById('privacy-policy')?.scrollIntoView({ behavior: 'smooth' })}
            className="text-[10px] font-black text-slate-500 uppercase tracking-widest hover:text-red-600 transition-colors"
          >
            Privacy Policy
          </button>
          <button 
            onClick={() => document.getElementById('terms-of-service')?.scrollIntoView({ behavior: 'smooth' })}
            className="text-[10px] font-black text-slate-500 uppercase tracking-widest hover:text-red-600 transition-colors"
          >
            Terms of Service
          </button>
          <button 
            onClick={() => document.getElementById('security-audit')?.scrollIntoView({ behavior: 'smooth' })}
            className="text-[10px] font-black text-slate-500 uppercase tracking-widest hover:text-red-600 transition-colors"
          >
            Security Audit
          </button>
        </div>
      </div>
    </div>
  );
};
