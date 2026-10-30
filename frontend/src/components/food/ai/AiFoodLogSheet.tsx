'use client';

/**
 * Snap / Say / Type — the whole flow, in one bottom sheet.
 *
 * choose -> loading -> review -> saved, with consent in front of the first use
 * and an error state that always offers manual logging instead.
 *
 * NOTHING IS SAVED UNTIL THE MEMBER PRESSES SAVE. The portion figures come
 * from a model looking at a photograph and are explicitly a guess; the review
 * step is the whole point of the feature, not a confirmation dialog.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { Sheet } from '@/components/ui/Sheet';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/States';
import { Textarea } from '@/components/ui/Field';
import {
  Camera, Images, Mic, Keyboard, Loader2, Square, WifiOff,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useI18nStore } from '@/store/i18nStore';
import {
  analyze, canRecordAudio, confirm, fetchAiStatus, giveConsent, resizeImage,
  rowNutrition, toAiError, toConfirmFood,
  type AiError, type AiStatus, type Draft, type ReviewRow,
} from '@/lib/aiFoodLog';
import { AiReviewList } from './AiReviewList';

type Step = 'consent' | 'choose' | 'loading' | 'review' | 'error';

interface MealSlotOption {
  slot_id: number;
  name: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  status: AiStatus;
  slots: MealSlotOption[];
  defaultSlotId: number | null;
  /** yyyy-MM-dd, the day the journal is showing. */
  date: string;
  /** Refresh the journal after a successful save. */
  onSaved: () => void;
  /** Open the ordinary manual add flow. */
  onLogManually: () => void;
  onStatusChange: (status: AiStatus) => void;
}

/** How long before we admit the request is slow. */
const SLOW_AFTER_MS = 12000;
/** How long before we stop and offer a way out. */
const GIVE_UP_AFTER_MS = 30000;

export function AiFoodLogSheet({
  open, onClose, status, slots, defaultSlotId, date, onSaved, onLogManually, onStatusChange,
}: Props) {
  const { t } = useI18nStore();

  const [step, setStep] = useState<Step>('choose');
  const [draft, setDraft] = useState<Draft | null>(null);
  const [rows, setRows] = useState<ReviewRow[]>([]);
  const [error, setError] = useState<AiError | null>(null);
  const [text, setText] = useState('');
  const [slotId, setSlotId] = useState<number | null>(defaultSlotId);
  const [loggedDate, setLoggedDate] = useState(date);
  const [saving, setSaving] = useState(false);
  const [slow, setSlow] = useState(false);
  const [recording, setRecording] = useState(false);
  const [consenting, setConsenting] = useState(false);

  const abortRef = useRef<AbortController | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  /** When recording began, so the real clip length can be reported. */
  const recordStartRef = useRef<number>(0);
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);

  // Reset to a clean sheet each time it opens, so a previous draft or error
  // never greets the member on a new attempt.
  useEffect(() => {
    if (!open) return;

    setStep(status.consent_required ? 'consent' : 'choose');
    setDraft(null);
    setRows([]);
    setError(null);
    setText('');
    setSlow(false);
    setSlotId(defaultSlotId);
    setLoggedDate(date);
  }, [open, status.consent_required, defaultSlotId, date]);

  // Abandon any in-flight request if the sheet closes.
  useEffect(() => {
    if (!open) {
      abortRef.current?.abort();
      stopRecording();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const cancel = useCallback(() => {
    abortRef.current?.abort();
    setStep('choose');
    setSlow(false);
  }, []);

  const run = useCallback(
    async (input: Parameters<typeof analyze>[0]) => {
      if (typeof navigator !== 'undefined' && navigator.onLine === false) {
        setError({ code: 'offline', message: t('aiFood.error.offline'), fallback: 'manual' });
        setStep('error');
        return;
      }

      const controller = new AbortController();
      abortRef.current = controller;

      setStep('loading');
      setSlow(false);

      const slowTimer = setTimeout(() => setSlow(true), SLOW_AFTER_MS);
      const giveUpTimer = setTimeout(() => controller.abort(), GIVE_UP_AFTER_MS);

      try {
        const result = await analyze(input, controller.signal);

        setDraft(result);
        setRows(
          result.items.map((item, i) => ({
            id: `${i}-${item.label}`,
            label: item.label,
            grams: item.grams_estimate,
            confidence: item.confidence,
            matches: item.usda_matches,
            // Pre-select the top match, since that is what the member is most
            // likely to want — but every row shows the alternatives and the
            // weight is editable, so nothing is chosen on their behalf
            // silently.
            chosen: item.usda_matches.length > 0 ? 0 : -1,
          })),
        );
        setStep('review');
      } catch (e) {
        setError(toAiError(e, t('aiFood.error.generic')));
        setStep('error');
      } finally {
        clearTimeout(slowTimer);
        clearTimeout(giveUpTimer);
        abortRef.current = null;
      }
    },
    [t],
  );

  // --------------------------------------------------------------- inputs

  const onPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';           // so the same photo can be picked twice
    if (!file) return;

    const resized = await resizeImage(file);
    void run({ image: resized });
  };

  function stopRecording() {
    const rec = recorderRef.current;
    if (rec && rec.state !== 'inactive') rec.stop();
    rec?.stream.getTracks().forEach((track) => track.stop());
    recorderRef.current = null;
    setRecording(false);
  }

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      const chunks: BlobPart[] = [];

      recorder.ondataavailable = (ev) => ev.data.size > 0 && chunks.push(ev.data);
      recorder.onstop = () => {
        stream.getTracks().forEach((track) => track.stop());
        const blob = new Blob(chunks, { type: recorder.mimeType || 'audio/webm' });
        const durationSeconds = (Date.now() - recordStartRef.current) / 1000;

        if (blob.size > 0) void run({ audio: blob, filename: 'clip.webm', durationSeconds });
      };

      recorderRef.current = recorder;
      recordStartRef.current = Date.now();
      recorder.start();
      setRecording(true);

      // The server refuses more than a minute of audio, so stop before it has
      // to — a refusal after a member has spoken is a worse experience than
      // being cut off at a limit they were told about.
      setTimeout(() => recorderRef.current === recorder && stopRecording(), 55000);
    } catch {
      toast.error(t('aiFood.error.micDenied'));
    }
  };

  // --------------------------------------------------------------- saving

  const totals = rows.reduce(
    (acc, row) => {
      const n = rowNutrition(row);
      if (!n) return acc;

      return {
        calories: acc.calories + n.calories,
        protein_g: acc.protein_g + n.protein_g,
        carbs_g: acc.carbs_g + n.carbs_g,
        fat_g: acc.fat_g + n.fat_g,
      };
    },
    { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 },
  );

  const saveable = rows.filter((r) => r.manual ?? r.matches[r.chosen]);

  const save = async () => {
    if (!slotId || saveable.length === 0) return;

    setSaving(true);
    try {
      await confirm({
        meal_slot_id: slotId,
        logged_date: loggedDate,
        items: saveable.map((row) => {
          const food = row.manual ?? row.matches[row.chosen];

          return { grams: row.grams, food: toConfirmFood(food) };
        }),
      });

      toast.success(
        saveable.length === 1
          ? t('aiFood.saved.one')
          : t('aiFood.saved.many', { count: saveable.length }),
      );
      onSaved();
      onClose();
    } catch (e) {
      const err = toAiError(e, t('aiFood.error.saveFailed'));
      setError(err);
      setStep('error');
    } finally {
      setSaving(false);
    }
  };

  const acceptConsent = async () => {
    setConsenting(true);
    try {
      await giveConsent(status.consent_version);
      const fresh = await fetchAiStatus();
      if (fresh) onStatusChange(fresh);
      setStep('choose');
    } catch {
      toast.error(t('aiFood.error.consentFailed'));
    } finally {
      setConsenting(false);
    }
  };

  // ---------------------------------------------------------------- views

  const title = {
    consent: t('aiFood.consent.title'),
    choose: t('aiFood.title'),
    loading: t('aiFood.loading.title'),
    review: t('aiFood.review.title'),
    error: t('aiFood.error.title'),
  }[step];

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={title}
      description={step === 'choose' ? t('aiFood.subtitle') : undefined}
      footer={
        step === 'review' ? (
          <Button
            fullWidth
            loading={saving}
            disabled={!slotId || saveable.length === 0}
            onClick={save}
          >
            {t('aiFood.review.save')}
          </Button>
        ) : step === 'consent' ? (
          <Button fullWidth loading={consenting} onClick={acceptConsent}>
            {t('aiFood.consent.accept')}
          </Button>
        ) : undefined
      }
    >
      {/* Hidden pickers. `capture` asks the phone for the camera directly, which
          is what lets this work in the PWA with no native code. */}
      <input
        ref={cameraRef} type="file" accept="image/jpeg,image/png,image/webp"
        capture="environment" className="hidden" onChange={onPhoto}
      />
      <input
        ref={galleryRef} type="file" accept="image/jpeg,image/png,image/webp"
        className="hidden" onChange={onPhoto}
      />

      {step === 'consent' && <ConsentView />}

      {step === 'choose' && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2.5">
            <ChoiceButton
              icon={<Camera size={20} />}
              label={t('aiFood.choose.takePhoto')}
              onClick={() => cameraRef.current?.click()}
            />
            <ChoiceButton
              icon={<Images size={20} />}
              label={t('aiFood.choose.choosePhoto')}
              onClick={() => galleryRef.current?.click()}
            />
            {/* Hidden rather than broken where MediaRecorder is missing. */}
            {canRecordAudio() && (
              <ChoiceButton
                icon={recording ? <Square size={18} /> : <Mic size={20} />}
                label={recording ? t('aiFood.choose.stopRecording') : t('aiFood.choose.speak')}
                active={recording}
                onClick={() => (recording ? stopRecording() : startRecording())}
              />
            )}
            <ChoiceButton
              icon={<Keyboard size={20} />}
              label={t('aiFood.choose.type')}
              onClick={() => document.getElementById('ai-food-text')?.focus()}
            />
          </div>

          {recording && (
            <p className="text-caption text-content-secondary text-center" role="status">
              {t('aiFood.choose.recordingHint')}
            </p>
          )}

          <Textarea
            id="ai-food-text"
            label={t('aiFood.choose.typeLabel')}
            placeholder={t('aiFood.choose.typePlaceholder')}
            value={text}
            maxLength={1000}
            rows={3}
            onChange={(e) => setText(e.target.value)}
          />
          <Button
            fullWidth
            variant="secondary"
            disabled={text.trim().length < 2}
            onClick={() => void run({ text: text.trim() })}
          >
            {t('aiFood.choose.analyseText')}
          </Button>

          {status.daily_remaining !== null && status.daily_remaining <= 3 && (
            <p className="text-caption text-content-tertiary text-center">
              {t('aiFood.choose.remaining', { count: status.daily_remaining })}
            </p>
          )}
        </div>
      )}

      {step === 'loading' && (
        <div className="py-8 flex flex-col items-center gap-4 text-center">
          <Loader2 size={30} className="animate-spin text-accent" />
          <div>
            <p className="text-body text-content-primary">{t('aiFood.loading.working')}</p>
            {/* Honest about the wait rather than pretending it is nearly done.
                A photo really does take about ten seconds. */}
            <p className="text-body-sm text-content-secondary mt-1">
              {slow ? t('aiFood.loading.stillWorking') : t('aiFood.loading.takesAMoment')}
            </p>
          </div>
          <Button variant="ghost" onClick={cancel}>
            {t('common.cancel')}
          </Button>
        </div>
      )}

      {step === 'review' && draft && (
        <AiReviewList
          draft={draft}
          rows={rows}
          setRows={setRows}
          slots={slots}
          slotId={slotId}
          setSlotId={setSlotId}
          loggedDate={loggedDate}
          setLoggedDate={setLoggedDate}
          totals={totals}
          onStartOver={() => setStep('choose')}
          onLogManually={() => { onClose(); onLogManually(); }}
        />
      )}

      {step === 'error' && error && (
        <ErrorView
          error={error}
          onRetry={() => setStep('choose')}
          onLogManually={() => { onClose(); onLogManually(); }}
        />
      )}
    </Sheet>
  );

  // ------------------------------------------------------- local subviews

  function ConsentView() {
    return (
      <div className="space-y-3 text-body-sm text-content-secondary">
        <p>{t('aiFood.consent.intro')}</p>
        <ul className="space-y-2 list-disc pl-5">
          <li>{t('aiFood.consent.point1')}</li>
          <li>{t('aiFood.consent.point2')}</li>
          <li>{t('aiFood.consent.point3')}</li>
        </ul>
        <p className="text-caption text-content-tertiary">{t('aiFood.consent.withdraw')}</p>
      </div>
    );
  }

  function ErrorView({
    error: err, onRetry, onLogManually: manual,
  }: { error: AiError; onRetry: () => void; onLogManually: () => void }) {
    const offline = err.code === 'offline';

    return (
      <div className="space-y-4">
        <Alert tone={err.code === 'ai_limit_reached' ? 'info' : 'warning'}>
          <span className="flex items-start gap-2">
            {offline ? <WifiOff size={16} className="shrink-0 mt-0.5" /> : null}
            <span>{err.code === 'timeout' ? t('aiFood.error.timeout') : err.message}</span>
          </span>
        </Alert>

        <div className="flex flex-col gap-2">
          {/* Always a way forward. A limit on an optional convenience must
              never read as the food journal being closed. */}
          <Button fullWidth onClick={manual}>
            {t('aiFood.error.logManually')}
          </Button>
          {!offline && err.code !== 'ai_limit_reached' && (
            <Button fullWidth variant="secondary" onClick={onRetry}>
              {t('aiFood.error.tryAgain')}
            </Button>
          )}
        </div>
      </div>
    );
  }
}

function ChoiceButton({
  icon, label, onClick, active,
}: { icon: React.ReactNode; label: string; onClick: () => void; active?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'flex flex-col items-center justify-center gap-2 rounded-md border px-2 py-4',
        'min-h-[84px] cursor-pointer transition-colors',
        active
          ? 'border-accent bg-accent-subtle text-accent'
          : 'border-border-subtle bg-surface-raised text-content-secondary hover:border-accent/50',
      ].join(' ')}
    >
      <span className={active ? 'text-accent' : 'text-accent'}>{icon}</span>
      <span className="text-caption font-medium text-center leading-tight">{label}</span>
    </button>
  );
}
