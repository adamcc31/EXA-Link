import { redirect } from 'next/navigation';

/**
 * Halaman root — redirect ke login page.
 * Setelah autentikasi, user akan diarahkan ke /dashboard.
 */
export default function RootPage() {
  redirect('/login');
}
