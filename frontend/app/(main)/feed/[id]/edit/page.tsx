'use client';

import { useParams } from 'next/navigation';
import { notFound } from 'next/navigation';
import FeedEditPage from '@/components/settings/FeedEditPage';

export default function FeedEditRoute() {
  const params = useParams();
  const feedId = Number(params.id);

  if (isNaN(feedId)) {
    notFound();
  }

  return <FeedEditPage feedId={feedId} />;
}
