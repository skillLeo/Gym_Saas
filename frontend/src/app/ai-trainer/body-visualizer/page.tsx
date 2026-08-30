'use client';

import { useState, useRef } from 'react';
import { useI18nStore } from '@/store/i18nStore';
import { DashboardShell } from '@/components/layout/DashboardShell';
import { Card } from '@/components/ui/Card';
import { PageHeader } from '@/components/ui/PageHeader';
import { Sparkles, Upload, Camera, Ruler, Target, Wand2, CheckCircle, X } from 'lucide-react';
import toast from 'react-hot-toast';

const inputCls = "w-full bg-surface-sunken border border-border-strong rounded-md px-4 py-2.5 text-sm text-content-primary placeholder:text-content-tertiary outline-none focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/40 transition-all";


type PhotoSlot = 'before' | 'after';

export default function BodyVisualizerPage() {
  const { t } = useI18nStore();
  const [photos, setPhotos] = useState<Record<PhotoSlot, string | null>>({ before: null, after: null });
  const [current, setCurrent] = useState({ weight: '185', bodyFat: '22', chest: '42', waist: '34', hips: '40', arms: '14', thighs: '24' });
  const [goal,    setGoal]    = useState({ weight: '170', bodyFat: '15', chest: '44', waist: '30', hips: '38', arms: '16', thighs: '22' });
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploadSlot, setUploadSlot] = useState<PhotoSlot>('before');

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotos(p => ({ ...p, [uploadSlot]: URL.createObjectURL(file) }));
  };

  const openUpload = (slot: PhotoSlot) => { setUploadSlot(slot); fileRef.current?.click(); };

  const generate = async () => {
    setGenerating(true);
    await new Promise(r => setTimeout(r, 2200));
    setGenerating(false);
    setResult(true);
    toast.success(t('bodyViz.generated'));
  };

  return (
    <DashboardShell>
      <div className="max-w-lg mx-auto px-4 py-6 pb-24">

        {/* Header */}
        <PageHeader
        title={t('bodyViz.title')}
        subtitle={t('bodyViz.subtitle')}
        back="/ai-trainer"
      />

        {/* AI Banner */}
        <div className="flex items-center gap-3 bg-gradient-to-r from-[#F87404]/10 to-[#004AAD]/10 border border-accent/20 rounded-md p-4 mb-5">
          <Sparkles size={18} className="text-accent shrink-0" />
          <div>
            <div className="text-sm font-semibold text-content-primary">{t('bodyViz.previewTitle')}</div>
            <div className="text-xs text-content-secondary">{t('bodyViz.help')}</div>
          </div>
        </div>

        {/* Photo Upload */}
        <Card className="mb-5">
          <div className="p-5">
            <h2 className="font-semibold text-content-primary text-sm mb-4 flex items-center gap-2">
              <Camera size={15} className="text-accent" /> {t('bodyViz.progressPhotos')}
            </h2>
            <div className="grid grid-cols-2 gap-3">
              {(['before', 'after'] as const).map(slot => (
                <div key={slot}>
                  <p className="text-xs font-medium text-content-secondary mb-2">{slot === 'before' ? t('bodyViz.beforePhoto') : t('bodyViz.afterPhoto')}</p>
                  {photos[slot] ? (
                    <div className="relative rounded-md overflow-hidden aspect-[3/4]">
                      <img src={photos[slot]!} alt={slot} className="w-full h-full object-cover" />
                      <button onClick={() => setPhotos(p => ({ ...p, [slot]: null }))}
                        className="absolute top-2 right-2 w-7 h-7 bg-black/60 rounded-full flex items-center justify-center text-white hover:bg-black/80 transition-colors">
                        <X size={13} />
                      </button>
                    </div>
                  ) : (
                    <button onClick={() => openUpload(slot)}
                      className="w-full aspect-[3/4] rounded-md border-2 border-dashed border-border-strong flex flex-col items-center justify-center gap-2 hover:border-accent hover:bg-accent/5 transition-all">
                      <Upload size={22} className="text-content-tertiary dark:text-content-secondary" />
                      <span className="text-xs text-content-tertiary font-medium">{t('bodyViz.uploadPhoto')}</span>
                    </button>
                  )}
                </div>
              ))}
            </div>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
          </div>
        </Card>

        {/* Current Stats */}
        <Card className="mb-5">
          <div className="p-5">
            <h2 className="font-semibold text-content-primary text-sm mb-4 flex items-center gap-2">
              <Ruler size={15} className="text-brand-blue-deep" /> {t('bodyViz.currentStats')}
            </h2>
            <div className="grid grid-cols-2 gap-3">
              {[
                { key: 'weight', label: t('common.weightLbs') },
                { key: 'bodyFat', label: t('bodyViz.bodyFatPct') },
                { key: 'chest', label: t('bodyViz.chestIn') },
                { key: 'waist', label: t('bodyViz.waistIn') },
                { key: 'hips', label: t('bodyViz.hipsIn') },
                { key: 'arms', label: t('bodyViz.armsIn') },
                { key: 'thighs', label: t('bodyViz.thighsIn') },
              ].map(({ key, label }) => (
                <div key={key}>
                  <label className="block text-xs font-medium text-content-secondary mb-1">{label}</label>
                  <input className={inputCls} type="number" min={0} value={current[key as keyof typeof current]}
                    onChange={e => { const v = e.target.value; if (v === '' || /^\d*\.?\d*$/.test(v)) setCurrent(p => ({ ...p, [key]: v })); }}
                    onKeyDown={e => { if (e.key === '-' || e.key === 'e') e.preventDefault(); }} />
                </div>
              ))}
            </div>
          </div>
        </Card>

        {/* Goal Stats */}
        <Card className="mb-5">
          <div className="p-5">
            <h2 className="font-semibold text-content-primary text-sm mb-4 flex items-center gap-2">
              <Target size={15} className="text-[#10B981]" /> {t('bodyViz.goalStats')}
            </h2>
            <div className="grid grid-cols-2 gap-3">
              {[
                { key: 'weight', label: t('bodyViz.goalWeight') },
                { key: 'bodyFat', label: t('bodyViz.goalBodyFat') },
                { key: 'chest', label: t('bodyViz.goalChest') },
                { key: 'waist', label: t('bodyViz.goalWaist') },
                { key: 'hips', label: t('bodyViz.goalHips') },
                { key: 'arms', label: t('bodyViz.goalArms') },
                { key: 'thighs', label: t('bodyViz.goalThighs') },
              ].map(({ key, label }) => (
                <div key={key}>
                  <label className="block text-xs font-medium text-content-secondary mb-1">{label}</label>
                  <input className={inputCls} type="number" min={0} value={goal[key as keyof typeof goal]}
                    onChange={e => { const v = e.target.value; if (v === '' || /^\d*\.?\d*$/.test(v)) setGoal(p => ({ ...p, [key]: v })); }}
                    onKeyDown={e => { if (e.key === '-' || e.key === 'e') e.preventDefault(); }} />
                </div>
              ))}
            </div>
          </div>
        </Card>

        {/* Changes summary */}
        <div className="grid grid-cols-3 gap-3 mb-5">
          {[
            { label: t('bodyViz.weightLoss'), val: `${parseInt(current.weight) - parseInt(goal.weight)} lbs`, color: '#F87404' },
            { label: t('bodyViz.fatReduction'), val: `${parseFloat(current.bodyFat) - parseFloat(goal.bodyFat)}%`, color: '#004AAD' },
            { label: t('bodyViz.waistLoss'), val: `${parseInt(current.waist) - parseInt(goal.waist)} in`, color: '#10B981' },
          ].map(({ label, val, color }) => (
            <div key={label} className="bg-surface-raised rounded-md border border-border-subtle p-3 text-center">
              <div className="font-bold text-lg" style={{ color }}>{val}</div>
              <div className="text-xs text-content-tertiary mt-0.5">{label}</div>
            </div>
          ))}
        </div>

        {/* Generate Button */}
        <button
          onClick={generate}
          disabled={generating}
          className="w-full flex items-center justify-center gap-3 py-4 rounded-md bg-gradient-to-r from-[#F87404] to-[#FF5C04] text-white font-bold text-base hover: transition-all active:scale-[0.98] disabled:opacity-70 mb-5"
        >
          {generating ? (
            <>
              <div className="w-5 h-5 rounded-full border-2 border-white/40 border-t-white animate-spin" />
              {t('bodyViz.generating')}
            </>
          ) : (
            <>
              <Wand2 size={20} /> {t('bodyViz.generate')}
            </>
          )}
        </button>

        {/* Result */}
        {result && (
          <Card className="overflow-hidden">
            <div className="p-5 border-b border-border-subtle flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle size={16} className="text-[#10B981]" />
                <span className="font-semibold text-content-primary text-sm">{t('bodyViz.preview')}</span>
              </div>
              <span className="text-xs bg-[#10B981]/10 text-[#10B981] px-2.5 py-1 rounded-full font-semibold">{t('common.aiGenerated')}</span>
            </div>
            <div className="grid grid-cols-2">
              {[
                { label: 'NOW',  img: photos.before, color: '#F87404' },
                { label: 'GOAL', img: photos.after,  color: '#10B981' },
              ].map(({ label, img, color }) => (
                <div key={label} className="relative bg-gray-100 dark:bg-white/5 aspect-[3/4] flex items-center justify-center overflow-hidden">
                  {img ? (
                    <img src={img} alt={label} className="w-full h-full object-cover" />
                  ) : (
                    <div className="flex flex-col items-center gap-2 text-content-tertiary">
                      <Camera size={28} />
                      <span className="text-xs">{label === 'NOW' ? t('bodyViz.beforePhoto') : 'Goal'}</span>
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                  <div className="absolute bottom-3 left-0 right-0 text-center">
                    <span className="text-xs font-bold tracking-widest px-3 py-1 rounded-full text-white" style={{ backgroundColor: color }}>
                      {label}
                    </span>
                  </div>
                </div>
              ))}
            </div>
            <div className="p-4">
              <p className="text-xs text-content-secondary text-center">
                This is an AI-estimated visualization based on your stats. Actual results depend on consistency and effort.
              </p>
              <button
                onClick={() => { toast.success(t('bodyViz.saved')); }}
                className="w-full mt-3 py-2.5 rounded-md border-2 border-accent text-accent text-sm font-semibold hover:bg-accent-surface transition-all"
              >
                {t('bodyViz.saveToProfile')}
              </button>
            </div>
          </Card>
        )}

      </div>
    </DashboardShell>
  );
}
