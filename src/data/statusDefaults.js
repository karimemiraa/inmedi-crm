// Standard-Status je Vorgangsart. Wird in Einstellungen → „Vorgänge & Status"
// gepflegt und unter db.statusConfig gespeichert. `closed` = gilt als abgeschlossen
// (steuert Zähler, KPIs, Filter „Offen" usw. — unabhängig vom Statusnamen).

export const STATUS_KINDS = {
  tickets: { label: 'Kundendienst-Tickets', hint: 'Anfragen, Reklamationen & Feedback' },
  activities: { label: 'Aufgaben & Termine', hint: 'Anrufe, Besuche, Aufgaben' },
  ideas: { label: 'Ideen', hint: 'Verbesserungsvorschläge des Teams' },
  incidents: { label: 'QM-Vorkommnisse', hint: 'Vigilanz nach MDR/MPDG' },
  capas: { label: 'CAPA / Maßnahmen', hint: 'Korrektur- & Vorbeugemaßnahmen' },
};

export const STATUS_TONES = [
  ['gray', 'Grau'], ['blue', 'Blau'], ['teal', 'Petrol'], ['green', 'Grün'],
  ['amber', 'Orange'], ['purple', 'Violett'], ['red', 'Rot'],
];

const S = (name, tone, closed = false) => ({ name, tone, closed });

export const DEFAULT_STATUS = {
  tickets: [S('Neu', 'blue'), S('In Bearbeitung', 'amber'), S('Wartet auf Kunde', 'purple'), S('Gelöst', 'green', true)],
  activities: [S('Offen', 'blue'), S('In Arbeit', 'amber'), S('Erledigt', 'green', true)],
  ideas: [S('Neu', 'blue'), S('In Prüfung', 'amber'), S('Umgesetzt', 'green', true), S('Verworfen', 'gray', true)],
  incidents: [S('Erfasst', 'gray'), S('In Prüfung', 'amber'), S('Gemeldet BfArM', 'purple'), S('Abgeschlossen', 'green', true)],
  capas: [S('Offen', 'gray'), S('In Umsetzung', 'amber'), S('Wirksamkeit prüfen', 'blue'), S('Abgeschlossen', 'green', true)],
};

export const cloneDefaultStatus = () => JSON.parse(JSON.stringify(DEFAULT_STATUS));
