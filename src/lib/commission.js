// Provisionsberechnung — Basis: abgerechnete Aufträge (kind 'Auftrag'),
// dem Außendienst des Auftrags (ownerId) zugerechnet.
export function rateFor(db, userId) {
  const u = db.users.find((x) => x.id === userId);
  const def = db.meta.commission?.defaultRate ?? 0;
  return (u && typeof u.commissionRate === 'number' && u.commissionRate > 0) ? u.commissionRate : def;
}

// Liefert Provisionszeilen je Mitarbeiter im Zeitraum [fromISO, toISO].
export function computeCommission(db, fromISO, toISO, { includeAllReps = false } = {}) {
  const f = new Date(fromISO + 'T00:00:00'), t = new Date(toISO + 'T23:59:59');
  const orders = db.orders.filter((o) => o.kind === 'Auftrag' && (() => { const d = new Date(o.date); return d >= f && d <= t; })());
  const agg = {};
  orders.forEach((o) => {
    const uid = o.ownerId;
    if (!agg[uid]) agg[uid] = { userId: uid, orders: 0, base: 0 };
    agg[uid].orders += 1; agg[uid].base += o.total || 0;
  });
  if (includeAllReps) db.users.filter((u) => u.role === 'Außendienst').forEach((u) => { if (!agg[u.id]) agg[u.id] = { userId: u.id, orders: 0, base: 0 }; });
  const rows = Object.values(agg).map((r) => {
    const u = db.users.find((x) => x.id === r.userId);
    const rate = rateFor(db, r.userId);
    return { ...r, name: u?.name || '—', color: u?.color, rate, commission: Math.round(r.base * rate) };
  }).sort((a, b) => b.commission - a.commission);
  const totals = rows.reduce((s, r) => ({ base: s.base + r.base, commission: s.commission + r.commission, orders: s.orders + r.orders }), { base: 0, commission: 0, orders: 0 });
  return { rows, totals };
}
