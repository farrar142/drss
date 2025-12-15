
// Masonry layout hook - distributes items into columns in sequential groups

import { useState, useRef, useCallback, useMemo } from "react";

// Items are processed in groups of `columns` size, maintaining reading order
export const useMasonryLayout = <T extends { id: number }>(items: T[], columns: number) => {
  const [itemHeights, setItemHeights] = useState<Map<number, number>>(new Map());
  const heightsRef = useRef<Map<number, number>>(new Map());
  const updateTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pendingUpdatesRef = useRef<Map<number, number>>(new Map());

  // Register height for an item - debounced and only updates if significantly different
  const registerHeight = useCallback((itemId: number, height: number) => {
    const currentHeight = heightsRef.current.get(itemId) || 0;

    // Only update if height changed by more than 20px (avoid micro-adjustments)
    if (Math.abs(currentHeight - height) > 20) {
      pendingUpdatesRef.current.set(itemId, height);

      // Debounce updates to batch them together
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current);
      }

      updateTimeoutRef.current = setTimeout(() => {
        if (pendingUpdatesRef.current.size > 0) {
          setItemHeights(prev => {
            const newMap = new Map(prev);
            pendingUpdatesRef.current.forEach((h, id) => {
              newMap.set(id, h);
              heightsRef.current.set(id, h);
            });
            pendingUpdatesRef.current.clear();
            return newMap;
          });
        }
      }, 300); // Wait 300ms before applying updates
    }
  }, []);

  // Calculate which column each item should go into
  // Process items in groups of `columns`, within each group place in shortest column
  const columnItems = useMemo(() => {
    const result: T[][] = Array.from({ length: columns }, () => []);
    const columnHeights = Array(columns).fill(0);

    // Process items in groups of `columns` size
    for (let i = 0; i < items.length; i += columns) {
      const group = items.slice(i, i + columns);

      // Sort group items by their heights (largest first) for better distribution
      const sortedGroup = [...group].sort((a, b) => {
        const heightA = itemHeights.get(a.id) || 300;
        const heightB = itemHeights.get(b.id) || 300;
        return heightB - heightA; // Largest first
      });

      // Assign each item in the group to the shortest column
      sortedGroup.forEach(item => {
        const shortestColumnIndex = columnHeights.indexOf(Math.min(...columnHeights));
        result[shortestColumnIndex].push(item);

        const itemHeight = itemHeights.get(item.id) || 300;
        columnHeights[shortestColumnIndex] += itemHeight;
      });
    }

    return result;
  }, [items, columns, itemHeights]);

  const getItemHeight = (id: number) => heightsRef.current.get(id) || 300;
  return { columnItems, registerHeight, getItemHeight };
};

