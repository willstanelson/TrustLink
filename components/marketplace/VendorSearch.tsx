'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Search, X, Loader2 } from 'lucide-react';

interface VendorSearchProps {
  onSearch: (query: string) => void;
  isLoading?: boolean;
}

export default function VendorSearch({ onSearch, isLoading = false }: VendorSearchProps) {
  const [query, setQuery] = useState('');
  const debouncedQueryRef = useRef<string>('');

  useEffect(() => {
    const handler = setTimeout(() => {
      if (debouncedQueryRef.current !== query) {
        debouncedQueryRef.current = query;
        onSearch(query.trim());
      }
    }, 400); // 400ms debounce

    return () => clearTimeout(handler);
  }, [query, onSearch]);

  const handleClear = () => {
    setQuery('');
    onSearch('');
  };

  return (
    <div className="relative w-full">
      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
        {isLoading ? (
          <Loader2 className="w-4 h-4 text-emerald-400 animate-spin" />
        ) : (
          <Search className="w-4 h-4 text-slate-500" />
        )}
      </div>

      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search vendor by business name or wallet address..."
        className="w-full pl-11 pr-10 py-3 bg-slate-950 border border-slate-900 focus:border-slate-800 rounded-2xl text-sm text-slate-300 placeholder-slate-500 outline-none transition-all"
      />

      {query && (
        <button
          onClick={handleClear}
          className="absolute inset-y-0 right-0 pr-4 flex items-center text-slate-500 hover:text-white transition-colors"
          type="button"
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}
