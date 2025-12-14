import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
    // API 경로는 제외 (백엔드에서 처리)
    if (request.nextUrl.pathname.startsWith('/api')) {
        return NextResponse.next();
    }

    // 정적 파일 제외
    if (
        request.nextUrl.pathname.startsWith('/_next') ||
        request.nextUrl.pathname.startsWith('/favicon.ico') ||
        request.nextUrl.pathname.includes('.')
    ) {
        return NextResponse.next();
    }

    // 토큰 확인
    const token = request.cookies.get('token')?.value;

    if (!token) {
        // 토큰이 없으면 로그인 페이지로 리다이렉트
        const loginUrl = new URL('/auth/signin', request.url);
        return NextResponse.redirect(loginUrl);
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