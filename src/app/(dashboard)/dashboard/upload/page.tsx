'use client';

import { useState } from 'react';
import BulkUploadInterface from '@/components/bulk-upload/BulkUploadInterface';
import GensenUploadInterface from '@/components/bulk-upload/GensenUploadInterface';
import { Header } from '@/components/layout/header';

export default function UploadPage() {
  const [activeTab, setActiveTab] = useState<'nenkin' | 'gensen'>('nenkin');

  return (
    <>
      <Header 
        title="Upload Dokumen" 
        description="Unggah dokumen client massal berbasis Folder Excel Match (Bulk Upload)" 
      />
      <div className="mx-auto w-full p-6 space-y-6">
        <div className="flex border-b border-gray-200">
          <button
            onClick={() => setActiveTab('nenkin')}
            className={`px-6 py-3 text-sm font-bold transition-all border-b-2 ${
              activeTab === 'nenkin' 
                ? 'border-blue-600 text-blue-600' 
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Nenkin (Standar)
          </button>
          <button
            onClick={() => setActiveTab('gensen')}
            className={`px-6 py-3 text-sm font-bold transition-all border-b-2 ${
              activeTab === 'gensen' 
                ? 'border-blue-600 text-blue-600' 
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Gensen (Tahun)
          </button>
        </div>

        <div className="transition-all duration-300">
          {activeTab === 'nenkin' ? (
            <BulkUploadInterface />
          ) : (
            <GensenUploadInterface />
          )}
        </div>
      </div>
    </>
  );
}
