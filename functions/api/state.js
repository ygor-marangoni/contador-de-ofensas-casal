import { getSharedCounter, json, methodNotAllowed } from '../_shared/counter.js';

export async function onRequest(context) {
  if (context.request.method !== 'GET') return methodNotAllowed('GET');

  try {
    const state = await getSharedCounter(context.env).getState();
    return json({ success: true, state });
  } catch {
    return json({ success: false, error: 'Não foi possível carregar o estado compartilhado.' }, 500);
  }
}
