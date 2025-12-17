'use client';

import React, { useState } from 'react';
import { Rss, Globe, FileText, ArrowRight, Clipboard, CheckCircle, AlertCircle } from 'lucide-react';
import { Button } from '@/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/ui/card';
import { Textarea } from '@/ui/textarea';
import { cn } from '@/lib/utils';
import { useTranslation } from '@/stores/languageStore';

export type SourceType = 'rss' | 'page_scraping' | 'detail_page_scraping';

// 소스 설정 타입 (JSON에서 가져올 수 있는 필드들)
export interface SourceConfig {
  source_type?: SourceType;
  url?: string;
  item_selector?: string;
  title_selector?: string;
  link_selector?: string;
  description_selector?: string;
  date_selector?: string;
  image_selector?: string;
  detail_title_selector?: string;
  detail_description_selector?: string;
  detail_content_selector?: string;
  detail_date_selector?: string;
  detail_image_selector?: string;
  exclude_selectors?: string[];
  date_formats?: string[];
  date_locale?: string;
  use_browser?: boolean;
  wait_selector?: string;
  timeout?: number;
  custom_headers?: Record<string, unknown>;
}

interface SourceTypeStepProps {
  onSelect: (type: SourceType, rssUrl?: string, config?: SourceConfig) => void;
}

export const SourceTypeStep: React.FC<SourceTypeStepProps> = ({
  onSelect,
}) => {
  const { t } = useTranslation();
  const [selectedType, setSelectedType] = useState<SourceType>('rss');
  const [rssUrl, setRssUrl] = useState('');
  const [jsonInput, setJsonInput] = useState('');
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [parsedConfig, setParsedConfig] = useState<SourceConfig | null>(null);

  const SOURCE_TYPES: { type: SourceType; icon: React.ReactNode; title: string; description: string }[] = [
    {
      type: 'rss',
      icon: <Rss className="w-6 h-6" />,
      title: t.rssEverything?.sourceTypeRss || 'RSS/Atom 피드',
      description: t.rssEverything?.sourceTypeRssDesc || '표준 RSS 또는 Atom 피드 URL을 입력합니다. 가장 간단한 방식입니다.',
    },
    {
      type: 'page_scraping',
      icon: <Globe className="w-6 h-6" />,
      title: t.rssEverything?.sourceTypePageScraping || '페이지 스크래핑',
      description: t.rssEverything?.sourceTypePageScrapingDesc || '목록 페이지에서 CSS 셀렉터로 아이템을 추출합니다.',
    },
    {
      type: 'detail_page_scraping',
      icon: <FileText className="w-6 h-6" />,
      title: t.rssEverything?.sourceTypeDetailScraping || '상세 페이지 스크래핑',
      description: t.rssEverything?.sourceTypeDetailScrapingDesc || '목록 페이지에서 링크를 수집하고, 각 상세 페이지에서 내용을 추출합니다.',
    },
  ];

  // JSON 붙여넣기 파싱
  const handleJsonPaste = (value: string) => {
    setJsonInput(value);
    setJsonError(null);
    setParsedConfig(null);

    if (!value.trim()) return;

    try {
      const parsed = JSON.parse(value);

      // 유효성 검사
      if (typeof parsed !== 'object' || parsed === null) {
        setJsonError('유효한 JSON 객체가 아닙니다.');
        return;
      }

      // source_type 확인 및 자동 선택
      if (parsed.source_type) {
        const validTypes: SourceType[] = ['rss', 'page_scraping', 'detail_page_scraping'];
        if (validTypes.includes(parsed.source_type)) {
          setSelectedType(parsed.source_type);
        }
      }

      // URL 자동 설정
      if (parsed.url && parsed.source_type === 'rss') {
        setRssUrl(parsed.url);
      }

      setParsedConfig(parsed as SourceConfig);
    } catch {
      setJsonError('JSON 파싱 오류: 유효한 JSON 형식인지 확인하세요.');
    }
  };

  const handleContinue = () => {
    if (selectedType === 'rss') {
      // RSS는 URL 없이 바로 다음 단계로 (rss-save에서 URL 입력)
      onSelect('rss', rssUrl || undefined, parsedConfig || undefined);
    } else {
      onSelect(selectedType, undefined, parsedConfig || undefined);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <h2 className="text-lg font-semibold mb-2">{t.rssEverything?.selectSourceType || '소스 타입 선택'}</h2>
        <p className="text-sm text-muted-foreground">
          {t.rssEverything?.selectSourceTypeDesc || '피드 아이템을 가져올 방식을 선택하세요.'}
        </p>
      </div>

      {/* JSON 설정 붙여넣기 */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Clipboard className="w-4 h-4" />
            설정 붙여넣기 (선택사항)
          </CardTitle>
          <CardDescription>
            기존 소스에서 복사한 JSON 설정을 붙여넣으면 자동으로 설정이 적용됩니다.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <Textarea
            placeholder='{"source_type": "rss", "url": "https://...", ...}'
            value={jsonInput}
            onChange={(e) => handleJsonPaste(e.target.value)}
            className="font-mono text-xs min-h-[80px]"
          />
          {jsonError && (
            <div className="flex items-center gap-2 text-sm text-destructive">
              <AlertCircle className="w-4 h-4" />
              {jsonError}
            </div>
          )}
          {parsedConfig && (
            <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
              <CheckCircle className="w-4 h-4" />
              설정이 적용되었습니다. (타입: {parsedConfig.source_type || selectedType})
            </div>
          )}
        </CardContent>
      </Card>

      {/* 소스 타입 선택 카드들 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {SOURCE_TYPES.map(({ type, icon, title, description }) => (
          <Card
            key={type}
            className={cn(
              'cursor-pointer transition-all hover:border-primary/50',
              selectedType === type && 'border-primary ring-2 ring-primary/20'
            )}
            onClick={() => setSelectedType(type)}
          >
            <CardHeader className="pb-2">
              <div className={cn(
                'w-12 h-12 rounded-lg flex items-center justify-center mb-2',
                selectedType === type ? 'bg-primary text-primary-foreground' : 'bg-muted'
              )}>
                {icon}
              </div>
              <CardTitle className="text-base">{title}</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription className="text-xs">
                {description}
              </CardDescription>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* 다음 버튼 */}
      <div className="flex justify-end">
        <Button onClick={handleContinue}>
          {t.common?.next || '다음'} <ArrowRight className="w-4 h-4 ml-1" />
        </Button>
      </div>
    </div>
  );
};
