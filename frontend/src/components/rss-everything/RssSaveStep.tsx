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
  isSaving: boolean;
  isEditMode?: boolean;  // 수정 모드 여부
  validationResult?: {
    title: string;
    description: string;
    items_count: number;
  } | null;
  onUrlChange?: (url: string) => void;  // URL 변경 핸들러
  onBack: () => void;
  onSave: () => void;
}

export const RssSaveStep: React.FC<RssSaveStepProps> = ({
  url,
  isSaving,
  isEditMode = false,
  validationResult,
  onUrlChange,
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
      setValidationError(t.rssEverything.rssFeedVerifyFailed);
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
            ? t.rssEverything.editSource
            : t.rssEverything.addSource
          }
        </h2>
        <p className="text-sm text-muted-foreground">
          {isEditMode
            ? t.rssEverything.editSourceDescription
            : t.rssEverything.addSourceDescription
          }
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {t.rssEverything.rssSourceSettings}
          </CardTitle>
          <CardDescription>
            {url}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* URL 편집 */}
          <div className="space-y-2">
            <Label htmlFor="feed-url">{t.rssEverything.rssFeedUrl}</Label>
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
                <span className="ml-1">{t.rssEverything.verify}</span>
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
                  <span>{t.rssEverything.rssFeedVerifySuccess}</span>
                </div>
                <div className="ml-6 space-y-0.5 text-muted-foreground">
                  <p>{t.rssEverything.titleLabel}: {displayValidationResult.title}</p>
                  <p>{t.rssEverything.itemCountLabel}: {displayValidationResult.items_count}</p>
                  {displayValidationResult.description && (
                    <p className="truncate">{t.rssEverything.descriptionLabelShort}: {displayValidationResult.description}</p>
                  )}
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-between">
        <Button variant="outline" onClick={onBack}>
          <ArrowLeft className="w-4 h-4 mr-1" /> {t.common.back}
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
          {isEditMode ? t.common.edit : t.rssEverything.addSource}
        </Button>
      </div>
    </div>
  );
};
