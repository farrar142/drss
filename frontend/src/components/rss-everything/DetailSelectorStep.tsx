'use client';

import { useState } from 'react';
import { Loader2, Eye, ExternalLink } from 'lucide-react';
import { Button } from '@/ui/button';
import { Input } from '@/ui/input';
import { Label } from '@/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/ui/card';
import { HTMLViewer } from '@/components/common/HTMLViewer';
import { DetailSelectors } from '@/components/common/SelectorBuilder';
import { useTranslation } from '@/stores/languageStore';
import { DateFormatTester } from './DateFormatTester';
import { ExcludeSelectors } from './ExcludeSelectors';

// Field labels mapping for i18n
function useDetailFieldLabels() {
  const { t } = useTranslation();
  return {
    detailTitleSelector: t.rssEverything.titleSelector,
    detailDescriptionSelector: t.rssEverything.descriptionSelector,
    detailContentSelector: t.rssEverything.contentSelector,
    detailDateSelector: t.rssEverything.dateSelector,
    detailImageSelector: t.rssEverything.imageSelector,
    detailAuthorSelector: t.rssEverything.authorSelector,
    detailCategoriesSelector: t.rssEverything.categoriesSelector,
  };
}

interface DetailSelectorStepProps {
  detailUrl: string;
  detailHtml: string | null;
  detailSelectors: DetailSelectors;
  activeDetailField: keyof DetailSelectors | 'exclude';
  isLoading: boolean;
  previewLoading: boolean;
  dateFormats: string[];
  excludeSelectors: string[];
  onDetailUrlChange: (url: string) => void;
  onDetailSelectorsChange: (selectors: DetailSelectors) => void;
  onActiveDetailFieldChange: (field: keyof DetailSelectors | 'exclude') => void;
  onSelectorFromViewer: (selector: string) => void;
  onDateFormatsChange: (formats: string[]) => void;
  onExcludeSelectorsChange: (selectors: string[]) => void;
  onFetchDetail: () => void;
  onBack: () => void;
  onPreview: () => void;
}

export function DetailSelectorStep({
  detailUrl,
  detailHtml,
  detailSelectors,
  activeDetailField,
  isLoading,
  previewLoading,
  dateFormats,
  excludeSelectors,
  onDetailUrlChange,
  onDetailSelectorsChange,
  onActiveDetailFieldChange,
  onSelectorFromViewer,
  onDateFormatsChange,
  onExcludeSelectorsChange,
  onFetchDetail,
  onBack,
  onPreview,
}: DetailSelectorStepProps) {
  const { t } = useTranslation();
  const detailFieldLabels = useDetailFieldLabels();

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
          <CardTitle>{t.rssEverything.detailSelectors}</CardTitle>
          <CardDescription>
            {t.rssEverything.detailSelectorsDesc}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex-1 overflow-y-auto space-y-4">
          <div className="space-y-2">
            <Label htmlFor="detail-url">{t.rssEverything.urlLabel}</Label>
            <div className="flex gap-2">
              <Input
                id="detail-url"
                type="url"
                placeholder={t.rssEverything.urlPlaceholder}
                value={detailUrl}
                onChange={(e) => onDetailUrlChange(e.target.value)}
                className="flex-1"
              />
              <Button
                variant="outline"
                onClick={onFetchDetail}
                disabled={!detailUrl || isLoading}
              >
                {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ExternalLink className="h-4 w-4" />}
              </Button>
            </div>
            <p className="text-sm text-muted-foreground">
              {t.rssEverything.detailSelectorsNote}
            </p>
          </div>

          {detailHtml && (
            <>
              {/* Field selector buttons */}
              <div className="space-y-2">
                <Label>{t.rssEverything.selectElement}</Label>
                <div className="flex flex-wrap gap-2">
                  {(Object.keys(detailSelectors) as (keyof DetailSelectors)[]).map((field) => (
                    <Button
                      key={field}
                      size="sm"
                      variant={activeDetailField === field ? 'default' : 'outline'}
                      onClick={() => onActiveDetailFieldChange(field)}
                      className="text-xs"
                    >
                      {detailFieldLabels[field]}
                      {detailSelectors[field] && ' ✓'}
                    </Button>
                  ))}
                  {/* Exclude 버튼 추가 */}
                  <Button
                    size="sm"
                    variant={activeDetailField === 'exclude' ? 'default' : 'outline'}
                    onClick={() => onActiveDetailFieldChange('exclude')}
                    className={`text-xs ${activeDetailField === 'exclude' ? 'bg-destructive hover:bg-destructive/90' : 'border-destructive/50 text-destructive hover:bg-destructive/10'}`}
                  >
                    Exclude
                    {excludeSelectors.length > 0 && ` (${excludeSelectors.length})`}
                  </Button>
                </div>
              </div>

              {/* Current selector input */}
              {activeDetailField !== 'exclude' ? (
                <div className="space-y-2">
                  <Label>{detailFieldLabels[activeDetailField]}</Label>
                  <Input
                    value={detailSelectors[activeDetailField]}
                    onChange={(e) => onDetailSelectorsChange({
                      ...detailSelectors,
                      [activeDetailField]: e.target.value,
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

              {/* Date Format Tester - 날짜 셀렉터가 있을 때 표시 */}
              {detailSelectors.detailDateSelector && (
                <DateFormatTester
                  dateFormats={dateFormats}
                  onDateFormatsChange={onDateFormatsChange}
                  html={detailHtml || undefined}
                  dateSelector={detailSelectors.detailDateSelector}
                />
              )}

              {/* Exclude Selectors */}
              <ExcludeSelectors
                excludeSelectors={excludeSelectors}
                onExcludeSelectorsChange={onExcludeSelectorsChange}
              />
            </>
          )}

          <div className="flex gap-2">
            <Button variant="outline" onClick={onBack}>
              {t.common.cancel}
            </Button>
            <Button
              className="flex-1"
              onClick={onPreview}
              disabled={!detailHtml || !detailSelectors.detailContentSelector || previewLoading}
            >
              {previewLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t.common.loading}
                </>
              ) : (
                <>
                  <Eye className="mr-2 h-4 w-4" />
                  {t.rssEverything.preview}
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
            {detailHtml
              ? (activeDetailField === 'exclude'
                ? <span className="text-destructive">{t.rssEverything.clickToExclude}</span>
                : <>{t.rssEverything.selectElement}: <strong>{detailFieldLabels[activeDetailField]}</strong></>)
              : t.rssEverything.previewEmpty}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex-1 overflow-hidden p-0">
          {detailHtml ? (
            <HTMLViewer
              html={detailHtml}
              baseUrl={detailUrl}
              currentSelector={activeDetailField === 'exclude' ? '' : detailSelectors[activeDetailField]}
              onSelectorChange={onSelectorFromViewer}
            />
          ) : (
            <div className="flex items-center justify-center h-full text-muted-foreground p-8">
              {t.rssEverything.previewEmpty}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
