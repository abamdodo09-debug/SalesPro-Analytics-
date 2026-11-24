import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Store, Search, ChevronDown, X, Check } from 'lucide-react';

interface SearchableStoreFilterProps {
  value: string;
  stores: string[];
  onChange: (store: string) => void;
  theme?: 'light' | 'dark';
  label?: string;
  className?: string;
}

export const SearchableStoreFilter: React.FC<SearchableStoreFilterProps> = ({
  value,
  stores,
  onChange,
  theme = 'light',
  label = 'Toko',
  className = '',
}) => {
  const isDark = theme === 'dark';
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      setSearchTerm('');
      const timer = setTimeout(() => {
        inputRef.current?.focus();
      }, 20);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  const filteredStores = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return stores;
    return stores.filter((st) => st.toLowerCase().includes(q));
  }, [stores, searchTerm]);

  const isSelected = Boolean(value && value !== 'ALL');

  const handleSelect = (nextVal: string) => {
    onChange(nextVal);
    setIsOpen(false);
  };

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {isDark ? (
        <div
          className={`flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs border transition-colors ${
            isSelected
              ? 'bg-amber-500/15 border-amber-500/50 text-amber-200'
              : 'bg-[#121926] border-[#243147] text-white'
          }`}
        >
          <span className="text-slate-400 font-medium shrink-0">{label}:</span>
          <button
            type="button"
            onClick={() => setIsOpen((v) => !v)}
            className="flex items-center gap-1 font-bold outline-none cursor-pointer max-w-[155px] text-left truncate"
            title={isSelected ? value : `Semua Toko (${stores.length})`}
          >
            <span className="truncate">
              {isSelected ? value : `Semua Toko (${stores.length})`}
            </span>
            <ChevronDown
              className={`w-3.5 h-3.5 shrink-0 opacity-75 transition-transform ${
                isOpen ? 'rotate-180' : ''
              }`}
            />
          </button>
          {isSelected && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onChange('ALL');
              }}
              title="Reset filter toko"
              className="ml-0.5 text-amber-300 hover:text-white cursor-pointer shrink-0"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
      ) : (
        <div
          className={`w-full flex items-center justify-between gap-1.5 px-2.5 py-1.5 text-xs rounded-lg border transition-colors shadow-2xs ${
            isSelected
              ? 'border-amber-500 bg-amber-50 font-bold text-amber-900'
              : 'border-slate-200 bg-white text-slate-700'
          }`}
        >
          <button
            type="button"
            onClick={() => setIsOpen((v) => !v)}
            className="flex-1 flex items-center justify-between gap-1 text-left min-w-0 cursor-pointer"
            title={isSelected ? value : `Semua Store (${stores.length})`}
          >
            <span className="truncate">
              {isSelected ? value : `Semua Store (${stores.length})`}
            </span>
            <ChevronDown
              className={`w-3.5 h-3.5 shrink-0 text-slate-400 transition-transform ${
                isOpen ? 'rotate-180' : ''
              }`}
            />
          </button>
          {isSelected && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onChange('ALL');
              }}
              title="Reset filter toko"
              className="text-amber-700 hover:text-amber-950 cursor-pointer shrink-0"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      )}

      {isOpen && (
        <div
          className={`absolute z-50 mt-1.5 w-72 max-w-[90vw] rounded-xl border shadow-2xl overflow-hidden ${
            isDark
              ? 'bg-[#0F1623] border-[#2A3952] text-slate-100 right-0 sm:left-0'
              : 'bg-white border-slate-200 text-slate-800 left-0'
          }`}
        >
          <div
            className={`p-2 border-b ${
              isDark ? 'border-[#1E293B] bg-[#0B101A]' : 'border-slate-100 bg-slate-50'
            }`}
          >
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                ref={inputRef}
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Cari & pilih nama toko..."
                className={`w-full pl-8 pr-7 py-1.5 text-xs rounded-lg border focus:outline-none focus:ring-2 ${
                  isDark
                    ? 'bg-[#121926] border-[#28354D] text-white placeholder-slate-500 focus:ring-amber-500/60'
                    : 'bg-white border-slate-200 text-slate-800 placeholder-slate-400 focus:ring-amber-500'
                }`}
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 cursor-pointer"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
            <div className="flex items-center justify-between mt-1.5 px-1 text-[10px] text-slate-400">
              <span className="flex items-center gap-1">
                <Store className="w-3 h-3 text-amber-400" />
                <span>{filteredStores.length} toko ditemukan</span>
              </span>
              {isSelected && (
                <button
                  type="button"
                  onClick={() => handleSelect('ALL')}
                  className="text-amber-400 hover:underline font-semibold cursor-pointer"
                >
                  Reset Semua
                </button>
              )}
            </div>
          </div>

          <div className="max-h-64 overflow-y-auto py-1 text-xs">
            <button
              type="button"
              onClick={() => handleSelect('ALL')}
              className={`w-full px-3 py-2 text-left flex items-center justify-between gap-2 transition-colors cursor-pointer ${
                !isSelected
                  ? isDark
                    ? 'bg-amber-500/15 text-amber-300 font-bold'
                    : 'bg-amber-50 text-amber-900 font-bold'
                  : isDark
                  ? 'hover:bg-[#192234] text-slate-200'
                  : 'hover:bg-slate-50 text-slate-700'
              }`}
            >
              <span>Semua Toko ({stores.length})</span>
              {!isSelected && <Check className="w-3.5 h-3.5 shrink-0" />}
            </button>

            {filteredStores.length === 0 ? (
              <div className="px-3 py-5 text-center text-[11px] text-slate-400">
                Nama toko "{searchTerm}" tidak ditemukan.
              </div>
            ) : (
              filteredStores.map((st) => {
                const active = value === st;
                return (
                  <button
                    key={st}
                    type="button"
                    onClick={() => handleSelect(st)}
                    className={`w-full px-3 py-1.5 text-left flex items-center justify-between gap-2 transition-colors cursor-pointer ${
                      active
                        ? isDark
                          ? 'bg-amber-500/20 text-amber-200 font-bold'
                          : 'bg-amber-50 text-amber-900 font-bold'
                        : isDark
                        ? 'hover:bg-[#192234] text-slate-200'
                        : 'hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <span className="truncate" title={st}>
                      {st}
                    </span>
                    {active && <Check className="w-3.5 h-3.5 shrink-0" />}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};
