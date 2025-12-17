'use client';

import { useState, useCallback } from 'react';
import { useRSSStore } from '@/stores/rssStore';
import { useTabStore } from '@/stores/tabStore';
import {
  feedsRoutersRssEverythingFetchHtml,
  feedsRoutersRssEverythingPreviewItems,
  feedsRoutersRssEverythingCreateSource,
  feedsRoutersCategoryListCategories,
  FetchHTMLRequest,
  PreviewItemRequest,
  RSSEverythingCreateRequest,
  PreviewItem,
} from '@/services/api';
import { ListSelectors, DetailSelectors } from '@/components/SelectorBuilder';

// 파싱 모드
export type ParseMode = 'list' | 'detail';

// 스텝 정의
export type Step = 'url' | 'list-select' | 'detail-select' | 'preview' | 'save';

// 초기 상태
const initialListSelectors: ListSelectors = {
  itemSelector: '',
  titleSelector: '',
  linkSelector: '',
  descriptionSelector: '',
  dateSelector: '',
  imageSelector: '',
};

const initialDetailSelectors: DetailSelectors = {
  detailTitleSelector: '',
  detailDescriptionSelector: '',
  detailContentSelector: '',
  detailDateSelector: '',
  detailImageSelector: '',
};

// 셀렉터 검증 결과 타입
export interface SelectorValidation {
  totalItems: number;
  itemsWithLinks: number;
  warning: string | null;
}

export function useRSSEverything() {
  const { categories, setCategories } = useRSSStore();
  const { openTab, removeTab, panels, activePanelId } = useTabStore();

  // Step state
  const [currentStep, setCurrentStep] = useState<Step>('url');

  // URL step
  const [url, setUrl] = useState('');
  const [useBrowser, setUseBrowser] = useState(true);
  const [waitSelector, setWaitSelector] = useState('body');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 파싱 모드
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
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);
  const [refreshInterval, setRefreshInterval] = useState(60);
  const [customHeaders, setCustomHeaders] = useState<Record<string, string>>({});
  const [dateFormats, setDateFormats] = useState<string[]>([]);
  const [excludeSelectors, setExcludeSelectors] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  // HTMLViewer에서 선택된 셀렉터를 받을 현재 타겟
  // 'exclude'는 excludeSelectors 배열에 추가하는 모드
  const [activeListField, setActiveListField] = useState<keyof ListSelectors | 'exclude'>('itemSelector');
  const [activeDetailField, setActiveDetailField] = useState<keyof DetailSelectors | 'exclude'>('detailContentSelector');

  // Fetch HTML from URL (목록 페이지)
  const handleFetchListHTML = useCallback(async () => {
    if (!url) return;

    setIsLoading(true);
    setError(null);

    try {
      const request: FetchHTMLRequest = {
        url,
        use_browser: useBrowser,
        wait_selector: waitSelector,
        timeout: 30000,
        custom_headers: customHeaders,
      };

      const response = await feedsRoutersRssEverythingFetchHtml(request);

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
  }, [url, useBrowser, waitSelector, customHeaders]);

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
        wait_selector: waitSelector,
        timeout: 30000,
        custom_headers: customHeaders,
      };

      const response = await feedsRoutersRssEverythingFetchHtml(request);

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
  }, [detailUrl, useBrowser, waitSelector, customHeaders]);

  // HTMLViewer에서 셀렉터 선택시
  const handleListSelectorFromViewer = useCallback((selector: string) => {
    if (activeListField === 'exclude') {
      // exclude 모드일 때는 excludeSelectors 배열에 추가 (중복 방지)
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
      // exclude 모드일 때는 excludeSelectors 배열에 추가 (중복 방지)
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

      // 첫 번째 아이템 찾기
      const firstItem = doc.querySelector(listSelectors.itemSelector);
      if (!firstItem) return null;

      // 링크 셀렉터가 있으면 그것으로, 없으면 아이템 내 첫 번째 a 태그
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

      // 상대 URL을 절대 URL로 변환
      try {
        return new URL(href, url).href;
      } catch {
        return href;
      }
    } catch {
      return null;
    }
  }, [listHtml, listSelectors.itemSelector, listSelectors.linkSelector, url]);

  // 셀렉터 검증 함수 - 프론트엔드에서 미리 확인
  const validateSelectors = useCallback((): SelectorValidation | null => {
    if (!listHtml || !listSelectors.itemSelector) return null;

    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(listHtml, 'text/html');

      // 아이템들 찾기
      const items = doc.querySelectorAll(listSelectors.itemSelector);
      const totalItems = items.length;

      if (totalItems === 0) {
        return {
          totalItems: 0,
          itemsWithLinks: 0,
          warning: 'noItemsFound',
        };
      }

      // 링크가 있는 아이템 수 확인
      let itemsWithLinks = 0;
      const linkSelector = listSelectors.linkSelector || 'a[href]';

      items.forEach((item) => {
        const linkEl = item.querySelector(linkSelector);
        if (linkEl && linkEl.getAttribute('href')) {
          itemsWithLinks++;
        }
      });

      // 경고 메시지 결정
      let warning: string | null = null;

      if (itemsWithLinks === 0) {
        warning = 'noLinksWarning';
      } else if (itemsWithLinks < totalItems * 0.5) {
        // 절반 미만의 아이템에만 링크가 있으면 경고
        warning = 'selectorMismatchWarning';
      }

      return {
        totalItems,
        itemsWithLinks,
        warning,
      };
    } catch {
      return null;
    }
  }, [listHtml, listSelectors.itemSelector, listSelectors.linkSelector]);

  // 셀렉터 변경 시 자동 검증
  const handleValidateSelectors = useCallback(() => {
    if (!listSelectors.itemSelector) {
      setSelectorValidation(null);
      return;
    }

    setIsValidating(true);
    // 약간의 디바운스 효과
    setTimeout(() => {
      const result = validateSelectors();
      setSelectorValidation(result);
      setIsValidating(false);
    }, 100);
  }, [listSelectors.itemSelector, validateSelectors]);

  // 목록 셀렉터 설정 완료 후 다음 단계로
  const handleListSelectNext = useCallback(() => {
    if (!listSelectors.itemSelector) {
      setError('Item container selector is required');
      return;
    }

    if (parseMode === 'list') {
      if (!listSelectors.titleSelector) {
        setError('Title selector is required for list mode');
        return;
      }
      setCurrentStep('preview');
    } else {
      // detail 모드에서는 linkSelector가 필수
      if (!listSelectors.linkSelector) {
        setError('Link selector is required for detail mode');
        return;
      }

      // 목록에서 첫 번째 링크 URL을 상세 페이지 URL로 설정
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
      const request: PreviewItemRequest = {
        url,
        item_selector: listSelectors.itemSelector,
        title_selector: listSelectors.titleSelector,
        link_selector: listSelectors.linkSelector,
        description_selector: listSelectors.descriptionSelector,
        date_selector: listSelectors.dateSelector,
        image_selector: listSelectors.imageSelector,
        use_browser: useBrowser,
        wait_selector: waitSelector,
        custom_headers: customHeaders,
        exclude_selectors: excludeSelectors,
        // 상세 페이지 파싱 옵션
        follow_links: parseMode === 'detail',
        detail_title_selector: detailSelectors.detailTitleSelector,
        detail_description_selector: detailSelectors.detailDescriptionSelector,
        detail_content_selector: detailSelectors.detailContentSelector,
        detail_date_selector: detailSelectors.detailDateSelector,
        detail_image_selector: detailSelectors.detailImageSelector,
      };

      const response = await feedsRoutersRssEverythingPreviewItems(request);

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
  }, [url, parseMode, listSelectors, detailSelectors, useBrowser, waitSelector, customHeaders, excludeSelectors]);

  // Save RSS Everything source
  const handleSave = useCallback(async () => {
    if (!name) {
      setError('Name is required');
      return;
    }

    if (selectedCategoryId === null) {
      setError('Category is required');
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const request: RSSEverythingCreateRequest = {
        name,
        url,
        category_id: selectedCategoryId,
        item_selector: listSelectors.itemSelector,
        title_selector: listSelectors.titleSelector,
        link_selector: listSelectors.linkSelector,
        description_selector: listSelectors.descriptionSelector,
        date_selector: listSelectors.dateSelector,
        image_selector: listSelectors.imageSelector,
        follow_links: parseMode === 'detail',
        detail_title_selector: parseMode === 'detail' ? detailSelectors.detailTitleSelector : '',
        detail_description_selector: parseMode === 'detail' ? detailSelectors.detailDescriptionSelector : '',
        detail_content_selector: parseMode === 'detail' ? detailSelectors.detailContentSelector : '',
        detail_date_selector: parseMode === 'detail' ? detailSelectors.detailDateSelector : '',
        detail_image_selector: parseMode === 'detail' ? detailSelectors.detailImageSelector : '',
        use_browser: useBrowser,
        wait_selector: waitSelector,
        refresh_interval: refreshInterval,
        custom_headers: customHeaders,
        exclude_selectors: excludeSelectors.filter(s => s.trim() !== ''),
        date_formats: dateFormats.filter(f => f.trim() !== ''),
      };

      await feedsRoutersRssEverythingCreateSource(request);

      // 카테고리 새로고침
      const categoriesResponse = await feedsRoutersCategoryListCategories();
      setCategories(categoriesResponse);

      // 현재 탭을 닫고 홈으로 이동
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
  }, [name, url, parseMode, listSelectors, detailSelectors, selectedCategoryId, useBrowser, waitSelector, refreshInterval, setCategories, panels, activePanelId, removeTab, openTab]);

  // Reset and start over
  const handleReset = useCallback(() => {
    setCurrentStep('url');
    setUrl('');
    setUseBrowser(true);
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
    setSelectedCategoryId(null);
    setRefreshInterval(60);
    setCustomHeaders({});
    setDateFormats([]);
    setExcludeSelectors([]);
    setError(null);
  }, []);

  // Step navigation
  const goBack = useCallback(() => {
    switch (currentStep) {
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

  // 현재 스텝 인덱스 계산
  const getCurrentStepIndex = useCallback(() => {
    switch (currentStep) {
      case 'url': return 0;
      case 'list-select': return 1;
      case 'detail-select': return 2;
      case 'preview': return parseMode === 'detail' ? 3 : 2;
      case 'save': return parseMode === 'detail' ? 4 : 3;
    }
    return 0;
  }, [currentStep, parseMode]);

  return {
    // State
    currentStep,
    url,
    useBrowser,
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
    name,
    selectedCategoryId,
    refreshInterval,
    customHeaders,
    dateFormats,
    excludeSelectors,
    isSaving,
    activeListField,
    activeDetailField,
    categories,
    // Validation state
    selectorValidation,
    isValidating,

    // Setters
    setUrl,
    setUseBrowser,
    setWaitSelector,
    setParseMode,
    setListSelectors,
    setDetailUrl,
    setDetailSelectors,
    setName,
    setSelectedCategoryId,
    setRefreshInterval,
    setCustomHeaders,
    setDateFormats,
    setExcludeSelectors,
    setActiveListField,
    setActiveDetailField,

    // Actions
    handleFetchListHTML,
    handleFetchDetailHTML,
    handleListSelectorFromViewer,
    handleDetailSelectorFromViewer,
    handleListSelectNext,
    handlePreview,
    handleSave,
    handleReset,
    goBack,
    goToSave,
    // Validation actions
    handleValidateSelectors,

    // Computed
    currentStepIndex: getCurrentStepIndex(),
  };
}

// 필드 레이블 (deprecated - 이제 컴포넌트에서 i18n 사용)
export const listFieldLabels: Record<keyof ListSelectors, string> = {
  itemSelector: 'Item Container',
  titleSelector: 'Title',
  linkSelector: 'Link',
  descriptionSelector: 'Description',
  dateSelector: 'Date',
  imageSelector: 'Image',
};

export const detailFieldLabels: Record<keyof DetailSelectors, string> = {
  detailTitleSelector: 'Title',
  detailDescriptionSelector: 'Description',
  detailContentSelector: 'Content',
  detailDateSelector: 'Date',
  detailImageSelector: 'Image',
};
