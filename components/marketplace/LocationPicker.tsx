'use client';

import React, { useState } from 'react';
import { MapPin, Navigation, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';

interface LocationPickerProps {
  onLocationSelect: (lat: number, lng: number, label: string) => void;
  initialLat?: number | null;
  initialLng?: number | null;
}

const PRESETS = [
  { name: 'Lagos', lat: 6.5244, lng: 3.3792 },
  { name: 'Abuja', lat: 9.0765, lng: 7.3986 },
  { name: 'Port Harcourt', lat: 4.8156, lng: 7.0498 },
  { name: 'Kano', lat: 12.0022, lng: 8.592 },
  { name: 'Ibadan', lat: 7.3775, lng: 3.947 },
];

export default function LocationPicker({
  onLocationSelect,
  initialLat,
  initialLng,
}: LocationPickerProps) {
  const [lat, setLat] = useState<string>(initialLat ? initialLat.toString() : '');
  const [lng, setLng] = useState<string>(initialLng ? initialLng.toString() : '');
  const [isLocating, setIsLocating] = useState(false);
  const [activeLabel, setActiveLabel] = useState<string>('');

  const handleGetLocation = () => {
    if (!navigator.geolocation) {
      toast.error('Geolocation is not supported by your browser');
      return;
    }

    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const latitude = position.coords.latitude;
        const longitude = position.coords.longitude;
        setLat(latitude.toString());
        setLng(longitude.toString());
        setActiveLabel('Current Geolocation');
        onLocationSelect(latitude, longitude, 'Current Geolocation');
        setIsLocating(false);
        toast.success('Location obtained successfully');
      },
      (error) => {
        console.error('GPS error:', error);
        toast.error('Failed to retrieve location. Please input manually or select a preset.');
        setIsLocating(false);
      },
      { enableHighAccuracy: true, timeout: 5000 }
    );
  };

  const handlePresetSelect = (preset: typeof PRESETS[0]) => {
    setLat(preset.lat.toString());
    setLng(preset.lng.toString());
    setActiveLabel(preset.name);
    onLocationSelect(preset.lat, preset.lng, preset.name);
  };

  const handleManualChange = (field: 'lat' | 'lng', val: string) => {
    if (field === 'lat') setLat(val);
    else setLng(val);

    const l = parseFloat(lat);
    const n = parseFloat(lng);
    if (!isNaN(l) && !isNaN(n)) {
      setActiveLabel('Manual Coordinates');
      onLocationSelect(l, n, 'Manual Coordinates');
    }
  };

  return (
    <div className="space-y-4 p-4 bg-slate-950/80 border border-slate-900 rounded-2xl">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
            Set Business Location
          </span>
          <span className="text-[10px] text-slate-500 mt-0.5 block">
            Used to show matching nearby buyers (distance proximity)
          </span>
        </div>

        <button
          type="button"
          onClick={handleGetLocation}
          className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-850 border border-slate-800 text-xs font-bold text-white flex items-center justify-center gap-2 transition-all"
          disabled={isLocating}
        >
          {isLocating ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-400" />
          ) : (
            <Navigation className="w-3.5 h-3.5 text-emerald-400" />
          )}
          <span>Get Geolocation</span>
        </button>
      </div>

      {/* Preset List */}
      <div className="space-y-2">
        <span className="text-[10px] text-slate-500 font-bold block uppercase tracking-wider">Presets</span>
        <div className="flex flex-wrap gap-1.5">
          {PRESETS.map((preset) => {
            const isActive = activeLabel === preset.name;
            return (
              <button
                key={preset.name}
                type="button"
                onClick={() => handlePresetSelect(preset)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  isActive
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                    : 'bg-slate-900/50 text-slate-400 hover:text-white border border-transparent'
                }`}
              >
                {preset.name}
              </button>
            );
          })}
        </div>
      </div>

      {/* Manual coordinates input */}
      <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-900">
        <div className="space-y-1">
          <label className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Latitude</label>
          <input
            type="number"
            step="any"
            value={lat}
            onChange={(e) => handleManualChange('lat', e.target.value)}
            placeholder="e.g. 6.5244"
            className="w-full bg-slate-950 border border-slate-850 focus:border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-650 outline-none transition-all"
          />
        </div>
        <div className="space-y-1">
          <label className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Longitude</label>
          <input
            type="number"
            step="any"
            value={lng}
            onChange={(e) => handleManualChange('lng', e.target.value)}
            placeholder="e.g. 3.3792"
            className="w-full bg-slate-950 border border-slate-850 focus:border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-650 outline-none transition-all"
          />
        </div>
      </div>
    </div>
  );
}
