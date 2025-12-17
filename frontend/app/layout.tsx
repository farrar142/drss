import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { cookies } from "next/headers";
import "./globals.css";
import { ClientLayout } from '@/ClientLayout';
import { THEME_COOKIE_NAME, getThemeFromCookie, getInitialThemeStyles } from '@/stores/themeStore';

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "DRSS",
  description: "Django RSS Reader",
};

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

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // 서버에서 쿠키를 읽어 초기 테마 결정
  const cookieStore = await cookies();
  const themeCookie = cookieStore.get(THEME_COOKIE_NAME);
  const themeData = themeCookie ? getThemeFromCookie(themeCookie.value ? `${THEME_COOKIE_NAME}=${themeCookie.value}` : undefined) : null;

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
        <ClientLayout initialTheme={themeData}>
          {children}
        </ClientLayout>
      </body>
    </html>
  );
}
