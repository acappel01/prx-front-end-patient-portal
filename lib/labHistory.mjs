import { historyPage, responseState } from './commerceHistory.mjs';

export { historyPage as labPage };
export const LABS_PATH = '/health/labs';
export const LAB_PAGE_SIZE = 20;
export const labsEnabled = (config) => config?.portal?.modules?.labs !== false;
const pageHref = (page) => page === 1 ? LABS_PATH : `${LABS_PATH}?page=${page}`;

// Presentation only: do not classify urgency, interpret results or infer a next action.
export function labLabel(value, fallback = 'Not recorded') {
  if (typeof value !== 'string' || !value.trim()) return fallback;
  const text = value.trim().replace(/[_-]+/g, ' ');
  return text.charAt(0).toUpperCase() + text.slice(1);
}

const optionalText = (value) => value == null || typeof value === 'string';
const instant = (value) => value == null || (typeof value === 'string'
  && /T.*(?:Z|[+-]\d{2}:\d{2})$/.test(value) && Number.isFinite(Date.parse(value)));
const DATES = ['ordered_at', 'results_received_at', 'completed_at', 'created_at'];

export async function loadLabHistory(fetcher, page) {
  if (!Number.isInteger(page) || page < 1 || page > 10000) return { state: 'invalid' };
  let response;
  try {
    response = await fetcher(`/patient/labs?page=${page}&per_page=${LAB_PAGE_SIZE}`);
  } catch {
    return { state: 'unavailable', status: 503 };
  }
  if (response.status === 409 && response.code === 'no_linked_chart') return { state: 'unlinked' };
  const state = responseState(response);
  if (state !== 'ready') return { state, status: response.status, requestId: response.requestId };
  const { items, pagination } = response.data ?? {};
  if (!Array.isArray(items) || items.length > LAB_PAGE_SIZE || items.some((row) => !row
    || typeof row.id !== 'string' || !row.id
    || !['lab_order_number', 'status', 'collection_method'].every((field) => optionalText(row[field]))
    || !DATES.every((field) => instant(row[field])))
    || !pagination || pagination.current_page !== page || pagination.per_page !== LAB_PAGE_SIZE
    || !Number.isSafeInteger(pagination.total) || pagination.total < items.length
    || !Number.isSafeInteger(pagination.last_page) || pagination.last_page < 1) {
    return { state: 'unavailable', status: 502 };
  }
  // A second explicit whitelist keeps new upstream fields out of presentation.
  return { state: 'ready', items: items.map((row) => Object.fromEntries(
    ['id', 'lab_order_number', 'status', 'collection_method', ...DATES].map((field) => [field, row[field]])
  )), pagination, previous: page > 1 ? pageHref(page - 1) : null,
  next: page < pagination.last_page && page < 10000 ? pageHref(page + 1) : null };
}
