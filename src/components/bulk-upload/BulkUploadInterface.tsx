'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  parseExcelFile,
  validateBulkUploadV2,
  BulkValidationResult,
  ExcelEntry,
  AgentData,
} from '@/lib/utils/bulk-upload-parser';
import {
  finalizeClientUploadAction,
  FileUploadMeta,
  createBatchJobAction,
  completeBatchJobAction,
  getAgentsAction,
} from '@/lib/actions/bulk-upload.actions';
import pLimit from 'p-limit';
import * as XLSX from 'xlsx';

interface ButtonProps {
  children: React.ReactNode;
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  disabled?: boolean;
  className?: string;
  variant?: 'primary' | 'outline' | 'destructive';
}

const Button = ({ children, onClick, disabled, className, variant = 'primary' }: ButtonProps) => {
  const base = 'px-4 py-2 rounded font-medium disabled:opacity-50 transition-colors';
  const variants = {
    primary: 'bg-blue-600 text-white hover:bg-blue-700',
    outline: 'border border-gray-300 hover:bg-gray-50 text-gray-700',
    destructive: 'bg-red-600 text-white hover:bg-red-700',
  };
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`${base} ${variants[variant] || variants.primary} ${className || ''}`}
    >
      {children}
    </button>
  );
};

export default function BulkUploadInterface() {
  const [agents, setAgents] = useState<AgentData[]>([]);
  const [excelEntries, setExcelEntries] = useState<ExcelEntry[] | null>(null);
  const [validationResult, setValidationResult] = useState<BulkValidationResult | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [uploadResults, setUploadResults] = useState<
    { name: string; success: boolean; link?: string; error?: string }[]
  >([]);
  const [modalConfig, setModalConfig] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    type: 'alert' | 'confirm';
    onConfirm?: () => void;
  }>({ isOpen: false, title: '', message: '', type: 'alert' });
  const [excelFileName, setExcelFileName] = useState<string>('Batch Upload');
  const [hasAutoDownloaded, setHasAutoDownloaded] = useState(false);

  const [dattaiFiles, setDattaiFiles] = useState<File[]>([]);
  const [resiFiles, setResiFiles] = useState<File[]>([]);
  const [kwitansiFiles, setKwitansiFiles] = useState<File[]>([]);

  const handleDocFileChange = (
    e: React.ChangeEvent<HTMLInputElement>,
    setter: React.Dispatch<React.SetStateAction<File[]>>,
  ) => {
    if (!e.target.files) return;
    const files = Array.from(e.target.files);
    const MAX_SIZE = 2 * 1024 * 1024; // 2MB
    const oversizedFiles = files.filter((f) => f.size > MAX_SIZE);

    if (oversizedFiles.length > 0) {
      setModalConfig({
        isOpen: true,
        title: 'Ukuran File Melebihi Batas',
        message: `Terdapat ${oversizedFiles.length} file yang diabaikan karena melebihi batas 2MB. Pastikan setiap file maksimal berukuran 2MB.`,
        type: 'alert',
      });
    }

    setter(files.filter((f) => f.size <= MAX_SIZE));
  };

  useEffect(() => {
    getAgentsAction().then(setAgents);
  }, []);

  const downloadExcel = useCallback(() => {
    const data = uploadResults.map((res) => {
      const client = validationResult?.valid.find((c) => c.clientName === res.name);
      return {
        'Nama Lengkap': res.name,
        'Tanggal Lahir': client?.dob ? client.dob.toLocaleDateString('id-ID') : '',
        PIC: client?.picName || '',
        'Nomor Telephone': client?.phone || '',
        Link: res.link ? `https://www.exata-indonesia.id${res.link}` : '',
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Laporan Link Akses');

    worksheet['!cols'] = [{ wch: 30 }, { wch: 15 }, { wch: 20 }, { wch: 15 }, { wch: 60 }];

    XLSX.writeFile(workbook, `Laporan_Upload_EXATA_${new Date().toISOString().split('T')[0]}.xlsx`);
  }, [uploadResults, validationResult]);

  const downloadTemplate = () => {
    const data = [
      {
        'Nama Lengkap': 'BUDI SANTOSO',
        'Tanggal Lahir': '15/08/1990',
        'PIC': 'NAMA AGENT',
        'Nomor Telephone': '08123456789'
      },
      {
        'Nama Lengkap': 'ANI WIJAYA',
        'Tanggal Lahir': '20/12/1992',
        'PIC': 'NAMA AGENT',
        'Nomor Telephone': ''
      }
    ];
    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Template Nenkin');
    XLSX.writeFile(workbook, `Template_Bulk_Nenkin.xlsx`);
  };

  useEffect(() => {
    if (progress === 100 && !isUploading && !hasAutoDownloaded && uploadResults.length > 0) {
      downloadExcel();
      setHasAutoDownloaded(true);
    }
  }, [progress, isUploading, hasAutoDownloaded, uploadResults.length, downloadExcel]);

  const excelInputRef = useRef<HTMLInputElement>(null);

  const handleExcelUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.length) return;
    setExcelFileName(e.target.files[0].name.replace(/\.[^/.]+$/, ''));
    try {
      const entries = await parseExcelFile(e.target.files[0], agents);
      setExcelEntries(entries);
      setValidationResult(null);
    } catch {
      setModalConfig({
        isOpen: true,
        title: 'Error Input',
        message:
          "Gagal membaca file Excel. Pastikan format benar dan mengandung kolom 'Nama Lengkap', 'Tanggal Lahir', & 'PIC'.",
        type: 'alert',
      });
    }
  };

  const handleValidate = () => {
    if (!excelEntries) {
      setModalConfig({
        isOpen: true,
        title: 'Perhatian',
        message: 'Silakan upload file Excel terlebih dahulu sebagai acuan validasi.',
        type: 'alert',
      });
      return;
    }

    if (dattaiFiles.length === 0 && resiFiles.length === 0 && kwitansiFiles.length === 0) {
      setModalConfig({
        isOpen: true,
        title: 'Perhatian',
        message: 'Silakan upload file dokumen terlebih dahulu.',
        type: 'alert',
      });
      return;
    }

    const result = validateBulkUploadV2(excelEntries, dattaiFiles, resiFiles, kwitansiFiles);
    setValidationResult(result);
  };

  const executeUpload = () => {
    if (!validationResult || validationResult.valid.length === 0) return;
    setModalConfig({
      isOpen: true,
      title: 'Konfirmasi Upload',
      message:
        'Apakah Anda yakin ingin memulai upload? Proses ini tidak dapat dibatalkan di tengah jalan.',
      type: 'confirm',
      onConfirm: () => {
        setModalConfig((prev) => ({ ...prev, isOpen: false }));
        startUploadProcess();
      },
    });
  };

  const startUploadProcess = async () => {
    if (!validationResult) return;
    setIsUploading(true);
    setProgress(0);
    setUploadResults([]);
    setHasAutoDownloaded(false);

    // Concurrency control: max 3 concurrent uploads
    const limit = pLimit(3);
    const total = validationResult.valid.length;
    let completedCount = 0;

    // Start Batch Audit Log
    const { batchId } = await createBatchJobAction(total, excelFileName);

    const tasks = validationResult.valid.map((client) =>
      limit(async () => {
        try {
          const fileMetas: FileUploadMeta[] = [];
          const clientFolderPrefix = `bulk_${client.clientName.replace(/[^a-zA-Z0-9]/g, '_')}_${Date.now()}`;

          const uploadPromises = [
            { file: client.files.dattai_ichijikin, type: 'dattai_ichijikin' },
            { file: client.files.resi_transfer, type: 'resi_transfer' },
            { file: client.files.kwitansi, type: 'kwitansi' },
          ].map(async ({ file, type }) => {
            const fileExt = file.name.split('.').pop();
            const fileName = `${type}_${Date.now()}.${fileExt}`;
            const filePath = `${clientFolderPrefix}/${fileName}`;

            const formData = new FormData();
            formData.append('file', file);
            formData.append('storagePath', filePath);

            const response = await fetch('/api/bulk-upload/upload', {
              method: 'POST',
              body: formData,
            });

            const result = await response.json();
            if (!response.ok || !result.success) {
              throw new Error(result.error?.message || 'Gagal menyimpan dokumen ke server');
            }

            fileMetas.push({
              doc_type: type,
              title: `Dokumen ${type} - ${client.clientName}`,
              file_name: fileName,
              original_file_name: file.name,
              mime_type: file.type || 'application/octet-stream',
              file_size: file.size,
              storage_path: filePath,
            });
          });

          // Wait for all 3 files to be stored
          await Promise.all(uploadPromises);

          // Commit transaction in database
          const res = await finalizeClientUploadAction({
            clientName: client.clientName,
            dob: client.dob.toISOString(),
            phone: client.phone,
            files: fileMetas,
            batchId,
            picId: client.picId,
          });

          setUploadResults((prev) => [
            ...prev,
            { name: client.clientName, success: true, link: res.accessLink },
          ]);
        } catch (err: unknown) {
          const errorMessage = err instanceof Error ? err.message : 'Unknown error';
          console.error('Failed for client:', client.clientName, err);
          setUploadResults((prev) => [
            ...prev,
            { name: client.clientName, success: false, error: errorMessage },
          ]);
        } finally {
          completedCount++;
          setProgress(Math.round((completedCount / total) * 100));
        }
      }),
    );

    await Promise.all(tasks);

    // Complete Batch Job
    await completeBatchJobAction(batchId || '', completedCount, 0);
    setIsUploading(false);
  };

  return (
    <div className="max-w-6xl mx-auto font-sans bg-gray-50 min-h-screen">
      {modalConfig.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-lg w-full max-w-sm overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-2">{modalConfig.title}</h3>
              <p className="text-sm text-gray-600 font-medium">{modalConfig.message}</p>
            </div>
            <div className="bg-gray-50 px-6 py-4 flex justify-end gap-3 border-t">
              <Button
                variant="outline"
                onClick={() => setModalConfig({ ...modalConfig, isOpen: false })}
              >
                {modalConfig.type === 'confirm' ? 'Batal' : 'Tutup'}
              </Button>
              {modalConfig.type === 'confirm' && (
                <Button onClick={modalConfig.onConfirm}>Mulai Upload</Button>
              )}
            </div>
          </div>
        </div>
      )}

      {agents.length === 0 && (
        <div className="mb-4 bg-yellow-50 text-yellow-800 p-4 rounded-lg font-medium animate-pulse border border-yellow-200 shadow-sm">
          Menyinkronkan data Agents untuk memvalidasi PIC...
        </div>
      )}

      <div className="bg-white border rounded-xl overflow-hidden shadow-sm mb-8">
        <div className="bg-blue-600 p-4 text-white flex justify-between items-center">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <span className="bg-white/20 px-2 py-1 rounded text-sm shrink-0">Step 1</span>
            Data Excel Master
          </h2>
          <Button 
            variant="outline" 
            onClick={downloadTemplate} 
            className="bg-white/10 border-white/20 text-white hover:bg-white/20 py-1.5 h-auto text-xs"
          >
            ⬇️ Download Template Excel
          </Button>
        </div>
        <div className="p-6">
          <p className="text-sm text-gray-500 mb-4 font-medium">
            Unggah file laporan Excel yang mengandung daftar nama lengkap, tanggal lahir, dan PIC
            yang bertanggung jawab.
          </p>
          <input
            type="file"
            accept=".xlsx, .xls, .csv"
            className="block text-sm text-gray-500 file:mr-4 file:py-2.5 file:px-4 file:rounded file:border-0 file:bg-blue-50 file:text-blue-700 file:font-semibold hover:file:bg-blue-100 cursor-pointer"
            onChange={handleExcelUpload}
            ref={excelInputRef}
            disabled={isUploading || agents.length === 0}
          />
          {excelEntries && (
            <div className="mt-4 p-4 bg-green-50 rounded-lg border border-green-100 flex gap-4">
              <div className="text-sm text-green-800">
                ✅ <strong>{excelEntries.length} target</strong> termuat.
              </div>
              <div className="text-sm text-blue-800 flex items-center">
                <span>
                  Di-assign ke {new Set(excelEntries.map((e) => e.picName).filter(Boolean)).size}{' '}
                  PIC:{' '}
                </span>
                <div className="flex gap-1 ml-2">
                  {Array.from(new Set(excelEntries.map((e) => e.picName).filter(Boolean))).map(
                    (picName, i) => (
                      <span
                        key={i}
                        className="bg-blue-100 text-blue-800 px-2 py-0.5 rounded text-xs font-semibold"
                      >
                        {picName}
                      </span>
                    ),
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="bg-white border rounded-xl overflow-hidden shadow-sm mb-8">
        <div className="bg-slate-700 p-4 text-white">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <span className="bg-white/20 px-2 py-1 rounded text-sm shrink-0">Step 2</span>
            Kategori Dokumen File
          </h2>
        </div>
        <div className="p-6">
          <p className="text-sm text-gray-500 mb-6 font-medium">
            Masukkan file dokumen sesuai kategorinya. Anda dapat memblok gambar lalu drag-drop ke
            input.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="border bg-gray-50 rounded p-4">
              <h3 className="font-bold text-gray-800 mb-1">Dattai Ichijikin</h3>
              <p className="text-xs text-gray-500 mb-3 font-mono">
                Wajib mengandung Nama Lengkap (Format: JPG, JPEG, PNG, PDF | Maks: 2MB)
              </p>
              <input
                type="file"
                multiple
                accept=".jpg,.jpeg,.png,.pdf,image/jpeg,image/png,application/pdf"
                onChange={(e) => handleDocFileChange(e, setDattaiFiles)}
                className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:bg-blue-50 file:text-blue-700 file:font-semibold hover:file:bg-blue-100 cursor-pointer"
                disabled={!excelEntries || isUploading}
              />
              <div className="mt-2 text-xs font-semibold">{dattaiFiles.length} file dipilih</div>
            </div>

            <div className="border bg-gray-50 rounded p-4">
              <h3 className="font-bold text-gray-800 mb-1">Resi Transfer</h3>
              <p className="text-xs text-gray-500 mb-3 font-mono">
                Wajib mengandung Nama Lengkap (Format: JPG, JPEG, PNG, PDF | Maks: 2MB)
              </p>
              <input
                type="file"
                multiple
                accept=".jpg,.jpeg,.png,.pdf,image/jpeg,image/png,application/pdf"
                onChange={(e) => handleDocFileChange(e, setResiFiles)}
                className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:bg-blue-50 file:text-blue-700 file:font-semibold hover:file:bg-blue-100 cursor-pointer"
                disabled={!excelEntries || isUploading}
              />
              <div className="mt-2 text-xs font-semibold">{resiFiles.length} file dipilih</div>
            </div>

            <div className="border bg-gray-50 rounded p-4">
              <h3 className="font-bold text-gray-800 mb-1">Kwitansi</h3>
              <p className="text-xs text-gray-500 mb-3 font-mono">
                Wajib mengandung Nama Lengkap (Format: JPG, JPEG, PNG, PDF | Maks: 2MB)
              </p>
              <input
                type="file"
                multiple
                accept=".jpg,.jpeg,.png,.pdf,image/jpeg,image/png,application/pdf"
                onChange={(e) => handleDocFileChange(e, setKwitansiFiles)}
                className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:bg-blue-50 file:text-blue-700 file:font-semibold hover:file:bg-blue-100 cursor-pointer"
                disabled={!excelEntries || isUploading}
              />
              <div className="mt-2 text-xs font-semibold">{kwitansiFiles.length} file dipilih</div>
            </div>
          </div>

          <div className="mt-6 pt-6 border-t flex justify-end">
            <Button
              onClick={handleValidate}
              disabled={!excelEntries || isUploading}
              variant="outline"
              className="border-blue-600 text-blue-600 hover:bg-blue-50"
            >
              🔍 Analisis & Pencocokan File
            </Button>
          </div>
        </div>
      </div>

      {validationResult && !isUploading && progress === 0 && (
        <div className="border rounded-xl bg-white shadow-sm overflow-hidden mb-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="p-5 bg-gray-50 border-b flex justify-between items-center">
            <div>
              <h2 className="text-lg font-bold text-gray-800">Hasil Validasi & Matching</h2>
              <p className="text-sm text-gray-500">
                Sistem memetakan dokumen ke baris Excel dan PIC.
              </p>
            </div>
            <Button onClick={executeUpload} disabled={validationResult.valid.length === 0}>
              🚀 Eksekusi Upload ({validationResult.valid.length} Valid)
            </Button>
          </div>

          <div className="p-6">
            <div className="mb-6">
              <h3 className="font-semibold text-green-700 mb-3 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-green-500"></span>
                Daftar Client Valid ({validationResult.valid.length})
              </h3>
              {validationResult.valid.length > 0 ? (
                <div className="overflow-x-auto border rounded-lg bg-white shadow-sm">
                  <table className="w-full text-sm text-left">
                    <thead className="text-xs text-gray-700 uppercase bg-gray-50 border-b">
                      <tr>
                        <th className="px-4 py-3">Client (Excel)</th>
                        <th className="px-4 py-3">PIC Database</th>
                        <th className="px-4 py-3">Matched Files</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {validationResult.valid.map((v, i) => (
                        <tr key={i} className="hover:bg-gray-50">
                          <td className="px-4 py-3">
                            <div className="font-semibold text-gray-800">{v.clientName}</div>
                            <div className="text-xs text-gray-500 mt-1">
                              DOB: {v.dob.toLocaleDateString('id-ID')}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="font-medium text-blue-700 flex items-center gap-1">
                              👩‍💼 {v.picName}
                            </div>
                          </td>
                          <td className="px-4 py-3 font-mono text-xs text-gray-600 break-all space-y-1">
                            <div className="bg-gray-100 px-2 py-1 rounded truncate max-w-xs">
                              {v.files.dattai_ichijikin.name}
                            </div>
                            <div className="bg-gray-100 px-2 py-1 rounded truncate max-w-xs">
                              {v.files.resi_transfer.name}
                            </div>
                            <div className="bg-gray-100 px-2 py-1 rounded truncate max-w-xs">
                              {v.files.kwitansi.name}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="p-6 border border-dashed rounded-lg text-center text-gray-500 bg-gray-50">
                  Tidak ada dokumen yang match secara sempurna (3 jenis file).
                </div>
              )}
            </div>

            {validationResult.invalid.length > 0 && (
              <div>
                <h3 className="font-semibold text-red-700 mb-3 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-red-500"></span>
                  Gagal Validasi ({validationResult.invalid.length})
                </h3>
                <div className="overflow-x-auto border border-red-200 rounded-lg">
                  <table className="w-full text-sm text-left">
                    <thead className="text-xs text-red-800 uppercase bg-red-50 border-b border-red-200">
                      <tr>
                        <th className="px-4 py-3">Client Baris Excel</th>
                        <th className="px-4 py-3 w-48">Error Code</th>
                        <th className="px-4 py-3">Alasan Detail</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-red-100">
                      {validationResult.invalid.map((inv, i) => (
                        <tr key={i} className="bg-white hover:bg-red-50/50">
                          <td className="px-4 py-3 font-medium text-gray-800">{inv.clientName}</td>
                          <td className="px-4 py-3">
                            <span className="bg-red-100 text-red-800 text-xs px-2 py-1 rounded font-semibold tracking-wide block w-max">
                              {inv.errorType}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-red-700 text-sm">{inv.errorMessage}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {(isUploading || progress > 0) && (
        <div className="border rounded-xl p-8 bg-white shadow-sm mb-8 animate-in slide-in-from-bottom-2">
          <div className="flex justify-between items-end mb-4">
            <div>
              <h2 className="text-xl font-bold text-gray-800">Memproses Bulk Upload</h2>
              <p className="text-sm text-gray-500">
                Menyimpan file dan menghasilkan token URL secara Atomic...
              </p>
            </div>
            <span className="text-3xl font-bold text-blue-600">{progress}%</span>
          </div>

          <div className="w-full bg-gray-100 rounded-full h-3 mb-6 relative overflow-hidden">
            <div
              className="bg-blue-600 h-3 rounded-full transition-all duration-300 ease-out"
              style={{ width: `${progress}%` }}
            >
              <div className="absolute top-0 left-0 bottom-0 right-0 bg-white/20 animate-pulse"></div>
            </div>
          </div>

          {progress === 100 && !isUploading && (
            <div className="mb-4 space-y-2">
              <Button
                onClick={downloadExcel}
                className="w-full bg-green-600 hover:bg-green-700 text-white flex items-center justify-center gap-2"
              >
                <span>⬇️</span> Download Laporan Link (Excel)
              </Button>
              <p className="text-xs text-center text-gray-500 font-medium">
                ⚠️ Excel seharusnya otomatis terunduh. Jika diblokir oleh browser, silakan klik
                tombol di atas.
              </p>
            </div>
          )}

          {uploadResults.length > 0 && (
            <div className="mt-8">
              <h3 className="font-semibold mb-4 text-gray-800 border-b pb-2">
                Log Eksekusi Real-time:
              </h3>
              <ul className="space-y-3">
                {uploadResults.map((res, idx) => (
                  <li
                    key={idx}
                    className={`p-4 rounded-lg flex gap-3 items-start ${res.success ? 'bg-green-50/50 border border-green-100' : 'bg-red-50/50 border border-red-100'}`}
                  >
                    <div className="mt-0.5">{res.success ? '✅' : '❌'}</div>
                    <div className="flex-1">
                      <div className="font-semibold text-gray-800">{res.name}</div>
                      {res.success ? (
                        <div className="text-sm mt-1 flex flex-col gap-1">
                          <div>
                            <span className="text-gray-600">Link Akses:</span> {res.link}
                          </div>
                        </div>
                      ) : (
                        <div className="text-sm text-red-600 mt-1">{res.error}</div>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
