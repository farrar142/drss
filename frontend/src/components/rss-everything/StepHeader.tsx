'use client';

import React from 'react';
import { Globe, ChevronRight, RotateCcw } from 'lucide-react';
import { Button } from '@/ui/button';
import { useTranslation } from '@/stores/languageStore';

interface StepHeaderProps {
  currentStepIndex: number;
  onReset: () => void;
}

export function StepHeader({ currentStepIndex, onReset }: StepHeaderProps) {
  const { t } = useTranslation();

  const steps = [
    t.rssEverything.step1,
    t.rssEverything.step2,
    t.rssEverything.step3,
    t.rssEverything.step4,
    t.rssEverything.step5,
  ];

  return (
    <div className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b px-4 py-2">
      <div className="flex items-center justify-between max-w-[1600px] mx-auto">
        <div className="flex items-center gap-2">
          <Globe className="h-5 w-5 text-primary" />
          <h1 className="font-semibold">{t.rssEverything.title}</h1>
        </div>

        <div className="hidden md:flex items-center gap-1 text-sm text-muted-foreground">
          {steps.map((step, index) => (
            <React.Fragment key={step}>
              {index > 0 && <ChevronRight className="h-4 w-4" />}
              <span className={index === currentStepIndex ? 'text-primary font-medium' : ''}>
                {index + 1}. {step}
              </span>
            </React.Fragment>
          ))}
        </div>

        <Button variant="ghost" size="sm" onClick={onReset}>
          <RotateCcw className="h-4 w-4 mr-1" />
          {t.rssEverything.reset}
        </Button>
      </div>
    </div>
  );
}
