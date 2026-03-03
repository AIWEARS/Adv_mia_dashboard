# Mappatura Eventi e Metriche - MIA Diagnosi Pubblicita

## Cos'e' questo documento

Questo documento spiega in italiano semplice cosa misura ogni evento, ogni metrica e ogni controllo della piattaforma MIA Diagnosi Pubblicita. Se trovi un termine tecnico, c'e' sempre una spiegazione tra parentesi.

---

## 1. Eventi tracciati (cosa misuriamo)

### 1.1 Lead principale: richiesta preventivo

- **Cosa succede**: un utente clicca il link "Richiedi preventivo" sul sito itsmia.it
- **Come funziona tecnicamente**: il click apre il programma email con destinatario info@itsmia.it
- **Nome tecnico in GTM**: trigger "TRG - Click mailto itsmia"
- **Cosa si attiva**: il tag Google Ads (GAds - Conv - Tailor Preventivo) e il tag Meta (Meta - Lead) registrano la conversione
- **Perche' e' importante**: questo e' il nostro obiettivo principale. Ogni click = una persona interessata che vuole un preventivo

### 1.2 Micro-conversione: ingresso nella webapp

- **Cosa succede**: un utente clicca un link che lo porta su app.miafashion.it
- **Nome tecnico in GTM**: trigger "TRG - Click to app.miafashion"
- **Cosa si attiva**: il tag Google Ads (GAds - Conv - Go to app) registra il click
- **Perche' e' importante**: chi entra nella webapp sta esplorando il servizio. Non e' ancora un cliente, ma e' molto interessato

### 1.3 Registrazione (sign_up)

- **Cosa succede**: un utente crea un account su app.miafashion.it
- **Come funziona tecnicamente**: la webapp invia un evento "sign_up" al dataLayer (il contenitore dati della pagina)
- **Nome tecnico in GTM**: trigger "TRG - sign_up (webapp)"
- **Filtro**: si attiva SOLO sulle pagine di app.miafashion.it (non su itsmia.it)
- **Perche' e' importante**: la registrazione significa che la persona vuole usare il servizio. E' un passo avanti verso l'acquisto

### 1.4 Acquisto abbonamento (purchase)

- **Cosa succede**: un utente compra un abbonamento su app.miafashion.it
- **Come funziona tecnicamente**: la webapp invia un evento "purchase" con valore, valuta e ID transazione
- **Nome tecnico in GTM**: trigger "TRG - purchase (webapp)"
- **Dati inviati**:
  - `value` (valore dell'acquisto in euro)
  - `currency` (la valuta, cioe' EUR)
  - `transaction_id` (codice unico dell'acquisto per evitare duplicati)
- **ERRORE ATTUALE**: la variabile che legge la valuta ("DLV - currency") sta leggendo il campo sbagliato. Legge "transaction_id" invece di "currency". Questo va corretto in GTM.

---

## 2. Metriche della dashboard (i numeri che vedi)

| Metrica | Cosa significa | Come si calcola |
|---------|---------------|-----------------|
| Spesa totale | Quanto hai speso in pubblicita in euro | Somma delle spese su Meta Ads + Google Ads |
| Richieste preventivo | Quante persone hanno cliccato "Richiedi preventivo" | Conteggio eventi "lead mailto" |
| Costo per preventivo | Quanto ti costa in media ogni richiesta | Spesa totale diviso numero di preventivi |
| Ingressi webapp | Quante persone sono entrate su app.miafashion.it | Conteggio eventi "go-to-app" |
| Registrazioni | Quante persone si sono registrate nella webapp | Conteggio eventi "sign_up" |
| Acquisti | Quanti abbonamenti sono stati comprati | Conteggio eventi "purchase" |
| CTR medio | Percentuale di persone che cliccano sull'annuncio dopo averlo visto | (Click / Impressioni) x 100 |
| ROAS | Ritorno sulla spesa pubblicitaria. Per ogni euro speso, quanti ne guadagni | Ricavi / Spesa pubblicitaria |

### Come leggere i trend

- **Freccia verde verso l'alto**: la metrica sta migliorando (es: piu' preventivi)
- **Freccia rossa verso l'alto**: la metrica sta peggiorando (es: costo in aumento)
- **Freccia gialla stabile**: nessun cambiamento significativo

Nota: per le metriche di costo, la freccia e' "invertita". Se il costo sale, la freccia e' rossa (male). Se scende, e' verde (bene).

---

## 3. Controlli salute tracciamento

### 3.1 Lead mailto
- Controlla che il click su "Richiedi preventivo" venga effettivamente registrato da Google Ads e Meta

### 3.2 Click verso webapp
- Controlla che il click verso app.miafashion.it venga registrato da Google Ads

### 3.3 Registrazione sign_up
- Controlla che l'evento di registrazione arrivi correttamente dal dataLayer della webapp

### 3.4 Acquisto purchase
- Controlla che l'evento di acquisto arrivi con tutti i dati (valore, valuta, ID transazione)
- Segnala se ci sono errori nelle variabili (come il bug della valuta)

### 3.5 Cross-domain (passaggio tra siti)
- Controlla che quando un utente passa da itsmia.it a app.miafashion.it, i dati di tracciamento non si perdano
- Il Conversion Linker di Google Ads deve essere attivo su entrambi i domini
- Il metodo usato e' il parametro nell'URL (la parte dopo il "?" nell'indirizzo web)

### 3.6 Consenso cookie
- Controlla che il Consent Mode (sistema di gestione consenso di Google) sia configurato
- Tutti i tipi di consenso devono partire come "negato" (denied) finche' l'utente non accetta
- I tag pubblicitari devono avere consentStatus = "NEEDED" (serve il consenso per attivarsi)
- Se un tag ha "NOT_SET", significa che si attiva anche senza consenso dell'utente. Questo va corretto.

### 3.7 Variabili dataLayer
- Controlla che ogni variabile legga il campo giusto
- Errore trovato: "DLV - currency" legge "transaction_id" invece di "currency"

---

## 4. Struttura GTM (Google Tag Manager)

### Container: GTM-NHH9WPMC (sito: itsmia.it)

### Tag (cosa viene inviato alle piattaforme)

| Tag | Piattaforma | Cosa fa | Stato |
|-----|-------------|---------|-------|
| GAds - Conversion Linker | Google Ads | Collega i click sugli annunci alle conversioni. Attivo su itsmia.it e app.miafashion.it | OK |
| GAds - Conv - Tailor Preventivo | Google Ads | Registra quando qualcuno clicca "Richiedi preventivo" | Consenso da correggere |
| GAds - Tag Google | Google Ads | Tag base di Google Ads per il remarketing (mostrare annunci a chi ha gia' visitato il sito) | Consenso da correggere |
| GAds - Conv - Go to app | Google Ads | Registra quando qualcuno clicca verso la webapp | Consenso da correggere |
| GAds - Conv - Subscription purchase | Google Ads | Registra quando qualcuno compra un abbonamento | Variabile currency errata |
| Consent Mode default | Personalizzato | Imposta tutti i consensi su "negato" all'inizio | OK |
| Meta - Lead | Meta (Facebook) | Registra la richiesta preventivo su Meta | OK |
| Iubenda Privacy Controls | Iubenda | Gestisce il banner cookie e aggiorna i consensi | OK |

### Trigger (quando si attivano i tag)

| Trigger | Tipo | Quando scatta |
|---------|------|---------------|
| TRG - Click mailto itsmia | Click link | Quando l'utente clicca su mailto:info@itsmia.it |
| TRG - Click to app.miafashion | Click link | Quando l'utente clicca un link verso app.miafashion.it |
| TRG - sign_up (webapp) | Evento custom | Quando la webapp invia l'evento "sign_up" |
| TRG - purchase (webapp) | Evento custom | Quando la webapp invia l'evento "purchase" |
| EV - gtm.consentUpdate | Evento custom | Quando l'utente accetta o rifiuta i cookie |

### Variabili (dati letti dalla pagina)

| Variabile | Cosa dovrebbe leggere | Cosa legge realmente | Stato |
|-----------|----------------------|---------------------|-------|
| DLV - value | Il valore dell'acquisto | value | OK |
| DLV - currency | La valuta (es. EUR) | transaction_id | ERRORE |
| DLV - transaction_id | L'ID unico dell'acquisto | transaction_id | OK |

---

## 5. Cosa correggere (riepilogo)

### Priorita' ALTA

1. **Variabile currency sbagliata**: in GTM, la variabile "DLV - currency" legge il campo "transaction_id" del dataLayer. Deve leggere "currency". Senza questa correzione, Google Ads non sa che gli acquisti sono in euro e non calcola bene il valore delle conversioni.

2. **Consenso tag Google Ads**: i tag "GAds - Conv - Tailor Preventivo", "GAds - Tag Google" e "GAds - Conv - Go to app" hanno il consenso impostato su "NOT_SET". Devono avere "NEEDED" con `ad_storage` e `analytics_storage` come tipi di consenso richiesti. Altrimenti si attivano anche quando l'utente non ha dato il permesso per i cookie pubblicitari.

### Priorita' MEDIA

3. **Verifica cross-domain periodica**: testare regolarmente che il passaggio di dati tra itsmia.it e app.miafashion.it funzioni aprendo un link dalla landing page e verificando che il parametro `_gl` appaia nell'URL della webapp.

---

## 6. Glossario

| Termine | Significato |
|---------|-------------|
| GTM | Google Tag Manager: strumento che gestisce tutti i codici di tracciamento del sito senza toccare il codice della pagina |
| Tag | Un pezzo di codice che invia dati a una piattaforma (Google Ads, Meta, etc.) |
| Trigger | Una regola che dice "quando" un tag deve attivarsi |
| Variabile | Un dato letto dalla pagina (es: il valore di un acquisto) |
| dataLayer | Un contenitore invisibile nella pagina web dove vengono messi i dati da leggere |
| CTR | Click-Through Rate: la percentuale di persone che cliccano sull'annuncio dopo averlo visto |
| ROAS | Return On Ad Spend: quanto guadagni per ogni euro speso in pubblicita' |
| Consent Mode | Sistema di Google che blocca il tracciamento finche' l'utente non accetta i cookie |
| Cross-domain | Il passaggio di dati di tracciamento tra due siti diversi (es: itsmia.it e app.miafashion.it) |
| Conversion Linker | Tag di Google che collega il click sull'annuncio alla conversione sul sito |
| Lead | Una persona interessata che ha fatto un'azione (es: richiesta preventivo) |
| Remarketing | Mostrare annunci a persone che hanno gia' visitato il tuo sito |
| Lookalike | Pubblico di persone simili ai tuoi clienti, creato da Meta o Google |
| Landing page | La pagina dove arriva una persona dopo aver cliccato su un annuncio |
