'use client';

import { useState, useCallback, useEffect } from 'react';
import { useRSSStore } from '@/stores/rssStore';
import { useTabStore, RSSEverythingContext } from '@/stores/tabStore';
import {
  fetchHtml,
  previewItems as previewItemsApi,
  createRssEverythingSource,
  getRssEverythingSource,
  updateRssEverythingSource,
  listCategories,
  FetchHTMLRequest,
  CrawlRequest,
  RSSEverythingCreateRequest,
  RSSEverythingUpdateRequest,
  PreviewItem,
} from '@/services/api';
import { BrowserServiceType } from '@/types/rss';
import { ListSelectors, DetailSelectors } from '@/components/common/SelectorBuilder';
import { SourceConfig } from '@/components/rss-everything/SourceTypeStep';

// 파싱 모드
export type ParseMode = 'list' | 'detail';

// 소스 타입
export type SourceType = 'rss' | 'page_scraping' | 'detail_page_scraping';

// 스텝 정의 (source-type, rss-save 추가)
export type Step = 'source-type' | 'rss-save' | 'url' | 'list-select' | 'detail-select' | 'preview' | 'save';

// 초기 상태
const initialListSelectors: ListSelectors = {
  itemSelector: '',
  titleSelector: '',
  linkSelector: '',
  descriptionSelector: '',
  dateSelector: '',
  imageSelector: '',
  authorSelector: '',
};

const initialDetailSelectors: DetailSelectors = {
  detailTitleSelector: '',
  detailDescriptionSelector: '',
  detailContentSelector: '',
  detailDateSelector: '',
  detailImageSelector: '',
  detailAuthorSelector: '',
};

// 셀렉터 검증 결과 타입
export interface SelectorValidation {
  totalItems: number;
  itemsWithLinks: number;
  warning?: string;
}

export interface UseRSSEverythingOptions {
  context?: RSSEverythingContext;
}

export function useRSSEverything(options: UseRSSEverythingOptions = {}) {
  const { context } = options;
  const { setCategories } = useRSSStore();
  const { openTab, removeTab, panels, activePanelId } = useTabStore();

  // Context에 따라 초기 스텝 결정
  const getInitialStep = (): Step => {
    if (context?.mode === 'edit') {
      // 편집 모드: 기존 소스 수정 (URL 스텝부터)
      return 'url';
    }
    // 생성 모드: 소스 타입 선택부터
    return 'source-type';
  };

  // 소스 타입 상태
  const [sourceType, setSourceType] = useState<SourceType>('rss');

  // Step state
  const [currentStep, setCurrentStep] = useState<Step>(getInitialStep());

  // URL step
  const [url, setUrl] = useState('');
  const [useBrowser, setUseBrowser] = useState(true);
  const [browserService, setBrowserService] = useState<BrowserServiceType>('realbrowser');
  const [waitSelector, setWaitSelector] = useState('body');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 파싱 모드 (소스 타입에 따라 결정)
  const [parseMode, setParseMode] = useState<ParseMode>('list');

  // 목록 페이지 HTML & 셀렉터
  const [listHtml, setListHtml] = useState<string | null>(null);
  const [listSelectors, setListSelectors] = useState<ListSelectors>(initialListSelectors);

  // 상세 페이지 HTML & 셀렉터
  const [detailHtml, setDetailHtml] = useState<string | null>(null);
  const [detailUrl, setDetailUrl] = useState<string>('');
  const [detailSelectors, setDetailSelectors] = useState<DetailSelectors>(initialDetailSelectors);

  // Preview step
  const [previewItems, setPreviewItems] = useState<PreviewItem[]>([]);
  const [previewLoading, setPreviewLoading] = useState(false);

  // 셀렉터 검증 상태
  const [selectorValidation, setSelectorValidation] = useState<SelectorValidation | null>(null);
  const [isValidating, setIsValidating] = useState(false);

  // Save step
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [refreshInterval, setRefreshInterval] = useState(60);
  const [customHeaders, setCustomHeaders] = useState<Record<string, string>>({});
  const [dateFormats, setDateFormats] = useState<string[]>([]);
  const [excludeSelectors, setExcludeSelectors] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  // RSS 피드 검증 결과
  const [rssValidationResult, setRssValidationResult] = useState<{
    title: string;
    description: string;
    items_count: number;
  } | null>(null);

  // HTMLViewer에서 선택된 셀렉터를 받을 현재 타겟
  const [activeListField, setActiveListField] = useState<keyof ListSelectors | 'exclude'>('itemSelector');
  const [activeDetailField, setActiveDetailField] = useState<keyof DetailSelectors | 'exclude'>('detailContentSelector');

  // 편집 중인 소스 ID (수정 모드에서)
  const [editingSourceId, setEditingSourceId] = useState<number | null>(context?.sourceId || null);

  // 편집 모드일 때 기존 소스 데이터 로드
  useEffect(() => {
    const loadSourceData = async () => {
      if (context?.mode === 'edit' && context.sourceId) {
        setIsLoading(true);
        try {
          const source = await getRssEverythingSource(context.sourceId);
          setEditingSourceId(source.id);

          // 기본 정보 설정
          setUrl(source.url);
          setUseBrowser(source.use_browser);
          setBrowserService((source.browser_service as BrowserServiceType) || 'realbrowser');
          setWaitSelector(source.wait_selector || 'body');
          setCustomHeaders(source.custom_headers as Record<string, string> || {});
          setDateFormats(source.date_formats || []);
          setExcludeSelectors(source.exclude_selectors || []);

          // 소스 타입에 따라 분기
          const srcType = source.source_type as SourceType;
          setSourceType(srcType);

          if (srcType === 'rss') {
            // RSS 타입이면 rss-save 스텝으로 (URL 수정 가능하게)
            setCurrentStep('rss-save');
          } else if (srcType === 'detail_page_scraping') {
            setParseMode('detail');
            // 목록 셀렉터
            setListSelectors({
              itemSelector: source.item_selector || '',
              titleSelector: source.title_selector || '',
              linkSelector: source.link_selector || '',
              descriptionSelector: source.description_selector || '',
              dateSelector: source.date_selector || '',
              imageSelector: source.image_selector || '',
              authorSelector: source.author_selector || '',
            });
            // 상세 셀렉터
            setDetailSelectors({
              detailTitleSelector: source.detail_title_selector || '',
              detailDescriptionSelector: source.detail_description_selector || '',
              detailContentSelector: source.detail_content_selector || '',
              detailDateSelector: source.detail_date_selector || '',
              detailImageSelector: source.detail_image_selector || '',
              detailAuthorSelector: source.detail_author_selector || '',
            });
            setCurrentStep('url');
          } else {
            // page_scraping
            setParseMode('list');
            setListSelectors({
              itemSelector: source.item_selector || '',
              titleSelector: source.title_selector || '',
              linkSelector: source.link_selector || '',
              descriptionSelector: source.description_selector || '',
              dateSelector: source.date_selector || '',
              imageSelector: source.image_selector || '',
              authorSelector: source.author_selector || '',
            });
            setCurrentStep('url');
          }
        } catch (err) {
          console.error('Failed to load source:', err);
          setError('소스 데이터를 불러오는데 실패했습니다.');
        } finally {
          setIsLoading(false);
        }
      }
    };

    loadSourceData();
  }, [context?.mode, context?.sourceId]);

  // 소스 타입 선택 후 다음 단계로
  const handleSourceTypeSelect = (type: SourceType, rssUrl?: string, config?: SourceConfig) => {
    setSourceType(type);

    // config가 있으면 미리 설정 적용
    if (config) {
      // URL 설정
      if (config.url) {
        setUrl(config.url);
      }

      // 기타 설정들
      if (config.use_browser !== undefined) setUseBrowser(config.use_browser);
      if (config.browser_service) setBrowserService(config.browser_service);
      if (config.wait_selector) setWaitSelector(config.wait_selector);
      if (config.custom_headers) setCustomHeaders(config.custom_headers as Record<string, string>);
      if (config.date_formats) setDateFormats(config.date_formats);
      if (config.exclude_selectors) setExcludeSelectors(config.exclude_selectors);

      // 목록 셀렉터
      setListSelectors({
        itemSelector: config.item_selector || '',
        titleSelector: config.title_selector || '',
        linkSelector: config.link_selector || '',
        descriptionSelector: config.description_selector || '',
        dateSelector: config.date_selector || '',
        imageSelector: config.image_selector || '',
        authorSelector: config.author_selector || '',
      });

      // 상세 셀렉터
      setDetailSelectors({
        detailTitleSelector: config.detail_title_selector || '',
        detailDescriptionSelector: config.detail_description_selector || '',
        detailContentSelector: config.detail_content_selector || '',
        detailDateSelector: config.detail_date_selector || '',
        detailImageSelector: config.detail_image_selector || '',
        detailAuthorSelector: config.detail_author_selector || '',
      });
    }

    if (type === 'rss') {
      // RSS URL이 있으면 설정
      if (rssUrl) {
        setUrl(rssUrl);
      }
      // RSS는 바로 저장 단계로 (URL은 rss-save에서 입력 가능)
      setCurrentStep('rss-save');
    } else {
      // page_scraping 또는 detail_page_scraping
      setParseMode(type === 'detail_page_scraping' ? 'detail' : 'list');
      setCurrentStep('url');
    }
  };

  // RSS 피드 검증
  const handleValidateRss = useCallback(async () => {
    if (!url) return;

    setIsLoading(true);
    setError(null);

    try {
      // RSS URL 검증 API 호출 (백엔드에 해당 API가 있다고 가정)
      const response = await fetch(`/api/rss/validate?url=${encodeURIComponent(url)}`);
      if (response.ok) {
        const data = await response.json();
        setRssValidationResult(data);
        if (!name && data.title) {
          setName(data.title);
        }
        if (!description && data.description) {
          setDescription(data.description);
        }
      }
    } catch (err) {
      // 검증 실패해도 저장은 가능
      console.warn('RSS validation failed:', err);
    } finally {
      setIsLoading(false);
    }
  }, [url, name, description]);

  // RSS 피드 저장 (생성 또는 수정)
  const handleSaveRssFeed = useCallback(async () => {
    if (!url) {
      setError('URL is required');
      return;
    }

    // feedId 필수 (기존 피드에 소스 추가)
    if (!context?.feedId) {
      setError('Feed ID is required');
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      if (context?.mode === 'edit' && editingSourceId) {
        // 수정 모드: 기존 소스 업데이트
        const updateData: RSSEverythingUpdateRequest = {
          url,
          source_type: 'rss',
          custom_headers: customHeaders,
        };

        await updateRssEverythingSource(editingSourceId, updateData);

        // 성공 메시지 후 탭 닫기
        alert('소스가 업데이트되었습니다.');
      } else {
        // 생성 모드: 기존 피드에 소스 추가
        const sourceData: RSSEverythingCreateRequest = {
          feed_id: context.feedId,
          url,
          source_type: 'rss',
          custom_headers: customHeaders,
        };

        await createRssEverythingSource(sourceData);

        // 카테고리 새로고침 (피드 목록도 함께 갱신됨)
        const updatedCategories = await listCategories();
        setCategories(updatedCategories);
      }

      // 현재 탭 닫고 홈으로
      const activePanel = panels.find(p => p.id === activePanelId);
      const currentTab = activePanel?.tabs.find(t => t.type === 'rss-everything');
      if (currentTab) {
        removeTab(currentTab.id);
      }
      openTab({ type: 'home', title: '메인스트림', path: '/home' });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsSaving(false);
    }
  }, [url, customHeaders, panels, activePanelId, removeTab, openTab, setCategories, context?.mode, context?.feedId, editingSourceId]);

  // Fetch HTML from URL (목록 페이지)
  const handleFetchListHTML = useCallback(async () => {
    if (!url) return;

    setIsLoading(true);
    setError(null);

    try {
      const request: FetchHTMLRequest = {
        url,
        use_browser: useBrowser,
        browser_service: browserService,
        wait_selector: waitSelector,
        timeout: 30000,
        custom_headers: customHeaders,
      };

      const response = await fetchHtml(request);

      if (response.success && response.html) {
        setListHtml(response.html);
        setCurrentStep('list-select');
      } else {
        setError(response.error || 'Failed to fetch HTML');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  }, [url, useBrowser, browserService, waitSelector, customHeaders]);

  // 상세 페이지 HTML 가져오기
  const handleFetchDetailHTML = useCallback(async () => {
    if (!detailUrl) {
      setError('Please enter a sample detail page URL');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const request: FetchHTMLRequest = {
        url: detailUrl,
        use_browser: useBrowser,
        browser_service: browserService,
        wait_selector: waitSelector,
        timeout: 30000,
        custom_headers: customHeaders,
      };

      const response = await fetchHtml(request);

      if (response.success && response.html) {
        setDetailHtml(response.html);
      } else {
        setError(response.error || 'Failed to fetch detail page');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  }, [detailUrl, useBrowser, browserService, waitSelector, customHeaders]);

  // HTMLViewer에서 셀렉터 선택시
  const handleListSelectorFromViewer = useCallback((selector: string) => {
    if (activeListField === 'exclude') {
      setExcludeSelectors(prev => {
        if (prev.includes(selector)) return prev;
        return [...prev, selector];
      });
    } else {
      setListSelectors(prev => ({
        ...prev,
        [activeListField]: selector,
      }));
    }
  }, [activeListField]);

  const handleDetailSelectorFromViewer = useCallback((selector: string) => {
    if (activeDetailField === 'exclude') {
      setExcludeSelectors(prev => {
        if (prev.includes(selector)) return prev;
        return [...prev, selector];
      });
    } else {
      setDetailSelectors(prev => ({
        ...prev,
        [activeDetailField]: selector,
      }));
    }
  }, [activeDetailField]);

  // 목록 HTML에서 첫 번째 링크 URL 추출
  const extractFirstLinkUrl = useCallback((): string | null => {
    if (!listHtml || !listSelectors.itemSelector) return null;

    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(listHtml, 'text/html');

      const firstItem = doc.querySelector(listSelectors.itemSelector);
      if (!firstItem) return null;

      let linkElement: HTMLAnchorElement | null = null;

      if (listSelectors.linkSelector) {
        linkElement = firstItem.querySelector(listSelectors.linkSelector) as HTMLAnchorElement;
      }

      if (!linkElement) {
        linkElement = firstItem.querySelector('a[href]') as HTMLAnchorElement;
      }

      if (!linkElement) return null;

      const href = linkElement.getAttribute('href');
      if (!href) return null;

      try {
        return new URL(href, url).href;
      } catch {
        return href;
      }
    } catch {
      return null;
    }
  }, [listHtml, listSelectors.itemSelector, listSelectors.linkSelector, url]);

  // 셀렉터 검증 함수
  const validateSelectors = useCallback((): SelectorValidation | null => {
    if (!listHtml || !listSelectors.itemSelector) return null;

    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(listHtml, 'text/html');

      const items = doc.querySelectorAll(listSelectors.itemSelector);
      const totalItems = items.length;

      if (totalItems === 0) {
        return {
          totalItems: 0,
          itemsWithLinks: 0,
          warning: 'noItemsFound',
        };
      }

      let itemsWithLinks = 0;
      const linkSelector = listSelectors.linkSelector || 'a[href]';

      items.forEach((item) => {
        const link = item.querySelector(linkSelector);
        if (link?.getAttribute('href')) {
          itemsWithLinks++;
        }
      });

      const result: SelectorValidation = {
        totalItems,
        itemsWithLinks,
      };

      if (itemsWithLinks === 0) {
        result.warning = 'noLinksFound';
      } else if (itemsWithLinks < totalItems * 0.5) {
        result.warning = 'fewLinksFound';
      }

      return result;
    } catch {
      return {
        totalItems: 0,
        itemsWithLinks: 0,
        warning: 'validationError',
      };
    }
  }, [listHtml, listSelectors.itemSelector, listSelectors.linkSelector]);

  // 셀렉터 검증 핸들러
  const handleValidateSelectors = useCallback(() => {
    setIsValidating(true);
    const result = validateSelectors();
    setSelectorValidation(result);
    setIsValidating(false);
  }, [validateSelectors]);

  // 목록 선택 다음 단계
  const handleListSelectNext = useCallback(() => {
    if (!listSelectors.itemSelector) {
      setError('Item selector is required');
      return;
    }

    if (parseMode === 'list') {
      // 목록만 파싱: 바로 미리보기로
      setCurrentStep('preview');
    } else {
      // 상세 페이지 파싱 필요
      const firstLinkUrl = extractFirstLinkUrl();
      if (firstLinkUrl) {
        setDetailUrl(firstLinkUrl);
      }
      setCurrentStep('detail-select');
    }
  }, [parseMode, listSelectors, extractFirstLinkUrl]);

  // Preview items with current selectors
  const handlePreview = useCallback(async () => {
    setPreviewLoading(true);
    setError(null);

    try {
      const request: CrawlRequest = {
        url,
        item_selector: listSelectors.itemSelector,
        title_selector: listSelectors.titleSelector,
        link_selector: listSelectors.linkSelector,
        description_selector: listSelectors.descriptionSelector,
        date_selector: listSelectors.dateSelector,
        date_formats: dateFormats,
        image_selector: listSelectors.imageSelector,
        use_browser: useBrowser,
        browser_service: browserService,
        wait_selector: waitSelector,
        custom_headers: customHeaders,
        exclude_selectors: excludeSelectors,
        detail_title_selector: detailSelectors.detailTitleSelector,
        detail_description_selector: detailSelectors.detailDescriptionSelector,
        detail_content_selector: detailSelectors.detailContentSelector,
        detail_date_selector: detailSelectors.detailDateSelector,
        detail_image_selector: detailSelectors.detailImageSelector,
        source_type: sourceType
      };
      console.log('Preview request:', request);

      const response = await previewItemsApi(request);

      if (response.success) {
        setPreviewItems(response.items || []);
        setCurrentStep('preview');
      } else {
        setError(response.error || 'Failed to preview items');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setPreviewLoading(false);
    }
  }, [url, parseMode, listSelectors, detailSelectors, useBrowser, browserService, waitSelector, customHeaders, excludeSelectors, dateFormats, sourceType]);

  // Save RSS Everything source (page_scraping / detail_page_scraping)
  const handleSave = useCallback(async () => {
    // feedId는 필수 (기존 피드에 소스 추가)
    if (!context?.feedId) {
      setError('Feed ID is required');
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const sourceTypeValue = parseMode === 'detail' ? 'detail_page_scraping' : 'page_scraping';

      if (context?.mode === 'edit' && editingSourceId) {
        // 수정 모드: 기존 소스 업데이트
        const updateData: RSSEverythingUpdateRequest = {
          url,
          source_type: sourceTypeValue,
          item_selector: listSelectors.itemSelector,
          title_selector: listSelectors.titleSelector,
          link_selector: listSelectors.linkSelector,
          description_selector: listSelectors.descriptionSelector,
          date_selector: listSelectors.dateSelector,
          image_selector: listSelectors.imageSelector,
          detail_title_selector: parseMode === 'detail' ? detailSelectors.detailTitleSelector : '',
          detail_description_selector: parseMode === 'detail' ? detailSelectors.detailDescriptionSelector : '',
          detail_content_selector: parseMode === 'detail' ? detailSelectors.detailContentSelector : '',
          detail_date_selector: parseMode === 'detail' ? detailSelectors.detailDateSelector : '',
          detail_image_selector: parseMode === 'detail' ? detailSelectors.detailImageSelector : '',
          use_browser: useBrowser,
          browser_service: browserService,
          wait_selector: waitSelector,
          date_formats: dateFormats,
          exclude_selectors: excludeSelectors,
          custom_headers: customHeaders,
        };

        await updateRssEverythingSource(editingSourceId, updateData);
      } else {
        // 생성 모드: 새 소스 생성
        const request: RSSEverythingCreateRequest = {
          feed_id: context.feedId,
          url,
          source_type: sourceTypeValue,
          item_selector: listSelectors.itemSelector,
          title_selector: listSelectors.titleSelector,
          link_selector: listSelectors.linkSelector,
          description_selector: listSelectors.descriptionSelector,
          date_selector: listSelectors.dateSelector,
          image_selector: listSelectors.imageSelector,
          detail_title_selector: parseMode === 'detail' ? detailSelectors.detailTitleSelector : '',
          detail_description_selector: parseMode === 'detail' ? detailSelectors.detailDescriptionSelector : '',
          detail_content_selector: parseMode === 'detail' ? detailSelectors.detailContentSelector : '',
          detail_date_selector: parseMode === 'detail' ? detailSelectors.detailDateSelector : '',
          detail_image_selector: parseMode === 'detail' ? detailSelectors.detailImageSelector : '',
          use_browser: useBrowser,
          browser_service: browserService,
          wait_selector: waitSelector,
          date_formats: dateFormats,
          exclude_selectors: excludeSelectors,
          custom_headers: customHeaders,
        };

        await createRssEverythingSource(request);
      }

      // 카테고리 & 피드 새로고침
      const updatedCategories = await listCategories();
      setCategories(updatedCategories);

      // 현재 탭 닫고 홈으로
      const activePanel = panels.find(p => p.id === activePanelId);
      const currentTab = activePanel?.tabs.find(t => t.type === 'rss-everything');
      if (currentTab) {
        removeTab(currentTab.id);
      }
      openTab({ type: 'home', title: '메인스트림', path: '/home' });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsSaving(false);
    }
  }, [url, parseMode, listSelectors, detailSelectors, useBrowser, browserService, waitSelector, dateFormats, excludeSelectors, customHeaders, setCategories, panels, activePanelId, removeTab, openTab, context?.feedId, context?.mode, editingSourceId]);

  // Reset and start over
  const handleReset = useCallback(() => {
    setCurrentStep(getInitialStep());
    setSourceType('rss');
    setUrl('');
    setUseBrowser(true);
    setBrowserService('realbrowser');
    setWaitSelector('body');
    setParseMode('list');
    setListHtml(null);
    setListSelectors(initialListSelectors);
    setActiveListField('itemSelector');
    setDetailHtml(null);
    setDetailUrl('');
    setDetailSelectors(initialDetailSelectors);
    setActiveDetailField('detailContentSelector');
    setPreviewItems([]);
    setName('');
    setDescription('');
    setRefreshInterval(60);
    setCustomHeaders({});
    setDateFormats([]);
    setExcludeSelectors([]);
    setError(null);
    setRssValidationResult(null);
    setSelectorValidation(null);
  }, []);

  // Step navigation
  const goBack = useCallback(() => {
    switch (currentStep) {
      case 'rss-save':
        setCurrentStep('source-type');
        break;
      case 'url':
        setCurrentStep('source-type');
        break;
      case 'list-select':
        setCurrentStep('url');
        break;
      case 'detail-select':
        setCurrentStep('list-select');
        break;
      case 'preview':
        setCurrentStep(parseMode === 'detail' ? 'detail-select' : 'list-select');
        break;
      case 'save':
        setCurrentStep('preview');
        break;
    }
  }, [currentStep, parseMode]);

  const goToSave = useCallback(() => {
    setCurrentStep('save');
  }, []);

  // 현재 스텝 인덱스 계산 (소스 타입별로 다른 스텝 구조)
  const getCurrentStepIndex = useCallback(() => {
    // RSS: source-type(0) → rss-save(1)
    if (sourceType === 'rss') {
      switch (currentStep) {
        case 'source-type': return 0;
        case 'rss-save': return 1;
        default: return 0;
      }
    }

    // Page Scraping: source-type(0) → url(1) → list-select(2) → preview(3) → save(4)
    if (sourceType === 'page_scraping') {
      switch (currentStep) {
        case 'source-type': return 0;
        case 'url': return 1;
        case 'list-select': return 2;
        case 'preview': return 3;
        case 'save': return 4;
        default: return 0;
      }
    }

    // Detail Page Scraping: source-type(0) → url(1) → list-select(2) → detail-select(3) → preview(4) → save(5)
    if (sourceType === 'detail_page_scraping') {
      switch (currentStep) {
        case 'source-type': return 0;
        case 'url': return 1;
        case 'list-select': return 2;
        case 'detail-select': return 3;
        case 'preview': return 4;
        case 'save': return 5;
        default: return 0;
      }
    }

    // 소스 타입 선택 전
    return currentStep === 'source-type' ? 0 : 0;
  }, [currentStep, sourceType]);

  return {
    // Context
    context,

    // Source type
    sourceType,
    setSourceType,
    handleSourceTypeSelect,

    // State
    currentStep,
    url,
    useBrowser,
    browserService,
    waitSelector,
    isLoading,
    error,
    parseMode,
    listHtml,
    listSelectors,
    detailHtml,
    detailUrl,
    detailSelectors,
    previewItems,
    previewLoading,
    customHeaders,
    dateFormats,
    excludeSelectors,
    isSaving,
    activeListField,
    activeDetailField,
    // Validation state
    selectorValidation,
    isValidating,
    rssValidationResult,

    // Setters
    setUrl,
    setUseBrowser,
    setBrowserService,
    setWaitSelector,
    setParseMode,
    setListSelectors,
    setDetailUrl,
    setDetailSelectors,
    setCustomHeaders,
    setDateFormats,
    setExcludeSelectors,
    setActiveListField,
    setActiveDetailField,

    // Edit mode
    isEditMode: context?.mode === 'edit',
    editingSourceId,

    // Actions
    handleFetchListHTML,
    handleFetchDetailHTML,
    handleListSelectorFromViewer,
    handleDetailSelectorFromViewer,
    handleListSelectNext,
    handlePreview,
    handleSave,
    handleSaveRssFeed,
    handleValidateRss,
    handleReset,
    goBack,
    goToSave,
    // Validation actions
    handleValidateSelectors,

    // Computed
    currentStepIndex: getCurrentStepIndex(),
  };
}
