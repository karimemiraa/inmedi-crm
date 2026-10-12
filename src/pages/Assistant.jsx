import { useState } from 'react';
import { Sparkles, CalendarCheck } from 'lucide-react';
import { useStore } from '../data/store.js';
import { Select } from '../components/ui.jsx';
import AssistantChat from '../components/ai/AssistantChat.jsx';
import { send } from '../lib/ai/chatStore.js';
import { providerReady, getAiSettings } from '../lib/ai/settings.js';
import { useToast } from '../components/Toast.jsx';

export default function Assistant() {
  const db = useStore();
  const toast = useToast();
  const [acc, setAcc] = useState('');
  const accounts = [...db.accounts].filter((a) => a.status !== 'Inaktiv').sort((a, b) => a.name.localeCompare(b.name));
  const prep = () => {
    const a = db.accounts.find((x) => x.id === acc);
    if (!a) return;
    if (!providerReady(getAiSettings())) { toast('Bitte zuerst den KI-Anbieter einrichten'); return; }
    send(`Bereite mein nächstes Kundengespräch mit ${a.name} vor`, { kind: 'accounts', id: a.id, label: a.name });
  };
  return (
    <div className="page ai-page">
      <div className="page-head">
        <div><h1><Sparkles size={20} style={{ verticalAlign: -3, color: 'var(--brand)' }} /> KI-Assistent</h1><div className="sub">Analysen, Gesprächsvorbereitung und Antworten direkt aus Ihren CRM-Daten</div></div>
        <div className="page-actions ai-prep">
          <Select value={acc} onChange={(e) => setAcc(e.target.value)} aria-label="Firma für Gesprächsvorbereitung">
            <option value="">Firma wählen …</option>
            {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </Select>
          <button className="btn primary" onClick={prep} disabled={!acc}><CalendarCheck size={15} /> Gesprächsvorbereitung</button>
        </div>
      </div>
      <div className="card ai-page-card"><AssistantChat /></div>
    </div>
  );
}
