/**
 * MOCK DATA - MIA Diagnosi Pubblicita
 *
 * Dati dimostrativi realistici basati sugli eventi tracciati in GTM:
 * - Lead principale: click su mailto:info@itsmia.it (richiesta preventivo)
 * - Micro-conversione: click verso app.miafashion.it (ingresso webapp)
 * - sign_up: registrazione su app.miafashion.it
 * - purchase: acquisto abbonamento su app.miafashion.it
 *
 * Tutti i testi sono in italiano semplice.
 */

// ---------- SINTESI (Dashboard principale) ----------
export const summaryData = {
  score: 58,
  interpretazione: "Le tue campagne funzionano, ma stai pagando troppo per ogni contatto. C'e' margine per migliorare il ritorno sulla spesa pubblicitaria.",
  summary_text: "Negli ultimi 30 giorni hai speso 2.847 euro in pubblicita tra Meta e Google. Hai ottenuto 23 richieste di preventivo (lead), 156 ingressi nella webapp e 12 registrazioni. Il costo per ogni preventivo e' di 123,78 euro, sopra la media del settore moda (80-100 euro). Le registrazioni sulla webapp crescono ma gli acquisti restano bassi: solo 3 su 12 registrati hanno comprato.",
  metrics: [
    {
      id: 'spesa_totale',
      nome: 'Spesa totale',
      valore: 2847,
      formato: 'euro',
      trend: 'up',
      variazione: '+12%',
      interpretazione: 'Hai speso il 12% in piu rispetto al mese scorso. Verifica se i risultati giustificano la spesa extra.',
      invertiTrend: true
    },
    {
      id: 'lead_preventivo',
      nome: 'Richieste preventivo',
      valore: 23,
      trend: 'down',
      variazione: '-8%',
      interpretazione: 'Le richieste di preventivo (click su "Richiedi preventivo") sono calate. Controlla se la pagina di atterraggio funziona bene.',
      invertiTrend: false
    },
    {
      id: 'costo_per_lead',
      nome: 'Costo per preventivo',
      valore: 123.78,
      formato: 'euro',
      trend: 'up',
      variazione: '+22%',
      interpretazione: 'Stai pagando troppo per ogni richiesta di preventivo. La media nel settore moda e\' 80-100 euro.',
      invertiTrend: true
    },
    {
      id: 'click_webapp',
      nome: 'Ingressi webapp',
      valore: 156,
      trend: 'up',
      variazione: '+18%',
      interpretazione: 'Buon numero di persone entrano nella webapp (app.miafashion.it). Il traffico cresce.',
      invertiTrend: false
    },
    {
      id: 'registrazioni',
      nome: 'Registrazioni',
      valore: 12,
      trend: 'up',
      variazione: '+50%',
      interpretazione: 'Le registrazioni sulla webapp crescono bene. 12 nuovi utenti registrati questo mese.',
      invertiTrend: false
    },
    {
      id: 'acquisti',
      nome: 'Acquisti abbonamento',
      valore: 3,
      trend: 'stable',
      variazione: '0%',
      interpretazione: 'Solo 3 acquisti su 12 registrazioni. Il tasso di conversione (chi compra dopo essersi registrato) e\' basso: 25%.',
      invertiTrend: false
    },
    {
      id: 'ctr_medio',
      nome: 'CTR medio (percentuale click)',
      valore: 2.1,
      formato: 'percentuale',
      trend: 'down',
      variazione: '-0.3%',
      interpretazione: 'La percentuale di persone che cliccano sui tuoi annunci e\' leggermente calata. Rivedi le creativita.',
      invertiTrend: false
    },
    {
      id: 'roas',
      nome: 'ROAS (ritorno sulla spesa)',
      valore: 1.8,
      formato: 'moltiplicatore',
      trend: 'down',
      variazione: '-15%',
      interpretazione: 'Per ogni euro speso in pubblicita, ne guadagni 1,80. Buono, ma era 2,10 il mese scorso.',
      invertiTrend: false
    }
  ]
};

// ---------- TREND TEMPORALI ----------
export const trendsData = {
  periodo: '30 giorni',
  dati_giornalieri: generateDailyData(30)
};

function generateDailyData(days) {
  const data = [];
  const now = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    const dayStr = date.toISOString().split('T')[0];

    // Simula variazioni realistiche
    const baseSpesa = 85 + Math.random() * 40;
    const baseLead = Math.random() > 0.4 ? 1 : 0;
    const baseClick = Math.floor(3 + Math.random() * 8);

    data.push({
      data: dayStr,
      spesa: Math.round(baseSpesa * 100) / 100,
      lead: baseLead,
      click_webapp: baseClick,
      registrazioni: Math.random() > 0.7 ? 1 : 0,
      acquisti: Math.random() > 0.9 ? 1 : 0,
      impressioni: Math.floor(800 + Math.random() * 600),
      click_annuncio: Math.floor(15 + Math.random() * 25)
    });
  }
  return data;
}

// ---------- DIAGNOSI (Cosa migliorare) ----------
export const diagnosisData = {
  issues: [
    {
      id: 'target_ampio',
      area: 'Target (pubblico)',
      titolo: 'Il pubblico delle campagne Meta e\' troppo ampio',
      descrizione: 'Le campagne Meta stanno mostrando annunci a un pubblico generico di 2,5 milioni di persone. Per un servizio di moda su misura come MIA, il pubblico ideale e\' molto piu\' specifico.',
      gravita: 'critico',
      impatto: 'Stai sprecando budget mostrando annunci a persone che non comprano moda personalizzata.',
      perche: 'Quando il pubblico e\' troppo grande, Meta mostra gli annunci a persone meno interessate per spendere tutto il budget. Il risultato: tanti click inutili, pochi preventivi.',
      cosa_fare: 'Restringi il pubblico a donne 30-55 anni, interessate a moda, sartoria, abiti su misura. Escludi chi ha gia\' visitato il sito senza fare nulla.',
      risultato_atteso: 'Piu\' contatti a parita\' di spesa. Il costo per preventivo dovrebbe scendere del 20-30%.'
    },
    {
      id: 'creativita_stanche',
      area: 'Creativita (immagini e testi)',
      titolo: 'Le creativita\' sono attive da troppo tempo senza cambi',
      descrizione: 'Gli stessi annunci (immagini e testi) sono attivi da oltre 45 giorni. Dopo 3-4 settimane le persone si abituano e smettono di cliccare.',
      gravita: 'da_migliorare',
      impatto: 'Il CTR (percentuale di click sugli annunci) e\' calato del 15% nell\'ultimo mese.',
      perche: 'Meta e Google mostrano gli annunci piu\' volte alle stesse persone. Dopo un po\' il cervello le ignora. Si chiama "fatica da annuncio".',
      cosa_fare: 'Crea 3 nuove varianti di annuncio: una con foto dei capi indossati, una con video del processo sartoriale, una con recensione cliente. Testa angoli diversi: esclusivita, risparmio di tempo, unicita.',
      risultato_atteso: 'Il CTR dovrebbe risalire sopra il 2,5%. Piu\' click di qualita\' significa piu\' preventivi.'
    },
    {
      id: 'offerta_debole',
      area: 'Offerta e invito all\'azione',
      titolo: 'L\'invito all\'azione non e\' abbastanza forte',
      descrizione: 'Gli annunci dicono "Scopri di piu" o "Visita il sito". Queste frasi sono generiche e non spingono a chiedere un preventivo.',
      gravita: 'da_migliorare',
      impatto: 'Molte persone arrivano sul sito ma non cliccano "Richiedi preventivo". Solo il 2,3% dei visitatori chiede un preventivo.',
      perche: 'Senza un motivo urgente o un vantaggio chiaro, le persone rimandano. "Scopri di piu" non da\' nessuna urgenza.',
      cosa_fare: 'Cambia l\'invito con: "Richiedi il tuo preventivo gratuito - risposta entro 24h". Aggiungi un elemento di scarsita\' o tempo limitato, per esempio "Posti limitati questo mese".',
      risultato_atteso: 'Il tasso di conversione sulla landing page dovrebbe salire dal 2,3% al 4-5%.'
    },
    {
      id: 'landing_lenta',
      area: 'Pagina di atterraggio (landing page)',
      titolo: 'La pagina itsmia.it si carica lentamente su mobile',
      descrizione: 'Il tempo di caricamento su cellulare e\' di 4,2 secondi. Google consiglia sotto i 2,5 secondi. Il 53% del traffico arriva da cellulare.',
      gravita: 'critico',
      impatto: 'Le persone che arrivano da un annuncio aspettano al massimo 3 secondi. Oltre, chiudono e vai a perdere il click pagato.',
      perche: 'Immagini troppo pesanti, codice non ottimizzato, troppe risorse esterne caricate insieme.',
      cosa_fare: 'Comprimi le immagini (usa formato WebP). Rimanda il caricamento degli elementi non visibili subito. Chiedi al tuo sviluppatore di controllare il punteggio PageSpeed Insights.',
      risultato_atteso: 'Meno persone abbandonano la pagina. Piu\' preventivi a parita\' di click pagati.'
    },
    {
      id: 'budget_sbilanciato',
      area: 'Budget e distribuzione',
      titolo: 'Il 75% del budget va su Meta, ma Google porta lead migliori',
      descrizione: 'Stai spendendo 2.135 euro su Meta e 712 euro su Google. Ma i preventivi da Google costano 89 euro (sotto media) mentre quelli da Meta costano 142 euro (sopra media).',
      gravita: 'da_migliorare',
      impatto: 'Stai dando piu\' soldi alla piattaforma che ti costa di piu\' per ogni contatto.',
      perche: 'Meta funziona bene per farsi conoscere, ma chi cerca "abiti su misura" su Google e\' gia\' pronto a comprare. Il traffico da Google ha piu\' "intenzione di acquisto".',
      cosa_fare: 'Sposta il 15-20% del budget da Meta a Google Search. Mantieni Meta per la notorieta\' del marchio, ma aumenta Google per catturare chi sta gia\' cercando.',
      risultato_atteso: 'Piu\' preventivi totali a parita\' di spesa. Il costo medio per preventivo dovrebbe scendere a 100-110 euro.'
    },
    {
      id: 'google_keyword',
      area: 'Google Search (parole chiave)',
      titolo: 'Ci sono parole chiave che sprecano budget senza portare risultati',
      descrizione: 'Le parole chiave "moda online" e "vestiti economici" hanno speso 312 euro senza generare nessun preventivo. Attirano persone che cercano fast fashion, non moda su misura.',
      gravita: 'critico',
      impatto: 'Il 44% della spesa Google va su parole chiave che non convertono.',
      perche: 'Queste parole chiave sono troppo generiche. Chi cerca "vestiti economici" non vuole un servizio sartoriale premium.',
      cosa_fare: 'Aggiungi "economici", "low cost", "gratis" come parole chiave negative (cioe\' da escludere). Concentrati su: "abiti su misura", "sartoria personalizzata", "vestiti tailor made".',
      risultato_atteso: 'Eliminare lo spreco del 44% significa risparmiare circa 310 euro al mese o ottenere 3-4 preventivi in piu\' con lo stesso budget.'
    },
    {
      id: 'meta_struttura',
      area: 'Meta (struttura campagne)',
      titolo: 'Troppe campagne attive frammentano il budget',
      descrizione: 'Hai 6 campagne attive su Meta con budget giornaliero di 10-15 euro ciascuna. Con budget cosi\' bassi, Meta non riesce a ottimizzare bene la consegna degli annunci.',
      gravita: 'da_migliorare',
      impatto: 'Le campagne non escono mai dalla "fase di apprendimento" (periodo in cui Meta impara a chi mostrare l\'annuncio) perche\' non hanno abbastanza budget.',
      perche: 'Meta ha bisogno di almeno 50 conversioni a settimana per campagna per ottimizzare bene. Con 10 euro al giorno e un costo per lead di 140 euro, non ci arrivi mai.',
      cosa_fare: 'Unisci le 6 campagne in 2-3 campagne piu\' forti. Una per "notorieta\' marchio" (awareness), una per "generare contatti" (lead). Dai almeno 30 euro al giorno per campagna.',
      risultato_atteso: 'Le campagne usciranno dalla fase di apprendimento e Meta trovera\' il pubblico giusto piu\' velocemente. Meno sprechi, piu\' preventivi.'
    }
  ],
  suggerimenti: [
    {
      id: 'sug_retargeting',
      titolo: 'Attiva il retargeting (mostra annunci a chi ha gia\' visitato il sito)',
      descrizione: 'Chi ha visitato itsmia.it ma non ha chiesto un preventivo puo\' essere raggiunto di nuovo con un annuncio mirato. Questo tipo di campagna ha un costo per contatto molto piu\' basso.',
      priorita: 'alta'
    },
    {
      id: 'sug_lookalike',
      titolo: 'Crea un pubblico simile (lookalike) basato sui tuoi clienti',
      descrizione: 'Carica la lista dei tuoi clienti esistenti su Meta e chiedi di trovare persone simili. Meta trovera\' persone con caratteristiche e comportamenti affini ai tuoi migliori clienti.',
      priorita: 'alta'
    },
    {
      id: 'sug_video',
      titolo: 'Usa video brevi (15-30 secondi) nelle creativita\' Meta',
      descrizione: 'I video hanno un costo per click piu\' basso del 35% rispetto alle immagini statiche su Meta. Mostra il processo di creazione di un capo su misura in 15 secondi.',
      priorita: 'media'
    },
    {
      id: 'sug_form',
      titolo: 'Aggiungi un modulo rapido sulla landing page',
      descrizione: 'Oltre al link mailto, aggiungi un modulo con nome + telefono + tipo di capo desiderato. Molte persone preferiscono compilare un form piuttosto che aprire il programma email.',
      priorita: 'alta'
    },
    {
      id: 'sug_testimonianze',
      titolo: 'Inserisci testimonianze reali negli annunci',
      descrizione: 'Le recensioni dei clienti soddisfatti aumentano la fiducia. Usa frasi vere dei clienti come testo dell\'annuncio. Per esempio: "Ho ricevuto il mio abito in 2 settimane, perfetto!" - Maria, Milano.',
      priorita: 'media'
    }
  ]
};

// ---------- PIANO 7 GIORNI ----------
export const actionPlan7Data = {
  description: 'Azioni veloci da fare questa settimana per migliorare subito le performance delle campagne.',
  actions: [
    {
      id: 'a7_1',
      titolo: 'Aggiungi parole chiave negative su Google Ads',
      descrizione: 'Vai su Google Ads, apri la campagna Search, vai su "Parole chiave negative" e aggiungi: economico, low cost, gratis, economici, fast fashion, outlet. Questo blocca gli annunci per chi cerca roba a basso costo.',
      giorno: 'Giorno 1',
      tempo_stimato: '30 minuti',
      difficolta: 'bassa',
      impatto: 'alto',
      priorita: 'alta',
      completed: false
    },
    {
      id: 'a7_2',
      titolo: 'Modifica l\'invito all\'azione in tutti gli annunci',
      descrizione: 'Sostituisci "Scopri di piu" con "Richiedi preventivo gratuito - Risposta in 24h" in tutti gli annunci Meta e Google attivi.',
      giorno: 'Giorno 1-2',
      tempo_stimato: '45 minuti',
      difficolta: 'bassa',
      impatto: 'alto',
      priorita: 'alta',
      completed: false
    },
    {
      id: 'a7_3',
      titolo: 'Unisci le campagne Meta: da 6 a 3',
      descrizione: 'Accedi a Meta Ads Manager. Pausa le 3 campagne con peggior costo per risultato. Redistribuisci il loro budget sulle 3 migliori. Obiettivo: almeno 25-30 euro al giorno per campagna.',
      giorno: 'Giorno 2',
      tempo_stimato: '1 ora',
      difficolta: 'media',
      impatto: 'alto',
      priorita: 'alta',
      completed: false
    },
    {
      id: 'a7_4',
      titolo: 'Comprimi le immagini della landing page itsmia.it',
      descrizione: 'Usa tinypng.com o squoosh.app per comprimere tutte le immagini. Converti in formato WebP. Il sito deve caricarsi sotto i 3 secondi su cellulare.',
      giorno: 'Giorno 3',
      tempo_stimato: '1 ora',
      difficolta: 'bassa',
      impatto: 'medio',
      priorita: 'media',
      completed: false
    },
    {
      id: 'a7_5',
      titolo: 'Crea 2 nuove immagini per gli annunci Meta',
      descrizione: 'Prepara 2 nuove creativita: (1) foto di un capo finito indossato da una cliente reale, (2) immagine con recensione cliente sovrapposta. Formato quadrato 1080x1080 pixel.',
      giorno: 'Giorno 3-4',
      tempo_stimato: '2 ore',
      difficolta: 'media',
      impatto: 'alto',
      priorita: 'alta',
      completed: false
    },
    {
      id: 'a7_6',
      titolo: 'Sposta il 15% del budget da Meta a Google',
      descrizione: 'Riduci il budget giornaliero Meta di circa 10 euro e aggiungili a Google Search. Il nuovo split: Meta 60 euro/giorno, Google 35 euro/giorno.',
      giorno: 'Giorno 5',
      tempo_stimato: '20 minuti',
      difficolta: 'bassa',
      impatto: 'medio',
      priorita: 'media',
      completed: false
    },
    {
      id: 'a7_7',
      titolo: 'Correggi l\'errore sulla variabile "currency" in GTM',
      descrizione: 'Apri Google Tag Manager, vai su Variabili, trova "DLV - currency". Cambia il campo "Nome variabile livello dati" da "transaction_id" a "currency". Salva e pubblica.',
      giorno: 'Giorno 5',
      tempo_stimato: '15 minuti',
      difficolta: 'bassa',
      impatto: 'medio',
      priorita: 'alta',
      completed: false
    }
  ]
};

// ---------- PIANO 30 GIORNI ----------
export const actionPlan30Data = {
  description: 'Azioni strutturali per il prossimo mese. Richiedono piu\' tempo ma portano risultati duraturi.',
  actions: [
    {
      id: 'a30_1',
      titolo: 'Crea una campagna di retargeting su Meta',
      descrizione: 'Crea un pubblico personalizzato con: visitatori itsmia.it degli ultimi 30 giorni che NON hanno cliccato "Richiedi preventivo". Mostra loro un annuncio con offerta speciale o testimonianza.',
      giorno: 'Settimana 1',
      tempo_stimato: '2 ore',
      difficolta: 'media',
      impatto: 'alto',
      priorita: 'alta',
      completed: false
    },
    {
      id: 'a30_2',
      titolo: 'Costruisci un pubblico lookalike dai clienti esistenti',
      descrizione: 'Esporta la lista email dei tuoi clienti. Caricala su Meta come "Pubblico personalizzato". Poi crea un "Pubblico simile" (lookalike) all\'1% per trovare persone simili ai tuoi migliori clienti.',
      giorno: 'Settimana 1',
      tempo_stimato: '1.5 ore',
      difficolta: 'media',
      impatto: 'alto',
      priorita: 'alta',
      completed: false
    },
    {
      id: 'a30_3',
      titolo: 'Gira 3 video brevi per gli annunci',
      descrizione: 'Video 1: processo di creazione di un capo (15 sec). Video 2: cliente che riceve il suo ordine (15 sec). Video 3: prima/dopo di una trasformazione sartoriale (20 sec). Formato verticale 9:16.',
      giorno: 'Settimana 1-2',
      tempo_stimato: '4 ore',
      difficolta: 'alta',
      impatto: 'alto',
      priorita: 'alta',
      completed: false
    },
    {
      id: 'a30_4',
      titolo: 'Aggiungi un modulo di contatto rapido su itsmia.it',
      descrizione: 'Oltre al mailto, inserisci un form con: nome, telefono, tipo di capo desiderato, budget indicativo. Collegalo a un sistema che manda notifica immediata (email o WhatsApp).',
      giorno: 'Settimana 2',
      tempo_stimato: '3 ore',
      difficolta: 'media',
      impatto: 'alto',
      priorita: 'alta',
      completed: false
    },
    {
      id: 'a30_5',
      titolo: 'Ottimizza la landing page per mobile',
      descrizione: 'Fai un redesign leggero della pagina itsmia.it per cellulare: bottone "Richiedi preventivo" sempre visibile in basso, testo piu\' grande, immagini ottimizzate. Obiettivo: PageSpeed sopra 80.',
      giorno: 'Settimana 2',
      tempo_stimato: '4 ore',
      difficolta: 'alta',
      impatto: 'alto',
      priorita: 'media',
      completed: false
    },
    {
      id: 'a30_6',
      titolo: 'Testa 3 diverse offerte nelle campagne',
      descrizione: 'Offerta A: "Preventivo gratuito + sconto 10% primo ordine". Offerta B: "Consulenza stile gratuita + preventivo". Offerta C: "Spedizione gratuita + preventivo in 24h". Fai girare per 2 settimane e vedi quale porta piu\' richieste.',
      giorno: 'Settimana 2-3',
      tempo_stimato: '2 ore',
      difficolta: 'media',
      impatto: 'alto',
      priorita: 'media',
      completed: false
    },
    {
      id: 'a30_7',
      titolo: 'Implementa il tracciamento cross-domain completo',
      descrizione: 'Verifica che il passaggio da itsmia.it a app.miafashion.it mantenga i dati della sessione. Controlla che il Conversion Linker di Google Ads funzioni. Testa il percorso completo: annuncio > landing > webapp > registrazione > acquisto.',
      giorno: 'Settimana 3',
      tempo_stimato: '2 ore',
      difficolta: 'alta',
      impatto: 'medio',
      priorita: 'media',
      completed: false
    },
    {
      id: 'a30_8',
      titolo: 'Crea una campagna Google Performance Max',
      descrizione: 'Performance Max usa l\'intelligenza artificiale di Google per mostrare i tuoi annunci su Search, YouTube, Display, Gmail e Maps contemporaneamente. Ideale per ampliare la copertura senza gestire tante campagne.',
      giorno: 'Settimana 3-4',
      tempo_stimato: '3 ore',
      difficolta: 'alta',
      impatto: 'medio',
      priorita: 'media',
      completed: false
    },
    {
      id: 'a30_9',
      titolo: 'Analizza e migliora il percorso webapp (da registrazione ad acquisto)',
      descrizione: 'Solo il 25% di chi si registra su app.miafashion.it compra un abbonamento. Analizza dove le persone si fermano: pagina prezzi? processo di pagamento? mancanza di fiducia? Poi intervieni sui punti critici.',
      giorno: 'Settimana 4',
      tempo_stimato: '3 ore',
      difficolta: 'alta',
      impatto: 'alto',
      priorita: 'alta',
      completed: false
    },
    {
      id: 'a30_10',
      titolo: 'Report mensile e ricalibrazione obiettivi',
      descrizione: 'Dopo 30 giorni di ottimizzazioni, confronta i numeri: costo per preventivo, numero di lead, tasso di conversione webapp. Imposta gli obiettivi per il mese successivo. Documenta cosa ha funzionato e cosa no.',
      giorno: 'Settimana 4',
      tempo_stimato: '2 ore',
      difficolta: 'bassa',
      impatto: 'medio',
      priorita: 'media',
      completed: false
    }
  ]
};

// ---------- COMPETITOR ----------
export const competitorData = {
  competitors: [
    {
      id: 'comp_1',
      nome: 'Lanieri',
      dominio: 'lanieri.com',
      descrizione: 'Piattaforma di abbigliamento maschile su misura online. Forte presenza pubblicitaria su Google e Meta. Si posizionano come "il sarto digitale" con processo completamente online.',
      punti_forza: [
        'Brand forte e riconosciuto',
        'Processo tutto online: scegli tessuto, misure, stile',
        'Molte recensioni positive visibili',
        'Video di alta qualita\' nelle ads',
        'Landing page veloce e ottimizzata mobile'
      ],
      punti_deboli: [
        'Solo abbigliamento maschile',
        'Prezzi alti non sempre trasparenti',
        'Nessuna prova fisica prima dell\'acquisto',
        'Tempi di consegna lunghi (4-6 settimane)'
      ],
      comunicazione: 'Puntano su qualita\' italiana, artigianalita\' e comodita\' dell\'online. Usano molto lo storytelling del "fatto a mano".',
      creativita: 'Video lifestyle di uomini in abiti eleganti. Foto prodotto su sfondo chiaro. Copy emozionale: "Il tuo abito, le tue regole".',
      score: 78
    },
    {
      id: 'comp_2',
      nome: 'Sumissura',
      dominio: 'sumissura.com',
      descrizione: 'Abiti su misura per donna con configuratore online. Offrono camicie, vestiti e blazer personalizzabili. Prezzi piu\' accessibili della sartoria tradizionale.',
      punti_forza: [
        'Si rivolgono alle donne (meno competitor)',
        'Configuratore visuale intuitivo',
        'Prezzi chiari sul sito',
        'Garanzia "soddisfatti o rimborsati"',
        'Buon posizionamento SEO (ricerca organica)'
      ],
      punti_deboli: [
        'Meno presenza su Meta Ads',
        'Design del sito un po\' datato',
        'Poche recensioni visibili',
        'Non offrono consulenza personalizzata'
      ],
      comunicazione: 'Puntano su accessibilita\' e facilita\'. Messaggi tipo: "Il su misura alla portata di tutti".',
      creativita: 'Immagini di capi colorati. Poche ads video. Copy diretto: "Crea il tuo abito in 3 minuti".',
      score: 62
    },
    {
      id: 'comp_3',
      nome: 'Atelier Eme',
      dominio: 'ateliereme.it',
      descrizione: 'Brand di abiti da cerimonia e sposa. Non direttamente competitor ma cattura ricerche simili su Google. Forte investimento in brand awareness.',
      punti_forza: [
        'Brand molto conosciuto in Italia',
        'Budget pubblicitario elevato',
        'Negozi fisici in tutta Italia',
        'Contenuti editoriali di alta qualita\''
      ],
      punti_deboli: [
        'Solo cerimonia e sposa (nicchia limitata)',
        'Nessun servizio online di personalizzazione',
        'Prezzi non visibili online',
        'Esperienza di acquisto solo in negozio'
      ],
      comunicazione: 'Lusso accessibile, sogno, emozione. Puntano molto su Instagram con foto aspirazionali.',
      creativita: 'Foto editoriali con modelle. Ambientazioni lussuose. Zero copy tecnico, tutto emozione visiva.',
      score: 71
    }
  ],
  cose_che_fanno_meglio: [
    'Landing page piu\' veloci e ottimizzate per cellulare',
    'Video professionali nelle pubblicita\' (non solo foto statiche)',
    'Prezzi visibili e trasparenti sul sito',
    'Recensioni e testimonianze ben in evidenza',
    'Processo di acquisto semplificato e guidato passo dopo passo'
  ],
  opportunita_per_differenziarsi: [
    'MIA puo\' offrire consulenza personalizzata (i competitor non lo fanno online)',
    'Puntare sulla velocita\' di risposta: "preventivo in 24h" vs tempi lunghi dei competitor',
    'Servizio sia uomo che donna (Lanieri solo uomo, Sumissura limita il catalogo)',
    'Mostrare il "dietro le quinte" della sartoria per creare fiducia e unicita\'',
    'Usare WhatsApp come canale diretto (nessun competitor lo fa attivamente)'
  ],
  idee_annunci: [
    {
      id: 'idea_1',
      copy: 'Il tuo stile, cucito addosso a te. Preventivo gratuito in 24 ore.',
      angolo: 'Personalizzazione + velocita\' di risposta',
      formato: 'Immagine con capo indossato + testo sovrapposto'
    },
    {
      id: 'idea_2',
      copy: 'Stanca di vestiti che non ti rappresentano? MIA crea capi unici per te.',
      angolo: 'Frustrazione per la moda standardizzata',
      formato: 'Video 15 secondi: scaffale di vestiti anonimi > zoom su capo MIA personalizzato'
    },
    {
      id: 'idea_3',
      copy: '"Il mio abito MIA mi ha fatto sentire unica al matrimonio di mia figlia" - Carla, Torino',
      angolo: 'Prova sociale (testimonianza reale)',
      formato: 'Immagine con citazione cliente e foto dell\'abito'
    },
    {
      id: 'idea_4',
      copy: 'Da 60 anni vestiamo le donne che vogliono essere se stesse. Scopri la sartoria MIA.',
      angolo: 'Heritage e tradizione artigianale',
      formato: 'Video 20 secondi: mani che cuciono > capo finito > donna che sorride'
    },
    {
      id: 'idea_5',
      copy: 'Niente taglie standard. Niente compromessi. Solo il tuo abito perfetto.',
      angolo: 'Rifiuto della standardizzazione',
      formato: 'Carosello 3 slide: problema > soluzione > risultato'
    },
    {
      id: 'idea_6',
      copy: '3 motivi per scegliere MIA: tessuti italiani, su misura al 100%, pronto in 2 settimane.',
      angolo: 'Benefici concreti e tangibili',
      formato: 'Immagine con 3 icone + foto prodotto'
    },
    {
      id: 'idea_7',
      copy: 'Lo sapevi? Un abito su misura costa meno di quanto pensi. Chiedi un preventivo gratuito.',
      angolo: 'Superare l\'obiezione "costa troppo"',
      formato: 'Immagine comparativa: prezzo brand lusso vs prezzo MIA'
    },
    {
      id: 'idea_8',
      copy: 'Il tuo guardaroba merita pezzi unici. Inizia con una consulenza gratuita.',
      angolo: 'Aspirazione e cura di se\'',
      formato: 'Video 10 secondi: guardaroba aperto > mano sceglie capo MIA'
    },
    {
      id: 'idea_9',
      copy: 'Dalla tua idea al tuo abito: guarda come nasce un capo MIA in 60 secondi.',
      angolo: 'Trasparenza del processo produttivo',
      formato: 'Video Reel/Story 60 secondi: dal bozzetto al capo finito'
    },
    {
      id: 'idea_10',
      copy: 'Solo 5 posti disponibili questo mese per nuovi clienti. Prenota la tua consulenza.',
      angolo: 'Scarsita\' e urgenza (FOMO)',
      formato: 'Immagine con countdown visivo e bottone "Prenota ora"'
    }
  ]
};

// ---------- SALUTE TRACCIAMENTO ----------
export const trackingHealthData = {
  stato: 'da_migliorare',
  punteggio: 65,
  summary: 'Il tracciamento funziona nella maggior parte dei casi, ma ci sono 2 problemi da correggere: la variabile "currency" e\' configurata male e alcuni tag pubblicitari non rispettano il consenso cookie.',
  controlli: [
    {
      id: 'check_lead',
      nome: 'Lead principale (click su "Richiedi preventivo")',
      descrizione: 'Il click su mailto:info@itsmia.it viene tracciato correttamente. Il trigger (regola di attivazione) scatta quando l\'utente clicca il link email sulla pagina.',
      stato: 'ok',
      dettagli: 'Tag attivi: Google Ads Conversion (GAds - Conv - Tailor Preventivo), Meta Lead. Entrambi si attivano sul trigger "TRG - Click mailto itsmia".'
    },
    {
      id: 'check_gotoapp',
      nome: 'Micro-conversione (click verso webapp)',
      descrizione: 'Il click verso app.miafashion.it viene tracciato. Il trigger scatta quando l\'utente clicca un link che punta alla webapp.',
      stato: 'ok',
      dettagli: 'Tag attivo: Google Ads Conversion (GAds - Conv - Go to app). Trigger: "TRG - Click to app.miafashion".'
    },
    {
      id: 'check_signup',
      nome: 'Registrazione webapp (sign_up)',
      descrizione: 'L\'evento sign_up viene ricevuto dal dataLayer (il contenitore dati della pagina) quando un utente si registra su app.miafashion.it.',
      stato: 'ok',
      dettagli: 'Il trigger "TRG - sign_up (webapp)" ascolta l\'evento custom "sign_up" solo sulle pagine di app.miafashion.it. Configurazione corretta.'
    },
    {
      id: 'check_purchase',
      nome: 'Acquisto abbonamento (purchase)',
      descrizione: 'L\'evento purchase viene ricevuto quando un utente completa un acquisto su app.miafashion.it. Pero\' c\'e\' un errore nella variabile della valuta.',
      stato: 'da_migliorare',
      dettagli: 'Il trigger funziona, ma la variabile "DLV - currency" legge "transaction_id" invece di "currency" dal dataLayer. Questo significa che Google Ads riceve un ID transazione al posto della valuta (EUR). L\'importo viene tracciato, ma la valuta no.'
    },
    {
      id: 'check_crossdomain',
      nome: 'Cross-domain (passaggio tra itsmia.it e app.miafashion.it)',
      descrizione: 'Il Conversion Linker di Google Ads e\' configurato per collegare i due domini. Quando un utente passa da itsmia.it a app.miafashion.it, i dati di tracciamento vengono mantenuti.',
      stato: 'ok',
      dettagli: 'Il tag "GAds - Conversion Linker" ha il cross-domain attivo per: itsmia.it, app.miafashion.it. Metodo: parametro URL (query). Decorazione form disattivata (non serve per link normali).'
    },
    {
      id: 'check_consent',
      nome: 'Consenso cookie (Consent Mode + Iubenda)',
      descrizione: 'Il Consent Mode e\' configurato: tutti i tipi di consenso partono come "negato" (denied). Pero\' alcuni tag Google hanno il consenso impostato su "NOT_SET" invece di "NEEDED".',
      stato: 'da_migliorare',
      dettagli: 'Il tag HTML con lo script di default consent e\' corretto (ad_storage, analytics_storage, ad_user_data, ad_personalization tutti "denied" di default). Iubenda e\' presente e configurato. Problema: i tag "GAds - Tag Google", "GAds - Conv - Tailor Preventivo" e "GAds - Conv - Go to app" hanno consentStatus "NOT_SET". Dovrebbero avere "NEEDED" con ad_storage e analytics_storage richiesti, come il tag "Meta - Lead" che e\' configurato correttamente.'
    },
    {
      id: 'check_currency_bug',
      nome: 'ERRORE: Variabile "DLV - currency" punta al campo sbagliato',
      descrizione: 'La variabile "DLV - currency" (che dovrebbe leggere la valuta, es. EUR) in realta\' legge il campo "transaction_id" dal dataLayer. Sia "DLV - currency" che "DLV - transaction_id" leggono lo stesso campo.',
      stato: 'critico',
      dettagli: 'In GTM, vai su Variabili > DLV - currency. Il campo "Nome variabile livello dati" e\' impostato su "transaction_id". Deve essere cambiato in "currency". Senza questa correzione, il tag "GAds - Conv - Subscription purchase" invia un ID transazione al posto della valuta, e Google Ads non puo\' calcolare correttamente il valore delle conversioni in euro.',
      istruzioni_fix: '1) Apri Google Tag Manager (tagmanager.google.com)\n2) Vai nel container GTM-NHH9WPMC\n3) Clicca su "Variabili" nel menu a sinistra\n4) Trova "DLV - currency" e aprila\n5) Cambia il campo "Nome variabile livello dati" da "transaction_id" a "currency"\n6) Salva\n7) Pubblica il container'
    }
  ]
};

// ---------- ANALISI GTM COMPLETA ----------
export const gtmAnalysisData = {
  container: {
    id: 'GTM-NHH9WPMC',
    nome: 'itsmia.it',
    account_id: '6341256602'
  },
  tags: [
    { nome: 'GAds - Conversion Linker', tipo: 'Google Ads Linker', stato: 'ok', note: 'Cross-domain attivo per itsmia.it e app.miafashion.it' },
    { nome: 'GAds - Conv - Tailor Preventivo (mailto)', tipo: 'Google Ads Conversion', stato: 'da_migliorare', note: 'Consent NOT_SET - dovrebbe essere NEEDED' },
    { nome: 'GAds - Tag Google (AW-17330152664)', tipo: 'Google Tag', stato: 'da_migliorare', note: 'Consent NOT_SET - dovrebbe essere NEEDED' },
    { nome: 'GAds - Conv - Go to app (click)', tipo: 'Google Ads Conversion', stato: 'da_migliorare', note: 'Consent NOT_SET - dovrebbe essere NEEDED' },
    { nome: 'GAds - Conv - Subscription purchase', tipo: 'Google Ads Conversion', stato: 'da_migliorare', note: 'Usa variabile currency errata' },
    { nome: 'Consent Mode (default denied)', tipo: 'HTML Personalizzato', stato: 'ok', note: 'Tutti i consensi partono come denied' },
    { nome: 'Meta - Lead (mailto preventivo)', tipo: 'Meta Pixel', stato: 'ok', note: 'Consent NEEDED configurato correttamente' },
    { nome: 'Iubenda Privacy Controls', tipo: 'Template Iubenda', stato: 'ok', note: 'Attivo su tutte le pagine' }
  ],
  triggers: [
    { nome: 'TRG - Click mailto itsmia', tipo: 'Click Link', evento: 'Click su mailto:info@itsmia.it' },
    { nome: 'TRG - Click to app.miafashion', tipo: 'Click Link', evento: 'Click su link verso app.miafashion.it' },
    { nome: 'TRG - sign_up (webapp)', tipo: 'Evento personalizzato', evento: 'Evento "sign_up" su app.miafashion.it' },
    { nome: 'TRG - purchase (webapp)', tipo: 'Evento personalizzato', evento: 'Evento "purchase" su app.miafashion.it' },
    { nome: 'EV - gtm.consentUpdate', tipo: 'Evento personalizzato', evento: 'Aggiornamento consenso cookie' }
  ],
  variabili: [
    { nome: 'DLV - value', tipo: 'Variabile livello dati', campo: 'value', stato: 'ok' },
    { nome: 'DLV - currency', tipo: 'Variabile livello dati', campo: 'transaction_id', stato: 'critico', errore: 'Dovrebbe leggere "currency" ma legge "transaction_id"' },
    { nome: 'DLV - transaction_id', tipo: 'Variabile livello dati', campo: 'transaction_id', stato: 'ok' }
  ]
};
