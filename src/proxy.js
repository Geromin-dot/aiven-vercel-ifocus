import { NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';

function noStore(response) {
  response.headers.set('Cache-Control', 'private, no-store, max-age=0, must-revalidate');
  response.headers.set('Pragma', 'no-cache');
  response.headers.set('Expires', '0');
  return response;
}

export async function proxy(request) {
  if (request.nextUrl.pathname.startsWith('/api/')) return noStore(NextResponse.next());
  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
  if (token?.error === 'ACCOUNT_DELETED' && request.nextUrl.pathname !== '/login') {
    return noStore(NextResponse.redirect(new URL('/login?error=ACCOUNT_DELETED', request.url)));
  }
  if (request.nextUrl.pathname === '/login') {
    if (token?.sub && token.status !== 'ON_HOLD' && token.status !== 'BANNED' && !request.nextUrl.searchParams.has('error')) {
      const destination = token.role === 'ADMIN' || token.username === 'adminUAnursing' ? '/admin' : '/dashboard';
      return noStore(NextResponse.redirect(new URL(destination, request.url)));
    }
    return noStore(NextResponse.next());
  }
  if (!token) {
    const login = new URL('/login', request.url);
    login.searchParams.set('callbackUrl', request.nextUrl.pathname);
    return noStore(NextResponse.redirect(login));
  }
  return noStore(NextResponse.next());
}

export const config = { matcher: ['/login', '/api/:path*', '/dashboard/:path*', '/flashcards/:path*', '/coach/:path*', '/analytics/:path*', '/settings/:path*', '/admin/:path*'] };
