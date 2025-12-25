'use client';

import { CheckCircle, Heart, User, Tag, RefreshCw } from "lucide-react";
import parse, { DOMNode, Element, domToReact, HTMLReactParserOptions } from 'html-react-parser';
import { FC, useCallback, useEffect, useMemo, useRef, useState, forwardRef } from "react";
import { toggleItemFavorite, toggleItemRead, refreshItem } from "../../services/api";
import { cn } from "@/lib/utils";
import { useSettingsStore, fontSizeConfig, FontSizeLevel } from "../../stores/settingsStore";
import { useRSSStore } from "../../stores/rssStore";
import { RSSItem } from "../../types/rss";
import { FeedImage } from "./FeedImage";
import { FeedVideo } from "./FeedVideo";

/**
 * CSS 선택자 앞에 scope prefix를 추가합니다.
 * 예: ".content { color: red; }" -> ".rss-scope-123 .content { color: red; }"
 */
export const scopeCss = (css: string, scopeId: string): string => {
  // 주석 제거
  let cleanCss = css.replace(/\/\*[\s\S]*?\*\//g, '');

  const result: string[] = [];
  let i = 0;

  while (i < cleanCss.length) {
    // @media, @keyframes 등 @ 규칙 처리
    if (cleanCss[i] === '@') {
      const atRuleMatch = cleanCss.slice(i).match(/^@[\w-]+[^{]*\{/);
      if (atRuleMatch) {
        const atRule = atRuleMatch[0];
        result.push(atRule);
        i += atRule.length;

        // @keyframes는 내부를 건드리지 않음
        if (atRule.includes('@keyframes') || atRule.includes('@font-face')) {
          let braceCount = 1;
          const start = i;
          while (i < cleanCss.length && braceCount > 0) {
            if (cleanCss[i] === '{') braceCount++;
            if (cleanCss[i] === '}') braceCount--;
            i++;
          }
          result.push(cleanCss.slice(start, i));
        }
        continue;
      }
    }

    // 닫는 중괄호
    if (cleanCss[i] === '}') {
      result.push('}');
      i++;
      continue;
    }

    // 선택자 찾기 (다음 { 까지)
    const selectorEnd = cleanCss.indexOf('{', i);
    if (selectorEnd === -1) break;

    let selector = cleanCss.slice(i, selectorEnd).trim();
    i = selectorEnd + 1;

    // 빈 선택자 건너뛰기
    if (!selector) {
      result.push('{');
      continue;
    }

    // 여러 선택자 (콤마로 구분) 각각에 scope 추가
    const scopedSelectors = selector.split(',').map(sel => {
      sel = sel.trim();
      if (!sel) return sel;

      // body, html, :root는 scope 클래스로 대체
      if (sel === 'body' || sel === 'html' || sel === ':root') {
        return `.${scopeId}`;
      }

      // 이미 scoped면 그대로
      if (sel.includes(scopeId)) {
        return sel;
      }

      // 일반 선택자 앞에 scope 추가
      return `.${scopeId} ${sel}`;
    }).join(', ');

    result.push(scopedSelectors + ' {');

    // 속성 블록 찾기 (다음 } 까지, 중첩 { } 고려)
    let braceCount = 1;
    const propsStart = i;
    while (i < cleanCss.length && braceCount > 0) {
      if (cleanCss[i] === '{') braceCount++;
      if (cleanCss[i] === '}') braceCount--;
      if (braceCount > 0) i++;
    }
    result.push(cleanCss.slice(propsStart, i));
  }

  return result.join('');
};


export const renderDescription = (
  description: string,
  onMediaClick: (url: string, type: 'image' | 'video', itemId?: number) => void,
  baseUrl?: string,
  itemId?: number
) => {
  // Scope ID for CSS isolation
  const scopeId = `rss-scope-${itemId}`;

  // Helper to check if a node contains an img or video (directly or nested)
  const hasMediaChild = (node: any): boolean => {
    if (!node.children) return false;
    return node.children.some((child: any) =>
      child.name === 'img' || child.name === 'video' || hasMediaChild(child)
    );
  };

  // Helper to check if a node is inline (can be inside <p>)
  const isBlockElement = (name: string): boolean => {
    const blockElements = ['div', 'p', 'figure', 'blockquote', 'ul', 'ol', 'li', 'table', 'section', 'article', 'header', 'footer', 'nav', 'aside', 'main', 'form', 'fieldset', 'address', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'pre', 'hr', 'noscript'];
    return blockElements.includes(name);
  };

  const normalizeSrc = (raw: string) => {
    if (!raw) return raw;
    // Protocol-relative (//example.com/path)
    if (raw.startsWith('//')) {
      try {
        return window.location.protocol + raw;
      } catch (e) {
        return raw;
      }
    }
    // Root-relative (/path) -> resolve against article/feed origin if provided
    if (raw.startsWith('/')) {
      try {
        const origin = baseUrl ? new URL(baseUrl).origin : window.location.origin;
        return origin + raw;
      } catch (e) {
        return raw;
      }
    }
    // If it's not an absolute URL (no scheme) and we have a baseUrl, resolve relative paths
    if (!/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(raw) && baseUrl) {
      try {
        return new URL(raw, baseUrl).toString();
      } catch (e) {
        return raw;
      }
    }
    return raw;
  };

  // Convert CSS string to React style object
  const parseStyleString = (styleString: string): React.CSSProperties => {
    const style: Record<string, string> = {};
    styleString.split(';').forEach(rule => {
      const [property, value] = rule.split(':').map(s => s.trim());
      if (property && value) {
        // Convert kebab-case to camelCase (e.g., text-align -> textAlign)
        const camelCaseProperty = property.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
        style[camelCaseProperty] = value;
      }
    });
    return style as React.CSSProperties;
  };

  // Define replace function separately so it can be used recursively with domToReact
  const replaceNode = (domNode: DOMNode): React.ReactElement | null | undefined => {
    if (!(domNode instanceof Element)) return undefined; // Let default parsing handle
    if (domNode.attribs && domNode.attribs.class) {
      domNode.attribs.className = domNode.attribs.class;
      delete domNode.attribs.class;
    }

    // Handle <style> tags - scope CSS selectors
    if (domNode.name === 'style') {
      const cssText = (domNode.children[0] as any)?.data || '';
      if (!cssText.trim()) return null;

      const scopedCss = scopeCss(cssText, scopeId);
      return <style dangerouslySetInnerHTML={{ __html: scopedCss }} />;
    }

    // Handle <a> tags that wrap images - remove the link wrapper
    if (domNode.name === 'a' && hasMediaChild(domNode)) {
      // Return just the children without the <a> wrapper
      return <>{domNode.children?.map((child: any, index: number) => {
        if (child.name === 'img') {
          const src = child.attribs?.src;
          const alt = child.attribs?.alt || '';
          if (!src) return null;
          const resolved = normalizeSrc(src);
          return (
            <FeedImage
              key={index}
              src={resolved}
              alt={alt}
              onClick={() => onMediaClick(resolved, 'image', itemId)}
            />
          );
        } else if (child.name === 'video') {
          const { class: _, src, ...attribs } = child.attribs;
          const videoSrc = src || attribs.source;
          if (!videoSrc) return null;
          const resolved = normalizeSrc(videoSrc);
          return (
            <FeedVideo
              key={index}
              src={resolved}
              onClick={() => onMediaClick(resolved, 'video', itemId)}
              {...attribs}
            />
          );
        }
        return null;
      })}</>;
    }

    // Convert <p> to <div> if it contains media (img/video) to avoid hydration errors
    // HTML doesn't allow <div> inside <p>, and FeedImage/FeedVideo use <div>
    if (domNode.name === 'p' && hasMediaChild(domNode)) {
      const { class: className, style: styleString, ...attribs } = domNode.attribs || {};
      const style = styleString ? parseStyleString(styleString) : undefined;
      return (
        <div {...attribs} className={className} style={style}>
          {domToReact(domNode.children as DOMNode[], { replace: replaceNode })}
        </div>
      );
    }

    if (domNode.name === 'img') {
      const src = domNode.attribs.src;
      const alt = domNode.attribs.alt || '';

      // Skip if no src
      if (!src) return null;

      const resolved = normalizeSrc(src);
      return (
        <FeedImage
          src={resolved}
          alt={alt}
          onClick={() => onMediaClick(resolved, 'image', itemId)}
        />
      );
    }
    if (domNode.name === 'video') {
      const { class: _, src, ...attribs } = domNode.attribs;
      const videoSrc = src || attribs.source;
      const resolved = videoSrc ? normalizeSrc(videoSrc) : videoSrc;
      return (
        <FeedVideo
          src={resolved}
          onClick={() => resolved ? onMediaClick(resolved, 'video', itemId) : undefined}
          {...attribs}
        />
      );
    }
    return undefined; // Let default parsing handle other elements
  };

  return parse(description, { replace: replaceNode });
}

export const FeedItemCard = forwardRef<HTMLDivElement, {
  item: RSSItem,
  onMediaClick: (url: string, type: 'image' | 'video', itemId?: number) => void,
  onCollapseChange?: (id: number, collapsed: boolean) => void,
  onItemRefreshed?: (itemId: number, updatedItem: Partial<RSSItem>) => void,
  fontSizeOverride?: FontSizeLevel, // 미리보기용 오버라이드
}>(({ item, onMediaClick, onCollapseChange, onItemRefreshed, fontSizeOverride }, ref) => {
  const { viewMode, fontSizeLevel: storeFontSize } = useSettingsStore();
  const fontSizeLevel = fontSizeOverride || storeFontSize;
  const fontSize = fontSizeConfig[fontSizeLevel];

  // Feed 모드에서는 기본적으로 펼쳐진 상태, Board 모드에서는 접힌 상태
  const [collapsed, setCollapsed] = useState(viewMode !== 'feed');
  const [isRead, setIsRead] = useState(item.is_read);
  const [isFavorite, setIsFavorite] = useState(item.is_favorite);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const localRef = useRef<HTMLDivElement | null>(null);

  // Use ref for onMediaClick to avoid re-rendering description on callback change
  const onMediaClickRef = useRef(onMediaClick);
  onMediaClickRef.current = onMediaClick;

  // Stable callback that uses the ref
  const stableMediaClick = useCallback((url: string, type: 'image' | 'video', itemId?: number) => {
    onMediaClickRef.current(url, type, itemId);
  }, []);

  const description = useMemo(() => renderDescription(item.description, stableMediaClick, item.link, item.id), [item.description, stableMediaClick, item.link, item.id]);

  const publishedAt = useMemo(() => {
    try {
      const d = new Date(item.published_at);
      if (isNaN(d.getTime())) return null;
      // Format like: Dec 15, 2025 · 17:26
      const date = d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
      const time = d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
      return `${date} · ${time}`;
    } catch (e) {
      return null;
    }
  }, [item.published_at]);

  // Pre-schedule caching for nearby (above-the-fold / near-viewport) items to improve
  // perceived performance. If the item's container is within ~1.5x viewport height on mount,
  // schedule caching for all images found in the description.
  useEffect(() => {
    const el = localRef.current as HTMLDivElement | null;
    if (!el) return;
    try {
      const rect = el.getBoundingClientRect();
      if (rect.top < (window.innerHeight * 1.5)) {
        const urls: string[] = [];
        const re = /<img[^>]+src=(?:"|')([^"']+)(?:"|')/gi;
        let m: RegExpExecArray | null;
        while ((m = re.exec(item.description))) {
          if (m[1]) urls.push(m[1]);
        }
        // No-op: server-side image caching was removed. Rely on browser cache.
      }
    } catch (e) {
      // ignore
    }
  }, [item.description]);

  const handleToggleFavorite = useCallback(async () => {
    try {
      await toggleItemFavorite(item.id);
      setIsFavorite(!isFavorite);
    } catch (error) {
      console.error(error);
    }
  }, [item.id, isFavorite]);

  const handleRefresh = useCallback(async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    try {
      const result = await refreshItem(item.id);
      if (result.success && result.item) {
        // 반환된 아이템 데이터로 부모 컴포넌트에 업데이트 알림
        onItemRefreshed?.(item.id, result.item);
      }
    } catch (error) {
      console.error('Failed to refresh item:', error);
    } finally {
      setIsRefreshing(false);
    }
  }, [item.id, isRefreshing, onItemRefreshed]);

  const adjustFeedItemCount = useRSSStore((state) => state.adjustFeedItemCount);

  const handleToggleRead = useCallback(async () => {
    try {
      await toggleItemRead(item.id);
      const newIsRead = !isRead;
      setIsRead(newIsRead);
      // 읽음 상태가 변경되면 피드의 item_count 조절
      // isRead가 false -> true 이면 unread count 감소 (delta = -1)
      // isRead가 true -> false 이면 unread count 증가 (delta = +1)
      adjustFeedItemCount(item.feed_id, newIsRead ? -1 : 1);
    } catch (error) {
      console.error(error);
    }
  }, [item.id, item.feed_id, isRead, adjustFeedItemCount]);

  return (
    <div
      ref={(node) => {
        localRef.current = node;
        if (typeof ref === 'function') (ref as any)(node);
        else if (ref && typeof ref === 'object') (ref as any).current = node;
      }}
      key={item.id}
      className={cn(
        "glass-card p-3 sm:p-4 mt-1 cursor-pointer scroll-mt-[92px]",
        viewMode === 'board' ? 'mb-3' : ''
      )}
      style={{
        // 화면 밖 카드 렌더링 최적화
        contentVisibility: 'auto',
        containIntrinsicSize: '0 300px', // 예상 높이
      }}
      onClick={() => {
        const newCollapsed = !collapsed;
        setCollapsed(newCollapsed);
        onCollapseChange && onCollapseChange(item.id, newCollapsed);
      }}
    >
      {/* Sticky Header: Title + Actions in one row */}
      <div
        className={cn(
          "-mx-3 sm:-mx-4 px-3 sm:px-4 py-1.5 sm:py-2 -mt-3 sm:-mt-4 flex items-center justify-between",
          fontSize.gap,
          // Apply sticky when content is visible (expanded state)
          !collapsed && "sticky z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 transition-[top] duration-300"
        )}
        style={{
          // CSS 변수로 헤더 오프셋 사용 (기본값 92px)
          top: !collapsed ? 'var(--header-offset, 92px)' : undefined,
        }}
        onClick={(e) => {
          // When sticky header is clicked and it's actually stuck at top, scroll the card to top
          if (!collapsed) {
            const cardEl = localRef.current;
            if (!cardEl) return;

            // 가장 가까운 스크롤 컨테이너 찾기
            let scrollContainer: HTMLElement | null = cardEl.parentElement;
            while (scrollContainer) {
              const overflow = getComputedStyle(scrollContainer).overflowY;
              if (overflow === 'auto' || overflow === 'scroll') break;
              scrollContainer = scrollContainer.parentElement;
            }

            if (!scrollContainer) return;

            const cardRect = cardEl.getBoundingClientRect();
            const containerRect = scrollContainer.getBoundingClientRect();

            // 스티키 헤더의 top 위치 계산 (탭바 높이 약 36px 고려)
            // --header-offset이 0px이면 sticky top은 컨테이너 상단
            // 하지만 탭바가 sticky로 상단에 있으므로 실제 스티키 영역은 탭바 아래
            const tabBarHeight = 36;
            const stickyAreaTop = containerRect.top + tabBarHeight;

            // 카드 상단이 스티키 영역보다 위에 있으면 (= 스티키 상태)
            // 단, 이미 목표 위치 근처에 있으면 접기 동작 수행
            const isSticky = cardRect.top < stickyAreaTop - 5; // 스티키 상태: 카드 상단이 탭바 위에 있을 때
            const isNearTargetPosition = Math.abs(cardRect.top - stickyAreaTop - 8) < 20; // 목표 위치 근처

            if (isSticky && !isNearTargetPosition) {
              e.stopPropagation();
              // 카드 상단을 탭바 바로 아래로 이동
              const currentScrollTop = scrollContainer.scrollTop;
              const cardOffsetFromContainer = cardRect.top - containerRect.top;
              const targetScrollTop = currentScrollTop + cardOffsetFromContainer - tabBarHeight - 8;
              scrollContainer.scrollTo({ top: Math.max(0, targetScrollTop), behavior: 'smooth' });
            } else {
              // 스티키가 아닌 상태이거나 이미 목표 위치에 있을 때 타이틀 클릭하면 접기
              e.stopPropagation();
              const newCollapsed = !collapsed;
              setCollapsed(newCollapsed);
              onCollapseChange && onCollapseChange(item.id, newCollapsed);
            }
          }
        }}
      >
        {/* Title - truncated */}
        <h3 className={cn("font-semibold text-foreground leading-snug truncate flex-1 min-w-0", fontSize.title)}>
          {item.title}
        </h3>

        {/* Actions */}
        <div className={cn("flex items-center shrink-0", fontSize.gap)}>
          {/* Refresh Button - only shown if source_id exists */}
          {item.source_id && (
            <button
              onClick={(e) => { e.stopPropagation(); handleRefresh(); }}
              disabled={isRefreshing}
              className={cn(
                "p-1 rounded-full transition-colors flex items-center justify-center",
                "text-muted-foreground hover:bg-muted",
                isRefreshing && "animate-spin"
              )}
              title="Refresh item"
            >
              <RefreshCw className={cn(fontSize.icon)} />
            </button>
          )}

          {/* Read Toggle Button */}
          <button
            onClick={(e) => { e.stopPropagation(); handleToggleRead(); }}
            className={cn(
              "p-1 rounded-full transition-colors flex items-center justify-center",
              isRead
                ? "text-primary hover:bg-primary/10"
                : "text-muted-foreground hover:bg-muted"
            )}
            title={isRead ? "Mark as unread" : "Mark as read"}
          >
            <CheckCircle className={cn(fontSize.icon)} />
          </button>

          {/* Favorite Toggle Button */}
          <button
            onClick={(e) => { e.stopPropagation(); handleToggleFavorite(); }}
            className={cn(
              "p-1 rounded-full transition-colors flex items-center justify-center",
              isFavorite
                ? "text-red-500 hover:bg-red-500/10"
                : "text-muted-foreground hover:bg-muted"
            )}
            title={isFavorite ? "Remove from favorites" : "Add to favorites"}
          >
            <Heart className={cn(fontSize.icon, isFavorite && "fill-red-500")} />
          </button>

          {/* Read More Link */}
          <a
            href={item.link}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className={cn(
              "px-2 py-1 sm:px-3 sm:py-1.5 rounded-full font-medium transition-colors shrink-0 whitespace-nowrap",
              "bg-primary text-primary-foreground hover:bg-primary/90",
              fontSize.meta
            )}
          >
            Read more
          </a>
        </div>
      </div>

      {/* Date + Author + Categories - metadata row */}
      <div className={cn("flex flex-wrap items-center gap-x-3 gap-y-1 text-muted-foreground", fontSize.meta)}>
        {publishedAt && <span>{publishedAt}</span>}
        {item.author && (
          <span className="flex items-center gap-1">
            <User className="w-3 h-3" />
            {item.author}
          </span>
        )}
      </div>

      {/* Thumbnail Image (shown when collapsed in board mode) */}
      {item.image && viewMode === 'board' && collapsed && (
        <div className="mt-2">
          <FeedImage
            src={item.image}
            alt={item.title}
            onClick={() => stableMediaClick(item.image!, 'image', item.id)}
            className="w-full max-h-48 object-cover rounded-md"
          />
        </div>
      )}

      {/* Description */}
      {!collapsed && (
        <div className={cn(
          `rss-scope-${item.id}`,
          "mt-2 sm:mt-3 text-muted-foreground leading-relaxed overflow-hidden prose dark:prose-invert max-w-none",
          fontSize.body
        )}>
          {/* Feed custom CSS (user-defined) */}
          {item.feed_custom_css && (
            <style dangerouslySetInnerHTML={{ __html: scopeCss(item.feed_custom_css, `rss-scope-${item.id}`) }} />
          )}
          {/* Show thumbnail if image exists and not already in description */}
          {item.image && !item.description?.includes(item.image) && (
            <FeedImage
              src={item.image}
              alt={item.title}
              onClick={() => stableMediaClick(item.image!, 'image', item.id)}
              className="float-right ml-3 mb-2 w-32 sm:w-48 max-h-48 object-cover rounded-md"
            />
          )}
          {description}
        </div>
      )}
    </div>
  )
});

FeedItemCard.displayName = 'FeedItemCard';

export default FeedItemCard;
