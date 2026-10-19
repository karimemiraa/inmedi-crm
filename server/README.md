# InMedi Rechnungseingang (invoice intake server)

A small Node.js service that reads PDF invoices from a Microsoft 365 mailbox around the clock and hands them to the InMedi CRM.

```
Supplier ──email + PDF──▶ rechnungen@… (Microsoft 365)
                                │  every 5 min (Microsoft Graph, app-only, ONE mailbox)
                                ▼
                     Oracle server: inmedi-intake (this folder)
                       · reads each PDF (same parser as the CRM: src/lib/invoiceParse.js)
                       · stores the extracted data (data/intake.json)
                       · moves the mail → "Rechnungen verarbeitet" / "Rechnungen prüfen"
                                │  HTTPS + token (Caddy)
                                ▼
                     InMedi CRM (browser) – syncs on open and every few minutes
                       · matches Kundennummer → Firma + Betreuer
                       · unclear invoices get "Zu prüfen", duplicates are skipped
                       · export: Rechnungen CSV, Positionen CSV, full JSON backup
```

## What it does, exactly

| Situation | Mailbox | CRM |
|---|---|---|
| Readable invoice | moved to **Rechnungen verarbeitet** | created automatically; assigned via Kundennummer |
| Readable, but Kundennummer unknown in the CRM | **Rechnungen verarbeitet** | created with **Zu prüfen** (assign Firma in one click) |
| PDF unreadable / required fields missing (Rechnungsnr., Kundennr., total, positions) | **Rechnungen prüfen** | created with **Zu prüfen** and the reason |
| Mail with attachments but no PDF | **Rechnungen prüfen** | – |
| Same PDF again, or same supplier + Rechnungsnr. again | **Rechnungen verarbeitet** | skipped (duplicate) |
| Mail without attachments | stays in the inbox, untouched | – |

- The original PDF stays in the mailbox. The mailbox (or your accounting system) remains the legal archive; the CRM is the working copy.
- The server stores only the extracted invoice data plus sender, subject, date and file name. No PDFs and no other mail content are kept.
- If a run is interrupted, the next run recognises already processed PDFs by their SHA-256 hash, so nothing is created twice.

## Setup (one-time, about 45 minutes)

You need: an admin for Microsoft 365, SSH access to the Oracle server, and a (sub)domain whose DNS you control, e.g. `rechnungen.ihre-domain.de`.

### 1. Microsoft: register the app (Microsoft Entra admin center)

1. https://entra.microsoft.com → **Applications → App registrations → New registration**
   - Name: `InMedi Rechnungseingang`, *Accounts in this organizational directory only*, no redirect URI → **Register**.
   - Note the **Application (client) ID** and **Directory (tenant) ID**.
2. **Certificates & secrets → New client secret** (e.g. 24 months). Copy the **Value** immediately; it is shown only once. Put a reminder in your calendar to renew it before it expires.
3. **Enterprise applications** → open `InMedi Rechnungseingang` → note its **Object ID** (this is the service principal ID, not the one from step 1).
4. **Do NOT add the Graph permission `Mail.ReadWrite` under "API permissions".** That would grant access to *every* mailbox in the company. Instead, restrict access to the invoice mailbox only (step 2).

### 2. Microsoft: allow access to exactly one mailbox (Exchange Online)

In PowerShell as Exchange administrator:

```powershell
Install-Module ExchangeOnlineManagement   # once
Connect-ExchangeOnline
.\deploy\restrict-mailbox.ps1 -AppId <client-id> -ObjectId <enterprise-app-object-id> -Mailbox rechnungen@ihre-domain.de
```

The script ends with `Test-ServicePrincipalAuthorization`; it must show `InScope : True` for the mailbox. Changes can take up to an hour to become active.

### 3. Oracle server: open HTTPS and point the domain at it

1. Oracle Cloud console → your instance → **Virtual cloud network → Security list → Add ingress rule**: source `0.0.0.0/0`, TCP, destination port **443** (and **80**, needed once for the certificate).
2. Host firewall:
   - Ubuntu image: `sudo iptables -I INPUT 6 -p tcp -m multiport --dports 80,443 -j ACCEPT && sudo netfilter-persistent save`
   - Oracle Linux image: `sudo firewall-cmd --permanent --add-service=http --add-service=https && sudo firewall-cmd --reload`
3. DNS: create an **A record** `rechnungen.ihre-domain.de` → public IP of the instance.
   (No domain at hand? `<ip-with-dashes>.sslip.io`, e.g. `141-147-1-2.sslip.io`, also works with Let's Encrypt.)

### 4. Oracle server: install the service

```bash
# Node.js 22 (works on x86 and Ampere/ARM)
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -   # Ubuntu
sudo apt-get install -y nodejs git                                  # (Oracle Linux: sudo dnf module install nodejs:22)

sudo useradd --system --no-create-home --shell /usr/sbin/nologin inmedi
sudo git clone https://github.com/karimemiraa/inmedi-crm.git /opt/inmedi-crm
cd /opt/inmedi-crm/server && sudo npm ci --omit=dev

sudo cp deploy/inmedi-intake.env.example /etc/inmedi-intake.env
sudo nano /etc/inmedi-intake.env          # fill in tenant/client ID, secret, mailbox, API_TOKEN
openssl rand -hex 32                      # → use as API_TOKEN
sudo chown root:inmedi /etc/inmedi-intake.env && sudo chmod 640 /etc/inmedi-intake.env

sudo cp deploy/inmedi-intake.service /etc/systemd/system/
sudo systemctl daemon-reload && sudo systemctl enable --now inmedi-intake
sudo journalctl -u inmedi-intake -f       # should show: "API auf http://127.0.0.1:8787 · Postfach: rechnungen@…"
```

### 5. Oracle server: HTTPS with Caddy

```bash
sudo apt-get install -y caddy            # (Oracle Linux: see https://caddyserver.com/docs/install)
sudo cp /opt/inmedi-crm/server/deploy/Caddyfile /etc/caddy/Caddyfile
sudo nano /etc/caddy/Caddyfile           # set your domain
sudo systemctl reload caddy
curl https://rechnungen.ihre-domain.de/health   # → {"ok":true,...}
```

### 6. CRM: connect

In the CRM: **Einstellungen → Rechnungseingang**
- Server-Adresse: `https://rechnungen.ihre-domain.de`
- Zugangs-Token: the `API_TOKEN` value
- **Verbindung testen** → shows the mailbox. **Postfach jetzt prüfen** runs immediately.

Each employee enters this once in their browser. The address and token are kept only in that browser and are never part of the data export.

## Operation

| Task | Command |
|---|---|
| Status / live log | `sudo systemctl status inmedi-intake` · `sudo journalctl -u inmedi-intake -f` |
| Update to the latest version | `cd /opt/inmedi-crm && sudo git pull && cd server && sudo npm ci --omit=dev && sudo systemctl restart inmedi-intake` |
| Backup | copy `/var/lib/inmedi-intake/intake.json` (a few KB per invoice) |
| Renew the client secret | Entra → app → Certificates & secrets → new secret → update `/etc/inmedi-intake.env` → restart |
| Change the token | new `API_TOKEN` in the env file → restart → enter the new token in every CRM browser |

## API (for reference)

All `/api/*` calls need `Authorization: Bearer <API_TOKEN>`. CORS is allowed only for `ALLOWED_ORIGINS`.

| Endpoint | Purpose |
|---|---|
| `GET /health` | liveness, no authentication, reveals no data |
| `GET /api/invoices?since=<seq>&limit=200` | invoices newer than `seq` (`{ invoices, seq, more }`) |
| `GET /api/status` | mailbox, schedule, last 20 runs, counters |
| `POST /api/run` | check the mailbox now |

## Security

- Microsoft access is limited to one mailbox by Exchange RBAC for Applications (step 2).
- The client secret and API token live only in `/etc/inmedi-intake.env` (readable by root and the service), never in Git.
- The service listens on `127.0.0.1`; only Caddy (HTTPS) is reachable from outside.
- PDFs are parsed with pdf.js with script evaluation disabled; the service runs as an unprivileged user with a read-only system (systemd hardening).
- Data protection: invoice data is processed on your own Oracle server. Oracle Cloud acts as a processor, so make sure a data processing agreement (AVV/DPA, part of the Oracle Cloud terms) is in place and the region is in the EU (e.g. Frankfurt).

## Tests

```bash
cd server && npm ci && npm test
```

The tests run the real service against a simulated Microsoft 365 mailbox (`test/mockGraph.js`) with generated invoice PDFs (`test/makePdf.js`). They cover import, folder moves, duplicates, unreadable PDFs, mail without PDF, several PDFs per mail, throttling (429), token caching, API authentication, CORS, paging and persistence.

The parser is tuned to the current supplier layout (Ovesco Endoscopy AG). Invoices from other suppliers are still saved, but marked **Zu prüfen** when fields are missing.
