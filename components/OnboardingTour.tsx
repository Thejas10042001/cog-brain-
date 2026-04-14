
import React, { useState, useEffect, useRef, useLayoutEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ICONS } from '../constants';

interface TourStep {
  id: string;
  targetId?: string;
  title: string;
  content: string;
  position: 'top' | 'bottom' | 'left' | 'right' | 'center';
  tab?: string;
  autoAdvance?: number; // ms to wait before auto-advancing
  requireInteraction?: boolean; // if true, wait for user to click the element
}

interface OnboardingTourProps {
  onComplete: () => void;
  onTabChange: (tab: string) => void;
  activeTab: string;
}

export const OnboardingTour: React.FC<OnboardingTourProps> = ({ onComplete, onTabChange, activeTab }) => {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const [isAutoAdvancing, setIsAutoAdvancing] = useState(false);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const autoAdvanceTimerRef = useRef<NodeJS.Timeout | null>(null);

  const steps: TourStep[] = [
    {
      id: 'welcome',
      title: "Neural Onboarding Initiated",
      content: "Welcome to SPIKED AI. I am your neural guide. I will walk you through the core nodes of our sales intelligence protocol. No action is required; simply follow the spotlight.",
      position: 'center',
      autoAdvance: 6000
    },
    {
      id: 'settings-node',
      tab: 'context',
      targetId: 'tour-tab-context',
      title: "Node 01: Strategic Settings",
      content: "This is your foundation. Here you define the seller and client landscape to ground our neural engine.",
      position: 'right',
      autoAdvance: 5000
    },
    {
      id: 'context-config',
      tab: 'context',
      targetId: 'tour-context-config',
      title: "Context Configuration",
      content: "Define the specific parameters of your deal. The more precise the input, the higher the fidelity of our synthesis.",
      position: 'bottom',
      autoAdvance: 5000
    },
    {
      id: 'upload-zone',
      tab: 'context',
      targetId: 'tour-upload-zone',
      title: "Intelligence Ingestion",
      content: "Upload your sales playbooks and product specs here. Our engine will parse them into vector-space for instant retrieval.",
      position: 'top',
      autoAdvance: 5000
    },
    {
      id: 'notifications',
      targetId: 'tour-notifications',
      title: "Neural Feed",
      content: "Monitor real-time system updates and your upcoming Google Calendar strategy sessions here.",
      position: 'bottom',
      autoAdvance: 5000
    },
    {
      id: 'strategy-node',
      tab: 'strategy',
      targetId: 'tour-tab-strategy',
      title: "Node 02: Strategy Lab",
      content: "Moving to the Strategy Lab. This is where we synthesize your winning roadmap.",
      position: 'right',
      autoAdvance: 4000
    },
    {
      id: 'synthesize-btn',
      tab: 'strategy',
      targetId: 'tour-synthesize-btn',
      title: "Strategy Synthesis",
      content: "Trigger the neural synthesis engine to generate actionable competitive wedges and objection defense strategies.",
      position: 'bottom',
      autoAdvance: 5000
    },
    {
      id: 'simulation-node',
      tab: 'avatar-staged',
      targetId: 'tour-tab-avatar-staged',
      title: "Node 04: Stage Simulation",
      content: "Practice makes perfect. Use this node to roleplay through specific deal phases.",
      position: 'right',
      autoAdvance: 4000
    },
    {
      id: 'start-sim-btn',
      tab: 'avatar-staged',
      targetId: 'tour-start-sim-btn',
      title: "Tactical Roleplay",
      content: "Engage with high-fidelity AI buyer personas to pressure-test your strategy before the actual meeting.",
      position: 'top',
      autoAdvance: 5000
    },
    {
      id: 'gpt-node',
      tab: 'gpt',
      targetId: 'tour-tab-gpt',
      title: "Node 07: Spiked GPT",
      content: "Your instant intelligence retrieval engine. Ask anything about your deal context.",
      position: 'right',
      autoAdvance: 4000
    },
    {
      id: 'gpt-input',
      tab: 'gpt',
      targetId: 'tour-gpt-input',
      title: "Cognitive Query",
      content: "Ask complex deal questions and receive grounded, evidence-based responses instantly.",
      position: 'top',
      autoAdvance: 5000
    },
    {
      id: 'help-node',
      tab: 'help',
      targetId: 'tour-tab-help',
      title: "Node 09: Protocol Manual",
      content: "Access comprehensive documentation and support for the SPIKED AI protocol.",
      position: 'right',
      autoAdvance: 4000
    },
    {
      id: 'finish',
      title: "Protocol Mastery Achieved",
      content: "You are now equipped with the SPIKED AI sales intelligence protocol. Go win the deal.",
      position: 'center',
      autoAdvance: 5000
    }
  ];

  const currentStep = steps[currentStepIndex];

  // Auto-advance logic
  useEffect(() => {
    if (!isVisible) return;

    if (autoAdvanceTimerRef.current) {
      clearTimeout(autoAdvanceTimerRef.current);
    }

    if (currentStep.autoAdvance) {
      setIsAutoAdvancing(true);
      autoAdvanceTimerRef.current = setTimeout(() => {
        handleNext();
      }, currentStep.autoAdvance);
    } else {
      setIsAutoAdvancing(false);
    }

    return () => {
      if (autoAdvanceTimerRef.current) {
        clearTimeout(autoAdvanceTimerRef.current);
      }
    };
  }, [currentStepIndex, isVisible]);

  // Tab sync logic: If the user manually changes tab, jump to the first step of that tab if it's ahead
  useEffect(() => {
    if (!isVisible) return;
    
    const targetTabIndex = steps.findIndex(s => s.tab === activeTab);
    if (targetTabIndex !== -1 && targetTabIndex !== currentStepIndex) {
      // Only jump if the user is moving forward or to a different logical section
      setCurrentStepIndex(targetTabIndex);
    }
  }, [activeTab]);

  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), 1000);
    return () => clearTimeout(timer);
  }, []);

  useLayoutEffect(() => {
    let isMounted = true;
    const updateRect = () => {
      if (!isMounted) return;
      if (currentStep.targetId) {
        const el = document.getElementById(currentStep.targetId);
        if (el) {
          const rect = el.getBoundingClientRect();
          setTargetRect(rect);
        } else {
          setTargetRect(null);
        }
      } else {
        setTargetRect(null);
      }
    };

    updateRect();
    window.addEventListener('resize', updateRect);
    const timer = setTimeout(updateRect, 300);
    
    return () => {
      isMounted = false;
      window.removeEventListener('resize', updateRect);
      clearTimeout(timer);
    };
  }, [currentStepIndex, activeTab]);

  const handleNext = () => {
    if (currentStepIndex < steps.length - 1) {
      const nextIndex = currentStepIndex + 1;
      setCurrentStepIndex(nextIndex);
      if (steps[nextIndex].tab && steps[nextIndex].tab !== activeTab) {
        onTabChange(steps[nextIndex].tab!);
      }
    } else {
      setIsVisible(false);
      setTimeout(onComplete, 500);
    }
  };

  const handleSkip = () => {
    setIsVisible(false);
    setTimeout(onComplete, 500);
  };

  const getTooltipStyle = () => {
    if (!targetRect || currentStep.position === 'center') return {};

    const padding = 24;
    const tooltipWidth = 380;
    const tooltipHeight = 200;

    let top = 0;
    let left = 0;

    switch (currentStep.position) {
      case 'top':
        top = targetRect.top - tooltipHeight - padding;
        left = targetRect.left + targetRect.width / 2 - tooltipWidth / 2;
        break;
      case 'bottom':
        top = targetRect.bottom + padding;
        left = targetRect.left + targetRect.width / 2 - tooltipWidth / 2;
        break;
      case 'left':
        top = targetRect.top + targetRect.height / 2 - tooltipHeight / 2;
        left = targetRect.left - tooltipWidth - padding;
        break;
      case 'right':
        top = targetRect.top + targetRect.height / 2 - tooltipHeight / 2;
        left = targetRect.right + padding;
        break;
    }

    left = Math.max(20, Math.min(window.innerWidth - tooltipWidth - 20, left));
    top = Math.max(20, Math.min(window.innerHeight - tooltipHeight - 20, top));

    return {
      position: 'fixed' as const,
      top,
      left,
      width: tooltipWidth,
    };
  };

  return (
    <AnimatePresence>
      {isVisible && (
        <div className="fixed inset-0 z-[100] pointer-events-none overflow-hidden">
          {/* Spotlight Overlay */}
          <svg className="absolute inset-0 w-full h-full pointer-events-auto">
            <defs>
              <mask id="spotlight-mask">
                <rect x="0" y="0" width="100%" height="100%" fill="white" />
                {targetRect && (
                  <motion.rect
                    initial={false}
                    animate={{
                      x: targetRect.left - 10,
                      y: targetRect.top - 10,
                      width: targetRect.width + 20,
                      height: targetRect.height + 20,
                    }}
                    rx="20"
                    fill="black"
                  />
                )}
              </mask>
            </defs>
            <rect
              x="0"
              y="0"
              width="100%"
              height="100%"
              fill="rgba(2, 6, 23, 0.8)"
              mask="url(#spotlight-mask)"
              className="backdrop-blur-[2px]"
              onClick={handleSkip}
            />
          </svg>

          {/* Pulsing Highlight */}
          {targetRect && (
            <motion.div
              initial={false}
              animate={{
                top: targetRect.top - 10,
                left: targetRect.left - 10,
                width: targetRect.width + 20,
                height: targetRect.height + 20,
              }}
              className="fixed pointer-events-none z-[101]"
            >
              <motion.div
                animate={{
                  boxShadow: [
                    "0 0 0 0px rgba(79, 70, 229, 0)",
                    "0 0 0 20px rgba(79, 70, 229, 0.4)",
                    "0 0 0 40px rgba(79, 70, 229, 0)",
                  ],
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
                className="w-full h-full rounded-[1.5rem] border-2 border-indigo-500/50"
              />
            </motion.div>
          )}
          
          <motion.div
            ref={tooltipRef}
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ 
              opacity: 1, 
              scale: 1, 
              y: 0,
              ...getTooltipStyle()
            }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className={`
              relative z-10 p-8 bg-slate-900 border border-slate-800 rounded-[2.5rem] shadow-2xl pointer-events-auto
              ${currentStep.position === 'center' ? 'mx-auto mt-[20vh] w-full max-w-md' : ''}
            `}
          >
            <div className="absolute -top-6 -left-6 w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-xl shadow-indigo-900/40">
              <span className="text-white font-black text-sm">{currentStepIndex + 1}</span>
            </div>

            <div className="space-y-6">
              <div className="space-y-2">
                <h3 className="text-xl font-black text-white uppercase tracking-tighter">
                  {currentStep.title}
                </h3>
                <div className="h-1 w-12 bg-indigo-600 rounded-full" />
              </div>

              <p className="text-slate-400 text-sm leading-relaxed font-medium">
                {currentStep.content}
              </p>

              <div className="flex items-center justify-between pt-4">
                <button 
                  onClick={handleSkip}
                  className="text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-slate-300 transition-colors"
                >
                  Skip Tour
                </button>
                
                <div className="flex items-center gap-6">
                  <div className="flex gap-1.5">
                    {steps.map((_, i) => (
                      <div 
                        key={i} 
                        className={`h-1 rounded-full transition-all duration-500 ${i === currentStepIndex ? 'w-6 bg-indigo-600' : 'w-1.5 bg-slate-800'}`} 
                      />
                    ))}
                  </div>
                  
                  {currentStep.autoAdvance && (
                    <div className="relative w-10 h-10 flex items-center justify-center">
                      <svg className="w-full h-full -rotate-90">
                        <circle
                          cx="20"
                          cy="20"
                          r="18"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="3"
                          className="text-slate-800"
                        />
                        <motion.circle
                          key={currentStepIndex}
                          cx="20"
                          cy="20"
                          r="18"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="3"
                          strokeDasharray="113"
                          initial={{ strokeDashoffset: 113 }}
                          animate={{ strokeDashoffset: 0 }}
                          transition={{ duration: currentStep.autoAdvance / 1000, ease: "linear" }}
                          className="text-indigo-600"
                        />
                      </svg>
                      <button 
                        onClick={handleNext}
                        className="absolute inset-0 flex items-center justify-center text-white hover:text-indigo-400 transition-colors"
                        title="Force Next"
                      >
                        <ICONS.ArrowRight className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
