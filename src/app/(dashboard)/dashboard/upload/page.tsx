import BulkUploadInterface from '@/components/bulk-upload/BulkUploadInterface';
import { Header } from '@/components/layout/header';

export const metadata = {
  title: 'Upload Dokumen | EXATA',
  description: 'Unggah dokumen client massal untuk sistem distibusi Exata'
};

export default function UploadPage() {
  return (
    <>
      <Header title="Upload Dokumen" description="Unggah dokumen client massal berbasis Folder Excel Match (Bulk Upload)" />
      <div className="mx-auto w-full p-6">
        <BulkUploadInterface />
      </div>
    </>
  );
}
