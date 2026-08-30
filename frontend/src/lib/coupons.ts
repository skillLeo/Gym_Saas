import api from './api';

export interface CouponOffer {
  id: number;
  key: string;
  name: string;
  stage: number;
  trigger_day_offset: number;
  expires_after_days: number;
  discount_type: 'percent' | 'fixed';
  discount_value: number;
  discount_label: string;
  stripe_coupon_id: string | null;
  email_subject: string;
  email_body_html: string;
  is_active: boolean;
  grants_count: number | null;
  redeemed_count: number | null;
}

export interface CouponOfferStats {
  key: string;
  name: string;
  stage: number;
  discount: string;
  sent: number;
  redeemed: number;
  expired_unused: number;
  /** Null when nothing has been sent — 0% on zero sends is not a fact. */
  conversion_rate: number | null;
}

export type CouponOfferInput = Omit<
  CouponOffer,
  'id' | 'discount_label' | 'stripe_coupon_id' | 'grants_count' | 'redeemed_count'
>;

export async function fetchOffers(): Promise<{ offers: CouponOffer[]; maxFixedDiscount: number }> {
  const { data } = await api.get('/admin/coupon-offers');
  return { offers: data.data ?? [], maxFixedDiscount: data.meta?.max_fixed_discount ?? 0 };
}

export async function fetchOfferStats(): Promise<CouponOfferStats[]> {
  const { data } = await api.get('/admin/coupon-offers/stats');
  return data.data ?? [];
}

export async function createOffer(input: CouponOfferInput): Promise<CouponOffer> {
  const { data } = await api.post('/admin/coupon-offers', input);
  return data.data;
}

export async function updateOffer(
  id: number,
  input: CouponOfferInput,
): Promise<{ offer: CouponOffer; message: string }> {
  const { data } = await api.put(`/admin/coupon-offers/${id}`, input);
  return { offer: data.data, message: data.message };
}

export async function deleteOffer(id: number): Promise<{ message: string; deactivated: boolean }> {
  const { data } = await api.delete(`/admin/coupon-offers/${id}`);
  // The API deactivates rather than deletes when codes are already in the wild,
  // and says so by returning the offer alongside the message.
  return { message: data.message, deactivated: Boolean(data.data) };
}

export async function sendOfferPreview(id: number): Promise<string> {
  const { data } = await api.post(`/admin/coupon-offers/${id}/preview`);
  return data.message;
}

/** Placeholders the admin may use in subject and body. */
export const EMAIL_PLACEHOLDERS = [
  { token: '{{name}}', description: "The member's name" },
  { token: '{{code}}', description: 'Their unique coupon code' },
  { token: '{{expires}}', description: 'The date the code expires' },
  { token: '{{discount}}', description: 'The discount, e.g. "30% off"' },
  { token: '{{url}}', description: 'Link to the pricing page' },
] as const;
