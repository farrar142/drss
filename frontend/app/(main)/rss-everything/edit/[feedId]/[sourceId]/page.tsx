'use client';

import { useParams } from 'next/navigation';
import { notFound } from 'next/navigation';
import RSSEverythingPage from '@/components/rss-everything/RSSEverythingPage';

export default function RSSEverythingEditRoute() {
  const params = useParams();
  const feedId = Number(params.feedId);
  const sourceId = Number(params.sourceId);

  if (isNaN(feedId) || isNaN(sourceId)) {
    notFound();
  }

  return (
    <RSSEverythingPage
      context={{ mode: 'edit', feedId, sourceId }}
    />
  );
}
