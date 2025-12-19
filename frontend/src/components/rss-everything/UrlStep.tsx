'use client';

import { Loader2, ArrowRight, Plus, Trash2, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/ui/button';
import { Input } from '@/ui/input';
import { Label } from '@/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/ui/card';
import { Switch } from '@/ui/switch';
import { RadioGroup, RadioGroupItem } from '@/ui/radio-group';
import { ParseMode } from '@/hooks/rss-everything/useRSSEverything';
import { useTranslation } from '@/stores/languageStore';
import { useState } from 'react';

interface UrlStepProps {
  url: string;
  useBrowser: boolean;
  waitSelector: string;
  parseMode: ParseMode;
  isLoading: boolean;
  customHeaders: Record<string, string>;
  onUrlChange: (url: string) => void;
  onUseBrowserChange: (value: boolean) => void;
  onWaitSelectorChange: (value: string) => void;
  onParseModeChange: (mode: ParseMode) => void;
  onCustomHeadersChange: (headers: Record<string, string>) => void;
  onFetch: () => void;
}

export function UrlStep({
  url,
  useBrowser,
  waitSelector,
  parseMode,
  isLoading,
  customHeaders,
  onUrlChange,
  onUseBrowserChange,
  onWaitSelectorChange,
  onParseModeChange,
  onCustomHeadersChange,
  onFetch,
}: UrlStepProps) {
  const { t } = useTranslation();
  const [showHeaders, setShowHeaders] = useState(Object.keys(customHeaders).length > 0);

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
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>{t.rssEverything.urlLabel}</CardTitle>
          <CardDescription>
            {t.rssEverything.description}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="url">{t.rssEverything.urlLabel}</Label>
            <Input
              id="url"
              type="url"
              placeholder={t.rssEverything.urlPlaceholder}
              value={url}
              onChange={(e) => onUrlChange(e.target.value)}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="use-browser">{t.rssEverything.useBrowser}</Label>
              <p className="text-sm text-muted-foreground">
                {t.rssEverything.useBrowserDesc}
              </p>
            </div>
            <Switch
              id="use-browser"
              checked={useBrowser}
              onCheckedChange={onUseBrowserChange}
            />
          </div>

          {useBrowser && (
            <div className="space-y-2">
              <Label htmlFor="wait-selector">{t.rssEverything.selectElement}</Label>
              <Input
                id="wait-selector"
                placeholder="body"
                value={waitSelector}
                onChange={(e) => onWaitSelectorChange(e.target.value)}
              />
              <p className="text-sm text-muted-foreground">
                CSS selector to wait for before capturing HTML
              </p>
            </div>
          )}

          {/* Custom Headers */}
          <div className="space-y-2">
            <button
              type="button"
              className="flex items-center gap-2 text-sm font-medium hover:text-primary transition-colors"
              onClick={() => setShowHeaders(!showHeaders)}
            >
              {showHeaders ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
              {t.rssEverything?.customHeaders || 'Custom Headers'}
              {Object.keys(customHeaders).length > 0 && (
                <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                  {Object.keys(customHeaders).length}
                </span>
              )}
            </button>

            {showHeaders && (
              <div className="space-y-3 border rounded-md p-3 bg-muted/30">
                <p className="text-xs text-muted-foreground">
                  {t.rssEverything?.customHeadersDescription || 'Add custom HTTP headers for requests (e.g., User-Agent, Cookie, Authorization)'}
                </p>

                {Object.entries(customHeaders).map(([key, value], index) => (
                  <div key={index} className="flex gap-2 items-center">
                    <Input
                      placeholder="Header name (e.g., Cookie)"
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

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleAddHeader}
                  className="w-full"
                >
                  <Plus className="h-4 w-4 mr-1" />
                  {t.common?.add || 'Add Header'}
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t.rssEverything.parseMode}</CardTitle>
          <CardDescription>
            {t.rssEverything.description}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <RadioGroup value={parseMode} onValueChange={(v) => onParseModeChange(v as ParseMode)}>
            <div
              className="flex items-start space-x-3 p-4 rounded-lg border hover:bg-muted/50 cursor-pointer"
              onClick={() => onParseModeChange('list')}
            >
              <RadioGroupItem value="list" id="mode-list" className="mt-1" />
              <div className="flex-1">
                <Label htmlFor="mode-list" className="font-medium cursor-pointer">
                  {t.rssEverything.parseModeList}
                </Label>
                <p className="text-sm text-muted-foreground mt-1">
                  {t.rssEverything.parseModeListDesc}
                </p>
                <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                  <span className="px-2 py-1 bg-muted rounded">{t.rssEverything.step2}</span>
                  <ArrowRight className="h-3 w-3" />
                  <span className="px-2 py-1 bg-primary/10 text-primary rounded">{t.rssEverything.previewItems}</span>
                </div>
              </div>
            </div>

            <div
              className="flex items-start space-x-3 p-4 rounded-lg border hover:bg-muted/50 cursor-pointer mt-3"
              onClick={() => onParseModeChange('detail')}
            >
              <RadioGroupItem value="detail" id="mode-detail" className="mt-1" />
              <div className="flex-1">
                <Label htmlFor="mode-detail" className="font-medium cursor-pointer">
                  {t.rssEverything.parseModeDetail}
                </Label>
                <p className="text-sm text-muted-foreground mt-1">
                  {t.rssEverything.parseModeDetailDesc}
                </p>
                <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                  <span className="px-2 py-1 bg-muted rounded">{t.rssEverything.step2}</span>
                  <ArrowRight className="h-3 w-3" />
                  <span className="px-2 py-1 bg-muted rounded">{t.rssEverything.linkSelector}</span>
                  <ArrowRight className="h-3 w-3" />
                  <span className="px-2 py-1 bg-muted rounded">{t.rssEverything.step3}</span>
                  <ArrowRight className="h-3 w-3" />
                  <span className="px-2 py-1 bg-primary/10 text-primary rounded">{t.rssEverything.contentSelector}</span>
                </div>
              </div>
            </div>
          </RadioGroup>
        </CardContent>
      </Card>

      <Button
        className="w-full"
        onClick={onFetch}
        disabled={!url || isLoading}
      >
        {isLoading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            {t.rssEverything.fetching}
          </>
        ) : (
          t.rssEverything.fetchPage
        )}
      </Button>
    </div>
  );
}
