'use client';

import { useParams } from 'next/navigation';
import { notFound } from 'next/navigation';
import RSSEverythingPage from '@/components/rss-everything/RSSEverythingPage';

export default function RSSEverythingCreateRoute() {
  const params = useParams();
  const feedId = Number(params.feedId);

  if (isNaN(feedId)) {
    notFound();
  }

  return (
    <RSSEverythingPage
      context={{ mode: 'create', feedId }}
    />
  );
}
