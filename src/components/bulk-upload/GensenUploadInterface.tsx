'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  parseExcelFile,
  validateGensenUploadV1,
  GensenBulkValidationResult,
  ExcelEntry,
  AgentData,
  ValidatedGensenClient,
  sanitizeName,
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
import { AlertCircle, CheckCircle2, Info, AlertTriangle, FileText, Upload, Trash2, Link as LinkIcon, Download } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface ButtonProps {
  children: React.ReactNode;
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  disabled?: boolean;
  className?: string;
  variant?: 'primary' | 'outline' | 'destructive' | 'secondary';
}

const Button = ({ children, onClick, disabled, className, variant = 'primary' }: ButtonProps) => {
  const base = 'px-4 py-2 rounded font-medium disabled:opacity-50 transition-colors flex items-center justify-center gap-2';
  const variants = {
    primary: 'bg-blue-600 text-white hover:bg-blue-700',
    outline: 'border border-gray-300 hover:bg-gray-50 text-gray-700',
    destructive: 'bg-red-600 text-white hover:bg-red-700',
    secondary: 'bg-green-600 text-white hover:bg-green-700',
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

export default function GensenUploadInterface() {
  const [agents, setAgents] = useState<AgentData[]>([]);
  const [excelEntries, setExcelEntries] = useState<ExcelEntry[] | null>(null);
  const [validationResult, setValidationResult] = useState<GensenBulkValidationResult | null>(null);
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
  const [excelFileName, setExcelFileName] = useState<string>('Batch Gensen');
  const [hasAutoDownloaded, setHasAutoDownloaded] = useState(false);

  const [hagakiFiles, setHagakiFiles] = useState<File[]>([]);
  const [resiFiles, setResiFiles] = useState<File[]>([]);
  const [kwitansiFiles, setKwitansiFiles] = useState<File[]>([]);

  // Manual Assignment State
  const [manualAssignments, setManualAssignments] = useState<Record<string, string>>({}); // file.name -> client.compoundKey

  const downloadTemplate = () => {
    const data = [
      {
        'Nama Lengkap': 'DIMAS SATRIA',
        'Tanggal Lahir': '12/05/1995',
        'Tahun Gensen': '2024',
        'PIC': 'NAMA AGENT',
        'Nomor Telepon': '08123456789'
      },
      {
        'Nama Lengkap': 'SARI DEWI',
        'Tanggal Lahir': '20/10/1992',
        'Tahun Gensen': '5A',
        'PIC': 'NAMA AGENT',
        'Nomor Telepon': ''
      }
    ];
    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Template Gensen');
    XLSX.writeFile(workbook, `Template_Bulk_Gensen_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  useEffect(() => {
    getAgentsAction().then(setAgents);
  }, []);

  const downloadExcel = useCallback(() => {
    if (uploadResults.length === 0) return;

    const data = uploadResults.map((res) => ({
      'Nama Client': res.name,
      'Status': res.success ? 'BERHASIL' : 'GAGAL',
      'Link Akses': res.link || '-',
      'Keterangan': res.error || 'Token Berhasil Dibuat',
      'Waktu': new Date().toLocaleString('id-ID'),
    }));

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Laporan Gensen');

    // Styling kolom
    worksheet['!cols'] = [
      { wch: 30 }, // Nama
      { wch: 15 }, // Status
      { wch: 40 }, // Link
      { wch: 30 }, // Keterangan
      { wch: 25 }, // Waktu
    ];

    XLSX.writeFile(workbook, `Laporan_Gensen_EXATA_${new Date().toISOString().split('T')[0]}.xlsx`);
  }, [uploadResults]);

  useEffect(() => {
    if (progress === 100 && !isUploading && !hasAutoDownloaded && uploadResults.length > 0) {
      downloadExcel();
      setHasAutoDownloaded(true);
    }
  }, [progress, isUploading, hasAutoDownloaded, uploadResults.length, downloadExcel]);

  const handleDocFileChange = (
    e: React.ChangeEvent<HTMLInputElement>,
    setter: React.Dispatch<React.SetStateAction<File[]>>,
  ) => {
    if (!e.target.files) return;
    const files = Array.from(e.target.files);
    const MAX_SIZE = 5 * 1024 * 1024; // 5MB for Gensen
    const validFiles = files.filter((f) => f.size <= MAX_SIZE);

    if (validFiles.length < files.length) {
      setModalConfig({
        isOpen: true,
        title: 'File Terlalu Besar',
        message: 'Beberapa file diabaikan karena melebihi batas 5MB.',
        type: 'alert',
      });
    }
    
    setter((prev) => [...prev, ...validFiles]);
  };

  const handleExcelUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.length) return;
    setExcelFileName(e.target.files[0].name.replace(/\.[^/.]+$/, ''));
    try {
      const entries = await parseExcelFile(e.target.files[0], agents);
      setExcelEntries(entries);
      setValidationResult(null);
      setManualAssignments({});
    } catch {
      setModalConfig({
        isOpen: true,
        title: 'Error Excel',
        message: 'Gagal memproses file Excel. Pastikan format kolom benar.',
        type: 'alert',
      });
    }
  };

  const handleValidate = () => {
    if (!excelEntries) return;
    const result = validateGensenUploadV1(excelEntries, hagakiFiles, resiFiles, kwitansiFiles, manualAssignments);
    setValidationResult(result);
  };

  useEffect(() => {
    if (excelEntries && (hagakiFiles.length > 0 || resiFiles.length > 0 || kwitansiFiles.length > 0)) {
        handleValidate();
    }
  }, [hagakiFiles, resiFiles, kwitansiFiles, excelEntries, manualAssignments]);

  const executeUpload = () => {
    if (!validationResult) return;
    
    // Check if any ambiguous resi are not assigned
    const unassignedAmbiguous = validationResult.ambiguousResi.filter(
      (a) => !manualAssignments[a.file.name]
    );

    if (unassignedAmbiguous.length > 0) {
      setModalConfig({
        isOpen: true,
        title: 'Assignment Diperlukan',
        message: `Terdapat ${unassignedAmbiguous.length} file Resi yang harus di-assign secara manual ke client yang tepat.`,
        type: 'alert',
      });
      return;
    }

    setModalConfig({
      isOpen: true,
      title: 'Konfirmasi Upload Gensen',
      message: `Mulai upload untuk ${validationResult.valid.length} client?`,
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

    const limit = pLimit(3);
    const total = validationResult.valid.length;
    let completedCount = 0;

    const { batchId } = await createBatchJobAction(total, excelFileName);

    const tasks = validationResult.valid.map((client) =>
      limit(async () => {
        try {
          const fileMetas: FileUploadMeta[] = [];
          const clientFolderPrefix = `gensen_${client.clientName.replace(/[^a-zA-Z0-9]/g, '_')}_${Date.now()}`;

          // Prepare all files for this client
          const filesToUpload: { file: File; type: string; year?: string }[] = [];
          
          client.files.hagaki.forEach((f) => filesToUpload.push({ file: f.file, type: 'hagaki', year: f.year }));
          client.files.kwitansi.forEach((f) => filesToUpload.push({ file: f.file, type: 'kwitansi', year: f.year }));
          client.files.resi_transfer.forEach((f) => filesToUpload.push({ file: f.file, type: 'resi_transfer' }));
          
          // Add manually assigned resi
          validationResult.ambiguousResi.forEach(a => {
            if (manualAssignments[a.file.name] === sanitizeName(client.clientName)) {
              filesToUpload.push({ file: a.file, type: 'resi_transfer' });
            }
          });

          const uploadPromises = filesToUpload.map(async ({ file, type, year }) => {
            const fileExt = file.name.split('.').pop();
            const fileName = `${type}_${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
            const filePath = `${clientFolderPrefix}/${fileName}`;

            const formData = new FormData();
            formData.append('file', file);
            formData.append('storagePath', filePath);

            const response = await fetch('/api/bulk-upload/upload', {
              method: 'POST',
              body: formData,
            });

            if (!response.ok) throw new Error('Upload failed');

            fileMetas.push({
              doc_type: type,
              title: `Gensen ${type} - ${client.clientName}`,
              file_name: fileName,
              original_file_name: file.name,
              mime_type: file.type || 'application/octet-stream',
              file_size: file.size,
              storage_path: filePath,
              category: 'gensen',
              document_year: year,
            });
          });

          await Promise.all(uploadPromises);

          const res = await finalizeClientUploadAction({
            clientName: client.clientName,
            dob: client.dob.toISOString(),
            phone: client.phone,
            files: fileMetas,
            batchId,
            picId: client.picId,
            tokenType: 'gensen',
          });

          setUploadResults((prev) => [
            ...prev,
            { name: client.clientName, success: true, link: res.accessLink },
          ]);
        } catch (err) {
          setUploadResults((prev) => [
            ...prev,
            { name: client.clientName, success: false, error: 'Gagal memproses client' },
          ]);
        } finally {
          completedCount++;
          setProgress(Math.round((completedCount / total) * 100));
        }
      })
    );

    await Promise.all(tasks);
    await completeBatchJobAction(batchId || '', completedCount, 0);
    setIsUploading(false);
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {modalConfig.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm overflow-hidden scale-100 animate-in zoom-in-95">
            <div className="p-6">
              <h3 className="text-lg font-bold mb-2">{modalConfig.title}</h3>
              <p className="text-sm text-gray-600">{modalConfig.message}</p>
            </div>
            <div className="bg-gray-50 px-6 py-4 flex justify-end gap-3 border-t">
              <Button variant="outline" onClick={() => setModalConfig({ ...modalConfig, isOpen: false })}>
                {modalConfig.type === 'confirm' ? 'Batal' : 'Tutup'}
              </Button>
              {modalConfig.type === 'confirm' && (
                <Button onClick={modalConfig.onConfirm}>Konfirmasi</Button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Step 1: Excel */}
      <div className="bg-white border rounded-xl overflow-hidden shadow-sm">
        <div className="bg-slate-800 p-4 text-white flex items-center justify-between">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <Badge variant="secondary" className="bg-white/20 text-white border-none">1</Badge>
            Excel Data Gensen
          </h2>
          <Button variant="outline" onClick={downloadTemplate} className="bg-white/10 border-white/20 text-white hover:bg-white/20 h-8 text-xs">
            <Download className="h-3.5 w-3.5" /> Unduh Template
          </Button>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-1 space-y-4">
              <div>
                <label className="block text-sm font-semibold mb-2">Upload File Excel (.xlsx)</label>
                <input
                  type="file"
                  accept=".xlsx"
                  onChange={handleExcelUpload}
                  className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer"
                  disabled={isUploading}
                />
              </div>
              {excelEntries && (
                <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 flex items-center gap-4">
                  <CheckCircle2 className="text-blue-600 h-8 w-8" />
                  <div>
                    <p className="font-bold text-blue-900">{excelEntries.length} Client Terdeteksi</p>
                    <p className="text-xs text-blue-700">Data siap dipasangkan dengan file.</p>
                  </div>
                </div>
              )}
            </div>

            <div className="lg:col-span-2 bg-slate-50 rounded-xl p-5 border border-slate-200">
               <h4 className="font-bold text-slate-800 mb-3 flex items-center gap-2">
                  <Info className="h-4 w-4 text-blue-600" /> Panduan Operasional Bulk Gensen:
               </h4>
               <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
                  <div className="space-y-3">
                     <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Langkah Persiapan</p>
                     <ul className="text-xs text-slate-600 space-y-2 leading-relaxed">
                        <li className="flex gap-2">
                           <span className="font-bold text-blue-600">1.</span>
                           <span>Isi Excel sesuai template. Wajib menyertakan <strong>Tahun Gensen</strong> (2024 atau 6A).</span>
                        </li>
                        <li className="flex gap-2">
                           <span className="font-bold text-blue-600">2.</span>
                           <span>Gunakan format Nama Lengkap yang konsisten antara Excel dan Nama File.</span>
                        </li>
                        <li className="flex gap-2">
                           <span className="font-bold text-blue-600">3.</span>
                           <span>Hagaki wajib memiliki kode tahun di AKHIR nama file (Contoh: <code>NAMA_CLIENT_5A.jpg</code>).</span>
                        </li>
                     </ul>
                  </div>
                  <div className="space-y-3">
                     <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Proses Matching</p>
                     <ul className="text-xs text-slate-600 space-y-2 leading-relaxed">
                        <li className="flex gap-2">
                           <span className="font-bold text-blue-600">4.</span>
                           <span>Unggah Excel, lalu masukkan semua file ke masing-masing kategori (Hagaki/Resi/Kwitansi).</span>
                        </li>
                        <li className="flex gap-2">
                           <span className="font-bold text-blue-600">5.</span>
                           <span><strong>Assignment Manual:</strong> Jika ada file Resi yang ambigu (nama sama beda tahun), pilih client yang sesuai pada dropdown yang muncul.</span>
                        </li>
                        <li className="flex gap-2">
                           <span className="font-bold text-blue-600">6.</span>
                           <span>Cek tabel validasi. Pastikan jumlah file seimbang (H=R=K) sebelum klik Submit.</span>
                        </li>
                     </ul>
                  </div>
               </div>
               <div className="mt-4 p-3 bg-amber-50 border border-amber-100 rounded-lg">
                  <p className="text-[11px] text-amber-800 leading-normal flex gap-2">
                     <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                     <span><strong>Tips Keamanan:</strong> Sistem menggunakan Smart Matching. Jika rasionya rendah (nama di file terlalu singkat dibanding Excel), sistem akan otomatis masuk ke <strong>Ambiguous Queue</strong> demi keamanan data.</span>
                  </p>
               </div>
            </div>
          </div>
        </div>
      </div>

      {/* Step 2: File Categories */}
      <div className="bg-white border rounded-xl overflow-hidden shadow-sm">
        <div className="bg-blue-700 p-4 text-white flex items-center justify-between">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <Badge variant="secondary" className="bg-white/20 text-white border-none">2</Badge>
            Kategori Dokumen Gensen
          </h2>
          <FileText className="h-5 w-5 opacity-50" />
        </div>
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <DropZone title="Hagaki" files={hagakiFiles} onFilesAdded={(e) => handleDocFileChange(e, setHagakiFiles)} onClear={() => setHagakiFiles([])} disabled={!excelEntries || isUploading} />
            <DropZone title="Resi Transfer" files={resiFiles} onFilesAdded={(e) => handleDocFileChange(e, setResiFiles)} onClear={() => setResiFiles([])} disabled={!excelEntries || isUploading} />
            <DropZone title="Kwitansi" files={kwitansiFiles} onFilesAdded={(e) => handleDocFileChange(e, setKwitansiFiles)} onClear={() => setKwitansiFiles([])} disabled={!excelEntries || isUploading} />
          </div>
        </div>
      </div>

      {/* Results & Validation */}
      {validationResult && (
        <div className="space-y-6">
          {/* Ambiguous Resi Section */}
          {validationResult.ambiguousResi.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl overflow-hidden shadow-sm">
              <div className="bg-amber-100 p-4 border-b border-amber-200 flex items-center gap-2">
                <AlertTriangle className="text-amber-700" />
                <h3 className="font-bold text-amber-900">Assignment Manual Diperlukan ({validationResult.ambiguousResi.length})</h3>
              </div>
              <div className="p-4 space-y-3">
                {validationResult.ambiguousResi.map((a, i) => (
                  <div key={i} className="flex flex-col md:flex-row items-center justify-between gap-4 p-3 bg-white rounded-lg border border-amber-200 shadow-sm">
                    <div className="flex items-center gap-2">
                      <FileText className="text-gray-400 h-4 w-4" />
                      <span className="text-sm font-medium">{a.file.name}</span>
                    </div>
                    <select
                      className="text-sm border rounded px-3 py-1.5 focus:ring-2 focus:ring-blue-500 outline-none w-full md:w-64"
                      value={manualAssignments[a.file.name] || ''}
                      onChange={(e) => setManualAssignments({ ...manualAssignments, [a.file.name]: e.target.value })}
                    >
                      <option value="">Pilih Client...</option>
                      {a.matchedClients.map((c, ci) => (
                        <option key={ci} value={sanitizeName(c.clientName)}>
                          {c.clientName}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Unbalanced Warning */}
          {validationResult.valid.some(c => c.isUnbalanced) && (
            <div className="bg-red-50 border border-red-200 p-4 rounded-xl flex items-start gap-3">
              <AlertCircle className="text-red-600 mt-0.5 shrink-0" />
              <div>
                <p className="font-bold text-red-900">Peringatan Kuantitas Tidak Seimbang</p>
                <p className="text-sm text-red-700">Beberapa client memiliki jumlah Hagaki, Resi, atau Kwitansi yang tidak sama. Upload tetap dapat dilakukan, namun token link tidak disarankan untuk dibagikan sampai seimbang.</p>
              </div>
            </div>
          )}

          {/* Action Header */}
          <div className="flex flex-col md:flex-row items-center justify-between gap-4 bg-white p-4 border rounded-xl shadow-sm">
            <div>
              <p className="text-sm text-gray-500 font-medium">Status Validasi:</p>
              <p className="font-bold text-lg">{validationResult.valid.length} Client Siap Diproses</p>
            </div>
            <Button 
              onClick={executeUpload} 
              disabled={isUploading || validationResult.valid.length === 0 || validationResult.ambiguousResi.some(a => !manualAssignments[a.file.name])}
              className="w-full md:w-auto px-10 py-3"
            >
              <Upload className="h-5 w-5" />
              Eksekusi & Generate Token Gensen
            </Button>
          </div>

          {/* Validation Table (Summary) */}
          <div className="bg-white border rounded-xl shadow-sm overflow-hidden">
             <table className="w-full text-sm text-left">
                 <thead className="bg-gray-50 text-gray-600 uppercase text-xs font-bold border-b">
                    <tr>
                       <th className="px-6 py-4">Client (Excel)</th>
                       <th className="px-6 py-4">Tahun</th>
                       <th className="px-6 py-4 text-center">Hagaki (N)</th>
                       <th className="px-6 py-4 text-center">Resi (1)</th>
                       <th className="px-6 py-4 text-center">Kwitansi (N)</th>
                    </tr>
                 </thead>
                <tbody className="divide-y">
                    {validationResult.valid.map((c, i) => {
                      const yearsArray = c.tahunGensen.split(/\s+/).filter(Boolean);
                      const expectedN = yearsArray.length;
                      const manualCount = Object.values(manualAssignments).filter(v => v === sanitizeName(c.clientName)).length;
                      const totalResi = c.files.resi_transfer.length + manualCount;

                      return (
                        <tr key={i} className={`hover:bg-gray-50/50 ${c.isUnbalanced ? 'bg-red-50/30' : ''}`}>
                           <td className="px-6 py-4 font-semibold text-gray-800">{c.clientName}</td>
                           <td className="px-6 py-4 text-xs font-mono text-blue-700">{c.tahunGensen}</td>
                           <td className={`px-6 py-4 text-center font-mono ${c.files.hagaki.length !== expectedN ? 'text-red-600 font-bold' : ''}`}>
                             {c.files.hagaki.length}
                           </td>
                           <td className={`px-6 py-4 text-center font-mono ${totalResi !== 1 ? 'text-red-600 font-bold' : ''}`}>
                              {totalResi}
                           </td>
                           <td className={`px-6 py-4 text-center font-mono ${c.files.kwitansi.length !== expectedN ? 'text-red-600 font-bold' : ''}`}>
                             {c.files.kwitansi.length}
                           </td>
                        </tr>
                      );
                    })}
                </tbody>
             </table>
          </div>
        </div>
      )}

      {/* Progress & Real-time Logs */}
      {(isUploading || progress > 0) && (
        <div className="bg-white border rounded-xl p-8 shadow-sm space-y-6">
          <div className="flex justify-between items-end">
            <div>
              <h3 className="text-xl font-bold">Proses Bulk Gensen</h3>
              <p className="text-sm text-gray-500">Jangan tutup halaman ini selama proses berlangsung.</p>
            </div>
            <span className="text-4xl font-black text-blue-600">{progress}%</span>
          </div>
          <div className="h-4 bg-gray-100 rounded-full overflow-hidden">
            <div className="h-full bg-blue-600 transition-all duration-300" style={{ width: `${progress}%` }} />
          </div>

          <div className="space-y-3">
             {uploadResults.slice(-5).reverse().map((res, i) => (
                <div key={i} className={`p-4 rounded-lg flex items-center gap-3 animate-in slide-in-from-left-2 ${res.success ? 'bg-green-50 border border-green-100' : 'bg-red-50 border border-red-100'}`}>
                   {res.success ? <CheckCircle2 className="text-green-600" /> : <AlertCircle className="text-red-600" />}
                   <div className="flex-1">
                      <p className="font-bold text-sm">{res.name}</p>
                      {res.success ? (
                        <p className="text-xs text-green-700 flex items-center gap-1"><LinkIcon className="h-3 w-3" /> {res.link}</p>
                      ) : (
                        <p className="text-xs text-red-700">{res.error}</p>
                      )}
                   </div>
                </div>
             ))}
          </div>
        </div>
      )}
    </div>
  );
}

function DropZone({ title, files, onFilesAdded, onClear, disabled }: { 
  title: string; 
  files: File[]; 
  onFilesAdded: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onClear: () => void;
  disabled: boolean;
}) {
  return (
    <div className={`border-2 border-dashed rounded-xl p-6 flex flex-col items-center text-center transition-colors ${disabled ? 'bg-gray-50 border-gray-200' : 'bg-white border-blue-200 hover:border-blue-400'}`}>
      <h3 className="font-bold mb-1">{title}</h3>
      <p className="text-[10px] text-gray-400 uppercase tracking-widest font-bold mb-4">Maks 5MB / File</p>
      
      {files.length > 0 ? (
        <div className="w-full space-y-3">
          <div className="bg-blue-50 py-2 rounded-lg text-blue-700 font-bold text-lg">
            {files.length} File
          </div>
          <button onClick={onClear} className="text-xs text-red-500 hover:underline flex items-center justify-center gap-1 w-full">
            <Trash2 className="h-3 w-3" /> Hapus Semua
          </button>
        </div>
      ) : (
        <div className="relative">
          <input
            type="file"
            multiple
            onChange={onFilesAdded}
            className="absolute inset-0 opacity-0 cursor-pointer"
            disabled={disabled}
          />
          <div className="bg-blue-50 text-blue-600 p-3 rounded-full mb-2">
            <Upload className="h-6 w-6" />
          </div>
          <p className="text-xs font-medium text-gray-500">Klik atau Drag File</p>
        </div>
      )}
    </div>
  );
}
