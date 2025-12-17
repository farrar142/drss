'use client';

import { Plus, Trash2, HelpCircle } from 'lucide-react';
import { Button } from '@/ui/button';
import { Input } from '@/ui/input';
import { Label } from '@/ui/label';
import { Tooltip } from '@/ui/tooltip';

interface ExcludeSelectorsProps {
  excludeSelectors: string[];
  onExcludeSelectorsChange: (selectors: string[]) => void;
}

export function ExcludeSelectors({
  excludeSelectors,
  onExcludeSelectorsChange,
}: ExcludeSelectorsProps) {
  const handleAddSelector = () => {
    onExcludeSelectorsChange([...excludeSelectors, '']);
  };

  const handleRemoveSelector = (index: number) => {
    const newSelectors = excludeSelectors.filter((_, i) => i !== index);
    onExcludeSelectorsChange(newSelectors);
  };

  const handleSelectorChange = (index: number, value: string) => {
    const newSelectors = [...excludeSelectors];
    newSelectors[index] = value;
    onExcludeSelectorsChange(newSelectors);
  };

  return (
    <div className="space-y-3 border rounded-lg p-3 bg-muted/30">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Label className="text-sm font-medium">Exclude Selectors</Label>
          <Tooltip
            content={
              <span className="whitespace-pre-wrap text-left text-xs">{`제외할 요소의 CSS 셀렉터:
광고, 사이드바, 스크립트 등
콘텐츠에서 제외하고 싶은
요소들을 지정합니다.

예: .ads, .sidebar
예: script, style
예: .related-posts`}</span>
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
          onClick={handleAddSelector}
        >
          <Plus className="h-3 w-3 mr-1" />
          Add
        </Button>
      </div>

      {/* 셀렉터 목록 */}
      {excludeSelectors.length > 0 && (
        <div className="space-y-2">
          {excludeSelectors.map((selector, index) => (
            <div key={index} className="flex gap-2 items-center">
              <Input
                placeholder=".ads, script, .sidebar"
                value={selector}
                onChange={(e) => handleSelectorChange(index, e.target.value)}
                className="flex-1 font-mono text-sm h-8"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => handleRemoveSelector(index)}
              >
                <Trash2 className="h-3 w-3 text-destructive" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {excludeSelectors.length === 0 && (
        <p className="text-xs text-muted-foreground">
          Add CSS selectors to exclude unwanted elements (ads, sidebars, scripts, etc.)
        </p>
      )}
    </div>
  );
}
