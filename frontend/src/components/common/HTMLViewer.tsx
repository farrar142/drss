'use client';

import React, { useRef, useEffect, useState, useCallback } from 'react';
import { cn } from '@/lib/utils';

interface HTMLViewerProps {
  html: string;
  baseUrl: string;
  currentSelector: string;
  onSelectorChange: (selector: string) => void;
}

/**
 * HTMLViewer: iframe 내에서 HTML을 렌더링하고 요소 선택을 지원합니다.
 * 사용자가 요소를 클릭하면 해당 요소의 CSS 셀렉터를 생성합니다.
 */
export function HTMLViewer({ html, baseUrl, currentSelector, onSelectorChange }: HTMLViewerProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [isReady, setIsReady] = useState(false);
  const [hoveredElement, setHoveredElement] = useState<Element | null>(null);

  // Generate unique CSS selector for an element (Chrome-style optimization)
  const generateSelector = useCallback((element: Element): string => {
    const parts: string[] = [];
    let current: Element | null = element;

    while (current && current !== current.ownerDocument?.body) {
      let selector = current.tagName.toLowerCase();

      // Use ID if available - stop here
      if (current.id) {
        parts.unshift(`#${current.id}`);
        break;
      }

      // Use classes (filter out dynamic-looking ones and our custom classes)
      const classes = Array.from(current.classList)
        .filter(c =>
          !c.match(/^[a-z]+-[a-f0-9]+$/i) &&  // hash-like classes
          !c.match(/^_/) &&                    // underscore-prefixed
          !c.match(/^css-/) &&                 // css-in-js
          !c.match(/^sc-/) &&                  // styled-components
          !c.startsWith('rss-everything-')     // our custom classes
        );

      // Check if we need nth-child to disambiguate
      if (current.parentElement) {
        const siblings = Array.from(current.parentElement.children);

        // Find siblings with same tag
        const sameTagSiblings = siblings.filter(el => el.tagName === current!.tagName);

        if (sameTagSiblings.length > 1) {
          // If we have a unique class, use it without nth-child
          if (classes.length > 0) {
            const sameTagAndClassSiblings = sameTagSiblings.filter(el =>
              el.classList.contains(classes[0])
            );

            if (sameTagAndClassSiblings.length === 1) {
              // Class is unique among siblings, use just the class
              selector += '.' + classes[0];
            } else {
              // Multiple siblings with same class, need nth-child
              const index = siblings.indexOf(current) + 1;
              selector += '.' + classes[0] + `:nth-child(${index})`;
            }
          } else {
            // No useful class, use nth-child
            const index = siblings.indexOf(current) + 1;
            selector += `:nth-child(${index})`;
          }
        } else if (classes.length > 0) {
          // Only child with this tag, but add class for clarity
          selector += '.' + classes[0];
        }
      } else if (classes.length > 0) {
        selector += '.' + classes[0];
      }

      parts.unshift(selector);
      current = current.parentElement;
    }

    return parts.join(' > ');
  }, []);

  // Generate a more general selector that matches multiple similar elements
  const generateGeneralSelector = useCallback((element: Element): string => {
    // Find the most meaningful class (excluding dynamic classes)
    const classes = Array.from(element.classList)
      .filter(c =>
        !c.match(/^[a-z]+-[a-f0-9]+$/i) &&
        !c.match(/^_/) &&
        !c.match(/^css-/) &&
        !c.match(/^sc-/) &&
        !c.startsWith('rss-everything-')
      );

    const tag = element.tagName.toLowerCase();

    // If element has a good class, return tag.class
    if (classes.length > 0) {
      return `${tag}.${classes[0]}`;
    }

    // Try to find a parent with ID or good class
    let parent = element.parentElement;
    while (parent && parent !== parent.ownerDocument?.body) {
      if (parent.id) {
        return `#${parent.id} ${tag}`;
      }

      const parentClasses = Array.from(parent.classList)
        .filter(c =>
          !c.match(/^[a-z]+-[a-f0-9]+$/i) &&
          !c.match(/^_/) &&
          !c.match(/^css-/) &&
          !c.match(/^sc-/) &&
          !c.startsWith('rss-everything-')
        );

      if (parentClasses.length > 0) {
        return `.${parentClasses[0]} ${tag}`;
      }

      parent = parent.parentElement;
    }

    // Fallback to just tag name
    return tag;
  }, []);

  // Initialize iframe with HTML content
  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe || !html) return;

    const doc = iframe.contentDocument;
    if (!doc) return;

    // Parse and inject the HTML
    const parser = new DOMParser();
    const parsed = parser.parseFromString(html, 'text/html');

    // Add base tag for relative URLs
    const base = parsed.createElement('base');
    base.href = baseUrl;
    parsed.head.insertBefore(base, parsed.head.firstChild);

    // Add custom styles for highlighting
    const style = parsed.createElement('style');
    style.textContent = `
      * {
        cursor: crosshair !important;
      }
      .rss-everything-hover {
        outline: 2px solid #3b82f6 !important;
        outline-offset: 2px !important;
        background-color: rgba(59, 130, 246, 0.1) !important;
      }
      .rss-everything-selected {
        outline: 3px solid #16a34a !important;
        outline-offset: 2px !important;
        background-color: rgba(22, 163, 74, 0.1) !important;
      }
    `;
    parsed.head.appendChild(style);

    // Write the modified HTML
    doc.open();
    doc.write(parsed.documentElement.outerHTML);
    doc.close();

    setIsReady(true);
  }, [html, baseUrl]);

  // Handle events in iframe
  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe || !isReady) return;

    const doc = iframe.contentDocument;
    if (!doc) return;

    let lastHovered: Element | null = null;

    const handleMouseOver = (e: MouseEvent) => {
      const target = e.target as Element;
      if (!target || target === doc.body || target === doc.documentElement) return;

      if (lastHovered && lastHovered !== target) {
        lastHovered.classList.remove('rss-everything-hover');
      }

      target.classList.add('rss-everything-hover');
      lastHovered = target;
      setHoveredElement(target);
    };

    const handleMouseOut = (e: MouseEvent) => {
      const target = e.target as Element;
      if (target) {
        target.classList.remove('rss-everything-hover');
      }
    };

    const handleClick = (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();

      const target = e.target as Element;
      if (!target || target === doc.body || target === doc.documentElement) return;

      // Generate selector
      const selector = e.shiftKey
        ? generateGeneralSelector(target)  // Shift+click for general selector
        : generateSelector(target);         // Normal click for specific selector

      onSelectorChange(selector);
    };

    doc.addEventListener('mouseover', handleMouseOver, true);
    doc.addEventListener('mouseout', handleMouseOut, true);
    doc.addEventListener('click', handleClick, true);

    // Prevent navigation - 모든 링크 이벤트 차단 (터치 포함)
    const preventNavigation = (e: Event) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'A' || target.closest('a')) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    doc.addEventListener('click', preventNavigation, false);
    doc.addEventListener('touchend', preventNavigation, false);
    doc.addEventListener('touchstart', preventNavigation, { passive: false });

    // Disable pointer events on all links to prevent any navigation
    const style = doc.createElement('style');
    style.id = 'rss-everything-link-disable';
    style.textContent = `
      a {
        pointer-events: auto !important;
        cursor: crosshair !important;
      }
    `;
    doc.head.appendChild(style);

    return () => {
      doc.removeEventListener('mouseover', handleMouseOver, true);
      doc.removeEventListener('mouseout', handleMouseOut, true);
      doc.removeEventListener('click', handleClick, true);
      doc.removeEventListener('click', preventNavigation, false);
      doc.removeEventListener('touchend', preventNavigation, false);
      doc.removeEventListener('touchstart', preventNavigation);
      const linkStyle = doc.getElementById('rss-everything-link-disable');
      if (linkStyle) linkStyle.remove();
    };
  }, [isReady, generateSelector, generateGeneralSelector, onSelectorChange]);

  // Highlight currently selected elements
  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe || !isReady) return;

    const doc = iframe.contentDocument;
    if (!doc) return;

    // Remove previous selections
    doc.querySelectorAll('.rss-everything-selected').forEach(el => {
      el.classList.remove('rss-everything-selected');
    });

    // Highlight new selections
    if (currentSelector) {
      try {
        doc.querySelectorAll(currentSelector).forEach(el => {
          el.classList.add('rss-everything-selected');
        });
      } catch {
        // Invalid selector, ignore
      }
    }
  }, [currentSelector, isReady]);

  return (
    <div className="relative h-full w-full">
      {/* Tooltip showing hovered element info */}
      {hoveredElement && (
        <div className="absolute top-2 left-2 z-10 bg-black/80 text-white text-xs px-2 py-1 rounded max-w-md truncate">
          {hoveredElement.tagName.toLowerCase()}
          {hoveredElement.className && `.${Array.from(hoveredElement.classList).filter(c => !c.startsWith('rss-everything-')).slice(0, 2).join('.')}`}
        </div>
      )}

      {/* Help text */}
      <div className="absolute bottom-2 right-2 z-10 bg-black/80 text-white text-xs px-2 py-1 rounded">
        Click: Select | Shift+Click: General selector
      </div>

      <iframe
        ref={iframeRef}
        className="w-full h-full border-0"
        sandbox="allow-same-origin"
        title="HTML Preview"
      />
    </div>
  );
}
