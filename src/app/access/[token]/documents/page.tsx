/**
 * Halaman daftar dokumen client — akan diimplementasikan di Fase 5.
 */
export default function DocumentsPage({ params }: { params: Promise<{ token: string }> }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-secondary">
      <div className="w-full max-w-2xl rounded-lg bg-card p-8 shadow-lg">
        <h1 className="mb-4 text-xl font-bold text-foreground">📄 Dokumen Anda</h1>
        <p className="text-muted-foreground">
          Daftar dokumen dan download akan diimplementasikan di Fase 5.
        </p>
      </div>
    </div>
  );
}
