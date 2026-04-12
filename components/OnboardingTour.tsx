
import React, { useState, useEffect } from 'react';
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

  const steps: TourStep[] = [
    {
      title: "Welcome to Spiked AI",
      content: "Your elite cognitive sales copilot. Let's take a quick tour of the neural architecture designed to help you win every deal.",
      position: 'center'
    },
    {
      tab: 'context',
      title: "Strategic Priming",
      content: "Start by configuring your deal context. Define the seller/client landscape and set simulation parameters to ground the AI in your reality.",
      position: 'right'
    },
    {
      tab: 'context',
      title: "Intelligence Ingestion",
      content: "Upload your sales playbooks, product specs, and customer data. Our neural engine categorizes them automatically for high-fidelity synthesis.",
      position: 'right'
    },
    {
      tab: 'strategy',
      title: "Strategy Lab",
      content: "Once grounded, synthesize high-fidelity sales strategies. Generate actionable roadmaps and competitive wedges tailored to your specific deal.",
      position: 'right'
    },
    {
      tab: 'avatar',
      title: "Avatar Simulation",
      content: "Pressure-test your strategy in real-time dialogue with skeptical buyer personas. Sharpen your reflexes before you face the actual committee.",
      position: 'right'
    },
    {
      tab: 'gpt',
      title: "Spiked GPT",
      content: "Your grounded answering engine. Ask any deal-related question and get instant, evidence-based responses from your uploaded intelligence.",
      position: 'right'
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

  const handleSkip = () => {
    setIsVisible(false);
    setTimeout(onComplete, 500);
  };

  const step = steps[currentStep];

  return (
    <AnimatePresence>
      {isVisible && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center pointer-events-none">
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm pointer-events-auto"
            onClick={handleSkip}
          />
          
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className={`
              relative z-10 w-full max-w-md p-8 bg-slate-900 border border-slate-800 rounded-[2.5rem] shadow-2xl pointer-events-auto
              ${step.position === 'center' ? '' : 'lg:ml-80'}
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
