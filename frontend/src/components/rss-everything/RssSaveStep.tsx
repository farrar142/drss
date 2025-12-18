'use client';

import React, { useState } from 'react';
import { ArrowLeft, Save, Loader2, CheckCircle, AlertCircle, Search } from 'lucide-react';
import { Button } from '@/ui/button';
import { Input } from '@/ui/input';
import { Label } from '@/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/ui/card';
import { validateFeed, FeedValidationResponse } from '@/services/api';
import { useTranslation } from '@/stores/languageStore';

interface RssSaveStepProps {
  url: string;
  refreshInterval: number;
  isSaving: boolean;
  isEditMode?: boolean;  // 수정 모드 여부
  validationResult?: {
    title: string;
    description: string;
    items_count: number;
  } | null;
  onUrlChange?: (url: string) => void;  // URL 변경 핸들러
  onRefreshIntervalChange: (interval: number) => void;
  onBack: () => void;
  onSave: () => void;
}

export const RssSaveStep: React.FC<RssSaveStepProps> = ({
  url,
  refreshInterval,
  isSaving,
  isEditMode = false,
  validationResult,
  onUrlChange,
  onRefreshIntervalChange,
  onBack,
  onSave,
}) => {
  const { t } = useTranslation();
  const [isValidating, setIsValidating] = useState(false);
  const [localValidationResult, setLocalValidationResult] = useState<FeedValidationResponse | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);

  const canSave = !!url;

  // URL 검증 함수
  const handleValidate = async () => {
    if (!url) return;

    setIsValidating(true);
    setValidationError(null);
    setLocalValidationResult(null);

    try {
      const result = await validateFeed({ url });
      setLocalValidationResult(result);
    } catch (error) {
      console.error('Validation error:', error);
      setValidationError('RSS 피드 검증에 실패했습니다. URL을 확인해주세요.');
    } finally {
      setIsValidating(false);
    }
  };

  // 표시할 검증 결과 (외부에서 전달된 것 또는 로컬 검증 결과)
  const displayValidationResult = localValidationResult || validationResult;

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div>
        <h2 className="text-lg font-semibold mb-2">
          {isEditMode
            ? (t.rssEverything?.saveFeed || 'RSS 소스 수정')
            : (t.rssEverything?.addSource || 'RSS 소스 추가')
          }
        </h2>
        <p className="text-sm text-muted-foreground">
          {isEditMode
            ? 'RSS 소스 URL과 설정을 수정합니다.'
            : (t.rssEverything?.addSourceDescription || 'RSS 소스를 기존 피드에 추가합니다.')
          }
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            RSS 소스 설정
          </CardTitle>
          <CardDescription>
            {url}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* URL 편집 */}
          <div className="space-y-2">
            <Label htmlFor="feed-url">RSS 피드 URL</Label>
            <div className="flex gap-2">
              <Input
                id="feed-url"
                placeholder="https://example.com/rss"
                value={url}
                onChange={(e) => onUrlChange?.(e.target.value)}
                className="flex-1"
              />
              <Button
                type="button"
                variant="outline"
                onClick={handleValidate}
                disabled={!url || isValidating}
              >
                {isValidating ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Search className="w-4 h-4" />
                )}
                <span className="ml-1">검증</span>
              </Button>
            </div>

            {/* 검증 결과 표시 */}
            {validationError && (
              <div className="flex items-center gap-2 p-3 bg-destructive/10 text-destructive rounded-md text-sm">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{validationError}</span>
              </div>
            )}

            {displayValidationResult && (
              <div className="p-3 bg-green-500/10 text-green-700 dark:text-green-400 rounded-md text-sm space-y-1">
                <div className="flex items-center gap-2 font-medium">
                  <CheckCircle className="w-4 h-4 flex-shrink-0" />
                  <span>RSS 피드 검증 성공</span>
                </div>
                <div className="ml-6 space-y-0.5 text-muted-foreground">
                  <p>제목: {displayValidationResult.title}</p>
                  <p>아이템 수: {displayValidationResult.items_count}개</p>
                  {displayValidationResult.description && (
                    <p className="truncate">설명: {displayValidationResult.description}</p>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* 새로고침 간격 */}
          <div className="space-y-2">
            <Label htmlFor="refresh-interval">
              {t.rssEverything?.refreshInterval || '새로고침 간격'} ({t.rssEverything?.refreshIntervalUnit || '분'})
            </Label>
            <Input
              id="refresh-interval"
              type="number"
              min={5}
              max={1440}
              value={refreshInterval}
              onChange={(e) => onRefreshIntervalChange(parseInt(e.target.value) || 60)}
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-between">
        <Button variant="outline" onClick={onBack}>
          <ArrowLeft className="w-4 h-4 mr-1" /> {t.common?.back || '이전'}
        </Button>
        <Button
          onClick={onSave}
          disabled={isSaving || !canSave}
        >
          {isSaving ? (
            <Loader2 className="w-4 h-4 animate-spin mr-1" />
          ) : (
            <Save className="w-4 h-4 mr-1" />
          )}
          {isEditMode ? '수정' : (t.rssEverything?.addSource || '추가')}
        </Button>
      </div>
    </div>
  );
};
