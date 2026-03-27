/**
 * Halaman challenge verification — akan diimplementasikan di Fase 5.
 * Ini adalah halaman yang diakses client melalui tokenized URL.
 */
export default function TokenAccessPage({ params }: { params: Promise<{ token: string }> }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-secondary">
      <div className="w-full max-w-md rounded-lg bg-card p-8 text-center shadow-lg">
        <div className="mb-6 text-4xl">🔒</div>
        <h1 className="mb-4 text-xl font-bold text-foreground">Verifikasi Identitas</h1>
        <p className="text-muted-foreground">
          Halaman verifikasi challenge akan diimplementasikan di Fase 5.
        </p>
      </div>
    </div>
  );
}
