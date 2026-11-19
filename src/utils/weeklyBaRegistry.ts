import { TransactionRecord } from '../types/dashboard';

export interface WeeklyStoreConfig {
  id: string;
  storeName: string;
  baName: string;
  salesName: string;
  trainerName: string;
  coverArea: string;
  region: string;
  targetMonthly: number;
}

export const STORAGE_KEY_WEEKLY_STORES = 'salespro_weekly_stores_config_v5';
export const STORAGE_KEY_WEEKLY_DELETED_STORES = 'salespro_weekly_deleted_stores_v5';
export const STORAGE_KEY_WEEKLY_ACTUALS = 'salespro_weekly_actuals_v5';
export const STORAGE_KEY_WEEKLY_PERFORMA = 'salespro_weekly_performa_v5';
export const STORAGE_KEY_WEEKLY_CUMULATIVE = 'salespro_weekly_cumulative_v5';

// 7 Toko yang direvisi untuk dihilangkan dari coveran sales ILHAMSYAH sesuai instruksi pengguna
export const EXCLUDED_ILHAMSYAH_STORES = new Set([
  'miss glam bukit barisan',
  'miss glam sudirman',
  'al kautsar cosmetik',
  'annisa cosmetik arifin',
  'annisa kosmetik (duri)',
  'miss glam marpoyan',
  'toko annisa kosmetik',
]);

export const isStoreExcludedFromIlhamsyah = (
  sales: string | undefined,
  storeName: string | undefined
): boolean => {
  if (!sales || !storeName) return false;
  return (
    sales.trim().toUpperCase() === 'ILHAMSYAH' &&
    EXCLUDED_ILHAMSYAH_STORES.has(storeName.trim().toLowerCase())
  );
};

export function normalizeStoreAlnum(name: string | undefined): string {
  return (name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

// 80 Master Toko, BA, Sales, dan Trainer persis sesuai template Weekly Sell Out BA
export const DEFAULT_WEEKLY_STORES: WeeklyStoreConfig[] = [
  // --- TRAINER: ARA | SALES: ALBERT FERNANDO (13 Toko) ---
  {
    id: 'ws-01',
    storeName: 'CITRA SWALAYAN',
    baName: 'WINDY PRATIWI',
    salesName: 'ALBERT FERNANDO',
    trainerName: 'ARA',
    coverArea: 'DUMAI',
    region: 'DUMAI',
    targetMonthly: 55000000,
  },
  {
    id: 'ws-02',
    storeName: 'HIDAYAH BELILAS',
    baName: 'SITI NURHALIZA',
    salesName: 'ALBERT FERNANDO',
    trainerName: 'ARA',
    coverArea: 'INDRAGIRI',
    region: 'RENGAT',
    targetMonthly: 45000000,
  },
  {
    id: 'ws-03',
    storeName: 'HIDAYAH KOSMETIK PERAWANG',
    baName: 'LILI LESTARI',
    salesName: 'ALBERT FERNANDO',
    trainerName: 'ARA',
    coverArea: 'SIAK',
    region: 'PERAWANG',
    targetMonthly: 45000000,
  },
  {
    id: 'ws-04',
    storeName: 'IDOLA KOSMETIK AIR MOLEK',
    baName: 'DEWI LESTARI',
    salesName: 'ALBERT FERNANDO',
    trainerName: 'ARA',
    coverArea: 'INDRAGIRI',
    region: 'AIR MOLEK',
    targetMonthly: 47000000,
  },
  {
    id: 'ws-05',
    storeName: 'JINAAN STORE',
    baName: 'NURUL AINI',
    salesName: 'ALBERT FERNANDO',
    trainerName: 'ARA',
    coverArea: 'INDRAGIRI',
    region: 'RENGAT',
    targetMonthly: 47000000,
  },
  {
    id: 'ws-06',
    storeName: 'TOKO HIDAYAH BEAUTY',
    baName: 'RAHMA FITRI',
    salesName: 'ALBERT FERNANDO',
    trainerName: 'ARA',
    coverArea: 'PEKANBARU',
    region: 'PEKAN BARU',
    targetMonthly: 45000000,
  },
  {
    id: 'ws-07',
    storeName: 'TOKO HIDAYAH BEAUTY KARTAMA',
    baName: 'NADIA SAFIRA',
    salesName: 'ALBERT FERNANDO',
    trainerName: 'ARA',
    coverArea: 'PEKANBARU',
    region: 'PEKAN BARU',
    targetMonthly: 45000000,
  },
  {
    id: 'ws-08',
    storeName: 'TOKO HIDAYAH UKUI',
    baName: 'PUTRI ANGGRAINI',
    salesName: 'ALBERT FERNANDO',
    trainerName: 'ARA',
    coverArea: 'PELALAWAN',
    region: 'UKUI',
    targetMonthly: 42000000,
  },
  {
    id: 'ws-09',
    storeName: 'TOKO IWAN KADO KOSMETIK (RENGAT)',
    baName: 'TIA MONICA',
    salesName: 'ALBERT FERNANDO',
    trainerName: 'ARA',
    coverArea: 'INDRAGIRI',
    region: 'RENGAT',
    targetMonthly: 45000000,
  },
  {
    id: 'ws-10',
    storeName: 'TOKO KARTINSHOP',
    baName: 'INDAH PERMATASARI',
    salesName: 'ALBERT FERNANDO',
    trainerName: 'ARA',
    coverArea: 'PEKANBARU',
    region: 'PEKAN BARU',
    targetMonthly: 45000000,
  },
  {
    id: 'ws-11',
    storeName: 'TOKO MY KOSMETIK (PKL KERINCI)',
    baName: 'RINA ANGGRAINI',
    salesName: 'ALBERT FERNANDO',
    trainerName: 'ARA',
    coverArea: 'PELALAWAN',
    region: 'PKL KERINCI',
    targetMonthly: 45000000,
  },
  {
    id: 'ws-12',
    storeName: 'TOKO MY KOSMETIK (SOREK)',
    baName: 'DWI WULANDARI',
    salesName: 'ALBERT FERNANDO',
    trainerName: 'ARA',
    coverArea: 'PELALAWAN',
    region: 'SOREK',
    targetMonthly: 45000000,
  },
  {
    id: 'ws-13',
    storeName: 'TOKO RIS IDOLA KOSMETIK',
    baName: 'FITRI HANDAYANI',
    salesName: 'ALBERT FERNANDO',
    trainerName: 'ARA',
    coverArea: 'INDRAGIRI',
    region: 'RENGAT',
    targetMonthly: 55000000,
  },

  // --- TRAINER: ARA | SALES: ILHAMSYAH (6 Toko aktif) ---
  {
    id: 'ws-14',
    storeName: 'BEAUTY STORE (BANGKINANG)',
    baName: 'NUR HIKMAH',
    salesName: 'ILHAMSYAH',
    trainerName: 'ARA',
    coverArea: 'KAMPAR',
    region: 'BANGKINANG',
    targetMonthly: 42000000,
  },
  {
    id: 'ws-15',
    storeName: 'CERIA KOSMETIK BANGKINANG',
    baName: 'DINA MARIANA',
    salesName: 'ILHAMSYAH',
    trainerName: 'ARA',
    coverArea: 'KAMPAR',
    region: 'BANGKINANG',
    targetMonthly: 45000000,
  },
  {
    id: 'ws-16',
    storeName: 'KHARISMA COSMETIC (DURIAN)',
    baName: 'AULIA RAHMA',
    salesName: 'ILHAMSYAH',
    trainerName: 'ARA',
    coverArea: 'PEKANBARU',
    region: 'PEKAN BARU',
    targetMonthly: 45000000,
  },
  {
    id: 'ws-17',
    storeName: 'KHARISMA COSMETIC (KUALU)',
    baName: 'SINTA DEWI',
    salesName: 'ILHAMSYAH',
    trainerName: 'ARA',
    coverArea: 'KAMPAR',
    region: 'TAMBANG',
    targetMonthly: 45000000,
  },
  {
    id: 'ws-20',
    storeName: 'SWALAYAN MALAYA MART',
    baName: 'RIKA AGUSTIN',
    salesName: 'ILHAMSYAH',
    trainerName: 'ARA',
    coverArea: 'PEKANBARU',
    region: 'PEKAN BARU',
    targetMonthly: 45000000,
  },
  {
    id: 'ws-21',
    storeName: 'TOKO BENING KOSMETIK',
    baName: 'NITA ANGGRAENI',
    salesName: 'ILHAMSYAH',
    trainerName: 'ARA',
    coverArea: 'PEKANBARU',
    region: 'PEKAN BARU',
    targetMonthly: 45000000,
  },

  // --- TRAINER: ARA | SALES: LUAR KOTA (1 Toko) ---
  {
    id: 'ws-22',
    storeName: 'PEKANBARU_ORIGINAL PRICE',
    baName: 'SILVIA NINGSIH',
    salesName: 'LUAR KOTA',
    trainerName: 'ARA',
    coverArea: 'PEKANBARU',
    region: 'PEKAN BARU',
    targetMonthly: 50000000,
  },

  // --- TRAINER: ARA | SALES: PARETO (3 Toko) ---
  {
    id: 'ws-23',
    storeName: 'GLASTING GLOW',
    baName: 'MAYA ROSALINA',
    salesName: 'PARETO',
    trainerName: 'ARA',
    coverArea: 'PEKANBARU',
    region: 'PEKAN BARU',
    targetMonthly: 60000000,
  },
  {
    id: 'ws-24',
    storeName: 'ISTANA KOSMETIK PEKANBARU',
    baName: 'TARI WULANDARI',
    salesName: 'PARETO',
    trainerName: 'ARA',
    coverArea: 'PEKANBARU',
    region: 'PEKAN BARU',
    targetMonthly: 55000000,
  },
  {
    id: 'ws-25',
    storeName: 'TOKO ISTANA KOSMETIK (ARIFIN AHMAD)',
    baName: 'CITRA LESTARI',
    salesName: 'PARETO',
    trainerName: 'ARA',
    coverArea: 'PEKANBARU',
    region: 'PEKAN BARU',
    targetMonthly: 50000000,
  },

  // --- TRAINER: ARA | SALES: TIWI (15 Toko) ---
  {
    id: 'ws-26',
    storeName: 'GUARDIAN CIPUTRA BNB LV',
    baName: 'TIARA ANDINI',
    salesName: 'TIWI',
    trainerName: 'ARA',
    coverArea: 'MODERN TRADE',
    region: 'PEKAN BARU',
    targetMonthly: 65000000,
  },
  {
    id: 'ws-27',
    storeName: 'GUARDIAN GUAR MAL PEKANBARU BNB LV',
    baName: 'AMELIA PUTRI',
    salesName: 'TIWI',
    trainerName: 'ARA',
    coverArea: 'MODERN TRADE',
    region: 'PEKAN BARU',
    targetMonthly: 65000000,
  },
  {
    id: 'ws-28',
    storeName: 'GUARDIAN LIVING WORLD PEKANBARU BNB LV',
    baName: 'FEBY FEBRIANA',
    salesName: 'TIWI',
    trainerName: 'ARA',
    coverArea: 'MODERN TRADE',
    region: 'PEKAN BARU',
    targetMonthly: 70000000,
  },
  {
    id: 'ws-29',
    storeName: 'GUARDIAN MTC PEKANBARU BNB LV',
    baName: 'DELLA ANGGITA',
    salesName: 'TIWI',
    trainerName: 'ARA',
    coverArea: 'MODERN TRADE',
    region: 'PEKAN BARU',
    targetMonthly: 60000000,
  },
  {
    id: 'ws-30',
    storeName: 'GUARDIAN PLAZA CITRA PEKANBARU BNB LV',
    baName: 'BELLA SAFIRA',
    salesName: 'TIWI',
    trainerName: 'ARA',
    coverArea: 'MODERN TRADE',
    region: 'PEKAN BARU',
    targetMonthly: 60000000,
  },
  {
    id: 'ws-31',
    storeName: 'GUARDIAN SKA MALL 2 PEKANBARU BNB LV',
    baName: 'GINA PUSPITA',
    salesName: 'TIWI',
    trainerName: 'ARA',
    coverArea: 'MODERN TRADE',
    region: 'PEKAN BARU',
    targetMonthly: 75000000,
  },
  {
    id: 'ws-32',
    storeName: 'MISS GLAM BUKIT BARISAN',
    baName: 'MIRA SANTIKA',
    salesName: 'TIWI',
    trainerName: 'ARA',
    coverArea: 'PEKANBARU',
    region: 'PEKAN BARU',
    targetMonthly: 70000000,
  },
  {
    id: 'ws-33',
    storeName: 'MISS GLAM PANAM',
    baName: 'RANI KURNIA',
    salesName: 'TIWI',
    trainerName: 'ARA',
    coverArea: 'PEKANBARU',
    region: 'PANAM',
    targetMonthly: 75000000,
  },
  {
    id: 'ws-34',
    storeName: 'MISS GLAM SUDIRMAN',
    baName: 'VINA PANDU',
    salesName: 'TIWI',
    trainerName: 'ARA',
    coverArea: 'PEKANBARU',
    region: 'PEKAN BARU',
    targetMonthly: 80000000,
  },
  {
    id: 'ws-35',
    storeName: 'MISS GLAM SUDIRMAN2',
    baName: 'RESTI FAUZIAH',
    salesName: 'TIWI',
    trainerName: 'ARA',
    coverArea: 'PEKANBARU',
    region: 'PEKAN BARU',
    targetMonthly: 75000000,
  },
  {
    id: 'ws-36',
    storeName: 'MISS GLAM TEMBILAHAN',
    baName: 'YOLANDA OKTAVIA',
    salesName: 'TIWI',
    trainerName: 'ARA',
    coverArea: 'INDRAGIRI HILIR',
    region: 'TEMBILAHAN',
    targetMonthly: 100000000,
  },
  {
    id: 'ws-37',
    storeName: 'WATSON CIPUTRA SERAYA',
    baName: 'SALSABILA',
    salesName: 'TIWI',
    trainerName: 'ARA',
    coverArea: 'MODERN TRADE',
    region: 'PEKAN BARU',
    targetMonthly: 65000000,
  },
  {
    id: 'ws-38',
    storeName: 'WATSON LIVING WORLD PEKANBARU',
    baName: 'NOVITA SARI',
    salesName: 'TIWI',
    trainerName: 'ARA',
    coverArea: 'MODERN TRADE',
    region: 'PEKAN BARU',
    targetMonthly: 75000000,
  },
  {
    id: 'ws-39',
    storeName: 'WATSON MTC PEKANBARU',
    baName: 'ELISABET',
    salesName: 'TIWI',
    trainerName: 'ARA',
    coverArea: 'MODERN TRADE',
    region: 'PEKAN BARU',
    targetMonthly: 65000000,
  },
  {
    id: 'ws-40',
    storeName: 'WATSON SKA PEKANBARU',
    baName: 'PUTRI AYU',
    salesName: 'TIWI',
    trainerName: 'ARA',
    coverArea: 'MODERN TRADE',
    region: 'PEKAN BARU',
    targetMonthly: 80000000,
  },

  // --- TRAINER: ONLINE | SALES: LUAR KOTA (2 Toko) ---
  {
    id: 'ws-41',
    storeName: 'BLUMEE ID',
    baName: 'ADINDA PUTRI',
    salesName: 'LUAR KOTA',
    trainerName: 'ONLINE',
    coverArea: 'ONLINE',
    region: 'ONLINE',
    targetMonthly: 45000000,
  },
  {
    id: 'ws-42',
    storeName: 'KIYORA BEAUTY',
    baName: 'SHINTA BELLA',
    salesName: 'LUAR KOTA',
    trainerName: 'ONLINE',
    coverArea: 'ONLINE',
    region: 'LUAR KOTA',
    targetMonthly: 45000000,
  },

  // --- TRAINER: RATIH | SALES: ABDUL RAHIM (8 Toko) ---
  {
    id: 'ws-43',
    storeName: 'ANNISA KOSMETIK (DURI)',
    baName: 'KARTIKA SARI',
    salesName: 'ABDUL RAHIM',
    trainerName: 'RATIH',
    coverArea: 'BENGKALIS',
    region: 'DURI',
    targetMonthly: 50000000,
  },
  {
    id: 'ws-44',
    storeName: 'GHANAYA COSMETIC',
    baName: 'ANITA RAHAYU',
    salesName: 'ABDUL RAHIM',
    trainerName: 'RATIH',
    coverArea: 'DUMAI',
    region: 'DUMAI',
    targetMonthly: 45000000,
  },
  {
    id: 'ws-45',
    storeName: 'GLOBAL KOSMETIK (PERAWANG)',
    baName: 'FITRIANA',
    salesName: 'ABDUL RAHIM',
    trainerName: 'RATIH',
    coverArea: 'SIAK',
    region: 'PERAWANG',
    targetMonthly: 45000000,
  },
  {
    id: 'ws-46',
    storeName: 'MM SANIA (BAGAN SIAPI API)',
    baName: 'DESI RATNASARI',
    salesName: 'ABDUL RAHIM',
    trainerName: 'RATIH',
    coverArea: 'ROKAN HILIR',
    region: 'BAGAN SIAPI API',
    targetMonthly: 45000000,
  },
  {
    id: 'ws-47',
    storeName: 'SABRINA STORE',
    baName: 'SRI WAHYUNI',
    salesName: 'ABDUL RAHIM',
    trainerName: 'RATIH',
    coverArea: 'DUMAI',
    region: 'DUMAI',
    targetMonthly: 45000000,
  },
  {
    id: 'ws-48',
    storeName: 'TOKO BLINK COSMETIC',
    baName: 'INTAN PERMATA',
    salesName: 'ABDUL RAHIM',
    trainerName: 'RATIH',
    coverArea: 'DUMAI',
    region: 'DUMAI',
    targetMonthly: 45000000,
  },
  {
    id: 'ws-49',
    storeName: 'TOKO DUMAI BARU',
    baName: 'NUR HASANAH',
    salesName: 'ABDUL RAHIM',
    trainerName: 'RATIH',
    coverArea: 'DUMAI',
    region: 'DUMAI',
    targetMonthly: 47000000,
  },
  {
    id: 'ws-50',
    storeName: 'TOKO ISTANA KOSMETIK (BAGAN SIAPI API)',
    baName: 'EVA SUSANTI',
    salesName: 'ABDUL RAHIM',
    trainerName: 'RATIH',
    coverArea: 'ROKAN HILIR',
    region: 'BAGAN SIAPI API',
    targetMonthly: 48000000,
  },

  // --- TRAINER: RATIH | SALES: ILHAMSYAH (7 Toko aktif) ---
  {
    id: 'ws-51',
    storeName: 'AKAR SARI KOSMETIK (HARAPAN RAYA)',
    baName: 'DIAN ANGGRAINI',
    salesName: 'ILHAMSYAH',
    trainerName: 'RATIH',
    coverArea: 'PEKANBARU',
    region: 'PEKAN BARU',
    targetMonthly: 45000000,
  },
  {
    id: 'ws-55',
    storeName: 'CS BEAUTEE',
    baName: 'FITRIA NINGSIH',
    salesName: 'ILHAMSYAH',
    trainerName: 'RATIH',
    coverArea: 'PEKANBARU',
    region: 'PEKAN BARU',
    targetMonthly: 45000000,
  },
  {
    id: 'ws-57',
    storeName: 'RATU PALUGADA',
    baName: 'FITRI YANTI',
    salesName: 'ILHAMSYAH',
    trainerName: 'RATIH',
    coverArea: 'PEKANBARU',
    region: 'PEKAN BARU',
    targetMonthly: 45000000,
  },
  {
    id: 'ws-58',
    storeName: 'RINI JOFA COSMETIK',
    baName: 'SITI AISYAH',
    salesName: 'ILHAMSYAH',
    trainerName: 'RATIH',
    coverArea: 'PEKANBARU',
    region: 'PEKAN BARU',
    targetMonthly: 45000000,
  },
  {
    id: 'ws-59',
    storeName: 'SARASA KOSMETIK',
    baName: 'ELVI SUKAESIH',
    salesName: 'ILHAMSYAH',
    trainerName: 'RATIH',
    coverArea: 'PEKANBARU',
    region: 'PEKAN BARU',
    targetMonthly: 45000000,
  },
  {
    id: 'ws-60',
    storeName: 'TOKO ALANA BEAUTY',
    baName: 'SITI RAHMAH',
    salesName: 'ILHAMSYAH',
    trainerName: 'RATIH',
    coverArea: 'PEKANBARU',
    region: 'PEKAN BARU',
    targetMonthly: 55000000,
  },
  {
    id: 'ws-62',
    storeName: 'TOKO UNIGLOW',
    baName: 'NURUL FADILAH',
    salesName: 'ILHAMSYAH',
    trainerName: 'RATIH',
    coverArea: 'PEKANBARU',
    region: 'PEKAN BARU',
    targetMonthly: 45000000,
  },

  // --- TRAINER: RATIH | SALES: LUAR KOTA (8 Toko) ---
  {
    id: 'ws-63',
    storeName: 'CAN BEAUTY',
    baName: 'VERA WATI',
    salesName: 'LUAR KOTA',
    trainerName: 'RATIH',
    coverArea: 'LUAR KOTA',
    region: 'RIAU',
    targetMonthly: 42000000,
  },
  {
    id: 'ws-64',
    storeName: 'FOR SKIN BEAUTY',
    baName: 'RATNA SARI',
    salesName: 'LUAR KOTA',
    trainerName: 'RATIH',
    coverArea: 'LUAR KOTA',
    region: 'RIAU',
    targetMonthly: 45000000,
  },
  {
    id: 'ws-65',
    storeName: 'I.C.A COSMETIK & PARFUM (BAGAN BATU)',
    baName: 'ANISA PUTRI',
    salesName: 'LUAR KOTA',
    trainerName: 'RATIH',
    coverArea: 'ROKAN HILIR',
    region: 'BAGAN BATU',
    targetMonthly: 47000000,
  },
  {
    id: 'ws-66',
    storeName: 'KIYORA BEAUTY',
    baName: 'MAHARANI',
    salesName: 'LUAR KOTA',
    trainerName: 'RATIH',
    coverArea: 'LUAR KOTA',
    region: 'RIAU',
    targetMonthly: 45000000,
  },
  {
    id: 'ws-67',
    storeName: 'LUCY KOSMETIK (BENGKALIS)',
    baName: 'RINI ASTUTI',
    salesName: 'LUAR KOTA',
    trainerName: 'RATIH',
    coverArea: 'BENGKALIS',
    region: 'BENGKALIS',
    targetMonthly: 45000000,
  },
  {
    id: 'ws-68',
    storeName: 'RAMBE KOSMETIK',
    baName: 'NURHALIMAH',
    salesName: 'LUAR KOTA',
    trainerName: 'RATIH',
    coverArea: 'ROKAN HULU',
    region: 'PASIR PENGARAIAN',
    targetMonthly: 45000000,
  },
  {
    id: 'ws-69',
    storeName: 'RAYA KOSMETIK BAGAN BATU',
    baName: 'CUT AMELIA',
    salesName: 'LUAR KOTA',
    trainerName: 'RATIH',
    coverArea: 'ROKAN HILIR',
    region: 'BAGAN BATU',
    targetMonthly: 45000000,
  },
  {
    id: 'ws-70',
    storeName: 'WARKOS IDN',
    baName: 'YENI MARLINA',
    salesName: 'LUAR KOTA',
    trainerName: 'RATIH',
    coverArea: 'LUAR KOTA',
    region: 'RIAU',
    targetMonthly: 45000000,
  },

  // --- TRAINER: RATIH | SALES: PARETO (6 Toko) ---
  {
    id: 'ws-71',
    storeName: 'AL KAUTSAR COSMETIK',
    baName: 'ZULFA AZZAHRA',
    salesName: 'PARETO',
    trainerName: 'RATIH',
    coverArea: 'PEKANBARU',
    region: 'PEKAN BARU',
    targetMonthly: 50000000,
  },
  {
    id: 'ws-72',
    storeName: 'ANNISA COSMETIK ARIFIN',
    baName: 'SALWA NABILA',
    salesName: 'PARETO',
    trainerName: 'RATIH',
    coverArea: 'PEKANBARU',
    region: 'PEKAN BARU',
    targetMonthly: 50000000,
  },
  {
    id: 'ws-73',
    storeName: 'GLASTING GLOW',
    baName: 'MELLY GOESLAW',
    salesName: 'PARETO',
    trainerName: 'RATIH',
    coverArea: 'PEKANBARU',
    region: 'PEKAN BARU',
    targetMonthly: 60000000,
  },
  {
    id: 'ws-74',
    storeName: 'NEW AKAR SARI DELIMA',
    baName: 'RETNO WULAN',
    salesName: 'PARETO',
    trainerName: 'RATIH',
    coverArea: 'PEKANBARU',
    region: 'PEKAN BARU',
    targetMonthly: 50000000,
  },
  {
    id: 'ws-75',
    storeName: 'TOKO ANNISA KOSMETIK',
    baName: 'WIDYA ASTUTI',
    salesName: 'PARETO',
    trainerName: 'RATIH',
    coverArea: 'PEKANBARU',
    region: 'PEKAN BARU',
    targetMonthly: 50000000,
  },
  {
    id: 'ws-76',
    storeName: 'TOKO ISTANA KOSMETIK (ARIFIN AHMAD)',
    baName: 'DEA ANANDA',
    salesName: 'PARETO',
    trainerName: 'RATIH',
    coverArea: 'PEKANBARU',
    region: 'PEKAN BARU',
    targetMonthly: 55000000,
  },

  // --- TRAINER: RATIH | SALES: TIWI (4 Toko) ---
  {
    id: 'ws-77',
    storeName: 'MISS GLAM BUKIT BARISAN',
    baName: 'SHERLY ANGGITA',
    salesName: 'TIWI',
    trainerName: 'RATIH',
    coverArea: 'PEKANBARU',
    region: 'PEKAN BARU',
    targetMonthly: 75000000,
  },
  {
    id: 'ws-78',
    storeName: 'MISS GLAM DUMAI',
    baName: 'LIA AMELIA',
    salesName: 'TIWI',
    trainerName: 'RATIH',
    coverArea: 'DUMAI',
    region: 'DUMAI',
    targetMonthly: 85000000,
  },
  {
    id: 'ws-79',
    storeName: 'MISS GLAM DURI',
    baName: 'SUCI LESTARI',
    salesName: 'TIWI',
    trainerName: 'RATIH',
    coverArea: 'BENGKALIS',
    region: 'DURI',
    targetMonthly: 85000000,
  },
  {
    id: 'ws-80',
    storeName: 'MISS GLAM MARPOYAN',
    baName: 'MUTIARA AZZAHRA',
    salesName: 'TIWI',
    trainerName: 'RATIH',
    coverArea: 'PEKANBARU',
    region: 'PEKAN BARU',
    targetMonthly: 80000000,
  },
];

/**
 * Mengambil daftar BA & Toko resmi yang sinkron dengan menu Weekly Sell Out BA:
 * 1. Membaca konfigurasi toko dari localStorage ('salespro_weekly_stores_config_v5') atau DEFAULT_WEEKLY_STORES.
 * 2. Mengecualikan toko yang dihapus user ('salespro_weekly_deleted_stores_v5') & toko ILHAMSYAH yang dikecualikan.
 * 3. Mengambil nama BA live dari Google Sheet SELL OUT jika tersedia (tidak '-' / 'NON BA' / 'STANDBY').
 * 4. Menambahkan toko ekstra dari Google Sheet SELL OUT yang memiliki BA & tidak dihapus.
 * 5. Menduplikasi-hapus berdasarkan nama toko agar 1 toko = 1 BA (tidak terhitung gaji ganda).
 */
export function resolveWeeklyBaStores(sellOutRecords: TransactionRecord[] = []): WeeklyStoreConfig[] {
  let baseStores: WeeklyStoreConfig[] = DEFAULT_WEEKLY_STORES;
  try {
    const rawStores = localStorage.getItem(STORAGE_KEY_WEEKLY_STORES);
    if (rawStores) {
      const parsed = JSON.parse(rawStores);
      if (Array.isArray(parsed) && parsed.length > 0) {
        baseStores = parsed;
      }
    }
  } catch {
    baseStores = DEFAULT_WEEKLY_STORES;
  }

  let deletedSet = new Set<string>();
  try {
    const rawDeleted = localStorage.getItem(STORAGE_KEY_WEEKLY_DELETED_STORES);
    if (rawDeleted) {
      const parsedDel = JSON.parse(rawDeleted);
      if (Array.isArray(parsedDel)) {
        deletedSet = new Set(parsedDel.map((n: string) => String(n || '').trim().toLowerCase()));
      }
    }
  } catch {
    // ignore
  }

  // Filter keluar toko yang dihapus user & toko yang dikecualikan dari ILHAMSYAH
  const filteredBase = baseStores.filter(
    (s) =>
      s.storeName &&
      !deletedSet.has(s.storeName.trim().toLowerCase()) &&
      !isStoreExcludedFromIlhamsyah(s.salesName, s.storeName)
  );

  // Kumpulkan live BA dari transaksi SELL OUT Google Sheets
  const sheetBaByStore = new Map<string, string>();
  const sheetBaByAlnum = new Map<string, string>();
  for (const r of sellOutRecords) {
    const ketUpper = (r.KET || '').trim().toUpperCase();
    if (ketUpper && ketUpper !== 'SELL OUT' && !ketUpper.includes('SELL OUT')) continue;
    if (!r.NAMA_STORE || !r.BA) continue;
    const baTrim = r.BA.trim();
    const baUpper = baTrim.toUpperCase();
    if (!baTrim || baTrim === '-' || baUpper === 'NON BA' || baUpper === 'STANDBY') continue;
    sheetBaByStore.set(r.NAMA_STORE.trim().toLowerCase(), baTrim);
    const alnum = normalizeStoreAlnum(r.NAMA_STORE);
    if (alnum) sheetBaByAlnum.set(alnum, baTrim);
  }

  // Deduplikasi per storeName (case-insensitive) agar 1 toko tidak dihitung gaji ganda
  const uniqueMap = new Map<string, WeeklyStoreConfig>();
  for (const s of filteredBase) {
    const sLower = s.storeName.trim().toLowerCase();
    const sAlnum = normalizeStoreAlnum(s.storeName);
    const liveBa = sheetBaByStore.get(sLower) || sheetBaByAlnum.get(sAlnum);
    const resolvedItem: WeeklyStoreConfig = liveBa ? { ...s, baName: liveBa } : { ...s };
    if (!uniqueMap.has(sLower)) {
      uniqueMap.set(sLower, resolvedItem);
    }
  }

  // Tambahkan toko tambahan dari Google Sheet SELL OUT (yang memiliki BA & tidak dihapus)
  for (const r of sellOutRecords) {
    const ketUpper = (r.KET || '').trim().toUpperCase();
    if (ketUpper && ketUpper !== 'SELL OUT' && !ketUpper.includes('SELL OUT')) continue;
    if (!r.NAMA_STORE) continue;
    if (isStoreExcludedFromIlhamsyah(r.SALES, r.NAMA_STORE)) continue;
    const sLower = r.NAMA_STORE.trim().toLowerCase();
    if (deletedSet.has(sLower)) continue;
    if (uniqueMap.has(sLower)) continue;

    const baTrim = (r.BA || '').trim();
    const baUpper = baTrim.toUpperCase();
    if (!baTrim || baTrim === '-' || baUpper === 'NON BA' || baUpper === 'STANDBY') {
      continue;
    }

    uniqueMap.set(sLower, {
      id: `gs-store-${sLower.replace(/\s+/g, '-')}`,
      storeName: r.NAMA_STORE.trim(),
      baName: baTrim,
      salesName: (r.SALES && r.SALES !== '-' ? r.SALES.trim() : 'SALES UMUM'),
      trainerName: 'ARA',
      coverArea: r.COVER_AREA || 'AREA BARU',
      region: r.REGION || 'PEKAN BARU',
      targetMonthly: 45000000,
    });
  }

  return Array.from(uniqueMap.values());
}
