/** Local commerce presentation and bounded request paths. No identity inference or token storage. */
export const PURCHASES_PATH = '/record/purchases';
export const PAGE_SIZE = 20;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isOrderUuid(value) {
  return typeof value === 'string' && UUID.test(value);
}

export function historyPage(value) {
  if (value === undefined) return 1;
  if (typeof value !== 'string' || !/^[1-9]\d{0,4}$/.test(value)) return null;
  const page = Number(value);
  return page <= 10000 ? page : null;
}

export function pageHref(page) {
  return page === 1 ? PURCHASES_PATH : `${PURCHASES_PATH}?page=${page}`;
}

export function formatMoney(value, currency) {
  if (value === null || value === undefined || value === '' || !/^[A-Z]{3}$/.test(currency ?? '')) return 'Not recorded';
  if ((typeof value !== 'string' && typeof value !== 'number') || !Number.isFinite(Number(value))
    || (typeof value === 'string' && !/^-?\d+(?:\.\d+)?$/.test(value))) return 'Not recorded';
  try {
    return new Intl.NumberFormat('en', { style: 'currency', currency, currencyDisplay: 'code' }).format(Number(value));
  } catch {
    return 'Not recorded';
  }
}

const STATUS_LABELS = {
  pending: 'Pending', processing: 'Processing', shipped: 'Shipped', partially_shipped: 'Partially shipped',
  delivered: 'Delivered', cancelled: 'Cancelled', refunded: 'Refunded', label_created: 'Label created',
  in_transit: 'In transit', exception: 'Shipping exception',
};
export function statusLabel(value) {
  return Object.hasOwn(STATUS_LABELS, value) ? STATUS_LABELS[value] : 'Status unavailable';
}

export function safeTrackingUrl(value) {
  if (typeof value !== 'string' || /[\u0000-\u0020]/.test(value)) return null;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password ? url.href : null;
  } catch {
    return null;
  }
}

export function responseState(response) {
  if (response.status === 401) return 'signed-out';
  if (response.status === 403 && response.code === 'two_factor_setup_required') return 'two-factor';
  if (response.status === 403) return 'forbidden';
  if (response.status === 404) return 'not-found';
  if (response.status === 422) return 'invalid';
  if (response.status === 429) return 'limited';
  return response.ok ? 'ready' : 'unavailable';
}

async function read(fetcher, path) {
  try {
    const response = await fetcher(path);
    return { ...response, state: responseState(response) };
  } catch {
    // Network failures must not render an empty purchase history or expose errors.
    return { state: 'unavailable', status: 503, data: null };
  }
}

const displayScalar = (value) => value == null || typeof value === 'string' || typeof value === 'number';
const displayFields = (row, fields) => row && typeof row === 'object' && !Array.isArray(row)
  && fields.every((field) => displayScalar(row[field]));

export async function loadOrderHistory(fetcher, page) {
  if (!Number.isInteger(page) || page < 1 || page > 10000) return { state: 'invalid', data: null };
  const result = await read(fetcher, `/orders?page=${page}&per_page=${PAGE_SIZE}`);
  if (result.state !== 'ready') return result;
  const { data, meta } = result;
  if (!Array.isArray(data) || data.some((order) => !isOrderUuid(order?.uuid)
    || !displayFields(order, ['status', 'total_amount', 'currency', 'placed_at', 'items_count']))
    || !meta || !Number.isInteger(meta.total) || meta.total < 0
    || !Number.isInteger(meta.last_page) || meta.last_page < 1 || meta.current_page !== page) {
    return { state: 'unavailable', status: 502, data: null };
  }
  // Never follow upstream pagination URLs. Navigation stays on this portal.
  return { ...result, previous: page > 1 ? pageHref(page - 1) : null,
    next: page < meta.last_page && page < 10000 ? pageHref(page + 1) : null };
}

export async function loadOrderDetail(fetcher, uuid) {
  if (!isOrderUuid(uuid)) return { state: 'not-found', data: null };
  const result = await read(fetcher, `/orders/${uuid}`);
  if (result.state !== 'ready') return result;
  if (!result.data || !isOrderUuid(result.data.uuid) || result.data.uuid.toLowerCase() !== uuid.toLowerCase()
    || !displayFields(result.data, ['prescribe_rx_order_number', 'status', 'currency', 'placed_at', 'shipped_at', 'delivered_at', 'cancelled_at'])
    || !Array.isArray(result.data.items) || !Array.isArray(result.data.shipments)
    || result.data.items.some((item) => !displayFields(item, ['name', 'quantity', 'billing_period']))
    || result.data.shipments.some((shipment) => !displayFields(shipment, ['carrier', 'status', 'tracking_number', 'shipped_at', 'delivered_at']))) {
    return { state: 'unavailable', status: 502, data: null };
  }
  return result;
}
