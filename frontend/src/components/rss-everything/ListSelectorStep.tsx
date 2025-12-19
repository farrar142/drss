'use client';

import { useEffect, useState } from 'react';
import { Loader2, Eye, ArrowRight, AlertTriangle, CheckCircle2, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/ui/button';
import { Input } from '@/ui/input';
import { Label } from '@/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/ui/card';
import { HTMLViewer } from '@/components/common/HTMLViewer';
import { ListSelectors } from '@/components/common/SelectorBuilder';
import { ParseMode, SelectorValidation } from '@/hooks/rss-everything/useRSSEverything';
import { useTranslation } from '@/stores/languageStore';
import { DateFormatTester } from './DateFormatTester';
import { ExcludeSelectors } from './ExcludeSelectors';

// Field labels mapping for i18n
function useListFieldLabels() {
  const { t } = useTranslation();
  return {
    itemSelector: t.rssEverything.itemSelector,
    titleSelector: t.rssEverything.titleSelector,
    linkSelector: t.rssEverything.linkSelector,
    descriptionSelector: t.rssEverything.descriptionSelector,
    dateSelector: t.rssEverything.dateSelector,
    imageSelector: t.rssEverything.imageSelector,
    authorSelector: t.rssEverything.authorSelector,
    categoriesSelector: t.rssEverything.categoriesSelector,
  };
}

interface ListSelectorStepProps {
  parseMode: ParseMode;
  listHtml: string;
  url: string;
  listSelectors: ListSelectors;
  activeListField: keyof ListSelectors | 'exclude';
  previewLoading: boolean;
  dateFormats: string[];
  excludeSelectors: string[];
  // Validation props
  selectorValidation: SelectorValidation | null;
  isValidating: boolean;
  onValidate: () => void;
  onListSelectorsChange: (selectors: ListSelectors) => void;
  onActiveListFieldChange: (field: keyof ListSelectors | 'exclude') => void;
  onSelectorFromViewer: (selector: string) => void;
  onDateFormatsChange: (formats: string[]) => void;
  onExcludeSelectorsChange: (selectors: string[]) => void;
  onBack: () => void;
  onNext: () => void;
  onPreview: () => void;
}

export function ListSelectorStep({
  parseMode,
  listHtml,
  url,
  listSelectors,
  activeListField,
  previewLoading,
  dateFormats,
  excludeSelectors,
  selectorValidation,
  isValidating,
  onValidate,
  onListSelectorsChange,
  onActiveListFieldChange,
  onSelectorFromViewer,
  onDateFormatsChange,
  onExcludeSelectorsChange,
  onBack,
  onNext,
  onPreview,
}: ListSelectorStepProps) {
  const { t } = useTranslation();
  const listFieldLabels = useListFieldLabels();

  // itemSelector가 변경될 때마다 자동 검증
  useEffect(() => {
    if (listSelectors.itemSelector) {
      onValidate();
    }
  }, [listSelectors.itemSelector, listSelectors.linkSelector, onValidate]);

  // 필수 필드 정의
  const requiredFields: (keyof ListSelectors)[] = parseMode === 'list'
    ? ['itemSelector', 'titleSelector']
    : ['itemSelector', 'linkSelector'];

  const canProceed = listSelectors.itemSelector &&
    (parseMode === 'list' ? listSelectors.titleSelector : listSelectors.linkSelector);

  // 모바일에서 셀렉터 패널과 HTML 뷰어 토글
  const [showHtmlViewer, setShowHtmlViewer] = useState(false);

  return (
    <div className="flex flex-col lg:grid lg:grid-cols-2 gap-4 h-[calc(100vh-8rem)]">
      {/* Mobile: Toggle Button */}
      <div className="lg:hidden flex gap-2">
        <Button
          variant={!showHtmlViewer ? "default" : "outline"}
          className="flex-1"
          onClick={() => setShowHtmlViewer(false)}
        >
          {t.rssEverything.selectorSettings}
        </Button>
        <Button
          variant={showHtmlViewer ? "default" : "outline"}
          className="flex-1"
          onClick={() => setShowHtmlViewer(true)}
        >
          {t.rssEverything.htmlPreview}
        </Button>
      </div>

      {/* Selector Builder - 모바일에서 토글 */}
      <Card className={`flex flex-col overflow-hidden ${showHtmlViewer ? 'hidden lg:flex' : 'flex'}`}>
        <CardHeader className="flex-shrink-0 pb-2">
          <CardTitle>
            {t.rssEverything.listSelectors}
          </CardTitle>
          <CardDescription>
            {t.rssEverything.listSelectorsDesc}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex-1 overflow-y-auto space-y-4">
          {/* Field selector buttons */}
          <div className="space-y-2">
            <Label>{t.rssEverything.selectElement}</Label>
            <div className="flex flex-wrap gap-2">
              {(Object.keys(listSelectors) as (keyof ListSelectors)[]).map((field) => {
                const isRequired = requiredFields.includes(field);
                const hasValue = !!listSelectors[field];

                return (
                  <Button
                    key={field}
                    size="sm"
                    variant={activeListField === field ? 'default' : 'outline'}
                    onClick={() => onActiveListFieldChange(field)}
                    className={`text-xs ${isRequired && !hasValue ? 'border-destructive text-destructive' : ''}`}
                  >
                    {listFieldLabels[field]}
                    {isRequired && <span className="text-destructive ml-0.5">*</span>}
                    {hasValue && ' ✓'}
                  </Button>
                );
              })}
              {/* Exclude 버튼 추가 */}
              <Button
                size="sm"
                variant={activeListField === 'exclude' ? 'default' : 'outline'}
                onClick={() => onActiveListFieldChange('exclude')}
                className={`text-xs ${activeListField === 'exclude' ? 'bg-destructive hover:bg-destructive/90' : 'border-destructive/50 text-destructive hover:bg-destructive/10'}`}
              >
                Exclude
                {excludeSelectors.length > 0 && ` (${excludeSelectors.length})`}
              </Button>
            </div>
          </div>

          {/* Current selector input */}
          {activeListField !== 'exclude' ? (
            <div className="space-y-2">
              <Label>{listFieldLabels[activeListField]}</Label>
              <Input
                value={listSelectors[activeListField]}
                onChange={(e) => onListSelectorsChange({
                  ...listSelectors,
                  [activeListField]: e.target.value,
                })}
                placeholder="CSS selector"
                className="font-mono text-sm"
              />
            </div>
          ) : (
            <div className="space-y-2">
              <Label className="text-destructive">Exclude Selector</Label>
              <p className="text-xs text-muted-foreground">
                {t.rssEverything.clickToExclude}
              </p>
            </div>
          )}

          {/* Validation Result */}
          {listSelectors.itemSelector && (
            <div className="space-y-2">
              {isValidating ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {t.rssEverything.validating}
                </div>
              ) : selectorValidation && (
                <div className="space-y-2">
                  {/* 아이템 수 표시 */}
                  <div className="flex items-center gap-2 text-sm">
                    {selectorValidation.totalItems > 0 ? (
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                    ) : (
                      <AlertTriangle className="h-4 w-4 text-destructive" />
                    )}
                    <span>
                      {selectorValidation.totalItems}{t.rssEverything.itemsFound}
                      {selectorValidation.totalItems > 0 && parseMode === 'detail' && (
                        <span className="text-muted-foreground ml-1">
                          ({selectorValidation.itemsWithLinks}
                          {t.rssEverything.itemsWithLinks.replace('{count}', String(selectorValidation.totalItems))})
                        </span>
                      )}
                    </span>
                  </div>

                  {/* 경고 메시지 */}
                  {selectorValidation.warning && (
                    <div className="flex items-start gap-2 p-2 rounded-md bg-destructive/10 border border-destructive/20 text-destructive text-xs">
                      <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                      <span>
                        {selectorValidation.warning === 'noLinksWarning'
                          ? t.rssEverything.noLinksWarning
                          : selectorValidation.warning === 'selectorMismatchWarning'
                            ? t.rssEverything.selectorMismatchWarning
                            : t.rssEverything.noItemsFound}
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Date Format Tester - 날짜 셀렉터가 있을 때 표시 */}
          {listSelectors.dateSelector && (
            <DateFormatTester
              dateFormats={dateFormats}
              onDateFormatsChange={onDateFormatsChange}
              html={listHtml}
              dateSelector={`${listSelectors.itemSelector} ${listSelectors.dateSelector}`}
            />
          )}

          {/* Exclude Selectors */}
          <ExcludeSelectors
            excludeSelectors={excludeSelectors}
            onExcludeSelectorsChange={onExcludeSelectorsChange}
          />

          <div className="flex gap-2">
            <Button variant="outline" onClick={onBack}>
              {t.common.cancel}
            </Button>
            <Button
              className="flex-1"
              onClick={parseMode === 'list' ? onPreview : onNext}
              disabled={!canProceed || previewLoading}
            >
              {previewLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t.common.loading}
                </>
              ) : parseMode === 'list' ? (
                <>
                  <Eye className="mr-2 h-4 w-4" />
                  {t.rssEverything.preview}
                </>
              ) : (
                <>
                  <ArrowRight className="mr-2 h-4 w-4" />
                  {t.rssEverything.step3}
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* HTML Viewer - 모바일에서 토글 */}
      <Card className={`overflow-hidden flex flex-col min-h-[50vh] lg:min-h-0 ${!showHtmlViewer ? 'hidden lg:flex' : 'flex'}`}>
        <CardHeader className="flex-shrink-0 py-2">
          <CardTitle>{t.rssEverything.preview}</CardTitle>
          <CardDescription>
            {activeListField === 'exclude' ? (
              <span className="text-destructive">{t.rssEverything.clickToExclude}</span>
            ) : (
              <>{t.rssEverything.selectElement}: <strong>{listFieldLabels[activeListField]}</strong></>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex-1 overflow-hidden p-0">
          <HTMLViewer
            html={listHtml}
            baseUrl={url}
            currentSelector={activeListField === 'exclude' ? '' : listSelectors[activeListField]}
            onSelectorChange={onSelectorFromViewer}
          />
        </CardContent>
      </Card>
    </div>
  );
}
