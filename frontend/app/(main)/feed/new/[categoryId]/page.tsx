'use client';

import { useParams } from 'next/navigation';
import FeedEditPage from '@/components/settings/FeedEditPage';

export default function FeedCreateWithCategoryRoute() {
  const params = useParams();
  const categoryId = Number(params.categoryId);

  return <FeedEditPage categoryId={categoryId} />;
}
