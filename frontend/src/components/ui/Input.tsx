'use client';

/**
 * Single source of truth for text inputs now lives in ./Field, alongside Field,
 * NumericField and Textarea so label/hint/error presentation is identical
 * across every control.
 *
 * This module is kept as a re-export because ~40 Phase 1–7 pages import from
 * '@/components/ui/Input'. The public API (label, hint, error + all native
 * input props) is unchanged.
 */
export { Input, Field, NumericField, Textarea, inputBaseClass } from './Field';
