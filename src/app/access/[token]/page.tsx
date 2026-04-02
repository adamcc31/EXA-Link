'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { FileText, Loader2, AlertTriangle, Lock, Clock } from 'lucide-react';

type TokenStatus = 'loading' | 'challenge_required' | 'invalid' | 'expired' | 'locked';

interface TokenInfo {
  status: TokenStatus;
  clientNameHint: string;
  lockMessage?: string;
}

export default function AccessPage() {
  const params = useParams();
  const router = useRouter();
  const token = params.token as string;

  const [tokenInfo, setTokenInfo] = useState<TokenInfo>({
    status: 'loading',
    clientNameHint: '',
  });
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [error, setError] = useState('');
  const [remainingAttempts, setRemainingAttempts] = useState<number | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);

  // Validasi token saat halaman dimuat
  useEffect(() => {
    validateToken();
  }, [token]);

  async function validateToken() {
    try {
      const res = await fetch(`/api/access/${token}`);
      const data = await res.json();

      if (data.success) {
        setTokenInfo({
          status: 'challenge_required',
          clientNameHint: data.data.client_name_hint,
        });
      } else {
        const code = data.error?.code;
        if (code === 'TOKEN_EXPIRED') {
          setTokenInfo({ status: 'expired', clientNameHint: '' });
        } else if (code === 'TOKEN_LOCKED') {
          setTokenInfo({
            status: 'locked',
            clientNameHint: '',
            lockMessage: data.error?.message,
          });
        } else {
          setTokenInfo({ status: 'invalid', clientNameHint: '' });
        }
      }
    } catch {
      setTokenInfo({ status: 'invalid', clientNameHint: '' });
    }
  }

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    setIsVerifying(true);
    setError('');

    try {
      const res = await fetch(`/api/access/${token}/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date_of_birth: dateOfBirth }),
      });

      const data = await res.json();

      if (data.success) {
        // Berhasil! Redirect ke halaman dokumen
        router.push(`/access/${token}/documents`);
      } else {
        const code = data.error?.code;
        if (code === 'TOKEN_LOCKED') {
          setTokenInfo({
            status: 'locked',
            clientNameHint: '',
            lockMessage: data.error?.message,
          });
        } else if (code === 'CHALLENGE_FAILED') {
          setError(data.error?.message);
          setRemainingAttempts(data.error?.remaining_attempts ?? null);
        } else {
          setError(data.error?.message ?? 'Terjadi kesalahan.');
        }
      }
    } catch (err: any) {
      console.error(err);
      setError(`Terjadi kesalahan koneksi (${err.message}). Silakan coba lagi.`);
    } finally {
      setIsVerifying(false);
    }
  }

  // === Loading State ===
  if (tokenInfo.status === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-primary/5 via-background to-primary/10">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // === Error States ===
  if (tokenInfo.status === 'invalid') {
    return (
      <ErrorScreen
        icon={<AlertTriangle className="h-8 w-8 text-destructive" />}
        title="Link Tidak Valid"
        message="Link yang Anda gunakan tidak valid atau sudah tidak berlaku. Silakan hubungi agen Anda untuk meminta link baru."
      />
    );
  }

  if (tokenInfo.status === 'expired') {
    return (
      <ErrorScreen
        icon={<Clock className="h-8 w-8 text-warning" />}
        title="Link Sudah Kadaluarsa"
        message="Link akses ini sudah melewati batas waktu. Silakan hubungi agen Anda untuk meminta link baru."
      />
    );
  }

  if (tokenInfo.status === 'locked') {
    return (
      <ErrorScreen
        icon={<Lock className="h-8 w-8 text-destructive" />}
        title="Akses Terkunci"
        message={tokenInfo.lockMessage ?? 'Terlalu banyak percobaan verifikasi yang gagal. Silakan coba lagi nanti.'}
      />
    );
  }

  // === Challenge Form ===
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-primary/5 via-background to-primary/10 px-4">
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader className="space-y-4 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary shadow-lg">
            <FileText className="h-7 w-7 text-primary-foreground" />
          </div>
          <div>
            <CardTitle className="text-xl">Verifikasi Identitas</CardTitle>
            <CardDescription>
              Dokumen untuk:{' '}
              <span className="font-semibold text-foreground">
                {tokenInfo.clientNameHint}
              </span>
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleVerify} className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="dob" className="text-sm font-medium">
                Tanggal Lahir
              </label>
              <Input
                id="dob"
                type="date"
                value={dateOfBirth}
                onChange={(e) => setDateOfBirth(e.target.value)}
                required
                max={new Date().toISOString().split('T')[0]}
              />
              <p className="text-xs text-muted-foreground">
                Masukkan tanggal lahir untuk memverifikasi identitas Anda
              </p>
            </div>

            {error && (
              <div className="rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive">
                {error}
                {remainingAttempts !== null && (
                  <p className="mt-1 font-medium">
                    Sisa percobaan: {remainingAttempts}
                  </p>
                )}
              </div>
            )}

            <Button type="submit" className="w-full" disabled={isVerifying || !dateOfBirth}>
              {isVerifying ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Memverifikasi...
                </>
              ) : (
                'Verifikasi'
              )}
            </Button>
          </form>

          <p className="mt-6 text-center text-xs text-muted-foreground">
            © 2026 EXATA — Sistem Distribusi Dokumen Aman
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function ErrorScreen({
  icon,
  title,
  message,
}: {
  icon: React.ReactNode;
  title: string;
  message: string;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-primary/5 via-background to-primary/10 px-4">
      <Card className="w-full max-w-md shadow-xl">
        <CardContent className="space-y-4 py-10 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-muted">
            {icon}
          </div>
          <h2 className="text-xl font-bold">{title}</h2>
          <p className="text-sm text-muted-foreground">{message}</p>
        </CardContent>
      </Card>
    </div>
  );
}
