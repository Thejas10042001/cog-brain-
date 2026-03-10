import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { brandingService, BrandingEvent } from '../services/brandingService';

export const DynamicLogo: React.FC = () => {
  const [event, setEvent] = useState<BrandingEvent | null>(null);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const initBranding = async () => {
      setIsLoading(true);
      try {
        // Detect current event
        const currentEvent = await brandingService.detectCurrentEvent();
        if (currentEvent) {
          setEvent(currentEvent);
          // Generate or fetch themed logo
          const url = await brandingService.generateThemedLogo(currentEvent);
          if (url) {
            setLogoUrl(url);
          }
        }
      } catch (e) {
        console.error("Branding initialization failed:", e);
      } finally {
        setIsLoading(false);
      }
    };

    initBranding();
  }, []);

  if (logoUrl) {
    return (
      <div className="flex flex-col items-start leading-none group cursor-pointer relative">
        <div className="flex items-center gap-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            whileHover={{ scale: 1.05 }}
            className="relative h-14 flex items-center"
          >
            <img 
              src={logoUrl} 
              alt={`Spiked AI - ${event?.name} Edition`} 
              className="h-full object-contain drop-shadow-[0_0_15px_rgba(220,38,38,0.3)]"
              referrerPolicy="no-referrer"
            />
            {event && (
              <motion.div 
                initial={{ opacity: 0, y: 5 }}
                whileHover={{ opacity: 1, y: 0 }}
                className="absolute -bottom-6 left-0 bg-slate-800/90 backdrop-blur-md px-3 py-1 rounded-full border border-slate-700/50 text-[8px] font-black uppercase tracking-widest text-red-500 whitespace-nowrap z-10 pointer-events-none"
              >
                {event.name} Edition
              </motion.div>
            )}
          </motion.div>
        </div>
        <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.5em] mt-2 ml-1 hidden md:block">
          Neural Sales Intelligence Protocol
        </span>
      </div>
    );
  }

  // Default Logo
  return (
    <div className="flex flex-col items-start leading-none group cursor-pointer">
      <div className="flex items-center gap-4">
        <motion.div 
          whileHover={{ rotate: 180, scale: 1.1 }}
          className="w-10 h-10 bg-red-600 text-white rounded-[1.25rem] flex items-center justify-center font-black text-2xl shadow-[0_10px_30px_rgba(220,38,38,0.4)]"
        >
          !
        </motion.div>
        <span className="font-black text-3xl tracking-tighter text-white uppercase">
          SPIKED<span className="text-red-600 drop-shadow-[0_0_15px_rgba(220,38,38,0.4)]">AI</span>
        </span>
      </div>
      <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.5em] mt-2 ml-1 hidden md:block">
        Neural Sales Intelligence Protocol
      </span>
    </div>
  );
};
