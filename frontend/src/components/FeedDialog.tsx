'use client';

import React, { useEffect, useState } from 'react';
import { Plus, Trash2, Globe, Rss, FileText } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/ui/dialog';
import { Label } from '@/ui/label';
import { Input } from '@/ui/input';
import { Button } from '@/ui/button';
import { Switch } from '@/ui/switch';
import { feedsRoutersFeedValidateFeed, FeedValidationResponse } from '../services/api';
import { useTranslation } from '../stores/languageStore';
import { SourceType, RSSSource, RSSSourceCreate } from '../types/rss';

interface HeaderEntry {
  key: string;
  value: string;
}

// 새로운 피드 생성용 Payload
interface FeedCreatePayload {
  category_id?: number;
  title?: string;
  description?: string;
  visible?: boolean;
  refresh_interval?: number;
  source: RSSSourceCreate;
}

// 피드 수정용 Payload (소스 없음)
interface FeedUpdatePayload {
  category_id?: number;
  title?: string;
  description?: string;
  visible?: boolean;
  refresh_interval?: number;
  favicon_url?: string;
}

interface FeedDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: 'create' | 'edit';
  initial?: {
    title?: string;
    description?: string;
    visible?: boolean;
    refresh_interval?: number;
    favicon_url?: string;
    source?: Partial<RSSSource>;
  };
  title?: string;
  submitLabel?: string;
  onSubmit: (payload: FeedCreatePayload | FeedUpdatePayload) => Promise<any>;
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

const SOURCE_TYPE_INFO: Record<SourceType, { icon: React.ReactNode; label: string; description: string }> = {
  rss: {
    icon: <Rss className="w-4 h-4" />,
    label: 'RSS/Atom',
    description: '표준 RSS/Atom 피드',
  },
  page_scraping: {
    icon: <Globe className="w-4 h-4" />,
    label: 'Page Scraping',
    description: '목록 페이지에서 아이템 추출',
  },
  detail_page_scraping: {
    icon: <FileText className="w-4 h-4" />,
    label: 'Detail Page Scraping',
    description: '상세 페이지까지 크롤링',
  },
};

export const FeedDialog: React.FC<FeedDialogProps> = ({
  open,
  onOpenChange,
  mode,
  initial = {},
  title,
  submitLabel,
  onSubmit,
}) => {
  const { t } = useTranslation();
  const dialogTitle = title ?? (mode === 'create' ? t.feed.add : t.feed.edit);
  const dialogSubmitLabel = submitLabel ?? (mode === 'create' ? t.common.add : t.common.save);

  // 피드 기본 정보
  const [feedTitle, setFeedTitle] = useState(initial.title ?? '');
  const [description, setDescription] = useState(initial.description ?? '');
  const [faviconUrl, setFaviconUrl] = useState(initial.favicon_url ?? '');
  const [visible, setVisible] = useState(initial.visible ?? true);
  const [refreshInterval, setRefreshInterval] = useState(initial.refresh_interval ?? 60);

  // 소스 정보 (생성 모드에서만)
  const [sourceType, setSourceType] = useState<SourceType>(
    initial.source?.source_type ?? 'rss'
  );
  const [url, setUrl] = useState(initial.source?.url ?? '');
  const [headerEntries, setHeaderEntries] = useState<HeaderEntry[]>(
    headersToEntries(initial.source?.custom_headers)
  );

  // 스크래핑 설정
  const [itemSelector, setItemSelector] = useState(initial.source?.item_selector ?? '');
  const [titleSelector, setTitleSelector] = useState(initial.source?.title_selector ?? '');
  const [linkSelector, setLinkSelector] = useState(initial.source?.link_selector ?? '');
  const [descriptionSelector, setDescriptionSelector] = useState(initial.source?.description_selector ?? '');
  const [dateSelector, setDateSelector] = useState(initial.source?.date_selector ?? '');
  const [useBrowser, setUseBrowser] = useState(initial.source?.use_browser ?? false);
  const [waitSelector, setWaitSelector] = useState(initial.source?.wait_selector ?? '');

  // 상세 페이지 설정
  const [detailTitleSelector, setDetailTitleSelector] = useState(initial.source?.detail_title_selector ?? '');
  const [detailContentSelector, setDetailContentSelector] = useState(initial.source?.detail_content_selector ?? '');
  const [detailDateSelector, setDetailDateSelector] = useState(initial.source?.detail_date_selector ?? '');

  // 상태
  const [validating, setValidating] = useState(false);
  const [validationResult, setValidationResult] = useState<FeedValidationResponse | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setFeedTitle(initial.title ?? '');
      setDescription(initial.description ?? '');
      setFaviconUrl(initial.favicon_url ?? '');
      setVisible(initial.visible ?? true);
      setRefreshInterval(initial.refresh_interval ?? 60);
      setSourceType(initial.source?.source_type ?? 'rss');
      setUrl(initial.source?.url ?? '');
      setHeaderEntries(headersToEntries(initial.source?.custom_headers));
      setItemSelector(initial.source?.item_selector ?? '');
      setTitleSelector(initial.source?.title_selector ?? '');
      setLinkSelector(initial.source?.link_selector ?? '');
      setDescriptionSelector(initial.source?.description_selector ?? '');
      setDateSelector(initial.source?.date_selector ?? '');
      setUseBrowser(initial.source?.use_browser ?? false);
      setWaitSelector(initial.source?.wait_selector ?? '');
      setDetailTitleSelector(initial.source?.detail_title_selector ?? '');
      setDetailContentSelector(initial.source?.detail_content_selector ?? '');
      setDetailDateSelector(initial.source?.detail_date_selector ?? '');
      setValidationResult(null);
    }
  }, [open, initial]);

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

      if (mode === 'create') {
        const source: RSSSourceCreate = {
          source_type: sourceType,
          url,
          custom_headers: parsedHeaders,
        };

        // 스크래핑 타입이면 셀렉터 정보 추가
        if (sourceType !== 'rss') {
          source.item_selector = itemSelector;
          source.title_selector = titleSelector;
          source.link_selector = linkSelector;
          source.description_selector = descriptionSelector;
          source.date_selector = dateSelector;
          source.use_browser = useBrowser;
          source.wait_selector = waitSelector;

          if (sourceType === 'detail_page_scraping') {
            source.detail_title_selector = detailTitleSelector;
            source.detail_content_selector = detailContentSelector;
            source.detail_date_selector = detailDateSelector;
          }
        }

        const payload: FeedCreatePayload = {
          title: feedTitle,
          description,
          visible,
          refresh_interval: refreshInterval,
          source,
        };
        await onSubmit(payload);
      } else {
        // 수정 모드에서는 피드 정보만
        const payload: FeedUpdatePayload = {
          title: feedTitle,
          description,
          visible,
          refresh_interval: refreshInterval,
          favicon_url: faviconUrl || undefined,
        };
        await onSubmit(payload);
      }
      onOpenChange(false);
    } catch (e) {
      console.error(e);
    } finally {
      setSubmitting(false);
    }
  };

  const isScrapingType = sourceType !== 'rss';
  const isDetailScraping = sourceType === 'detail_page_scraping';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{dialogTitle}</DialogTitle>
          <DialogDescription>
            {mode === 'create' ? '피드 소스 타입을 선택하고 설정을 입력하세요.' : '피드 정보를 수정합니다.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* 소스 타입 선택 (생성 모드에서만) */}
          {mode === 'create' && (
            <div className="space-y-2">
              <Label>소스 타입</Label>
              <div className="grid grid-cols-3 gap-2">
                {(Object.keys(SOURCE_TYPE_INFO) as SourceType[]).map((type) => {
                  const info = SOURCE_TYPE_INFO[type];
                  return (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setSourceType(type)}
                      className={`p-3 rounded-lg border text-left transition-all ${sourceType === type
                          ? 'border-primary bg-primary/10 ring-1 ring-primary'
                          : 'border-border hover:border-primary/50'
                        }`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        {info.icon}
                        <span className="font-medium text-sm">{info.label}</span>
                      </div>
                      <p className="text-xs text-muted-foreground">{info.description}</p>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* URL 입력 (생성 모드에서만) */}
          {mode === 'create' && (
            <div className="space-y-2">
              <Label htmlFor="feed-url">{sourceType === 'rss' ? 'RSS/Atom URL' : '페이지 URL'}</Label>
              <div className="flex gap-2">
                <Input
                  id="feed-url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder={sourceType === 'rss' ? 'https://example.com/feed.xml' : 'https://example.com/news'}
                  autoFocus
                />
                {sourceType === 'rss' && (
                  <Button variant="outline" onClick={handleValidate} disabled={validating} className="shrink-0">
                    {validating ? t.feed.validating : t.feed.validate}
                  </Button>
                )}
              </div>
            </div>
          )}

          {/* Custom Headers (생성 모드에서만) */}
          {mode === 'create' && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Custom Headers</Label>
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
                        className="h-8 w-8 p-0 text-destructive"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">필요한 경우 커스텀 헤더를 추가하세요.</p>
              )}
            </div>
          )}

          {/* RSS 검증 결과 */}
          {validationResult && (
            <div className="p-3 rounded-lg bg-accent/50 border border-border space-y-1">
              <p className="text-sm font-semibold">검증 결과</p>
              <p className="text-sm text-muted-foreground">제목: {validationResult.title}</p>
              <p className="text-sm text-muted-foreground">아이템 수: {validationResult.items_count}</p>
            </div>
          )}

          {/* 스크래핑 설정 (생성 모드, 스크래핑 타입에서만) */}
          {mode === 'create' && isScrapingType && (
            <>
              <div className="border-t pt-4">
                <h4 className="font-medium mb-3">목록 페이지 셀렉터</h4>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">아이템 셀렉터 *</Label>
                    <Input
                      value={itemSelector}
                      onChange={(e) => setItemSelector(e.target.value)}
                      placeholder="article.post, .news-item"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">제목 셀렉터</Label>
                    <Input
                      value={titleSelector}
                      onChange={(e) => setTitleSelector(e.target.value)}
                      placeholder="h2.title, .headline"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">링크 셀렉터</Label>
                    <Input
                      value={linkSelector}
                      onChange={(e) => setLinkSelector(e.target.value)}
                      placeholder="a.link, h2 > a"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">날짜 셀렉터</Label>
                    <Input
                      value={dateSelector}
                      onChange={(e) => setDateSelector(e.target.value)}
                      placeholder="time, .date"
                    />
                  </div>
                  <div className="col-span-2 space-y-1">
                    <Label className="text-xs">설명 셀렉터</Label>
                    <Input
                      value={descriptionSelector}
                      onChange={(e) => setDescriptionSelector(e.target.value)}
                      placeholder=".summary, p.excerpt"
                    />
                  </div>
                </div>
              </div>

              {/* 브라우저 설정 */}
              <div className="flex items-center justify-between">
                <div>
                  <Label>브라우저 렌더링</Label>
                  <p className="text-xs text-muted-foreground">JavaScript가 필요한 페이지에서 사용</p>
                </div>
                <Switch checked={useBrowser} onCheckedChange={setUseBrowser} />
              </div>

              {useBrowser && (
                <div className="space-y-1">
                  <Label className="text-xs">Wait Selector</Label>
                  <Input
                    value={waitSelector}
                    onChange={(e) => setWaitSelector(e.target.value)}
                    placeholder="페이지 로드 완료 확인용 셀렉터"
                  />
                </div>
              )}
            </>
          )}

          {/* 상세 페이지 설정 */}
          {mode === 'create' && isDetailScraping && (
            <div className="border-t pt-4">
              <h4 className="font-medium mb-3">상세 페이지 셀렉터</h4>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">제목 셀렉터</Label>
                  <Input
                    value={detailTitleSelector}
                    onChange={(e) => setDetailTitleSelector(e.target.value)}
                    placeholder="h1.title"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">날짜 셀렉터</Label>
                  <Input
                    value={detailDateSelector}
                    onChange={(e) => setDetailDateSelector(e.target.value)}
                    placeholder="time.published"
                  />
                </div>
                <div className="col-span-2 space-y-1">
                  <Label className="text-xs">본문 셀렉터</Label>
                  <Input
                    value={detailContentSelector}
                    onChange={(e) => setDetailContentSelector(e.target.value)}
                    placeholder="article.content, .post-body"
                  />
                </div>
              </div>
            </div>
          )}

          {/* 공통 피드 정보 */}
          <div className="border-t pt-4 space-y-3">
            <h4 className="font-medium">피드 정보</h4>
            <div className="space-y-2">
              <Label htmlFor="feed-title">{t.feed.title}</Label>
              <Input id="feed-title" value={feedTitle} onChange={(e) => setFeedTitle(e.target.value)} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="feed-description">{t.feed.description}</Label>
              <Input id="feed-description" value={description} onChange={(e) => setDescription(e.target.value)} />
            </div>

            {mode === 'edit' && (
              <div className="space-y-2">
                <Label htmlFor="feed-favicon">Favicon URL</Label>
                <Input
                  id="feed-favicon"
                  value={faviconUrl}
                  onChange={(e) => setFaviconUrl(e.target.value)}
                  placeholder="https://example.com/favicon.ico"
                />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="feed-refresh">새로고침 주기 (분)</Label>
              <Input
                id="feed-refresh"
                type="number"
                min={1}
                value={refreshInterval}
                onChange={(e) => setRefreshInterval(Number(e.target.value))}
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="feed-visible">{t.feed.visible}</Label>
                <p className="text-xs text-muted-foreground">{t.feed.visibleDescription}</p>
              </div>
              <Switch id="feed-visible" checked={visible} onCheckedChange={setVisible} />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={submitting}>
            {t.common.cancel}
          </Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting ? `${dialogSubmitLabel}...` : dialogSubmitLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default FeedDialog;
