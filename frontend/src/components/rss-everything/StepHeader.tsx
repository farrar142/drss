'use client';

import React from 'react';
import { Globe, ChevronRight, RotateCcw } from 'lucide-react';
import { Button } from '@/ui/button';
import { useTranslation } from '@/stores/languageStore';

type SourceType = 'rss' | 'page_scraping' | 'detail_page_scraping';

interface StepHeaderProps {
  currentStepIndex: number;
  sourceType: SourceType | null;
  onReset: () => void;
}

export function StepHeader({ currentStepIndex, sourceType, onReset }: StepHeaderProps) {
  const { t } = useTranslation();

  // 소스 타입별 스텝 정의
  const getStepsForSourceType = (): string[] => {
    if (!sourceType) {
      // 소스 타입 선택 전
      return [t.rssEverything.step1]; // 소스 타입 선택
    }

    switch (sourceType) {
      case 'rss':
        // RSS: 소스 타입 선택 → 저장
        return [
          t.rssEverything.step1, // 소스 타입 선택
          t.rssEverything.step5, // 저장
        ];
      case 'page_scraping':
        // Page Scraping: 소스 타입 → URL → 목록 셀렉터 → 미리보기 → 저장
        return [
          t.rssEverything.step1, // 소스 타입 선택
          t.rssEverything.step2, // URL 입력
          t.rssEverything.listSelectorStep, // 목록 셀렉터
          t.rssEverything.step4, // 미리보기
          t.rssEverything.step5, // 저장
        ];
      case 'detail_page_scraping':
        // Detail Page Scraping: 모든 스텝
        return [
          t.rssEverything.step1, // 소스 타입 선택
          t.rssEverything.step2, // URL 입력
          t.rssEverything.listSelectorStep, // 목록 셀렉터
          t.rssEverything.step3, // 상세 셀렉터
          t.rssEverything.step4, // 미리보기
          t.rssEverything.step5, // 저장
        ];
      default:
        return [t.rssEverything.step1];
    }
  };

  const steps = getStepsForSourceType();

  return (
    <div className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b px-4 py-2">
      <div className="flex items-center justify-between max-w-[1600px] mx-auto">
        <div className="flex items-center gap-2">
          <Globe className="h-5 w-5 text-primary" />
          <h1 className="font-semibold">{t.rssEverything.title}</h1>
        </div>

        <div className="hidden md:flex items-center gap-1 text-sm text-muted-foreground">
          {steps.map((step, index) => (
            <React.Fragment key={index}>
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
