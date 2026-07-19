'use client';

import React, { useState } from 'react';
import { Laptop, ShoppingBag, Wrench, ChevronRight } from 'lucide-react';

interface CategoryBrowserProps {
  onSelect: (category: 'digital' | 'physical' | 'services' | null, subcategory: string | null) => void;
  activeCategory: 'digital' | 'physical' | 'services' | null;
  activeSubcategory: string | null;
}

const CATEGORIES = [
  {
    key: 'digital' as const,
    label: 'Digital Assets',
    icon: Laptop,
    description: 'Gift cards, games, crypto, vouchers, virtual services',
    color: 'from-blue-500/20 to-indigo-500/5 hover:border-blue-500/30',
    iconColor: 'text-blue-400',
    subcategories: ['Gift Cards', 'Airtime/Data', 'Crypto Exchange', 'Gaming Vouchers', 'Software Licenses'],
  },
  {
    key: 'physical' as const,
    label: 'Physical Goods',
    icon: ShoppingBag,
    description: 'Shoes, electronics, POS agents, cash, merchandise',
    color: 'from-emerald-500/20 to-teal-500/5 hover:border-emerald-500/30',
    iconColor: 'text-emerald-400',
    subcategories: ['POS Agent / Cash Out', 'Electronics', 'Fashion & Shoes', 'Phones & Accessories', 'Food & Delivery'],
  },
  {
    key: 'services' as const,
    label: 'Services',
    icon: Wrench,
    description: 'Freelance, logistics, design, tutoring, repair, plumbing',
    color: 'from-purple-500/20 to-pink-500/5 hover:border-purple-500/30',
    iconColor: 'text-purple-400',
    subcategories: ['Logistics/Delivery', 'Freelance Work', 'Web/App Development', 'Design & Creative', 'Plumbing & Repairs'],
  },
];

export default function CategoryBrowser({ onSelect, activeCategory, activeSubcategory }: CategoryBrowserProps) {
  return (
    <div className="space-y-6">
      {/* Category Card Selector */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {CATEGORIES.map((cat) => {
          const Icon = cat.icon;
          const isActive = activeCategory === cat.key;
          return (
            <button
              key={cat.key}
              onClick={() => onSelect(isActive ? null : cat.key, null)}
              className={`flex flex-col text-left p-5 rounded-2xl border transition-all relative overflow-hidden ${
                isActive
                  ? 'bg-slate-900 border-emerald-500 shadow-lg shadow-emerald-500/10'
                  : 'bg-slate-950 border-slate-900 hover:border-slate-800'
              }`}
            >
              {/* Decorative gradient overlay */}
              <div className={`absolute inset-0 bg-gradient-to-br ${cat.color} opacity-40`} />

              <div className="relative z-10 space-y-3">
                <div className={`p-3 rounded-xl bg-slate-900 w-fit ${cat.iconColor} border border-slate-800/80`}>
                  <Icon className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-bold text-white text-base tracking-tight">{cat.label}</h4>
                  <p className="text-xs text-slate-400 mt-1 leading-relaxed">{cat.description}</p>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Subcategory Pills */}
      {activeCategory && (
        <div className="p-5 bg-slate-950/80 border border-slate-900 rounded-2xl space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">
              Subcategories for {activeCategory}
            </span>
            {activeSubcategory && (
              <button
                onClick={() => onSelect(activeCategory, null)}
                className="text-[10px] font-bold text-slate-500 hover:text-white transition-colors"
              >
                Clear subcategory
              </button>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {CATEGORIES.find((c) => c.key === activeCategory)?.subcategories.map((sub) => {
              const isSubActive = activeSubcategory === sub;
              return (
                <button
                  key={sub}
                  onClick={() => onSelect(activeCategory, isSubActive ? null : sub)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                    isSubActive
                      ? 'bg-emerald-500 text-slate-950'
                      : 'bg-slate-900 text-slate-300 hover:bg-slate-800/80'
                  }`}
                >
                  {sub}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
