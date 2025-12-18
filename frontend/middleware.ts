import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
    const pathname = request.nextUrl.pathname;

    // API 경로는 제외 (백엔드에서 처리)
    if (pathname.startsWith('/api')) {
        return NextResponse.next();
    }

    // 정적 파일 제외
    if (
        pathname.startsWith('/_next') ||
        pathname.startsWith('/favicon.ico') ||
        pathname.includes('.')
    ) {
        return NextResponse.next();
    }

    // auth 경로는 통과
    if (pathname.startsWith('/auth')) {
        return NextResponse.next();
    }

    // 토큰 확인
    const token = request.cookies.get('token')?.value;

    if (!token) {
        // 토큰이 없으면 로그인 페이지로 리다이렉트
        const loginUrl = new URL('/auth/signin', request.url);
        return NextResponse.redirect(loginUrl);
    }

    // SPA 라우팅: 특정 경로를 홈으로 리다이렉트하면서 쿼리 파라미터로 변환
    // /category/:id → /?openCategory=:id
    const categoryMatch = pathname.match(/^\/category\/(\d+)$/);
    if (categoryMatch) {
        const url = new URL('/home', request.url);
        url.searchParams.set('openCategory', categoryMatch[1]);
        return NextResponse.redirect(url);
    }

    // /category/:id/feed/:feedId → /?openFeed=:feedId&categoryId=:id
    const feedMatch = pathname.match(/^\/category\/(\d+)\/feed\/(\d+)$/);
    if (feedMatch) {
        const url = new URL('/home', request.url);
        url.searchParams.set('openFeed', feedMatch[2]);
        url.searchParams.set('categoryId', feedMatch[1]);
        return NextResponse.redirect(url);
    }

    // /settings → /?openSettings=true
    if (pathname === '/settings') {
        const url = new URL('/home', request.url);
        url.searchParams.set('openSettings', 'true');
        return NextResponse.redirect(url);
    }

    // 토큰이 있으면 통과
    return NextResponse.next();
}

export const config = {
    matcher: [
        /*
         * Match all request paths except for the ones starting with:
         * - api (API routes)
         * - _next/static (static files)
         * - _next/image (image optimization files)
         * - favicon.ico (favicon file)
         * - auth (authentication routes)
         */
        '/((?!api|_next/static|_next/image|favicon.ico|auth).*)',
    ],
};