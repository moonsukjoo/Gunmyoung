import React from 'react';
import { Delete, ChevronLeft } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';

interface PinKeypadProps {
  onInput: (value: string) => void;
  onDelete: () => void;
  onClear: () => void;
  onBack?: () => void;
  onOtherMethod?: () => void;
  passwordLength: number;
  className?: string;
}

export const PinKeypad: React.FC<PinKeypadProps> = ({ 
  onInput, 
  onDelete, 
  onClear, 
  onBack,
  onOtherMethod,
  passwordLength,
  className 
}) => {
  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];

  return (
    <div className={cn("fixed inset-0 z-[100] flex flex-col bg-background overflow-hidden", className)}>
      {/* Top Section - Background Based */}
      <div className="flex-[1.2] flex flex-col items-center justify-center p-6 space-y-12">
        <div className="w-full flex justify-start absolute top-8 left-6">
          <button onClick={onBack} className="p-2 -ml-2 text-muted-foreground hover:text-foreground transition-colors">
            <ChevronLeft className="w-8 h-8" />
          </button>
        </div>

        <div className="flex flex-col items-center gap-10 w-full pt-12">
          <h2 className="text-xl font-bold text-foreground tracking-tight">간편 비밀번호를 입력해주세요</h2>

          <div className="flex gap-4 items-center justify-center">
            {[...Array(6)].map((_, i) => (
              <motion.div 
                key={i} 
                animate={{ 
                  scale: passwordLength > i ? 1.2 : 1,
                  backgroundColor: passwordLength > i ? 'var(--primary)' : 'var(--muted)'
                }}
                className="w-4 h-4 rounded-full transition-all duration-200 border border-border" 
              />
            ))}
          </div>

          <button 
            onClick={onOtherMethod}
            className="text-sm font-bold text-muted-foreground underline underline-offset-4 hover:text-foreground transition-colors"
          >
            다른 로그인 방식
          </button>
        </div>
      </div>

      {/* Bottom Section - Keypad Area */}
      <div className="bg-card flex-1 p-8 shadow-2xl border-t border-border">
        <div className="grid grid-cols-3 h-full w-full max-w-sm mx-auto items-center">
          {keys.map((num) => (
            <motion.button
              key={num}
              whileTap={{ scale: 0.85, opacity: 0.6 }}
              onClick={() => onInput(num)}
              className="h-full flex items-center justify-center text-4xl font-black text-foreground"
            >
              {num}
            </motion.button>
          ))}
          
          <div /> {/* Spacer */}
          
          <motion.button
            whileTap={{ scale: 0.85, opacity: 0.6 }}
            onClick={() => onInput('0')}
            className="h-full flex items-center justify-center text-4xl font-black text-foreground"
          >
            0
          </motion.button>

          <motion.button
            whileTap={{ scale: 0.85, opacity: 0.6 }}
            onClick={onDelete}
            className="h-full flex items-center justify-center"
          >
            <Delete className="w-10 h-10" color="currentColor" />
          </motion.button>
        </div>
      </div>
    </div>
  );
};
