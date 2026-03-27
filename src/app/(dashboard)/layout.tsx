/**
 * Layout dashboard internal — akan diimplementasikan di Fase 4.
 * Menyediakan sidebar dan header untuk seluruh halaman /dashboard/*.
 */
export default function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="flex min-h-screen">
      {/* Sidebar — akan diimplementasikan di Fase 4 */}
      <aside className="hidden w-64 border-r border-border bg-sidebar lg:block">
        <div className="flex h-16 items-center px-6">
          <span className="text-lg font-bold text-sidebar-foreground">EXATA</span>
        </div>
        <nav className="space-y-1 px-3 py-4">
          <p className="px-3 text-xs text-muted-foreground">
            Navigasi akan diimplementasikan di Fase 4
          </p>
        </nav>
      </aside>
      {/* Konten Utama */}
      <main className="flex-1 bg-secondary">
        <div className="p-6">{children}</div>
      </main>
    </div>
  );
}
