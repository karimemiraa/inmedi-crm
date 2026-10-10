import { useState } from 'react';

// Lightweight table sorting. useSort('date','desc') -> { sort, toggle, apply }.
// apply(rows, accessors) sorts a copy using accessors[sort.key](row).
export function useSort(initialKey = null, initialDir = 'asc') {
  const [sort, setSort] = useState({ key: initialKey, dir: initialDir });
  const toggle = (key) => setSort((s) => (s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' }));
  const apply = (rows, accessors) => {
    if (!sort.key || !accessors[sort.key]) return rows;
    const acc = accessors[sort.key];
    const out = [...rows].sort((a, b) => {
      let va = acc(a), vb = acc(b);
      const na = va == null || va === '', nb = vb == null || vb === '';
      if (na && nb) return 0; if (na) return 1; if (nb) return -1;
      if (typeof va === 'number' && typeof vb === 'number') return va - vb;
      return String(va).localeCompare(String(vb), 'de', { numeric: true, sensitivity: 'base' });
    });
    return sort.dir === 'desc' ? out.reverse() : out;
  };
  return { sort, toggle, apply };
}
