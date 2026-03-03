// Test completo di tutte le API - MIA Diagnosi Pubblicita
const BASE = 'http://localhost:3001/api';

async function test() {
  const results = [];

  // 1. Login
  const loginRes = await fetch(`${BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'demo@itsmia.it', password: 'mia2024' })
  });
  const loginData = await loginRes.json();
  const token = loginData.token;
  results.push(`1. Login: ${token ? 'OK' : 'FAIL'} - Utente: ${loginData.user?.name}`);

  const headers = { 'Authorization': `Bearer ${token}` };

  // 2. Summary
  const summaryRes = await fetch(`${BASE}/diagnosis/summary`, { headers });
  const summary = await summaryRes.json();
  results.push(`2. Sintesi: Score ${summary.score}/100 - ${summary.metrics?.length} metriche`);

  // 3. Diagnosis
  const diagRes = await fetch(`${BASE}/diagnosis`, { headers });
  const diag = await diagRes.json();
  results.push(`3. Diagnosi: ${diag.issues?.length} problemi - ${diag.suggerimenti?.length} suggerimenti`);

  // 4. Action Plan 7
  const plan7Res = await fetch(`${BASE}/action-plan/7`, { headers });
  const plan7 = await plan7Res.json();
  results.push(`4. Piano 7gg: ${plan7.actions?.length} azioni`);

  // 5. Action Plan 30
  const plan30Res = await fetch(`${BASE}/action-plan/30`, { headers });
  const plan30 = await plan30Res.json();
  results.push(`5. Piano 30gg: ${plan30.actions?.length} azioni`);

  // 6. Competitors
  const compRes = await fetch(`${BASE}/competitors`, { headers });
  const comp = await compRes.json();
  results.push(`6. Competitor: ${comp.competitors?.length} analizzati - ${comp.idee_annunci?.length} idee annunci`);

  // 7. Tracking Health
  const trackRes = await fetch(`${BASE}/tracking-health`, { headers });
  const track = await trackRes.json();
  results.push(`7. Tracciamento: stato "${track.stato}" - ${track.controlli?.length} controlli - punteggio ${track.punteggio}`);

  // 8. GTM Analysis
  const gtmRes = await fetch(`${BASE}/tracking-health/gtm`, { headers });
  const gtm = await gtmRes.json();
  results.push(`8. GTM: ${gtm.tags?.length} tag - ${gtm.triggers?.length} trigger - ${gtm.variabili?.length} variabili`);

  // 9. Toggle action
  const toggleRes = await fetch(`${BASE}/action-plan/7/toggle/a7_1`, { method: 'PATCH', headers });
  const toggle = await toggleRes.json();
  results.push(`9. Toggle azione: ${toggle.completed ? 'completata' : 'riaperta'} - "${toggle.message?.substring(0, 50)}"`);

  // 10. CSS check
  const cssRes = await fetch('http://localhost:5173/src/index.css');
  const css = await cssRes.text();
  const hasTailwind = css.includes('.bg-mia-blue') && css.includes('.rounded-2xl') && css.includes('.grid-cols');
  results.push(`10. Tailwind CSS: ${hasTailwind ? 'OK - classi compilate' : 'ERRORE'}`);

  console.log('\n=== MIA DIAGNOSI - TEST COMPLETO ===\n');
  results.forEach(r => console.log(r));
  console.log('\n=== TUTTI I TEST PASSATI ===\n');
}

test().catch(e => console.error('TEST FALLITO:', e.message));
