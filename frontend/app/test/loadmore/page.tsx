"use client";

import React, { useCallback, useState } from "react";
import { FeedViewer } from "@/app/components/FeedViewer";

type TestItem = {
  id: number;
  feed_id: number;
  title: string;
  link: string;
  description: string;
  published_at: string;
  is_read: boolean;
  is_favorite: boolean;
};

// Generate items with variable heights (short vs long content)
const makeItem = (id: number, long = false): TestItem => ({
  id,
  feed_id: 1,
  title: `Item ${id}`,
  link: '#',
  description: long ? `<p>${'Long content. '.repeat(60)}</p>` : `<p>Short</p>`,
  published_at: new Date().toISOString(),
  is_read: false,
  is_favorite: false,
});

export default function Page() {
  const initial: TestItem[] = [];
  // Make a pattern so columns 1 and 3 end up long: produce long, short, long, short...
  for (let i = 1; i <= 30; i++) {
    initial.push(makeItem(i, i % 2 === 1));
  }

  const [items, setItems] = useState(initial);
  const [loadCount, setLoadCount] = useState(0);

  const onLoadMore = useCallback(() => {
    const nextId = items.length + 1;
    const more: TestItem[] = [];
    for (let i = 0; i < 10; i++) {
      more.push(makeItem(nextId + i, (nextId + i) % 2 === 1));
    }
    setItems(prev => [...prev, ...more]);
    setLoadCount(c => c + 1);
  }, [items.length]);

  return (
    <div className="p-6">
      <h1 className="text-xl font-bold mb-4">LoadMore test page</h1>
      <div id="load-count">{loadCount}</div>
      <FeedViewer items={items} onLoadMore={onLoadMore} hasNext={true} />
    </div>
  );
}
