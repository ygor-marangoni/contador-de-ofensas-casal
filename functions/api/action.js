import { getSharedCounter, isValidAction, json, methodNotAllowed } from '../_shared/counter.js';

export async function onRequest(context) {
  if (context.request.method !== 'POST') return methodNotAllowed('POST');

  let action;
  try {
    action = await context.request.json();
  } catch {
    return json({ success: false, error: 'JSON inválido.' }, 400);
  }

  if (!isValidAction(action)) {
    return json({ success: false, error: 'Ação ou pessoa inválida.' }, 400);
  }

  try {
    const state = await getSharedCounter(context.env).applyAction(action);
    return json({ success: true, state });
  } catch {
    return json({ success: false, error: 'Não foi possível salvar a ação.' }, 500);
  }
}
