import * as xlsx from 'xlsx';

export type UploadErrorType =
  | 'MISSING_EXCEL_ENTRY'
  | 'MISSING_FILES'
  | 'INVALID_FILE_COUNT'
  | 'UNSUPPORTED_FORMAT'
  | 'SUBFOLDER_DETECTED'
  | 'INVALID_EXCEL_DATE'
  | 'PIC_NOT_FOUND'
  | 'FILENAME_FORMAT_INVALID';

export interface ExcelEntry {
  namaLengkap: string;
  tanggalLahir: string | number | Date;
  pic: string;
  phone?: string;
  sanitizedName: string;
  sanitizedNameNoSpaces: string;
  picId?: string; // resolved UUID
  picName?: string; // resolved Name
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
    .replace(/\s+/g, ' '); // replace multiple spaces with single space
}

export function sanitizeNameNoSpaces(name: string): string {
  return sanitizeName(name).replace(/\s+/g, '');
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

export function parseExcelDate(dateValue: string | number | Date): Date {
  if (dateValue instanceof Date) return dateValue;

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
