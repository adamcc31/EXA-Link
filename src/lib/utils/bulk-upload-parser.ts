import * as xlsx from 'xlsx';

export type UploadErrorType =
  | 'MISSING_EXCEL_ENTRY'
  | 'MISSING_FILES'
  | 'INVALID_FILE_COUNT'
  | 'UNSUPPORTED_FORMAT'
  | 'SUBFOLDER_DETECTED'
  | 'INVALID_EXCEL_DATE'
  | 'PIC_NOT_FOUND'
  | 'FILENAME_FORMAT_INVALID'
  | 'DUPLICATE_EXCEL_ENTRY';

export interface ExcelEntry {
  namaLengkap: string;
  tanggalLahir: string | number | Date;
  pic: string;
  phone?: string;
  sanitizedName: string;
  sanitizedNameNoSpaces: string;
  picId?: string; // resolved UUID
  picName?: string; // resolved Name
  tahunGensen?: string;
  compoundKey?: string;
}

export interface AgentData {
  id: string;
  full_name: string;
  email: string;
}

export interface ValidatedClient {
  clientName: string;
  dob: Date;
  picId: string;
  picName: string;
  phone?: string;
  status: 'valid';
  files: {
    dattai_ichijikin: File;
    resi_transfer: File;
    kwitansi: File;
  };
}

export interface InvalidClient {
  clientName: string;
  status: 'invalid';
  errorType: UploadErrorType;
  errorMessage: string;
}

export interface BulkValidationResult {
  valid: ValidatedClient[];
  invalid: InvalidClient[];
}

export function sanitizeName(name: string): string {
  if (!name) return '';
  return name
    .trim()
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove accents
    .replace(/_/g, ' ')             // Treat underscores as spaces
    .replace(/\s+/g, ' ');          // replace multiple spaces with single space
}

export function sanitizeNameNoSpaces(name: string): string {
  return sanitizeName(name).replace(/\s+/g, '');
}

/**
 * Helper untuk membersihkan "noise" dari nama file (Bank, No Rekening, Year Code).
 */
function extractNameFromFilename(filename: string): string {
  let name = filename.replace(/\.[^/.]+$/, '').toUpperCase().replace(/_/g, ' ').trim();
  
  // 1. Hapus Pola Tanggal (misal: 12-05-2026) - Harus sebelum nomor urut
  name = name.replace(/\b\d{1,2}[-/]\d{1,2}[-/]\d{2,4}\b/g, '');

  // 2. Hapus Nomor Urut di Depan (misal: "15 ")
  name = name.replace(/^\d+\s+/, '');

  // 3. Hapus Year Code Gensen di akhir (misal: " 5A")
  name = name.replace(/\s+[0-9]+[A-Z]+$/, '');

  // 4. Hapus Tahun 4-digit (misal: "2025")
  name = name.replace(/\b(19|20)\d{2}\b/g, '');

  // 5. Hapus No Rekening (Pola angka panjang 5+ digit)
  name = name.replace(/\b\d{5,}(?:-\d+)*\b/g, '');

  // 6. Hapus Keyword Bank Umum
  const banks = ['MANDIRI', 'BCA', 'BNI', 'BRI', 'DANAMON', 'CIMB', 'PERMATA', 'MAYBANK', 'PANIN', 'OCBC', 'BTN'];
  banks.forEach(bank => {
    const regex = new RegExp(`\\b${bank}\\b`, 'g');
    name = name.replace(regex, '');
  });

  // 7. Hapus Common Prefixes/Keywords
  name = name.replace(/\b(AGEN|EXATA|GENSEN)\b/g, '');

  return name.trim().replace(/\s+/g, ' ');
}

/**
 * Filter Utama Pencocokan Nama: 3-Layer Filter
 */
function isNameMatch(excelName: string, fileNamePart: string): { isMatch: boolean; isLowConfidence: boolean } {
  const sExcel = sanitizeName(excelName);
  const sFile = extractNameFromFilename(fileNamePart);
  
  if (!sExcel || !sFile) return { isMatch: false, isLowConfidence: false };

  // Filter 1: Exact Match (High Confidence)
  if (sExcel === sFile) return { isMatch: true, isLowConfidence: false };

  // Persiapan Tokenisasi untuk Filter 2 & 3
  const excelWords = sExcel.split(' ');
  const fileWords = sFile.split(' ');

  // Filter 2: Word Boundary Matching (Subset Match)
  const isSubset = excelWords.every(word => fileWords.includes(word));
  if (!isSubset) return { isMatch: false, isLowConfidence: false };

  // Filter 3: Word Count Ratio Guard (Threshold 0.6)
  const ratio = excelWords.length / fileWords.length;
  const isLowConfidence = ratio < 0.6;

  return { isMatch: true, isLowConfidence };
}

export function parseExcelFile(file: File, agents: AgentData[]): Promise<ExcelEntry[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = xlsx.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];

        // Parse rows
        interface RawExcelRow {
          [key: string]: string | number | Date | undefined;
        }
        const rawJson = xlsx.utils.sheet_to_json(worksheet, { defval: '' }) as RawExcelRow[];

        const entries: ExcelEntry[] = rawJson
          .map((row) => {
            const nama =
              row['Nama Lengkap'] || row['nama lengkap'] || row['Nama'] || row['NAMA'] || '';
            const dob =
              row['Tanggal Lahir'] ||
              row['tanggal lahir'] ||
              row['TANGGAL_LAHIR'] ||
              row['DOB'] ||
              '';
            const picStr = row['PIC'] || row['pic'] || '';
            const phoneStr =
              row['Nomor Telepon'] ||
              row['no telepon'] ||
              row['nomor telepon'] ||
              row['Telephone'] ||
              row['Telp'] ||
              row['Phone'] ||
              row['phone'] ||
              '';
            const tahunGensen =
              row['Tahun Gensen'] ||
              row['tahun gensen'] ||
              row['Gensen Year'] ||
              row['year'] ||
              '';

            const fullName = String(nama);
            const sanitized = sanitizeName(fullName);
            const sanitizedNoSpace = sanitizeNameNoSpaces(fullName);

            // Find PIC
            let picId = undefined;
            let picName = undefined;

            if (picStr) {
              const sanitizedPicStr = sanitizeName(String(picStr));
              // Match substring or exact
              const foundAgent = agents.find(
                (a) =>
                  sanitizeName(a.full_name).includes(sanitizedPicStr) ||
                  sanitizeName(a.email).includes(sanitizedPicStr),
              );
              if (foundAgent) {
                picId = foundAgent.id;
                picName = foundAgent.full_name;
              }
            }

            return {
              namaLengkap: fullName,
              tanggalLahir: dob,
              pic: String(picStr),
              phone: String(phoneStr).trim(),
              sanitizedName: sanitized,
              sanitizedNameNoSpaces: sanitizedNoSpace,
              picId,
              picName,
              tahunGensen: String(tahunGensen).trim(),
              compoundKey: `${sanitizedNoSpace}_${String(tahunGensen).trim()}`,
            };
          })
          .filter((e) => e.namaLengkap && e.tanggalLahir);

        resolve(entries);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = (err) => reject(err);
    reader.readAsArrayBuffer(file);
  });
}

export function parseExcelDate(val: any): Date {
  // Handle YYYYMMDD string format (e.g., 19981117)
  if (typeof val === 'string' && /^\d{8}$/.test(val)) {
    const y = parseInt(val.substring(0, 4), 10);
    const m = parseInt(val.substring(4, 6), 10) - 1;
    const d = parseInt(val.substring(6, 8), 10);
    return new Date(y, m, d);
  }

  if (val instanceof Date) return val;

  let dateValue = val;
  if (typeof dateValue === 'number') {
    if (dateValue < 2958465) {
      return new Date(Math.round((dateValue - 25569) * 86400 * 1000));
    }
    const strObj = String(dateValue).trim();
    if (strObj.length === 8) {
      const p1 = parseInt(strObj.substring(0, 2));
      const p2 = parseInt(strObj.substring(2, 4));
      const p3 = parseInt(strObj.substring(4, 8));

      if (p3 > 1800) {
        return new Date(
          `${p3}-${String(p2).padStart(2, '0')}-${String(p1).padStart(2, '0')}T00:00:00Z`,
        );
      } else if (p1 > 18) {
        const y = parseInt(strObj.substring(0, 4));
        const m = parseInt(strObj.substring(4, 6));
        const d = parseInt(strObj.substring(6, 8));
        return new Date(
          `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}T00:00:00Z`,
        );
      }
    }
  }

  const str = String(dateValue).trim();
  const delimiterMatch = str.match(/[-/]/);
  if (delimiterMatch) {
    const parts = str.split(delimiterMatch[0]);
    if (parts.length === 3) {
      const p1 = parseInt(parts[0], 10);
      const p2 = parseInt(parts[1], 10);
      const p3 = parseInt(parts[2], 10);

      if (p3 > 1000) {
        return new Date(
          `${p3}-${String(p2).padStart(2, '0')}-${String(p1).padStart(2, '0')}T00:00:00Z`,
        );
      } else if (p1 > 1000) {
        return new Date(
          `${p1}-${String(p2).padStart(2, '0')}-${String(p3).padStart(2, '0')}T00:00:00Z`,
        );
      }
    }
  }

  const d = new Date(str);
  if (!isNaN(d.getTime())) return d;

  return new Date('Invalid Date');
}

export function validateBulkUploadV2(
  excelEntries: ExcelEntry[],
  dattaiFiles: File[],
  resiFiles: File[],
  kwitansiFiles: File[],
): BulkValidationResult {
  const valid: ValidatedClient[] = [];
  const invalid: InvalidClient[] = [];

  // Sort entries by name length descending so that subset names (e.g. "ALIF")
  // don't steal files from longer names (e.g. "ALIF RIZKI")
  const sortedEntries = [...excelEntries].sort(
    (a, b) => b.sanitizedName.length - a.sanitizedName.length,
  );

  const usedDattai = new Set<File>();
  const usedResi = new Set<File>();
  const usedKwitansi = new Set<File>();

  for (const entry of sortedEntries) {
    // PIC Validation
    if (!entry.picId) {
      invalid.push({
        clientName: entry.namaLengkap,
        status: 'invalid',
        errorType: 'PIC_NOT_FOUND',
        errorMessage: `PIC "${entry.pic}" tidak ditemukan di database agents.`,
      });
      continue;
    }

    const parsedDob = parseExcelDate(entry.tanggalLahir);
    if (
      isNaN(parsedDob.getTime()) ||
      parsedDob.getFullYear() < 1900 ||
      parsedDob.getFullYear() > 2100
    ) {
      invalid.push({
        clientName: entry.namaLengkap,
        status: 'invalid',
        errorType: 'INVALID_EXCEL_DATE',
        errorMessage: `Format tanggal (DOB) gagal dikenali: ${entry.tanggalLahir}. Gunakan format DD/MM/YYYY.`,
      });
      continue;
    }

    // Match Dattai File: [NamaLengkap].jpeg/jpg
    const matchedDattai = dattaiFiles.find((f) => {
      if (usedDattai.has(f)) return false;
      const nameWithoutExt = f.name.replace(/\.[^/.]+$/, '');
      return sanitizeName(nameWithoutExt) === entry.sanitizedName;
    });

    // Match Resi File: [NomorUrut]_[Bank]_[NamaLengkap]_[NoRekening].jpg
    const matchedResi = resiFiles.find((f) => {
      if (usedResi.has(f)) return false;
      const expectedSub = '_' + entry.sanitizedName.replace(/\s+/g, '_') + '_';
      const fileNameClean = '_' + f.name.replace(/\.[^/.]+$/, '').toUpperCase() + '_';
      return fileNameClean.includes(expectedSub);
    });

    // Match Kwitansi File: [NomorUrut]_[Tanggal]_[NamaLengkap]_[Jenis].jpg
    const matchedKwitansi = kwitansiFiles.find((f) => {
      if (usedKwitansi.has(f)) return false;
      const expectedSub = '_' + entry.sanitizedName.replace(/\s+/g, '_') + '_';
      const fileNameClean = '_' + f.name.replace(/\.[^/.]+$/, '').toUpperCase() + '_';
      return fileNameClean.includes(expectedSub);
    });

    if (!matchedDattai || !matchedResi || !matchedKwitansi) {
      const missing = [];
      if (!matchedDattai) missing.push('Dattai');
      if (!matchedResi) missing.push('Resi');
      if (!matchedKwitansi) missing.push('Kwitansi');

      invalid.push({
        clientName: entry.namaLengkap,
        status: 'invalid',
        errorType: 'MISSING_FILES',
        errorMessage: `File kurang atau tidak cocok. Yang belum ditemukan: ${missing.join(', ')}`,
      });
      continue;
    }

    usedDattai.add(matchedDattai);
    usedResi.add(matchedResi);
    usedKwitansi.add(matchedKwitansi);

    valid.push({
      clientName: entry.namaLengkap,
      dob: parsedDob,
      picId: entry.picId,
      picName: entry.picName!,
      phone: entry.phone,
      status: 'valid',
      files: {
        dattai_ichijikin: matchedDattai,
        resi_transfer: matchedResi,
        kwitansi: matchedKwitansi,
      },
    });
  }

  return { valid, invalid };
}

export interface GensenFileMatch {
  file: File;
  year?: string;
}

export interface ValidatedGensenClient {
  clientName: string;
  dob: Date;
  picId: string;
  picName: string;
  phone?: string;
  tahunGensen: string;
  status: 'valid';
  files: {
    hagaki: GensenFileMatch[];
    resi_transfer: GensenFileMatch[];
    kwitansi: GensenFileMatch[];
  };
  isUnbalanced?: boolean;
}

export interface GensenBulkValidationResult {
  valid: ValidatedGensenClient[];
  invalid: InvalidClient[];
  ambiguousResi: { file: File; matchedClients: ValidatedGensenClient[] }[];
}

export function validateGensenUploadV1(
  excelEntries: ExcelEntry[],
  hagakiFiles: File[],
  resiFiles: File[],
  kwitansiFiles: File[],
  manualAssignments: Record<string, string> = {},
): GensenBulkValidationResult {
  const valid: ValidatedGensenClient[] = [];
  const invalid: InvalidClient[] = [];
  const ambiguousResi: { file: File; matchedClients: ValidatedGensenClient[] }[] = [];

  // Layer 1: Check for duplicate compound keys in Excel
  const seenKeys = new Map<string, number>();
  const duplicates = new Set<string>();

  excelEntries.forEach((entry, idx) => {
    if (entry.compoundKey) {
      if (seenKeys.has(entry.compoundKey)) {
        duplicates.add(entry.compoundKey);
      } else {
        seenKeys.set(entry.compoundKey, idx + 1);
      }
    }
  });

  if (duplicates.size > 0) {
    duplicates.forEach((key) => {
      const entry = excelEntries.find((e) => e.compoundKey === key);
      invalid.push({
        clientName: entry?.namaLengkap || 'Unknown',
        status: 'invalid',
        errorType: 'DUPLICATE_EXCEL_ENTRY',
        errorMessage: `Ditemukan data duplikat untuk Client ${entry?.namaLengkap}. Pastikan satu client hanya memiliki satu baris data.`,
      });
    });
    return { valid: [], invalid, ambiguousResi: [] };
  }

  // Matching Logic
  for (const entry of excelEntries) {
    if (!entry.picId) {
      invalid.push({
        clientName: entry.namaLengkap,
        status: 'invalid',
        errorType: 'PIC_NOT_FOUND',
        errorMessage: `PIC "${entry.pic}" tidak ditemukan.`,
      });
      continue;
    }

    const parsedDob = parseExcelDate(entry.tanggalLahir);
    if (isNaN(parsedDob.getTime())) {
      invalid.push({
        clientName: entry.namaLengkap,
        status: 'invalid',
        errorType: 'INVALID_EXCEL_DATE',
        errorMessage: `Tanggal lahir tidak valid (Gunakan format YYYYMMDD atau DD/MM/YYYY).`,
      });
      continue;
    }

    // Split years into array (e.g. "6A 5A" -> ["6A", "5A"])
    const yearsArray = (entry.tahunGensen || '').split(/\s+/).filter(Boolean);

    const client: ValidatedGensenClient = {
      clientName: entry.namaLengkap,
      dob: parsedDob,
      picId: entry.picId,
      picName: entry.picName!,
      phone: entry.phone,
      tahunGensen: entry.tahunGensen || '',
      status: 'valid',
      files: {
        hagaki: [],
        resi_transfer: [],
        kwitansi: [],
      },
    };

    // Match Hagaki: Filter by name and ensure file year is in the Excel yearsArray
    client.files.hagaki = hagakiFiles
      .filter((f) => {
        const { isMatch } = isNameMatch(entry.namaLengkap, f.name);
        if (!isMatch) return false;
        
        const nameClean = f.name.replace(/\.[^/.]+$/, '').toUpperCase();
        const yearMatch = nameClean.match(/_([0-9]+[A-Z]+)$/);
        const fileYearCode = yearMatch ? yearMatch[1] : null;
        
        return yearsArray.includes(fileYearCode || '');
      })
      .map((f) => {
        const nameClean = f.name.replace(/\.[^/.]+$/, '').toUpperCase();
        const yearMatch = nameClean.match(/_([0-9]+[A-Z]+)$/);
        let yearLabel = undefined;
        if (yearMatch) {
          const yearNum = parseInt(yearMatch[1], 10);
          yearLabel = (yearNum + 2018).toString(); 
        }
        return { file: f, year: yearLabel };
      });

    // Match Kwitansi: Name + Explicit Year
    client.files.kwitansi = kwitansiFiles
      .filter((f) => {
        const { isMatch } = isNameMatch(entry.namaLengkap, f.name);
        return isMatch;
      })
      .map((f) => {
        const nameClean = f.name.replace(/\.[^/.]+$/, '').toUpperCase();
        const yearMatches = nameClean.match(/(20[0-9]{2})/g);
        const lastYear = yearMatches ? yearMatches[yearMatches.length - 1] : undefined;
        return { file: f, year: lastYear };
      });

    valid.push(client);
  }

  // Match Resi: Name Only
  for (const f of resiFiles) {
    const results = valid.map(c => ({
      client: c,
      ...isNameMatch(c.clientName, f.name)
    })).filter(r => r.isMatch);

    if (results.length === 1) {
      const res = results[0];
      if (res.isLowConfidence) {
        // Filter 3: Low Word Ratio detected, force ambiguous even if single match
        ambiguousResi.push({ file: f, matchedClients: [res.client] });
      } else {
        res.client.files.resi_transfer.push({ file: f });
      }
    } else if (results.length > 1) {
      ambiguousResi.push({ file: f, matchedClients: results.map(r => r.client) });
    }
  }

  // Layer 3: Quantity Validation based on number of years in Excel
  for (const client of valid) {
    const entry = excelEntries.find(e => e.compoundKey === client.clientName.replace(/_/g, ' ').trim().toUpperCase() || sanitizeName(e.namaLengkap) === sanitizeName(client.clientName));
    const expectedCount = (entry?.tahunGensen || '').split(/\s+/).filter(Boolean).length || 0;

    const hCount = client.files.hagaki.length;
    const rCount = client.files.resi_transfer.length;
    const kCount = client.files.kwitansi.length;

    // Check manual assignments for resi
    const manualCount = Object.values(manualAssignments).filter(v => v === sanitizeName(client.clientName)).length;
    const totalResi = rCount + manualCount;

    // Corrected Logic: Hagaki & Kwitansi match years count, Resi is always exactly 1
    if (hCount !== expectedCount || kCount !== expectedCount || totalResi !== 1) {
      client.isUnbalanced = true;
    }
  }

  return { valid, invalid, ambiguousResi };
}
