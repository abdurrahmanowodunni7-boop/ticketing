export const API_URL = 'http://localhost:4000';

export function formatNaira(kobo) {
  return '₦' + (kobo / 100).toLocaleString('en-NG');
}

export function formatDate(iso) {
  return new Date(iso).toLocaleString('en-NG', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}