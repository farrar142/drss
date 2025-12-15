import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { cookies } from "next/headers";
import "./globals.css";
import { ClientLayout } from './ClientLayout';
import { THEME_COOKIE_NAME, getThemeFromCookie } from './stores/themeStore';

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
  
  return (
    <html lang="en" className={initialDark ? 'dark' : ''}>
      <body className={`${geistSans.variable} ${geistMono.variable}`}>
        <ClientLayout initialTheme={themeData}>
          {children}
        </ClientLayout>
      </body>
    </html>
  );
}
