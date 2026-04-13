'use client';

import AppLayout from '@/components/layout/AppLayout';
import { useSiteStore } from '@/stores/siteStore';

export default function MainLayout({ children }: { children: React.ReactNode }) {
  const siteName = useSiteStore((s) => s.siteName);

  return (
    <AppLayout siteName={siteName}>
      {children}
    </AppLayout>
  );
}
