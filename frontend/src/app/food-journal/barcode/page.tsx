'use client';

import { useState } from 'react';
import { DashboardShell } from '@/components/layout/DashboardShell';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ChevronLeft, Barcode, Search, Plus, CheckCircle, ZapIcon } from 'lucide-react';
import Link from 'next/link';

const mockScanResult = {
  name: 'Quest Protein Bar – Cookies & Cream',
  brand: 'Quest Nutrition',
  serving: '1 bar (60g)',
  calories: 190,
  protein: 21,
  carbs: 22,
  fat: 7,
  fiber: 14,
  sugar: 1,
  sodium: 290,
  image: 'https://images.unsplash.com/photo-1490645935967-10de6ba17061?w=200&h=200&fit=crop',
};

const recentScans = [
  { name: 'Premier Protein Shake', brand: 'Premier Nutrition', calories: 160, protein: 30, serving: '11 fl oz' },
  { name: 'KIND Bar – Dark Chocolate', brand: 'KIND', calories: 200, protein: 6, serving: '1 bar (40g)' },
  { name: 'Chobani Greek Yogurt', brand: 'Chobani', calories: 120, protein: 17, serving: '5.3 oz' },
];

export default function BarcodeScannerPage() {
  const [scanning, setScanning] = useState(false);
  const [scanned, setScanned] = useState(false);
  const [added, setAdded] = useState(false);
  const [manualCode, setManualCode] = useState('');
  const [selectedMeal, setSelectedMeal] = useState('breakfast');

  const handleScan = () => {
    setScanning(true);
    setTimeout(() => {
      setScanning(false);
      setScanned(true);
    }, 2200);
  };

  const handleAdd = () => {
    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
  };

  return (
    <DashboardShell>
      <div className="max-w-md mx-auto px-4 py-6">

        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Link href="/food-journal">
            <button className="w-9 h-9 flex items-center justify-center rounded-xl bg-white dark:bg-[#1a1a1a] border border-gray-100 dark:border-white/[0.07] hover:border-[#F87404]/40 transition-colors">
              <ChevronLeft size={18} className="text-gray-600 dark:text-gray-400" />
            </button>
          </Link>
          <div>
            <h1 className="font-display text-2xl font-bold text-gray-900 dark:text-white">Barcode Scanner</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">Scan food packaging for instant nutrition info</p>
          </div>
        </div>

        {/* Scanner Viewfinder */}
        <div className="relative rounded-3xl overflow-hidden mb-5 bg-gray-900 aspect-[4/3]">
          {/* Camera feed simulation */}
          <div className="absolute inset-0 bg-gradient-to-b from-gray-800 to-gray-900">
            {scanning && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-48 h-48 relative">
                  {/* Scanner frame corners */}
                  {['top-0 left-0', 'top-0 right-0', 'bottom-0 left-0', 'bottom-0 right-0'].map((pos, i) => (
                    <div key={i} className={`absolute w-8 h-8 ${pos} border-[#F87404]`}
                      style={{
                        borderTopWidth: i < 2 ? 3 : 0,
                        borderBottomWidth: i >= 2 ? 3 : 0,
                        borderLeftWidth: i % 2 === 0 ? 3 : 0,
                        borderRightWidth: i % 2 === 1 ? 3 : 0,
                      }} />
                  ))}
                  {/* Scanning line */}
                  <div className="absolute left-0 right-0 h-0.5 bg-[#F87404] animate-scan-line" style={{ top: '50%', boxShadow: '0 0 8px #F87404' }} />
                </div>
                <p className="absolute bottom-6 text-white/70 text-sm animate-pulse">Scanning...</p>
              </div>
            )}

            {!scanning && !scanned && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
                <div className="w-16 h-16 rounded-full bg-white/10 flex items-center justify-center">
                  <Barcode size={32} className="text-white/60" />
                </div>
                <p className="text-white/60 text-sm">Position barcode in frame</p>
              </div>
            )}

            {scanned && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center">
                  <div className="w-16 h-16 rounded-full bg-green-500 flex items-center justify-center mx-auto mb-2 shadow-lg shadow-green-500/40">
                    <CheckCircle size={32} className="text-white" />
                  </div>
                  <p className="text-white font-semibold">Product Found!</p>
                </div>
              </div>
            )}
          </div>

          {/* Overlay gradient */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent pointer-events-none" />

          {/* Flash / AI badge */}
          <div className="absolute top-4 right-4">
            <div className="flex items-center gap-1.5 bg-black/40 backdrop-blur-sm px-3 py-1.5 rounded-full border border-white/20">
              <ZapIcon size={12} className="text-[#FFC000]" />
              <span className="text-white text-xs font-medium">AI Powered</span>
            </div>
          </div>
        </div>

        {/* Scan Button */}
        {!scanned && (
          <Button onClick={handleScan} fullWidth size="lg" loading={scanning} icon={<Barcode size={18} />} className="mb-4">
            {scanning ? 'Scanning...' : 'Start Scanning'}
          </Button>
        )}

        {/* Manual barcode entry */}
        {!scanned && (
          <div className="flex gap-2 mb-6">
            <div className="relative flex-1">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                value={manualCode}
                onChange={e => setManualCode(e.target.value)}
                placeholder="Enter barcode manually..."
                className="w-full pl-9 pr-4 py-3 rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-white/[0.05] text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#F87404]/40 text-sm"
              />
            </div>
            <Button variant="outline" size="md" onClick={() => manualCode && setScanned(true)}>Search</Button>
          </div>
        )}

        {/* Scan Result */}
        {scanned && (
          <Card className="mb-5">
            <div className="p-5">
              <div className="flex gap-4 mb-4">
                <img src={mockScanResult.image} alt={mockScanResult.name}
                  className="w-16 h-16 rounded-xl object-cover shrink-0 bg-gray-100 dark:bg-white/10" />
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-gray-900 dark:text-white text-sm leading-snug">{mockScanResult.name}</h3>
                  <p className="text-xs text-gray-400 mt-0.5">{mockScanResult.brand}</p>
                  <p className="text-xs text-gray-400">Serving: {mockScanResult.serving}</p>
                </div>
              </div>

              {/* Nutrition facts */}
              <div className="bg-gray-50 dark:bg-white/[0.05] rounded-2xl p-4 mb-4">
                <div className="text-center mb-3">
                  <div className="font-display text-3xl font-bold text-[#F87404]">{mockScanResult.calories}</div>
                  <div className="text-xs text-gray-400">calories per serving</div>
                </div>
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { label: 'Protein', val: mockScanResult.protein, unit: 'g', color: '#F87404' },
                    { label: 'Carbs', val: mockScanResult.carbs, unit: 'g', color: '#004AAD' },
                    { label: 'Fat', val: mockScanResult.fat, unit: 'g', color: '#7C3AED' },
                    { label: 'Fiber', val: mockScanResult.fiber, unit: 'g', color: '#10B981' },
                  ].map(({ label, val, unit, color }) => (
                    <div key={label} className="text-center">
                      <div className="font-bold text-sm" style={{ color }}>{val}{unit}</div>
                      <div className="text-xs text-gray-400">{label}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Meal selector */}
              <div className="mb-4">
                <label className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-2 block">Add to meal</label>
                <div className="grid grid-cols-4 gap-2">
                  {['breakfast', 'lunch', 'dinner', 'snacks'].map(m => (
                    <button key={m} onClick={() => setSelectedMeal(m)}
                      className={`py-2 rounded-xl text-xs font-medium capitalize transition-all ${selectedMeal === m ? 'bg-[#F87404] text-white' : 'bg-gray-100 dark:bg-white/10 text-gray-600 dark:text-gray-400'}`}>
                      {m}
                    </button>
                  ))}
                </div>
              </div>

              {added ? (
                <div className="flex items-center justify-center gap-2 py-3 bg-green-50 dark:bg-green-500/10 rounded-xl text-green-600 dark:text-green-400 text-sm font-medium">
                  <CheckCircle size={16} />
                  Added to {selectedMeal}!
                </div>
              ) : (
                <div className="flex gap-2">
                  <Button onClick={handleAdd} fullWidth icon={<Plus size={16} />} size="md">
                    Add to {selectedMeal}
                  </Button>
                  <Button variant="outline" size="md" onClick={() => { setScanned(false); setScanning(false); }}>
                    Re-scan
                  </Button>
                </div>
              )}
            </div>
          </Card>
        )}

        {/* Recent Scans */}
        {!scanned && (
          <div>
            <h3 className="font-semibold text-gray-900 dark:text-white text-sm mb-3">Recently Scanned</h3>
            <div className="space-y-2">
              {recentScans.map((item) => (
                <button key={item.name} className="w-full flex items-center justify-between p-4 bg-white dark:bg-[#1a1a1a] rounded-2xl border border-gray-100 dark:border-white/[0.07] hover:border-[#F87404]/30 transition-all text-left">
                  <div>
                    <div className="text-sm font-medium text-gray-900 dark:text-white">{item.name}</div>
                    <div className="text-xs text-gray-400">{item.brand} · {item.serving}</div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <div className="text-sm font-bold text-[#F87404]">{item.calories}</div>
                      <div className="text-xs text-gray-400">kcal</div>
                    </div>
                    <div className="w-7 h-7 rounded-full bg-[#F87404] flex items-center justify-center shrink-0">
                      <Plus size={14} className="text-white" />
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </DashboardShell>
  );
}
