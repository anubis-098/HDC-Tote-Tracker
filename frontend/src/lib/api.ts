import { locale } from './i18n';
export class ApiError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  if (options.body && !(options.body instanceof FormData)) headers.set('Content-Type', 'application/json');
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.body instanceof FormData ? 90000 : 30000);
  const abort = () => controller.abort();
  if (options.signal?.aborted) controller.abort();
  options.signal?.addEventListener('abort', abort, { once: true });
  try {
    let response: Response;
    try { response = await fetch('/api' + path, { ...options, headers, signal: controller.signal, credentials: 'same-origin' }); }
    catch {
      throw new Error(controller.signal.aborted ? 'หมดเวลารอ กรุณาตรวจสอบสถานะแล้วลองใหม่ ข้อมูลอาจบันทึกสำเร็จแล้ว' : 'เชื่อมต่อไม่ได้ กรุณาตรวจสอบเครือข่ายแล้วลองใหม่');
    }
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      const fallback = response.status === 413 ? 'ไฟล์ภาพใหญ่เกินไป กรุณาใช้ภาพไม่เกิน 8 MB' : response.status >= 500 ? 'ระบบยังไม่พร้อม กรุณารอสักครู่แล้วลองใหม่' : 'ข้อมูลไม่ถูกต้อง กรุณาตรวจสอบแล้วลองใหม่';
      throw new ApiError(response.status, typeof data.detail === 'string' ? data.detail : fallback);
    }
    return await response.json();
  } finally { clearTimeout(timeout); options.signal?.removeEventListener('abort', abort); }
}
export const message = (error: unknown) => error instanceof Error ? error.message : 'เกิดข้อผิดพลาด กรุณาลองใหม่';
// crypto.randomUUID requires a secure context; DataWedge can also be tried over LAN HTTP during development.
export function requestId() {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 15) | 64; bytes[8] = (bytes[8] & 63) | 128;
  const hex = Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
}
export type Status = 'READY' | 'AT_STORE' | 'RETURNED';
export type Action = 'DISPATCH' | 'RETURN' | 'RESET';
export const statusLabel: Record<Status, string> = { READY: 'พร้อมใช้งาน', AT_STORE: 'ส่งไป Store', RETURNED: 'รับกลับแล้ว' };
export const actionLabel: Record<Action | 'REGISTER', string> = { REGISTER: 'ลงทะเบียน Tote', DISPATCH: 'ส่งไป Store', RETURN: 'รับ Tote กลับ', RESET: 'ล้างปลายทาง · พร้อมใช้ใหม่' };
export const dateTime = (value: string) => new Date(value).toLocaleString(locale(), { timeZone: 'Asia/Bangkok', dateStyle: 'medium', timeStyle: 'short' });
export interface Identity { id: string; name: string; role: string }
export interface Store { code: string; name: string; active: boolean }
export interface ToteSummary { code: string; status: Status; store_code: string | null; store_name: string | null; version: number; updated_at: string }
export interface Tote extends ToteSummary {
  photos: { id: string; slot: number; uploaded_at: string }[];
  history: { id: string; action: Action | 'REGISTER'; store_code: string | null; store_name: string | null; worker_name: string; note: string; created_at: string }[];
}
export interface ToteList { items: ToteSummary[]; total: number; counts: Partial<Record<Status, number>> }
