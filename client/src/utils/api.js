const BASE_URL = import.meta.env.VITE_API_URL || '/api';

/**
 * Utility per le chiamate API.
 * Gestisce automaticamente il parsing JSON e gli errori.
 */
async function fetchApi(endpoint, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  const config = {
    ...options,
    headers,
  };

  const response = await fetch(`${BASE_URL}${endpoint}`, config);

  if (!response.ok) {
    let errorMessage = `Errore ${response.status}`;
    try {
      const errorData = await response.json();
      errorMessage = errorData.error || errorData.message || errorMessage;
    } catch {
      // Se il corpo non e' JSON, usa il messaggio di default
    }
    throw new Error(errorMessage);
  }

  // Gestisci risposte vuote (204 No Content)
  if (response.status === 204) {
    return null;
  }

  return response.json();
}

/**
 * Ottieni il riepilogo generale della diagnosi
 */
export async function getSummary() {
  return fetchApi('/diagnosis/summary');
}

/**
 * Ottieni i trend temporali delle metriche
 */
export async function getTrends() {
  return fetchApi('/diagnosis/trends');
}

/**
 * Ottieni la diagnosi dettagliata con problemi e suggerimenti
 */
export async function getDiagnosis() {
  return fetchApi('/diagnosis');
}

/**
 * Ottieni il piano di azione a 7 giorni
 */
export async function getActionPlan7() {
  return fetchApi('/action-plan/7');
}

/**
 * Ottieni il piano di azione a 30 giorni
 */
export async function getActionPlan30() {
  return fetchApi('/action-plan/30');
}

/**
 * Aggiorna lo stato di completamento di un'azione
 */
export async function toggleAction(planType, actionId) {
  return fetchApi(`/action-plan/${planType}/toggle/${actionId}`, {
    method: 'PATCH',
  });
}

/**
 * Ottieni l'analisi dei competitor
 */
export async function getCompetitors() {
  return fetchApi('/competitors');
}

/**
 * Ottieni lo stato di salute del tracciamento
 */
export async function getTrackingHealth() {
  return fetchApi('/tracking-health');
}

/**
 * Ottieni l'analisi del Google Tag Manager
 */
export async function getGtmAnalysis() {
  return fetchApi('/tracking-health/gtm');
}

/**
 * Carica CSV Google Ads
 */
export async function uploadGoogleCsv(file) {
  const formData = new FormData();
  formData.append('file', file);
  const response = await fetch(`${BASE_URL}/csv-import/google`, {
    method: 'POST',
    body: formData,
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || `Errore ${response.status}`);
  }
  return response.json();
}

/**
 * Carica CSV Meta Ads
 */
export async function uploadMetaCsv(file) {
  const formData = new FormData();
  formData.append('file', file);
  const response = await fetch(`${BASE_URL}/csv-import/meta`, {
    method: 'POST',
    body: formData,
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || `Errore ${response.status}`);
  }
  return response.json();
}

/**
 * Stato importazione CSV
 */
export async function getCsvStatus() {
  return fetchApi('/csv-import/status');
}

/**
 * Cancella dati CSV
 */
export async function deleteCsvData() {
  return fetchApi('/csv-import', { method: 'DELETE' });
}

export default fetchApi;
