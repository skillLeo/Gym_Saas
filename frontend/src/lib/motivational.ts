import api from './api';

export interface MotivationalMessage {
  id: number;
  title: string | null;
  body: string;
  is_active: boolean;
  last_sent_at: string | null;
  send_count: number;
  /** True for the message the rotation will pick next. */
  is_next: boolean;
}

export interface NotificationSchedule {
  id: number;
  name: string;
  /** ISO day numbers, 1 = Monday. */
  days_of_week: number[];
  day_labels: string;
  send_time: string;
  timezone: string;
  is_active: boolean;
  last_run_at: string | null;
}

export interface MotivationalIndex {
  messages: MotivationalMessage[];
  schedules: NotificationSchedule[];
  activeCount: number;
  recipientCount: number;
  delivery: 'in_app';
}

export const DAY_OPTIONS = [
  { value: 1, label: 'Mon' },
  { value: 2, label: 'Tue' },
  { value: 3, label: 'Wed' },
  { value: 4, label: 'Thu' },
  { value: 5, label: 'Fri' },
  { value: 6, label: 'Sat' },
  { value: 7, label: 'Sun' },
] as const;

export async function fetchMotivational(): Promise<MotivationalIndex> {
  const { data } = await api.get('/admin/motivational');
  return {
    messages: data.data ?? [],
    schedules: data.schedules ?? [],
    activeCount: data.meta?.active_count ?? 0,
    recipientCount: data.meta?.recipient_count ?? 0,
    delivery: data.meta?.delivery ?? 'in_app',
  };
}

export async function createMessage(input: { title: string | null; body: string; is_active: boolean }) {
  const { data } = await api.post('/admin/motivational', input);
  return data.data as MotivationalMessage;
}

export async function updateMessage(
  id: number,
  input: { title: string | null; body: string; is_active: boolean },
) {
  const { data } = await api.put(`/admin/motivational/${id}`, input);
  return data.data as MotivationalMessage;
}

export async function deleteMessage(id: number): Promise<string> {
  const { data } = await api.delete(`/admin/motivational/${id}`);
  return data.message;
}

export async function sendMessageNow(id: number): Promise<string> {
  const { data } = await api.post(`/admin/motivational/${id}/send`);
  return data.message;
}

export type ScheduleInput = {
  name: string;
  days_of_week: number[];
  send_time: string;
  timezone: string;
  is_active: boolean;
};

export async function createSchedule(input: ScheduleInput) {
  const { data } = await api.post('/admin/motivational/schedules', input);
  return data.data as NotificationSchedule;
}

export async function updateSchedule(id: number, input: ScheduleInput) {
  const { data } = await api.put(`/admin/motivational/schedules/${id}`, input);
  return data.data as NotificationSchedule;
}

export async function deleteSchedule(id: number): Promise<string> {
  const { data } = await api.delete(`/admin/motivational/schedules/${id}`);
  return data.message;
}
