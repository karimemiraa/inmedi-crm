// InMedi SERVICE Logo (echte Markendateien in /public).
import { useStore } from '../data/store.js';

export function LogoMark({ size = 32 }) {
  return <img src="/inmedi-mark.png" alt="InMedi" width={size} height={size} style={{ display: 'block', objectFit: 'contain' }} />;
}

export function Logo({ compact = false }) {
  const logo = useStore((s) => s.meta?.logo);
  if (logo) {
    return <img src={logo} alt="InMedi" style={{ maxHeight: 34, maxWidth: compact ? 34 : 160, objectFit: 'contain', display: 'block' }} />;
  }
  if (compact) return <LogoMark size={30} />;
  return <img src="/inmedi-logo.png" alt="InMedi Service" style={{ height: 32, maxWidth: 170, objectFit: 'contain', display: 'block' }} />;
}
