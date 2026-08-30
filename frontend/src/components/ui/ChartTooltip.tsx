'use client';

/**
 * Shared Recharts tooltip.
 *
 * Replaces three near-identical `CustomTooltip` components that were each
 * defined *inside* a page's render body. Recharts receives the component as
 * `content={<CustomTooltip />}`, so a new type on every render meant the
 * tooltip remounted constantly while hovering a chart
 * (react-hooks/static-components).
 *
 * Also fixes two smaller problems those copies shared: a hardcoded
 * `dark:bg-[#222]` surface instead of a token, and `any`-typed props.
 */

/** Minimal shape of what Recharts hands a custom tooltip. */
export interface ChartTooltipPayloadItem {
  name?: string;
  value?: number | string;
  color?: string;
  payload?: Record<string, unknown>;
}

export interface ChartTooltipProps {
  active?: boolean;
  payload?: ChartTooltipPayloadItem[];
  /**
   * Recharts passes its own `label` (the x-axis category value). It is accepted
   * here only so it does NOT collide with `seriesLabel` below — see the note on
   * that prop.
   */
  label?: string;
  /**
   * Overrides the series name, for charts showing one switchable metric.
   *
   * This used to be called `label`, which clashed with the `label` Recharts
   * injects. Charts that blank most axis categories (to stop the axis
   * crowding) therefore had Recharts pass `label=""` — and because an empty
   * string is not null, `label ?? p.name` returned the empty string and the
   * tooltip rendered a bare ": 0" with no series name at all.
   */
  seriesLabel?: string;
  /** Appended to the value, e.g. "lbs" or "%". */
  unit?: string;
  /** Overrides the series colour when the chart drives it externally. */
  color?: string;
  /** Key on the datum to use as the heading. Defaults to `date`. */
  labelKey?: string;
}

/**
 * Renders `2026-07-20` as `20 Jul 2026`, and leaves anything else untouched.
 * The axis already shows friendly dates; the heading showing a raw ISO string
 * made the same chart look like two different things.
 */
function formatHeading(value: unknown): string {
  const s = String(value);
  if (!/^\d{4}-\d{2}-\d{2}/.test(s)) return s;
  const d = new Date(s);
  return Number.isNaN(d.getTime())
    ? s
    : d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

export function ChartTooltip({
  active,
  payload,
  seriesLabel,
  unit,
  color,
  labelKey = 'date',
}: ChartTooltipProps) {
  if (!active || !payload?.length) return null;

  const heading = payload[0]?.payload?.[labelKey];

  return (
    <div className="bg-surface-raised border border-border-subtle rounded-md p-2.5 elev-1">
      {heading != null && (
        <p className="text-caption font-semibold text-content-secondary mb-1">{formatHeading(heading)}</p>
      )}
      <div className="flex flex-col gap-0.5">
        {payload.map((p, i) => (
          <p
            key={p.name ?? i}
            className="text-caption tabular"
            style={{ color: color ?? p.color ?? 'var(--content-primary)' }}
          >
            {/* `||` not `??`: an empty series name must fall through too. */}
            {seriesLabel || p.name || 'Value'}:{' '}
            <strong>
              {p.value}
              {unit ? ` ${unit}` : ''}
            </strong>
          </p>
        ))}
      </div>
    </div>
  );
}
