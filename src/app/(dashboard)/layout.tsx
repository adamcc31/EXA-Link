import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { Sidebar } from '@/components/layout/sidebar';

/**
 * Layout untuk semua halaman dashboard.
 * Memvalidasi autentikasi dan menyediakan sidebar navigation.
 */
export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();

  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser) {
    redirect('/login');
  }

  // Ambil profil user
  const { data: userProfile } = await supabase
    .from('users')
    .select('full_name, role')
    .eq('id', authUser.id)
    .single();

  if (!userProfile) {
    redirect('/login');
  }

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar userRole={userProfile.role} userName={userProfile.full_name} />
      <main className="ml-64 flex-1">
        {children}
      </main>
    </div>
  );
}
