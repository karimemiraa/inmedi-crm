import net from 'node:net';
export const freePort = () => new Promise((resolve) => { const s = net.createServer().listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => resolve(p)); }); });
export const waitFor = async (fn, ms = 5000, label = 'Bedingung') => {
  const end = Date.now() + ms;
  while (Date.now() < end) { if (await fn()) return true; await new Promise((r) => setTimeout(r, 25)); }
  throw new Error('Zeitüberschreitung: ' + label);
};
export const quiet = { info() {}, warn() {}, error() {} };
