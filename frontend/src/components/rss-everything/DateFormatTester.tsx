'use client';

import { useState, useMemo, useEffect } from 'react';
import { Plus, Trash2, HelpCircle, CheckCircle2, XCircle } from 'lucide-react';
import { Button } from '@/ui/button';
import { Input } from '@/ui/input';
import { Label } from '@/ui/label';
import { Tooltip } from '@/ui/tooltip';

interface DateFormatTesterProps {
  dateFormats: string[];
  onDateFormatsChange: (formats: string[]) => void;
  sampleDateText?: string;
  html?: string;
  dateSelector?: string;
}

// Python strftime 포맷을 JavaScript로 변환
function convertPythonToJsFormat(pythonFormat: string): string {
  const replacements: Record<string, string> = {
    '%Y': 'yyyy',
    '%y': 'yy',
    '%m': 'MM',
    '%d': 'dd',
    '%H': 'HH',
    '%I': 'hh',
    '%M': 'mm',
    '%S': 'ss',
    '%p': 'a',
    '%B': 'MMMM',
    '%b': 'MMM',
    '%A': 'EEEE',
    '%a': 'EEE',
  };

  let result = pythonFormat;
  for (const [py, js] of Object.entries(replacements)) {
    result = result.replace(new RegExp(py, 'g'), js);
  }
  return result;
}

// 간단한 날짜 파싱 테스트 (클라이언트 사이드)
function testDateFormat(dateText: string, format: string): { success: boolean; result?: string; error?: string } {
  if (!dateText || !format) {
    return { success: false, error: 'Empty input' };
  }

  try {
    // Python strftime 포맷에서 날짜 추출 시도
    const regex = format
      .replace(/%Y/g, '(\\d{4})')
      .replace(/%y/g, '(\\d{2})')
      .replace(/%m/g, '(\\d{1,2})')
      .replace(/%d/g, '(\\d{1,2})')
      .replace(/%H/g, '(\\d{1,2})')
      .replace(/%I/g, '(\\d{1,2})')
      .replace(/%M/g, '(\\d{1,2})')
      .replace(/%S/g, '(\\d{1,2})')
      .replace(/%p/g, '(AM|PM|am|pm)')
      .replace(/\./g, '\\.')
      .replace(/\(/g, '\\(')
      .replace(/\)/g, '\\)')
      .replace(/\s+/g, '\\s*');

    const match = dateText.match(new RegExp(regex));
    if (match) {
      // 포맷에서 어떤 순서로 캡처했는지 파악
      const formatParts = format.match(/%[YymdHIMSp]/g) || [];
      const values: Record<string, number> = {
        year: new Date().getFullYear(),
        month: 1,
        day: 1,
        hour: 0,
        minute: 0,
        second: 0,
      };

      formatParts.forEach((part, idx) => {
        const val = parseInt(match[idx + 1], 10);
        switch (part) {
          case '%Y': values.year = val; break;
          case '%y': values.year = 2000 + val; break;
          case '%m': values.month = val; break;
          case '%d': values.day = val; break;
          case '%H': case '%I': values.hour = val; break;
          case '%M': values.minute = val; break;
          case '%S': values.second = val; break;
        }
      });

      const date = new Date(values.year, values.month - 1, values.day, values.hour, values.minute, values.second);
      if (!isNaN(date.getTime())) {
        return {
          success: true,
          result: date.toLocaleString('ko-KR', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
          }),
        };
      }
    }

    return { success: false, error: 'Format mismatch' };
  } catch {
    return { success: false, error: 'Parse error' };
  }
}

// HTML에서 날짜 텍스트 추출
function extractDateFromHtml(html: string, selector: string): string | null {
  if (!html || !selector) return null;

  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const el = doc.querySelector(selector);
    if (el) {
      // datetime 속성 먼저 확인
      const datetime = el.getAttribute('datetime');
      if (datetime) return datetime;
      return el.textContent?.trim() || null;
    }
  } catch {
    // ignore
  }
  return null;
}

export function DateFormatTester({
  dateFormats,
  onDateFormatsChange,
  sampleDateText: propSampleText,
  html,
  dateSelector,
}: DateFormatTesterProps) {
  const [testInput, setTestInput] = useState('');

  // HTML에서 샘플 날짜 추출
  const extractedDate = useMemo(() => {
    if (html && dateSelector) {
      return extractDateFromHtml(html, dateSelector);
    }
    return null;
  }, [html, dateSelector]);

  // extractedDate가 있으면 testInput 기본값으로 설정
  useEffect(() => {
    if (extractedDate && !testInput) {
      setTestInput(extractedDate);
    }
  }, [extractedDate]);

  const sampleDateText = propSampleText || testInput || extractedDate;

  const handleAddFormat = () => {
    onDateFormatsChange([...dateFormats, '']);
  };

  const handleRemoveFormat = (index: number) => {
    const newFormats = dateFormats.filter((_, i) => i !== index);
    onDateFormatsChange(newFormats);
  };

  const handleFormatChange = (index: number, value: string) => {
    const newFormats = [...dateFormats];
    newFormats[index] = value;
    onDateFormatsChange(newFormats);
  };

  // 각 포맷의 테스트 결과
  const testResults = useMemo(() => {
    if (!sampleDateText) return [];
    return dateFormats.map(format => testDateFormat(sampleDateText, format));
  }, [dateFormats, sampleDateText]);

  return (
    <div className="space-y-3 border rounded-lg p-3 bg-muted/30">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Label className="text-sm font-medium">Date Formats</Label>
          <Tooltip
            content={
              <span className="whitespace-pre-wrap text-left text-xs">{`Python strftime 포맷 코드:
%Y - 연도 4자리 (2024)
%m - 월 (01-12)
%d - 일 (01-31)
%H - 시 24h (00-23)
%I - 시 12h (01-12)
%M - 분 (00-59)
%S - 초 (00-59)
%p - AM/PM

예: %Y. %m. %d (%H:%M:%S)
예: %Y-%m-%d %H:%M`}</span>
            }
            side="right"
          >
            <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
          </Tooltip>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleAddFormat}
        >
          <Plus className="h-3 w-3 mr-1" />
          Add
        </Button>
      </div>

      {/* 샘플 날짜 표시 */}
      {(extractedDate || dateFormats.length > 0) && (
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Sample date text</Label>
          <Input
            placeholder="Enter sample date text to test..."
            value={testInput}
            onChange={(e) => setTestInput(e.target.value)}
            className="text-sm font-mono h-8"
          />
        </div>
      )}

      {/* 포맷 목록 */}
      {dateFormats.length > 0 && (
        <div className="space-y-2">
          {dateFormats.map((format, index) => {
            const result = testResults[index];
            return (
              <div key={index} className="flex gap-2 items-center">
                <div className="flex-1 flex gap-2 items-center">
                  <Input
                    placeholder="%Y. %m. %d (%H:%M:%S)"
                    value={format}
                    onChange={(e) => handleFormatChange(index, e.target.value)}
                    className="flex-1 font-mono text-sm h-8"
                  />
                  {sampleDateText && format && (
                    result?.success ? (
                      <div className="flex items-center gap-1 text-xs text-green-600">
                        <CheckCircle2 className="h-3 w-3" />
                        <span className="hidden sm:inline">{result.result}</span>
                      </div>
                    ) : (
                      <XCircle className="h-4 w-4 text-muted-foreground" />
                    )
                  )}
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => handleRemoveFormat(index)}
                >
                  <Trash2 className="h-3 w-3 text-destructive" />
                </Button>
              </div>
            );
          })}
        </div>
      )}

      {dateFormats.length === 0 && (
        <p className="text-xs text-muted-foreground">
          Add date format patterns to parse dates. Multiple formats will be tried in order.
        </p>
      )}
    </div>
  );
}
