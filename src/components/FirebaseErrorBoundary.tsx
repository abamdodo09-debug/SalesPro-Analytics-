import React from 'react';
import { AlertTriangle, RefreshCw, Database } from 'lucide-react';
import { FIREBASE_PROJECT_ID, FIRESTORE_DATABASE_ID } from '../firebase';

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  errorMessage: string;
  isQuotaExceeded: boolean;
  isPermissionDenied: boolean;
  operationPath: string | null;
}

export class FirebaseErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      errorMessage: '',
      isQuotaExceeded: false,
      isPermissionDenied: false,
      operationPath: null,
    };
  }

  static getDerivedStateFromError(error: Error): State {
    const rawMsg = error?.message || 'Terjadi kesalahan pada database.';
    let parsedError = rawMsg;
    let operationPath: string | null = null;

    try {
      const parsed = JSON.parse(rawMsg);
      if (parsed && typeof parsed.error === 'string') {
        parsedError = parsed.error;
        operationPath = parsed.path || null;
      }
    } catch {
      // Raw non-JSON error
    }

    const isQuotaExceeded =
      parsedError.includes('Quota exceeded') ||
      parsedError.includes('Free daily read units per project');
    const isPermissionDenied =
      parsedError.includes('Missing or insufficient permissions') ||
      parsedError.includes('permission-denied');

    return {
      hasError: true,
      errorMessage: parsedError,
      isQuotaExceeded,
      isPermissionDenied,
      operationPath,
    };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    console.error('FirebaseErrorBoundary caught error:', error, info);
  }

  render() {
    if (this.state.hasError) {
      const upgradeUrl = `https://console.firebase.google.com/project/${FIREBASE_PROJECT_ID}/firestore/databases/${FIRESTORE_DATABASE_ID}/data?openUpgradeDialog=true`;

      return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
          <div className="max-w-lg w-full bg-white rounded-2xl border border-rose-200 shadow-xl p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-rose-100 text-rose-700">
                {this.state.isQuotaExceeded ? (
                  <Database className="w-6 h-6" />
                ) : (
                  <AlertTriangle className="w-6 h-6" />
                )}
              </div>
              <div>
                <h2 className="text-base font-extrabold text-slate-900">
                  {this.state.isQuotaExceeded
                    ? 'Kuota Harian Firestore Tercapai'
                    : this.state.isPermissionDenied
                      ? 'Akses Database Ditolak'
                      : 'Terjadi Gangguan Koneksi Database'}
                </h2>
                {this.state.operationPath && (
                  <p className="text-xs font-mono text-slate-500">
                    Path: {this.state.operationPath}
                  </p>
                )}
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-700 break-words font-mono">
              {this.state.errorMessage}
            </div>

            {this.state.isQuotaExceeded && (
              <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 space-y-1.5">
                <p className="font-bold">
                  Kuota gratis harian Firestore telah habis dan akan direset pada hari berikutnya.
                </p>
                <a
                  href={upgradeUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block font-bold underline text-amber-800 hover:text-amber-950"
                >
                  Buka Konsol Firebase Database / Upgrade Kuota
                </a>
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() =>
                  this.setState({
                    hasError: false,
                    errorMessage: '',
                    isQuotaExceeded: false,
                    isPermissionDenied: false,
                    operationPath: null,
                  })
                }
                className="px-4 py-2 text-xs font-bold rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-100 cursor-pointer"
              >
                Coba Lanjutkan
              </button>
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-lg bg-slate-900 text-white hover:bg-slate-800 cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Muat Ulang Aplikasi</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
