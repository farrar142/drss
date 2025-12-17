'use client';

import { useState } from 'react';
import { Input } from '@/ui/input';
import { Label } from '@/ui/label';
import { Button } from '@/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/ui/card';
import { Badge } from '@/ui/badge';
import { Tooltip } from '@/ui/tooltip';
import { CheckCircle, XCircle, Loader2 } from 'lucide-react';

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
  label: string;
  placeholder: string;
  description: string;
  required?: boolean;
}

const LIST_SELECTOR_FIELDS: SelectorFieldConfig[] = [
  {
    key: 'itemSelector',
    label: '아이템 셀렉터',
    placeholder: '.post-item, article, tr.list-row',
    description: '각 게시글 아이템을 선택하는 CSS 셀렉터 (필수)',
    required: true,
  },
  {
    key: 'titleSelector',
    label: '제목 셀렉터',
    placeholder: '.title, h2 a, .subject',
    description: '아이템 내에서 제목을 선택하는 셀렉터',
  },
  {
    key: 'linkSelector',
    label: '링크 셀렉터',
    placeholder: 'a, .title a, a.link',
    description: '아이템 내에서 링크를 선택하는 셀렉터 (href 속성 추출)',
  },
  {
    key: 'descriptionSelector',
    label: '설명 셀렉터',
    placeholder: '.summary, .excerpt, p.description',
    description: '아이템 내에서 요약/설명을 선택하는 셀렉터',
  },
  {
    key: 'dateSelector',
    label: '날짜 셀렉터',
    placeholder: '.date, time, .timestamp',
    description: '아이템 내에서 날짜를 선택하는 셀렉터',
  },
  {
    key: 'imageSelector',
    label: '이미지 셀렉터',
    placeholder: 'img, .thumbnail img, .cover',
    description: '아이템 내에서 이미지를 선택하는 셀렉터 (src 속성 추출)',
  },
];

const DETAIL_SELECTOR_FIELDS: SelectorFieldConfig[] = [
  {
    key: 'detailTitleSelector',
    label: '제목 셀렉터',
    placeholder: 'h1, .article-title, .post-title',
    description: '상세 페이지에서 제목을 선택하는 CSS 셀렉터',
  },
  {
    key: 'detailDescriptionSelector',
    label: '설명 셀렉터',
    placeholder: '.summary, .excerpt, meta[name="description"]',
    description: '상세 페이지에서 요약/설명을 선택하는 셀렉터',
  },
  {
    key: 'detailContentSelector',
    label: '본문 셀렉터',
    placeholder: '.article-content, .post-body, #content',
    description: '상세 페이지에서 본문 내용을 선택하는 셀렉터 (필수)',
    required: true,
  },
  {
    key: 'detailDateSelector',
    label: '날짜 셀렉터',
    placeholder: '.date, time, .published-at',
    description: '상세 페이지에서 날짜를 선택하는 셀렉터',
  },
  {
    key: 'detailImageSelector',
    label: '이미지 셀렉터',
    placeholder: '.featured-image img, .hero-image, .thumbnail',
    description: '상세 페이지에서 대표 이미지를 선택하는 셀렉터',
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
          {mode === 'list' ? '목록 페이지 셀렉터' : '상세 페이지 셀렉터'}
          <Badge variant={mode === 'list' ? 'default' : 'secondary'}>
            {mode === 'list' ? 'Step 2' : 'Step 3'}
          </Badge>
        </CardTitle>
        <CardDescription>
          {mode === 'list'
            ? 'HTML에서 각 아이템을 추출하기 위한 CSS 셀렉터를 설정합니다.'
            : '상세 페이지에서 콘텐츠를 추출하기 위한 CSS 셀렉터를 설정합니다.'}
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
                    {field.label}
                    {field.required && <span className="text-destructive ml-1">*</span>}
                  </Label>
                  <Tooltip content={field.description}>
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
                      {testResult.count}개 발견
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
                      '테스트'
                    )}
                  </Button>
                )}
              </div>
              {testResult && testResult.samples.length > 0 && (
                <div className="text-xs text-muted-foreground bg-muted p-2 rounded max-h-20 overflow-y-auto">
                  <p className="font-medium mb-1">샘플:</p>
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
