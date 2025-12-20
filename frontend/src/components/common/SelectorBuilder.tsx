'use client';

import { useState } from 'react';
import { Input } from '@/ui/input';
import { Label } from '@/ui/label';
import { Button } from '@/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/ui/card';
import { Badge } from '@/ui/badge';
import { Tooltip } from '@/ui/tooltip';
import { CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { useTranslation } from '@/stores/languageStore';
import { Translations } from '@/i18n/types';

export interface ListSelectors {
  itemSelector: string;
  titleSelector: string;
  linkSelector: string;
  descriptionSelector: string;
  dateSelector: string;
  imageSelector: string;
  authorSelector: string;
  categoriesSelector: string;
}

export interface DetailSelectors {
  detailTitleSelector: string;
  detailDescriptionSelector: string;
  detailContentSelector: string;
  detailDateSelector: string;
  detailImageSelector: string;
  detailAuthorSelector: string;
  detailCategoriesSelector: string;
}

interface SelectorResult {
  count: number;
  samples: string[];
}

interface SelectorBuilderProps {
  mode: 'list' | 'detail';
  listSelectors?: ListSelectors;
  detailSelectors?: DetailSelectors;
  onListSelectorsChange?: (selectors: ListSelectors) => void;
  onDetailSelectorsChange?: (selectors: DetailSelectors) => void;
  onTestSelector?: (selector: string) => Promise<SelectorResult>;
  isLoading?: boolean;
}

interface SelectorFieldConfig {
  key: string;
  labelKey: keyof Translations['selector'];
  descKey: keyof Translations['selector'];
  placeholder: string;
  required?: boolean;
}

const LIST_SELECTOR_FIELDS: SelectorFieldConfig[] = [
  {
    key: 'itemSelector',
    labelKey: 'itemSelector',
    descKey: 'itemSelectorDesc',
    placeholder: '.post-item, article, tr.list-row',
    required: true,
  },
  {
    key: 'titleSelector',
    labelKey: 'titleSelector',
    descKey: 'titleSelectorDesc',
    placeholder: '.title, h2 a, .subject',
  },
  {
    key: 'linkSelector',
    labelKey: 'linkSelector',
    descKey: 'linkSelectorDesc',
    placeholder: 'a, .title a, a.link',
  },
  {
    key: 'descriptionSelector',
    labelKey: 'descriptionSelector',
    descKey: 'descriptionSelectorDesc',
    placeholder: '.summary, .excerpt, p.description',
  },
  {
    key: 'dateSelector',
    labelKey: 'dateSelector',
    descKey: 'dateSelectorDesc',
    placeholder: '.date, time, .timestamp',
  },
  {
    key: 'imageSelector',
    labelKey: 'imageSelector',
    descKey: 'imageSelectorDesc',
    placeholder: 'img, .thumbnail img, .cover',
  },
];

const DETAIL_SELECTOR_FIELDS: SelectorFieldConfig[] = [
  {
    key: 'detailTitleSelector',
    labelKey: 'detailTitleSelector',
    descKey: 'detailTitleSelectorDesc',
    placeholder: 'h1, .article-title, .post-title',
  },
  {
    key: 'detailDescriptionSelector',
    labelKey: 'detailDescriptionSelector',
    descKey: 'detailDescriptionSelectorDesc',
    placeholder: '.summary, .excerpt, meta[name="description"]',
  },
  {
    key: 'detailContentSelector',
    labelKey: 'contentSelector',
    descKey: 'contentSelectorDesc',
    placeholder: '.article-content, .post-body, #content',
    required: true,
  },
  {
    key: 'detailDateSelector',
    labelKey: 'detailDateSelector',
    descKey: 'detailDateSelectorDesc',
    placeholder: '.date, time, .published-at',
  },
  {
    key: 'detailImageSelector',
    labelKey: 'detailImageSelector',
    descKey: 'detailImageSelectorDesc',
    placeholder: '.featured-image img, .hero-image, .thumbnail',
  },
];

export default function SelectorBuilder({
  mode,
  listSelectors,
  detailSelectors,
  onListSelectorsChange,
  onDetailSelectorsChange,
  onTestSelector,
  isLoading = false,
}: SelectorBuilderProps) {
  const { t } = useTranslation();
  const [testResults, setTestResults] = useState<Record<string, SelectorResult>>({});
  const [testingKey, setTestingKey] = useState<string | null>(null);

  const fields = mode === 'list' ? LIST_SELECTOR_FIELDS : DETAIL_SELECTOR_FIELDS;
  const selectors = mode === 'list' ? listSelectors : detailSelectors;

  const handleChange = (key: string, value: string) => {
    if (mode === 'list' && listSelectors && onListSelectorsChange) {
      onListSelectorsChange({
        ...listSelectors,
        [key]: value,
      });
    } else if (mode === 'detail' && detailSelectors && onDetailSelectorsChange) {
      onDetailSelectorsChange({
        ...detailSelectors,
        [key]: value,
      });
    }
  };

  const handleTestSelector = async (key: string, selector: string) => {
    if (!selector.trim() || !onTestSelector) return;

    setTestingKey(key);
    try {
      const result = await onTestSelector(selector);
      setTestResults(prev => ({
        ...prev,
        [key]: result,
      }));
    } catch {
      setTestResults(prev => ({
        ...prev,
        [key]: { count: 0, samples: [] },
      }));
    } finally {
      setTestingKey(null);
    }
  };

  const getValue = (key: string): string => {
    if (!selectors) return '';
    return (selectors as unknown as Record<string, string>)[key] || '';
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {mode === 'list' ? t.selector.listPageSelectors : t.selector.detailPageSelectors}
          <Badge variant={mode === 'list' ? 'default' : 'secondary'}>
            {mode === 'list' ? t.selector.step2 : t.selector.step3}
          </Badge>
        </CardTitle>
        <CardDescription>
          {mode === 'list'
            ? t.selector.listPageSelectorsDesc
            : t.selector.detailPageSelectorsDesc}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {fields.map((field) => {
          const value = getValue(field.key);
          const testResult = testResults[field.key];
          const isTesting = testingKey === field.key;

          return (
            <div key={field.key} className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Label htmlFor={field.key} className="font-medium">
                    {t.selector[field.labelKey]}
                    {field.required && <span className="text-destructive ml-1">*</span>}
                  </Label>
                  <Tooltip content={t.selector[field.descKey]}>
                    <span className="text-muted-foreground text-xs cursor-help">(?)</span>
                  </Tooltip>
                </div>
                {testResult && (
                  <div className="flex items-center gap-1">
                    {testResult.count > 0 ? (
                      <CheckCircle className="h-4 w-4 text-green-500" />
                    ) : (
                      <XCircle className="h-4 w-4 text-red-500" />
                    )}
                    <span className="text-sm text-muted-foreground">
                      {t.selector.foundCount.replace('{count}', String(testResult.count))}
                    </span>
                  </div>
                )}
              </div>
              <div className="flex gap-2">
                <Input
                  id={field.key}
                  value={value}
                  onChange={(e) => handleChange(field.key, e.target.value)}
                  placeholder={field.placeholder}
                  disabled={isLoading}
                  className="font-mono text-sm"
                />
                {onTestSelector && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => handleTestSelector(field.key, value)}
                    disabled={!value.trim() || isLoading || isTesting}
                  >
                    {isTesting ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      t.selector.testSelector
                    )}
                  </Button>
                )}
              </div>
              {testResult && testResult.samples.length > 0 && (
                <div className="text-xs text-muted-foreground bg-muted p-2 rounded max-h-20 overflow-y-auto">
                  <p className="font-medium mb-1">{t.selector.sample}:</p>
                  {testResult.samples.slice(0, 3).map((sample, i) => (
                    <p key={i} className="truncate">
                      {i + 1}. {sample}
                    </p>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
