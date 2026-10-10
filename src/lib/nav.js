import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';

// Deep-linking: navigate to a list page and auto-open a specific record's drawer.
// Link with openLink('/orders', id); the target list calls useOpenParam(records, setSel).
export const openLink = (path, id) => (id ? `${path}?open=${encodeURIComponent(id)}` : path);

export function useOpenParam(records, setSel) {
  const [params, setParams] = useSearchParams();
  const openId = params.get('open');
  useEffect(() => {
    if (!openId) return;
    const rec = (records || []).find((r) => r.id === openId);
    if (rec) {
      setSel(rec);
      const p = new URLSearchParams(params);
      p.delete('open');
      setParams(p, { replace: true });
    }
  }, [openId, records]); // eslint-disable-line react-hooks/exhaustive-deps
}
