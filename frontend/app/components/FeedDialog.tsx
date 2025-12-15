'use client';

import React, { useEffect, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { feedsRoutersFeedValidateFeed } from '../services/api';

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
  title = '피드',
  submitLabel = '저장',
  onSubmit,
}) => {
  const [url, setUrl] = useState(initial.url ?? '');
  const [feedTitle, setFeedTitle] = useState(initial.title ?? '');
  const [description, setDescription] = useState(initial.description ?? '');
  const [faviconUrl, setFaviconUrl] = useState((initial as any).favicon_url ?? '');
  const [visible, setVisible] = useState(initial.visible ?? true);
  const [headerEntries, setHeaderEntries] = useState<HeaderEntry[]>(headersToEntries(initial.custom_headers));
  const [refreshInterval, setRefreshInterval] = useState(initial.refresh_interval ?? 5);

  const [validating, setValidating] = useState(false);
  const [validationResult, setValidationResult] = useState<{ title: string; description: string; items_count: number; latest_item_date?: string } | null>(null);
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
      alert('URL을 입력하세요.');
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
      alert('피드 검증 실패: ' + ((error as any)?.message || '알 수 없는 오류'));
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
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            피드 정보를 입력하고 검증하세요.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="feed-url">URL</Label>
            <div className="flex gap-2">
              <Input id="feed-url" value={url} onChange={(e) => setUrl(e.target.value)} autoFocus />
              <Button variant="outline" onClick={handleValidate} disabled={validating} className="shrink-0">
                {validating ? (
                  <>
                    <svg className="w-4 h-4 mr-2 animate-spin" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" strokeLinecap="round" /></svg>
                    검증 중
                  </>
                ) : '검증'}
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>커스텀 헤더</Label>
              <Button type="button" variant="outline" size="sm" onClick={addHeaderEntry} className="h-7 px-2">
                <Plus className="w-3 h-3 mr-1" /> 추가
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
              <p className="text-xs text-muted-foreground">헤더가 없습니다. 추가 버튼을 눌러 헤더를 추가하세요.</p>
            )}
          </div>

          {validationResult && (
            <div className="p-3 rounded-lg bg-accent/50 border border-border space-y-1">
              <p className="text-sm font-semibold text-foreground">검증 결과</p>
              <p className="text-sm text-muted-foreground">제목: {validationResult.title}</p>
              <p className="text-sm text-muted-foreground">설명: {validationResult.description}</p>
              <p className="text-sm text-muted-foreground">아이템 수: {validationResult.items_count}</p>
              {validationResult.latest_item_date && (
                <p className="text-sm text-muted-foreground">최신 아이템 날짜: {validationResult.latest_item_date}</p>
              )}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="feed-title">제목</Label>
            <Input id="feed-title" value={feedTitle} onChange={(e) => setFeedTitle(e.target.value)} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="feed-description">설명</Label>
            <Input id="feed-description" value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="feed-favicon">Favicon URL</Label>
            <Input id="feed-favicon" placeholder="https://example.com/favicon.ico" value={faviconUrl} onChange={(e) => setFaviconUrl(e.target.value)} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="feed-refresh">새로고침 간격 (분)</Label>
            <Input id="feed-refresh" type="number" min={1} value={refreshInterval} onChange={(e) => setRefreshInterval(Number(e.target.value))} />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="feed-visible">표시</Label>
              <p className="text-xs text-muted-foreground">
                끄면 메인/카테고리 화면에서 글이 보이지 않습니다
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
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={submitting}>취소</Button>
          <Button onClick={handleSubmit} disabled={submitting}>{submitting ? '저장 중...' : submitLabel}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default FeedDialog;
