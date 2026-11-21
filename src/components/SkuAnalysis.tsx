import React, { useState, useMemo, useDeferredValue } from 'react';
import { Package, Sparkles, Flame, Search, X } from 'lucide-react';
import { TransactionRecord } from '../types/dashboard';
import { formatRupiah, formatNumber, formatPercent, isFocusProduct, isNewProduct } from '../utils/analytics';

interface SkuAnalysisProps {
  records: TransactionRecord[];
}

export const SkuAnalysis: React.FC<SkuAnalysisProps> = React.memo(({ records }) => {
  const [sortBy, setSortBy] = useState<'value' | 'qty' | 'returns'>('value');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const deferredSearch = useDeferredValue(searchQuery);

  const {
    rawSkuList,
    totalFocusValue,
    totalFocusValueQty,
    totalRegularValue,
    totalNewValue,
    totalExistingValue,
    totalAllVal,
    focusPct,
  } = useMemo(() => {
    const skuMap: Record<string, {
      noSku: string;
      brand: string;
      sku: string;
      kategori: string;
      focus: string;
      newProduct: string;
      totalValue: number;
      totalQty: number;
      returnsValue: number;
      returnsQty: number;
      txCount: number;
    }> = {};

    let focusVal = 0;
    let focusQty = 0;
    let regularVal = 0;
    let newVal = 0;
    let existingVal = 0;

    for (let i = 0; i < records.length; i++) {
      const r = records[i];
      const k = r.SKU;
      if (!skuMap[k]) {
        skuMap[k] = {
          noSku: r.NO_SKU,
          brand: r.BRAND,
          sku: r.SKU,
          kategori: r.KATEGORI,
          focus: r.PRODUK_FOCUS,
          newProduct: r.PRODUK_NEW,
          totalValue: 0,
          totalQty: 0,
          returnsValue: 0,
          returnsQty: 0,
          txCount: 0,
        };
      }

      const val = r.VALUE || 0;
      const qty = r.QTY || 0;

      skuMap[k].totalValue += val;
      skuMap[k].totalQty += qty;
      skuMap[k].txCount += 1;

      if (val < 0 || r.KET === 'RETURN') {
        skuMap[k].returnsValue += Math.abs(val);
        skuMap[k].returnsQty += Math.abs(qty);
      }

      if (isFocusProduct(r.PRODUK_FOCUS)) {
        focusVal += val;
        focusQty += qty;
      } else {
        regularVal += val;
      }

      if (isNewProduct(r.PRODUK_NEW)) {
        newVal += val;
      } else {
        existingVal += val;
      }
    }

    const totalAll = focusVal + regularVal || 1;
    return {
      rawSkuList: Object.values(skuMap),
      totalFocusValue: focusVal,
      totalFocusValueQty: focusQty,
      totalRegularValue: regularVal,
      totalNewValue: newVal,
      totalExistingValue: existingVal,
      totalAllVal: totalAll,
      focusPct: (focusVal / totalAll) * 100,
    };
  }, [records]);

  const skuList = useMemo(() => {
    const list = [...rawSkuList];
    list.sort((a, b) => {
      if (sortBy === 'qty') return b.totalQty - a.totalQty;
      if (sortBy === 'returns') return b.returnsValue - a.returnsValue;
      return b.totalValue - a.totalValue;
    });
    return list;
  }, [rawSkuList, sortBy]);

  const displayedSkuList = useMemo(() => {
    const normalizedSearch = deferredSearch.trim().toLowerCase();
    if (!normalizedSearch) return skuList;
    return skuList.filter(
      (item) =>
        item.sku.toLowerCase().includes(normalizedSearch) ||
        item.noSku.toLowerCase().includes(normalizedSearch) ||
        item.brand.toLowerCase().includes(normalizedSearch) ||
        item.kategori.toLowerCase().includes(normalizedSearch)
    );
  }, [skuList, deferredSearch]);

  return (
    <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-4 sm:p-6 mb-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-gradient-to-tr from-teal-600 to-cyan-500 text-white shadow-xs">
              <Package className="w-4 h-4" />
            </div>
            <h2 className="text-base font-extrabold text-slate-900">
              Analisa Performa SKU &amp; Strategi Produk
            </h2>
          </div>
          <p className="text-xs text-slate-500 mt-0.5 font-medium">
            Monitoring produk fokus (hero items), peluncuran produk baru (NPD), dan tingkat retur
          </p>
        </div>

        {/* Sort Controls with Vibrant Active Buttons */}
        <div className="flex items-center gap-1.5 p-1 bg-slate-100/90 rounded-xl border border-slate-200/80 shadow-2xs">
          <button
            onClick={() => setSortBy('value')}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
              sortBy === 'value'
                ? 'bg-gradient-to-r from-teal-600 to-cyan-600 text-white shadow-sm shadow-teal-500/20'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
          >
            Top Nilai (Rp)
          </button>
          <button
            onClick={() => setSortBy('qty')}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
              sortBy === 'qty'
                ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-sm shadow-blue-500/20'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
          >
            Top Volume (QTY)
          </button>
          <button
            onClick={() => setSortBy('returns')}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
              sortBy === 'returns'
                ? 'bg-gradient-to-r from-rose-600 to-red-600 text-white shadow-sm shadow-rose-500/20'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
          >
            Retur Tertinggi
          </button>
        </div>
      </div>

      {/* Focus & NPD Highlight Banners - Vibrant Dual Tone */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 my-6">
        {/* Produk Focus vs Regular */}
        <div className="p-4 rounded-2xl border border-amber-200/90 bg-gradient-to-br from-white via-amber-50/40 to-yellow-50/30 shadow-2xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-extrabold text-amber-950 flex items-center gap-1.5">
              <Flame className="w-4 h-4 text-amber-500" />
              Kontribusi Produk Fokus (Hero Items)
            </span>
            <span className="text-xs font-mono font-black px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
              {formatPercent(focusPct, false)} dari Total Omzet
            </span>
          </div>

          <div className="w-full bg-slate-100 h-3 rounded-full overflow-hidden flex my-2.5 p-0.5 border border-slate-200/60 shadow-inner">
            <div
              className="bg-gradient-to-r from-emerald-500 to-teal-400 h-full rounded-full transition-all duration-500 shadow-2xs"
              style={{ width: `${focusPct}%` }}
              title={`Focus: ${formatPercent(focusPct)}`}
            />
            <div
              className="bg-slate-300 h-full rounded-full transition-all duration-500"
              style={{ width: `${100 - focusPct}%` }}
              title={`Regular: ${formatPercent(100 - focusPct)}`}
            />
          </div>

          <div className="flex justify-between text-xs mt-2">
            <span className="font-medium text-emerald-900">
              <strong className="font-bold">Fokus:</strong> {formatRupiah(totalFocusValue, true)}
            </span>
            <span className="font-medium text-slate-600">
              <strong className="font-bold">Regular:</strong> {formatRupiah(totalRegularValue, true)}
            </span>
          </div>
        </div>

        {/* Produk New (Launch) vs Existing */}
        <div className="p-4 rounded-2xl border border-indigo-200/90 bg-gradient-to-br from-white via-indigo-50/40 to-purple-50/30 shadow-2xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-extrabold text-indigo-950 flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-indigo-500" />
              Kinerja Produk Baru (New Launch / NPD)
            </span>
            <span className="text-xs font-mono font-black px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800 border border-indigo-200">
              {formatPercent((totalNewValue / totalAllVal) * 100, false)} Adopsi
            </span>
          </div>

          <div className="w-full bg-slate-100 h-3 rounded-full overflow-hidden flex my-2.5 p-0.5 border border-slate-200/60 shadow-inner">
            <div
              className="bg-gradient-to-r from-indigo-600 to-violet-500 h-full rounded-full transition-all duration-500 shadow-2xs"
              style={{ width: `${Math.min(100, (totalNewValue / totalAllVal) * 100)}%` }}
            />
            <div
              className="bg-slate-300 h-full rounded-full transition-all duration-500"
              style={{ width: `${Math.max(0, 100 - (totalNewValue / totalAllVal) * 100)}%` }}
            />
          </div>

          <div className="flex justify-between text-xs mt-2">
            <span className="font-medium text-indigo-900">
              <strong className="font-bold">Produk Baru:</strong> {formatRupiah(totalNewValue, true)}
            </span>
            <span className="font-medium text-slate-600">
              <strong className="font-bold">Existing:</strong> {formatRupiah(totalExistingValue, true)}
            </span>
          </div>
        </div>
      </div>

      {/* Search & Total SKU Count Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
        <span className="text-xs font-bold text-slate-600 font-mono tabular-nums">
          Menampilkan <span className="text-slate-900">{displayedSkuList.length}</span> dari{' '}
          <span className="text-slate-900">{skuList.length}</span> Produk / SKU
        </span>
        <div className="relative min-w-[260px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari nama produk, no SKU, brand..."
            className="w-full pl-9 pr-8 py-1.5 text-xs rounded-xl border border-slate-200 bg-slate-50 focus:bg-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* SKU Table (Semua SKU & Nama Produk Tampil Penuh) */}
      <div className="overflow-x-auto max-h-[680px] overflow-y-auto border border-slate-200/80 rounded-xl">
        <table className="w-full text-left border-collapse text-xs">
          <thead className="sticky top-0 z-10 bg-slate-50 shadow-2xs">
            <tr className="border-b border-slate-200 text-slate-600 font-bold">
              <th className="py-2.5 px-3 text-center w-10">No</th>
              <th className="py-2.5 px-3 whitespace-nowrap">No SKU</th>
              <th className="py-2.5 px-3 min-w-[260px]">Nama Produk / SKU</th>
              <th className="py-2.5 px-3 whitespace-nowrap">Brand</th>
              <th className="py-2.5 px-3 whitespace-nowrap">Kategori</th>
              <th className="py-2.5 px-3 whitespace-nowrap">Strategi</th>
              <th className="py-2.5 px-3 text-right whitespace-nowrap">Total Nilai (Rp)</th>
              <th className="py-2.5 px-3 text-right whitespace-nowrap">Kuantitas (QTY)</th>
              <th className="py-2.5 px-3 text-right whitespace-nowrap">Retur (Rp)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {displayedSkuList.map((item, idx) => {
              const brandColorMap: Record<string, string> = {
                'barenbliss': 'bg-pink-100 text-pink-900 border-pink-200',
                'Y.O.U': 'bg-blue-100 text-blue-900 border-blue-200',
                'DAZZLE ME': 'bg-amber-100 text-amber-900 border-amber-200',
                'GLAMFIX': 'bg-purple-100 text-purple-900 border-purple-200',
                'lavojoy': 'bg-emerald-100 text-emerald-900 border-emerald-200',
              };
              const brandBadge = brandColorMap[item.brand] || 'bg-slate-100 text-slate-800 border-slate-200';

              return (
                <tr key={`${item.sku}-${idx}`} className="hover:bg-slate-50/80 transition-colors">
                  <td className="py-3 px-3 text-center font-mono tabular-nums text-slate-400">
                    {idx + 1}
                  </td>
                  <td className="py-3 px-3 font-mono font-semibold text-slate-500 whitespace-nowrap">{item.noSku}</td>
                  <td className="py-3 px-3 font-extrabold text-slate-900 min-w-[260px] whitespace-normal break-words leading-snug">
                    {item.sku}
                  </td>
                  <td className="py-3 px-3 whitespace-nowrap">
                    <span className={`font-bold px-2 py-0.5 rounded-md border text-[11px] ${brandBadge}`}>
                      {item.brand}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-slate-600 font-medium whitespace-nowrap">{item.kategori}</td>
                  <td className="py-3 px-3">
                    <div className="flex items-center gap-1">
                      {item.focus === 'FOCUS' && (
                        <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-gradient-to-r from-amber-400 to-yellow-300 text-amber-950 border border-amber-300 shadow-2xs">
                          FOCUS
                        </span>
                      )}
                      {item.newProduct === 'NEW' && (
                        <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-gradient-to-r from-purple-500 to-indigo-500 text-white shadow-2xs">
                          NEW
                        </span>
                      )}
                    </div>
                  </td>
                <td className="py-3 px-3 text-right font-mono font-bold text-slate-900 tabular-nums">
                  {formatRupiah(item.totalValue)}
                </td>
                <td className="py-3 px-3 text-right font-mono text-slate-700 tabular-nums">
                  {formatNumber(item.totalQty)} pcs
                </td>
                <td className="py-3 px-3 text-right font-mono tabular-nums">
                  {item.returnsValue > 0 ? (
                    <span className="text-rose-600 font-semibold">
                      - {formatRupiah(item.returnsValue)}
                    </span>
                  ) : (
                    <span className="text-slate-400">Rp 0</span>
                  )}
                </td>
              </tr>
            );
          })}
          </tbody>
        </table>
      </div>
    </div>
  );
});
