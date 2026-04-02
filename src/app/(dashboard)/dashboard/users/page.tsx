'use client';

import { useState, useEffect } from 'react';
import { Header } from '@/components/layout/header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { UserPlus, Ban, Loader2 } from 'lucide-react';

interface User {
  id: string;
  email: string;
  full_name: string;
  role: string;
  is_active: boolean;
  created_at: string;
  stats: {
    clients_count: number;
    uploads_count: number;
  };
}

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  async function fetchUsers() {
    setIsLoading(true);
    try {
      const res = await fetch('/api/users');
      const data = await res.json();
      if (data.success) setUsers(data.data);
    } catch {
      // Silent fail
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    fetchUsers();
  }, []);

  async function handleDeactivate(userId: string) {
    if (!confirm('Yakin ingin menonaktifkan user ini?')) return;

    try {
      await fetch(`/api/users/${userId}/deactivate`, { method: 'PATCH' });
      fetchUsers();
    } catch {
      // Silent fail
    }
  }

  return (
    <>
      <Header title="Kelola Pengguna" description="Manajemen user internal" />
      <div className="space-y-4 p-6">
        <div className="flex justify-end">
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger render={<Button />}>
              <UserPlus className="mr-2 h-4 w-4" />
              Tambah User
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Tambah User Baru</DialogTitle>
              </DialogHeader>
              <CreateUserForm
                onSuccess={() => {
                  setIsDialogOpen(false);
                  fetchUsers();
                }}
              />
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {isLoading ? (
            <div className="col-span-full flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            users.map((user) => (
              <Card key={user.id} className={!user.is_active ? 'opacity-50' : ''}>
                <CardContent className="space-y-3 pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">{user.full_name}</p>
                      <p className="text-xs text-muted-foreground">{user.email}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="capitalize">
                        {user.role}
                      </Badge>
                      {!user.is_active && (
                        <Badge variant="destructive">Nonaktif</Badge>
                      )}
                    </div>
                  </div>

                  <div className="flex gap-4 border-t pt-3 text-sm text-muted-foreground">
                    <span>{user.stats.clients_count} client</span>
                    <span>{user.stats.uploads_count} upload</span>
                  </div>

                  {user.is_active && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                      onClick={() => handleDeactivate(user.id)}
                    >
                      <Ban className="mr-2 h-3.5 w-3.5" />
                      Nonaktifkan
                    </Button>
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
    </>
  );
}

function CreateUserForm({ onSuccess }: { onSuccess: () => void }) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setIsSubmitting(true);
    setError('');

    const formData = new FormData(e.currentTarget);

    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: formData.get('email'),
          full_name: formData.get('full_name'),
          role: formData.get('role'),
          password: formData.get('password'),
        }),
      });

      const data = await res.json();
      if (data.success) {
        onSuccess();
      } else {
        setError(data.error?.message ?? 'Gagal membuat user.');
      }
    } catch {
      setError('Terjadi kesalahan.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <label className="text-sm font-medium">Nama Lengkap *</label>
        <Input name="full_name" required />
      </div>
      <div className="space-y-2">
        <label className="text-sm font-medium">Email *</label>
        <Input name="email" type="email" required />
      </div>
      <div className="space-y-2">
        <label className="text-sm font-medium">Role *</label>
        <select name="role" className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" required>
          <option value="agent">Agent</option>
          <option value="admin">Admin</option>
        </select>
      </div>
      <div className="space-y-2">
        <label className="text-sm font-medium">Password *</label>
        <Input name="password" type="password" minLength={8} required />
        <p className="text-xs text-muted-foreground">Minimal 8 karakter, harus mengandung huruf dan angka</p>
      </div>
      {error && (
        <div className="rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}
      <Button type="submit" className="w-full" disabled={isSubmitting}>
        {isSubmitting ? 'Menyimpan...' : 'Buat User'}
      </Button>
    </form>
  );
}
