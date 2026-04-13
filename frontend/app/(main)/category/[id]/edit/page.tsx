'use client';

import { useParams } from 'next/navigation';
import { CategoryEditPage } from '@/components/settings/CategoryEditPage';

export default function CategoryEditRoute() {
  const params = useParams();
  const categoryId = Number(params.id);

  return <CategoryEditPage categoryId={categoryId} />;
}
