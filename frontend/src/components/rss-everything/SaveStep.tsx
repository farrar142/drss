'use client';

import { Loader2, Save, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/ui/button';
import { Input } from '@/ui/input';
import { Label } from '@/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/ui/card';
import { CategorySchema } from '@/services/api';
import { useTranslation } from '@/stores/languageStore';

interface SaveStepProps {
  name: string;
  selectedCategoryId: number | null;
  refreshInterval: number;
  customHeaders: Record<string, string>;
  categories: CategorySchema[];
  isSaving: boolean;
  onNameChange: (name: string) => void;
  onCategoryChange: (categoryId: number | null) => void;
  onRefreshIntervalChange: (interval: number) => void;
  onCustomHeadersChange: (headers: Record<string, string>) => void;
  onBack: () => void;
  onSave: () => void;
}

export function SaveStep({
  name,
  selectedCategoryId,
  refreshInterval,
  customHeaders,
  categories,
  isSaving,
  onNameChange,
  onCategoryChange,
  onRefreshIntervalChange,
  onCustomHeadersChange,
  onBack,
  onSave,
}: SaveStepProps) {
  const { t } = useTranslation();

  const handleAddHeader = () => {
    onCustomHeadersChange({ ...customHeaders, '': '' });
  };

  const handleRemoveHeader = (key: string) => {
    const newHeaders = { ...customHeaders };
    delete newHeaders[key];
    onCustomHeadersChange(newHeaders);
  };

  const handleHeaderKeyChange = (oldKey: string, newKey: string) => {
    const newHeaders: Record<string, string> = {};
    for (const [k, v] of Object.entries(customHeaders)) {
      if (k === oldKey) {
        newHeaders[newKey] = v;
      } else {
        newHeaders[k] = v;
      }
    }
    onCustomHeadersChange(newHeaders);
  };

  const handleHeaderValueChange = (key: string, value: string) => {
    onCustomHeadersChange({ ...customHeaders, [key]: value });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t.rssEverything.saveFeed}</CardTitle>
        <CardDescription>
          {t.rssEverything.description}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="name">{t.rssEverything.feedName}</Label>
          <Input
            id="name"
            placeholder={t.rssEverything.feedNamePlaceholder}
            value={name}
            onChange={(e) => onNameChange(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="category">{t.rssEverything.selectCategory}</Label>
          <select
            id="category"
            className="w-full px-3 py-2 border rounded-md bg-background"
            value={selectedCategoryId || ''}
            onChange={(e) => onCategoryChange(e.target.value ? Number(e.target.value) : null)}
          >
            <option value="">{t.common.none}</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.name}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="refresh">{t.rssEverything.refreshInterval} ({t.rssEverything.refreshIntervalUnit})</Label>
          <Input
            id="refresh"
            type="number"
            min={5}
            value={refreshInterval}
            onChange={(e) => onRefreshIntervalChange(Number(e.target.value))}
          />
        </div>

        {/* Custom Headers */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>{t.rssEverything?.customHeaders || 'Custom Headers'}</Label>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleAddHeader}
            >
              <Plus className="h-4 w-4 mr-1" />
              {t.common?.add || 'Add'}
            </Button>
          </div>
          {Object.entries(customHeaders).length > 0 && (
            <div className="space-y-2 border rounded-md p-3">
              {Object.entries(customHeaders).map(([key, value], index) => (
                <div key={index} className="flex gap-2 items-center">
                  <Input
                    placeholder="Header name"
                    value={key}
                    onChange={(e) => handleHeaderKeyChange(key, e.target.value)}
                    className="flex-1"
                  />
                  <Input
                    placeholder="Header value"
                    value={value}
                    onChange={(e) => handleHeaderValueChange(key, e.target.value)}
                    className="flex-1"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => handleRemoveHeader(key)}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
          )}
          <p className="text-xs text-muted-foreground">
            {t.rssEverything?.customHeadersDescription || 'Add custom HTTP headers for requests (e.g., User-Agent, Cookie)'}
          </p>
        </div>

        <div className="flex gap-2">
          <Button variant="outline" onClick={onBack}>
            {t.common.cancel}
          </Button>
          <Button
            className="flex-1"
            onClick={onSave}
            disabled={!name || isSaving}
          >
            {isSaving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {t.rssEverything.saving}
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                {t.common.save}
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
