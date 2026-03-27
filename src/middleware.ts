import { type NextRequest, NextResponse } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';

/**
 * Route yang tidak memerlukan autentikasi internal.
 * - /login: halaman login
 * - /access: halaman publik untuk client access
 * - /api/health: health check endpoint
 * - /api/access: public API untuk verifikasi token client
 */
const RUTE_PUBLIK = ['/login', '/access', '/api/health', '/api/access'];

/**
 * Memeriksa apakah pathname termasuk rute publik.
 */
function isRutePublik(pathname: string): boolean {
  return RUTE_PUBLIK.some((rute) => pathname.startsWith(rute));
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Izinkan akses ke rute publik tanpa autentikasi
  if (isRutePublik(pathname)) {
    const { supabaseResponse } = await updateSession(request);
    return supabaseResponse;
  }

  // Untuk rute yang memerlukan autentikasi (dashboard, API internal)
  const { supabaseResponse, user } = await updateSession(request);

  if (!user) {
    // User belum login — redirect ke halaman login
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    /*
     * Cocokkan semua request kecuali:
     * - _next/static (file statis)
     * - _next/image (optimasi gambar)
     * - favicon.ico, sitemap.xml, robots.txt (file metadata)
     * - File statis di /public
     */
    '/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
