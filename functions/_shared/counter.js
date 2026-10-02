const SHARED_COUNTER_NAME = 'contador-ofensas-casal';

export function getSharedCounter(env) {
  if (!env?.RELATIONSHIP_COUNTER) {
    throw new Error('RELATIONSHIP_COUNTER binding is not configured');
  }

  const id = env.RELATIONSHIP_COUNTER.idFromName(SHARED_COUNTER_NAME);
  return env.RELATIONSHIP_COUNTER.get(id);
}

export function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Cache-Control': 'no-store',
      'Content-Type': 'application/json; charset=UTF-8'
    }
  });
}

export function methodNotAllowed(allowedMethod) {
  return new Response(JSON.stringify({ success: false, error: 'Method Not Allowed' }), {
    status: 405,
    headers: {
      Allow: allowedMethod,
      'Cache-Control': 'no-store',
      'Content-Type': 'application/json; charset=UTF-8'
    }
  });
}

export function isValidAction(action) {
  if (!action || typeof action !== 'object') return false;
  if (!['offense', 'peace', 'reset'].includes(action.type)) return false;
  if (action.type === 'reset') return true;
  return ['ygor', 'julianne'].includes(action.person);
}
