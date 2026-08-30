'use client';
import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Plus } from 'lucide-react';

const EMOJI_CATEGORIES: Record<string, string[]> = {
  Smileys: ['😀', '😃', '😄', '😁', '😆', '😅', '🤣', '😂', '🙂', '🙃', '😉', '😊', '😇', '🥰', '😍', '🤩', '😘', '😋', '😛', '😜', '🤪', '😝', '🤑', '🤗', '🤔', '🤨', '😐', '😑', '😶', '🙄', '😏', '😴', '🥱', '😪'],
  Gestures: ['👍', '👎', '👊', '✊', '🤛', '🤜', '👏', '🙌', '👐', '🤲', '🙏', '✌️', '🤞', '🤟', '🤘', '👌', '🤙', '💪', '🦾', '👋', '🤝', '👆', '👇', '☝️'],
  Hearts: ['❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔', '❣️', '💕', '💞', '💓', '💗', '💖', '💘', '💝'],
  Fitness: ['🏋️', '🏃', '🤸', '🧘', '🚴', '🏊', '⚽', '🏀', '🏈', '🎾', '🥊', '🥋', '🏆', '🥇', '🔥', '⚡', '💯', '🎯', '📈', '🥗'],
  Food: ['🍎', '🍌', '🍗', '🥩', '🍳', '🥑', '🥦', '🍚', '🍕', '🍔', '🥗', '🍩', '☕', '🥤', '💧', '🍇', '🍓', '🥕'],
  Objects: ['🎉', '🎊', '✨', '⭐', '🌟', '💫', '🎁', '🏅', '📸', '📅', '⏰', '✅', '❌', '💬', '👀', '🚀'],
};

interface EmojiPickerProps {
  onSelect: (emoji: string) => void;
  triggerClassName?: string;
  triggerLabel?: string;
}

const PANEL_W = 288;   // w-72
const PANEL_H = 300;   // header + emoji grid, approximately

export function EmojiPicker({ onSelect, triggerClassName, triggerLabel }: EmojiPickerProps) {
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState<keyof typeof EMOJI_CATEGORIES>('Smileys');
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  /**
   * The panel is rendered into a portal on <body> rather than inline.
   *
   * Inline, it was a child of the post card — and that card is `overflow-hidden`
   * (so images sit inside its rounded corners). That clipped the picker down to
   * a sliver showing two or three emoji. A portal escapes every ancestor's
   * clipping, and the position is measured from the trigger each time it opens.
   */
  const place = useCallback(() => {
    const btn = ref.current?.querySelector('button');
    if (!btn) return;
    const r = btn.getBoundingClientRect();

    // Prefer above the trigger; flip below if there is not room.
    let top = r.top - PANEL_H - 8;
    if (top < 8) top = Math.min(r.bottom + 8, window.innerHeight - PANEL_H - 8);

    // Keep it on screen horizontally.
    let left = r.left;
    if (left + PANEL_W > window.innerWidth - 8) left = window.innerWidth - PANEL_W - 8;
    if (left < 8) left = 8;

    setPos({ top, left });
  }, []);

  useEffect(() => {
    if (!open) return;
    place();

    const onClickOutside = (e: MouseEvent) => {
      const t = e.target as Node;
      // The panel is outside this component's DOM tree now, so it has to be
      // checked separately or clicking an emoji would close before it registers.
      if (ref.current?.contains(t) || panelRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onEscape = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };

    document.addEventListener('mousedown', onClickOutside);
    document.addEventListener('keydown', onEscape);
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      document.removeEventListener('mousedown', onClickOutside);
      document.removeEventListener('keydown', onEscape);
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [open, place]);

  return (
    <div className="relative" ref={ref}>
      <button type="button" onClick={() => setOpen(v => !v)}
        className={triggerClassName ?? 'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-content-secondary hover:bg-gray-100 dark:hover:bg-white/10 transition-colors'}>
        <Plus size={14} /> {triggerLabel ?? 'Emoji'}
      </button>

      {open && pos && typeof document !== 'undefined' && createPortal(
        <div
          ref={panelRef}
          style={{ position: 'fixed', top: pos.top, left: pos.left, width: PANEL_W }}
          className="bg-white dark:bg-[#1e1e1e] rounded-md border border-border-strong shadow-lg z-[100] overflow-hidden"
        >
          <div className="flex gap-1 p-2 border-b border-border-subtle overflow-x-auto">
            {(Object.keys(EMOJI_CATEGORIES) as (keyof typeof EMOJI_CATEGORIES)[]).map(cat => (
              <button key={cat} type="button" onClick={() => setCategory(cat)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold whitespace-nowrap transition-colors ${category === cat ? 'bg-accent text-white' : 'text-content-secondary hover:bg-gray-100 dark:hover:bg-white/10'}`}>
                {cat}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-8 gap-1 p-2.5 max-h-52 overflow-y-auto">
            {EMOJI_CATEGORIES[category].map((emoji, i) => (
              <button key={i} type="button" onClick={() => { onSelect(emoji); setOpen(false); }}
                className="w-8 h-8 flex items-center justify-center text-lg rounded-lg hover:bg-gray-100 dark:hover:bg-white/10 transition-colors">
                {emoji}
              </button>
            ))}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
