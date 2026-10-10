export const fmtMoney = (n, dp = 0) =>
  Number(n || 0).toLocaleString('de-DE', { minimumFractionDigits: dp, maximumFractionDigits: dp }) + ' €';

export const fmtMoneyShort = (n) => {
  const v = Number(n || 0);
  if (Math.abs(v) >= 1_000_000) return (v / 1_000_000).toFixed(1).replace('.', ',').replace(/,0$/, '') + ' Mio. €';
  if (Math.abs(v) >= 1_000) return Math.round(v / 1_000) + ' Tsd. €';
  return v + ' €';
};

export const fmtNum = (n) => Number(n || 0).toLocaleString('de-DE');

export const initials = (name = '') =>
  name.split(' ').filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase();

export const fmtDate = (iso) => {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('de-DE', { day: '2-digit', month: 'short', year: 'numeric' });
};

export const relDate = (iso) => {
  if (!iso) return '—';
  const now = new Date();
  const d = new Date(iso);
  const diff = Math.round((d - now) / 86400000);
  if (diff === 0) return 'Heute';
  if (diff === 1) return 'Morgen';
  if (diff === -1) return 'Gestern';
  if (diff < 0) return `vor ${Math.abs(diff)} T.`;
  return `in ${diff} T.`;
};

export const scoreColor = (s) => (s >= 70 ? 'var(--green)' : s >= 40 ? 'var(--amber)' : 'var(--red)');
