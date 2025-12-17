'use client';

import { Loader2, Eye, ExternalLink } from 'lucide-react';
import { Button } from '@/ui/button';
import { Input } from '@/ui/input';
import { Label } from '@/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/ui/card';
import { HTMLViewer } from '@/components/HTMLViewer';
import { DetailSelectors } from '@/components/SelectorBuilder';
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

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 h-[calc(100vh-8rem)]">
      {/* Selector Builder */}
      <Card className="flex flex-col overflow-hidden">
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
                  <Label className="text-destructive">Exclude Selector (클릭하여 추가)</Label>
                  <p className="text-xs text-muted-foreground">
                    HTML에서 요소를 클릭하면 제외 목록에 추가됩니다.
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

      {/* HTML Viewer */}
      <Card className="overflow-hidden flex flex-col">
        <CardHeader className="flex-shrink-0 py-2">
          <CardTitle>{t.rssEverything.preview}</CardTitle>
          <CardDescription>
            {detailHtml
              ? (activeDetailField === 'exclude'
                  ? <span className="text-destructive">클릭하여 제외할 요소 선택</span>
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
