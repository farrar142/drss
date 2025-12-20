import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { cookies, headers } from "next/headers";
import "./globals.css";
import { ClientLayout } from '@/ClientLayout';
import { THEME_COOKIE_NAME, getThemeFromCookie, getInitialThemeStyles } from '@/stores/themeStore';
import { SignupStatusSchema } from '@/services/api';

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// viewport-fit=cover를 설정하여 safe-area-inset을 사용할 수 있게 함
// 모바일에서 핀치 줌 비활성화
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
};

// 기본 색상
const defaultColors = {
  primary: '#6366f1',
  secondary: '#8b5cf6',
};

// 서버 사이드에서 사이트 설정 불러오기
async function fetchSiteSettings(): Promise<SignupStatusSchema | null> {
  try {
    // 서버 사이드에서는 내부 네트워크 URL 사용
    const apiUrl = process.env.INTERNAL_API_URL || 'http://django:8000';
    const res = await fetch(`${apiUrl}/api/auth/signup-status`, {
      next: { revalidate: 60 }, // 60초마다 재검증
    });
    if (!res.ok) return null;
    return await res.json();
  } catch (e) {
    console.error('Failed to fetch site settings:', e);
    return null;
  }
}

// 동적 메타데이터 생성
export async function generateMetadata(): Promise<Metadata> {
  const siteSettings = await fetchSiteSettings();
  const siteName = siteSettings?.site_name || 'DRSS';

  return {
    title: siteName,
    description: 'Django RSS Reader',
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // 서버에서 쿠키를 읽어 초기 테마 결정
  const cookieStore = await cookies();
  const themeCookie = cookieStore.get(THEME_COOKIE_NAME);
  const themeData = themeCookie ? getThemeFromCookie(themeCookie.value ? `${THEME_COOKIE_NAME}=${themeCookie.value}` : undefined) : null;

  // 서버에서 사이트 설정 미리 불러오기 (실패 시 기본값 사용)
  const siteSettings = await fetchSiteSettings() ?? { site_name: 'DRSS', allow_signup: true };

  // 초기 다크모드 클래스 결정 (system인 경우 기본 dark)
  const initialDark = themeData?.mode === 'dark' || themeData?.mode === 'system' || !themeData;

  // 초기 색상 결정
  const initialColors = themeData?.colors || defaultColors;

  // 초기 CSS 변수 스타일 생성
  const initialStyles = getInitialThemeStyles(initialColors, initialDark);

  return (
    <html lang="en" className={initialDark ? 'dark' : ''}>
      <head>
        <style dangerouslySetInnerHTML={{ __html: `:root { ${initialStyles} }` }} />
      </head>
      <body className={`${geistSans.variable} ${geistMono.variable}`}>
        <ClientLayout initialTheme={themeData} initialSiteSettings={siteSettings}>
          {children}
        </ClientLayout>
      </body>
    </html>
  );
}
