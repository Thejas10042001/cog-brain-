
import React, { useState, useEffect, useRef, useLayoutEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ICONS } from '../constants';

interface TourStep {
  targetId?: string;
  title: string;
  content: string;
  position: 'top' | 'bottom' | 'left' | 'right' | 'center';
  tab?: string;
}

interface OnboardingTourProps {
  onComplete: () => void;
  onTabChange: (tab: string) => void;
}

export const OnboardingTour: React.FC<OnboardingTourProps> = ({ onComplete, onTabChange }) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  const steps: TourStep[] = [
    {
      title: "Welcome to Spiked AI",
      content: "Your elite cognitive sales copilot. Let's take a quick tour of the neural architecture designed to help you win every deal.",
      position: 'center'
    },
    {
      tab: 'context',
      targetId: 'tour-context-config',
      title: "Strategic Priming",
      content: "Start by configuring your deal context. Define the seller/client landscape and set simulation parameters to ground the AI in your reality.",
      position: 'bottom'
    },
    {
      tab: 'context',
      targetId: 'tour-upload-zone',
      title: "Intelligence Ingestion",
      content: "Upload your sales playbooks, product specs, and customer data. Our neural engine categorizes them automatically for high-fidelity synthesis.",
      position: 'top'
    },
    {
      tab: 'strategy',
      targetId: 'tour-synthesize-btn',
      title: "Strategy Lab",
      content: "Once grounded, synthesize high-fidelity sales strategies. Generate actionable roadmaps and competitive wedges tailored to your specific deal.",
      position: 'bottom'
    },
    {
      tab: 'avatar-staged',
      targetId: 'tour-start-sim-btn',
      title: "Avatar Simulation",
      content: "Pressure-test your strategy in real-time dialogue with skeptical buyer personas. Sharpen your reflexes before you face the actual committee.",
      position: 'top'
    },
    {
      tab: 'gpt',
      targetId: 'tour-gpt-input',
      title: "Spiked GPT",
      content: "Your grounded answering engine. Ask any deal-related question and get instant, evidence-based responses from your uploaded intelligence.",
      position: 'top'
    },
    {
      title: "Ready for Launch",
      content: "You're now equipped with the SPIKED AI protocol. Go win that deal.",
      position: 'center'
    }
  ];

  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), 1000);
    return () => clearTimeout(timer);
  }, []);

  const stepsRef = useRef(steps);
  stepsRef.current = steps;

  useLayoutEffect(() => {
    let isMounted = true;
    const updateRect = () => {
      if (!isMounted) return;
      const step = stepsRef.current[currentStep];
      if (step.targetId) {
        const el = document.getElementById(step.targetId);
        if (el) {
          const rect = el.getBoundingClientRect();
          setTargetRect(prev => {
            if (prev && 
                prev.top === rect.top && 
                prev.left === rect.left && 
                prev.width === rect.width && 
                prev.height === rect.height) {
              return prev;
            }
            return rect;
          });
        } else {
          setTargetRect(null);
        }
      } else {
        setTargetRect(null);
      }
    };

    updateRect();
    window.addEventListener('resize', updateRect);
    // Add a small delay to allow tab transitions to complete
    const timer = setTimeout(updateRect, 500);
    
    return () => {
      isMounted = false;
      window.removeEventListener('resize', updateRect);
      clearTimeout(timer);
    };
  }, [currentStep]);

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      const nextStep = currentStep + 1;
      setCurrentStep(nextStep);
      if (steps[nextStep].tab) {
        onTabChange(steps[nextStep].tab!);
      }
    } else {
      setIsVisible(false);
      setTimeout(onComplete, 500);
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      const prevStep = currentStep - 1;
      setCurrentStep(prevStep);
      if (steps[prevStep].tab) {
        onTabChange(steps[prevStep].tab!);
      }
    }
  };

  const handleSkip = () => {
    setIsVisible(false);
    setTimeout(onComplete, 500);
  };

  const step = steps[currentStep];

  const getTooltipStyle = () => {
    if (!targetRect || step.position === 'center') return {};

    const padding = 20;
    const tooltipWidth = 400;
    const tooltipHeight = 250; // Approximate

    let top = 0;
    let left = 0;

    switch (step.position) {
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

    // Keep within viewport
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
              ${step.position === 'center' ? 'mx-auto mt-[20vh] w-full max-w-md' : ''}
            `}
          >
            <div className="absolute -top-6 -left-6 w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-xl shadow-indigo-900/40">
              <span className="text-white font-black text-sm">{currentStep + 1}</span>
            </div>

            <div className="space-y-6">
              <div className="space-y-2">
                <h3 className="text-xl font-black text-white uppercase tracking-tighter">
                  {step.title}
                </h3>
                <div className="h-1 w-12 bg-indigo-600 rounded-full" />
              </div>

              <p className="text-slate-400 text-sm leading-relaxed font-medium">
                {step.content}
              </p>

              <div className="flex items-center justify-between pt-4">
                <button 
                  onClick={handleSkip}
                  className="text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-slate-300 transition-colors"
                >
                  Skip Tour
                </button>
                
                <div className="flex items-center gap-4">
                  {currentStep > 0 && (
                    <button 
                      onClick={handleBack}
                      className="text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-slate-300 transition-colors"
                    >
                      Back
                    </button>
                  )}
                  
                  <div className="flex gap-1">
                    {steps.map((_, i) => (
                      <div 
                        key={i} 
                        className={`w-1 h-1 rounded-full transition-all ${i === currentStep ? 'w-4 bg-indigo-600' : 'bg-slate-800'}`} 
                      />
                    ))}
                  </div>
                  
                  <button 
                    onClick={handleNext}
                    className="flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-indigo-700 transition-all active:scale-95 shadow-lg shadow-indigo-900/20"
                  >
                    {currentStep === steps.length - 1 ? "Get Started" : "Next Step"}
                    <ICONS.ArrowRight className="w-3 h-3" />
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
