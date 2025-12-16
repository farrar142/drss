'use client';

import React, { useEffect, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { feedsRoutersFeedValidateFeed, FeedValidationResponse } from '../services/api';
import { useTranslation } from '../stores/languageStore';

interface HeaderEntry {
  key: string;
  value: string;
}

interface FeedPayload {
  url: string;
  title?: string;
  description?: string;
  visible?: boolean;
  custom_headers?: Record<string, unknown>;
  refresh_interval?: number;
  favicon_url?: string;
}

interface FeedDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial?: Partial<FeedPayload>;
  title?: string;
  submitLabel?: string;
  onSubmit: (payload: FeedPayload) => Promise<any>;
}

// Record를 HeaderEntry 배열로 변환
const headersToEntries = (headers: Record<string, unknown> | undefined): HeaderEntry[] => {
  if (!headers || typeof headers !== 'object') return [];
  return Object.entries(headers).map(([key, value]) => ({
    key,
    value: String(value ?? ''),
  }));
};

// HeaderEntry 배열을 Record로 변환
const entriesToHeaders = (entries: HeaderEntry[]): Record<string, string> | undefined => {
  const filtered = entries.filter(e => e.key.trim());
  if (filtered.length === 0) return undefined;
  return filtered.reduce((acc, { key, value }) => {
    acc[key.trim()] = value;
    return acc;
  }, {} as Record<string, string>);
};

interface FeedDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial?: Partial<FeedPayload>;
  title?: string;
  submitLabel?: string;
  onSubmit: (payload: FeedPayload) => Promise<any>;
}

export const FeedDialog: React.FC<FeedDialogProps> = ({
  open,
  onOpenChange,
  initial = {},
  title,
  submitLabel,
  onSubmit,
}) => {
  const { t } = useTranslation();
  const dialogTitle = title ?? t.nav.feeds;
  const dialogSubmitLabel = submitLabel ?? t.common.save;

  const [url, setUrl] = useState(initial.url ?? '');
  const [feedTitle, setFeedTitle] = useState(initial.title ?? '');
  const [description, setDescription] = useState(initial.description ?? '');
  const [faviconUrl, setFaviconUrl] = useState((initial as any).favicon_url ?? '');
  const [visible, setVisible] = useState(initial.visible ?? true);
  const [headerEntries, setHeaderEntries] = useState<HeaderEntry[]>(headersToEntries(initial.custom_headers));
  const [refreshInterval, setRefreshInterval] = useState(initial.refresh_interval ?? 5);

  const [validating, setValidating] = useState(false);
  const [validationResult, setValidationResult] = useState<FeedValidationResponse | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setUrl(initial.url ?? '');
      setFeedTitle(initial.title ?? '');
      setDescription(initial.description ?? '');
      setFaviconUrl((initial as any).favicon_url ?? '');
      setVisible(initial.visible ?? true);
      setHeaderEntries(headersToEntries(initial.custom_headers));
      setRefreshInterval(initial.refresh_interval ?? 5);
      setValidationResult(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const addHeaderEntry = () => {
    setHeaderEntries([...headerEntries, { key: '', value: '' }]);
  };

  const updateHeaderEntry = (index: number, field: 'key' | 'value', value: string) => {
    const newEntries = [...headerEntries];
    newEntries[index][field] = value;
    setHeaderEntries(newEntries);
  };

  const removeHeaderEntry = (index: number) => {
    setHeaderEntries(headerEntries.filter((_, i) => i !== index));
  };

  const handleValidate = async () => {
    if (!url.trim()) {
      alert(t.feed.enterUrl);
      return;
    }
    setValidating(true);
    try {
      const parsedHeaders = entriesToHeaders(headerEntries);
      const result = await feedsRoutersFeedValidateFeed({ url, custom_headers: parsedHeaders });
      setValidationResult(result);
      if (!feedTitle && result.title) setFeedTitle(result.title);
      if (!description && result.description) setDescription(result.description);
    } catch (error) {
      console.error(error);
      alert(t.feed.validationFailed + ': ' + ((error as any)?.message || t.errors.unknownError));
      setValidationResult(null);
    } finally {
      setValidating(false);
    }
  };

  const handleSubmit = async () => {
    try {
      setSubmitting(true);
      const parsedHeaders = entriesToHeaders(headerEntries);
      const payload: FeedPayload = {
        url,
        title: feedTitle,
        favicon_url: faviconUrl || undefined,
        description,
        visible,
        custom_headers: parsedHeaders,
        refresh_interval: refreshInterval,
      };
      await onSubmit(payload);
      onOpenChange(false);
    } catch (e) {
      console.error(e);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{dialogTitle}</DialogTitle>
          <DialogDescription>
            {t.feed.enterUrl}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="feed-url">{t.feed.url}</Label>
            <div className="flex gap-2">
              <Input id="feed-url" value={url} onChange={(e) => setUrl(e.target.value)} autoFocus />
              <Button variant="outline" onClick={handleValidate} disabled={validating} className="shrink-0">
                {validating ? (
                  <>
                    <svg className="w-4 h-4 mr-2 animate-spin" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" strokeLinecap="round" /></svg>
                    {t.feed.validating}
                  </>
                ) : t.feed.validate}
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>{t.feed.customHeaders}</Label>
              <Button type="button" variant="outline" size="sm" onClick={addHeaderEntry} className="h-7 px-2">
                <Plus className="w-3 h-3 mr-1" /> {t.feed.addHeader}
              </Button>
            </div>
            {headerEntries.length > 0 ? (
              <div className="space-y-2">
                {headerEntries.map((entry, index) => (
                  <div key={index} className="flex gap-2 items-center">
                    <Input
                      placeholder="Key"
                      value={entry.key}
                      onChange={(e) => updateHeaderEntry(index, 'key', e.target.value)}
                      className="flex-1"
                    />
                    <span className="text-muted-foreground">:</span>
                    <Input
                      placeholder="Value"
                      value={entry.value}
                      onChange={(e) => updateHeaderEntry(index, 'value', e.target.value)}
                      className="flex-1"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeHeaderEntry(index)}
                      className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">{t.feed.noHeaders}</p>
            )}
          </div>

          {validationResult && (
            <div className="p-3 rounded-lg bg-accent/50 border border-border space-y-1">
              <p className="text-sm font-semibold text-foreground">{t.feed.validationResult}</p>
              <p className="text-sm text-muted-foreground">{t.feed.title}: {validationResult.title}</p>
              <p className="text-sm text-muted-foreground">{t.feed.description}: {validationResult.description}</p>
              <p className="text-sm text-muted-foreground">{t.feed.itemCount}: {validationResult.items_count}</p>
              {validationResult.latest_item_date && (
                <p className="text-sm text-muted-foreground">{t.feed.latestItemDate}: {validationResult.latest_item_date}</p>
              )}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="feed-title">{t.feed.title}</Label>
            <Input id="feed-title" value={feedTitle} onChange={(e) => setFeedTitle(e.target.value)} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="feed-description">{t.feed.description}</Label>
            <Input id="feed-description" value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="feed-favicon">{t.feed.faviconUrl}</Label>
            <Input id="feed-favicon" placeholder="https://example.com/favicon.ico" value={faviconUrl} onChange={(e) => setFaviconUrl(e.target.value)} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="feed-refresh">{t.feed.refreshInterval} ({t.feed.refreshIntervalUnit})</Label>
            <Input id="feed-refresh" type="number" min={1} value={refreshInterval} onChange={(e) => setRefreshInterval(Number(e.target.value))} />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="feed-visible">{t.feed.visible}</Label>
              <p className="text-xs text-muted-foreground">
                {t.feed.visibleDescription}
              </p>
            </div>
            <Switch
              id="feed-visible"
              checked={visible}
              onCheckedChange={setVisible}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={submitting}>{t.common.cancel}</Button>
          <Button onClick={handleSubmit} disabled={submitting}>{submitting ? `${t.common.save}...` : dialogSubmitLabel}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default FeedDialog;
