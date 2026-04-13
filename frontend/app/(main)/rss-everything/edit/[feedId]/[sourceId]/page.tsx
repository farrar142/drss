'use client';

import { useParams } from 'next/navigation';
import RSSEverythingPage from '@/components/rss-everything/RSSEverythingPage';

export default function RSSEverythingEditRoute() {
  const params = useParams();
  const feedId = Number(params.feedId);
  const sourceId = Number(params.sourceId);

  return (
    <RSSEverythingPage
      context={{ mode: 'edit', feedId, sourceId }}
    />
  );
}
