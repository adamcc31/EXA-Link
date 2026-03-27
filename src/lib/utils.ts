import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Utility untuk menggabungkan Tailwind CSS class names.
 * Menggabungkan clsx untuk conditional classes dan tailwind-merge untuk deduplication.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Format tanggal ke format Indonesia (DD/MM/YYYY).
 */
export function formatTanggal(date: string | Date): string {
  const d = new Date(date);
  return d.toLocaleDateString('id-ID', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

/**
 * Format tanggal dan waktu ke format Indonesia.
 */
export function formatTanggalWaktu(date: string | Date): string {
  const d = new Date(date);
  return d.toLocaleDateString('id-ID', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Format ukuran file ke format yang mudah dibaca (KB, MB, GB).
 */
export function formatUkuranFile(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const satuan = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${satuan[i]}`;
}

/**
 * Masking nama untuk challenge page (contoh: "Suzuki Tanaka" → "S***ki T***ka").
 */
export function maskNama(nama: string): string {
  return nama
    .split(' ')
    .map((kata) => {
      if (kata.length <= 2) return kata;
      return kata[0] + '***' + kata.slice(-2);
    })
    .join(' ');
}
