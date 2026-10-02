import { DurableObject } from 'cloudflare:workers';

const STATE_ROW_ID = 1;
const DAY_IN_MS = 86400000;

const defaultState = {
  ygor: 0,
  julianne: 0,
  apologies: 0,
  peaceWins: 0,
  recordDays: 0,
  lastFightDate: null,
  memories: []
};

const validPeople = ['ygor', 'julianne'];
const validActions = ['offense', 'peace', 'reset'];

function createDefaultState() {
  return { ...defaultState, memories: [] };
}

function nonNegativeNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, number) : 0;
}

function normalizeState(value) {
  const source = value && typeof value === 'object' ? value : {};

  return {
    ygor: nonNegativeNumber(source.ygor),
    julianne: nonNegativeNumber(source.julianne),
    apologies: nonNegativeNumber(source.apologies),
    peaceWins: nonNegativeNumber(source.peaceWins),
    recordDays: nonNegativeNumber(source.recordDays),
    lastFightDate: Number.isFinite(Number(source.lastFightDate)) && Number(source.lastFightDate) > 0
      ? Number(source.lastFightDate)
      : null,
    memories: Array.isArray(source.memories)
      ? source.memories
        .filter((memory) => memory && typeof memory.message === 'string')
        .slice(0, 10)
        .map((memory) => ({
          message: memory.message,
          tone: ['neutral', 'record', 'offense', 'peace'].includes(memory.tone) ? memory.tone : 'neutral',
          createdAt: Number(memory.createdAt) || Date.now()
        }))
      : []
  };
}

function calculateStreak(state, now) {
  const lastFightDate = Number(state.lastFightDate);
  if (!Number.isFinite(lastFightDate) || lastFightDate <= 0) return 0;
  return Math.max(0, Math.floor((now - lastFightDate) / DAY_IN_MS));
}

function refreshRecord(state, now) {
  const streak = calculateStreak(state, now);
  if (streak <= state.recordDays) return false;
  state.recordDays = streak;
  return true;
}

function addMemory(state, message, tone, createdAt) {
  state.memories.unshift({ message, tone, createdAt });
  state.memories = state.memories.slice(0, 10);
}

export class RelationshipCounter extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);

    this.ctx.blockConcurrencyWhile(async () => {
      this.ctx.storage.sql.exec(`
        CREATE TABLE IF NOT EXISTS counter_state (
          id INTEGER PRIMARY KEY CHECK (id = 1),
          data TEXT NOT NULL
        )
      `);

      const rows = this.ctx.storage.sql.exec(
        'SELECT data FROM counter_state WHERE id = ?',
        STATE_ROW_ID
      ).toArray();

      if (!rows.length) {
        this.ctx.storage.sql.exec(
          'INSERT INTO counter_state (id, data) VALUES (?, ?)',
          STATE_ROW_ID,
          JSON.stringify(createDefaultState())
        );
      }
    });
  }

  readState() {
    const row = this.ctx.storage.sql.exec(
      'SELECT data FROM counter_state WHERE id = ?',
      STATE_ROW_ID
    ).toArray()[0];

    if (!row?.data) return createDefaultState();

    try {
      return normalizeState(JSON.parse(row.data));
    } catch {
      return createDefaultState();
    }
  }

  writeState(state) {
    this.ctx.storage.sql.exec(
      'UPDATE counter_state SET data = ? WHERE id = ?',
      JSON.stringify(state),
      STATE_ROW_ID
    );
  }

  async getState() {
    const state = this.readState();
    if (refreshRecord(state, Date.now())) this.writeState(state);
    return state;
  }

  async applyAction(action) {
    if (!action || !validActions.includes(action.type)) {
      throw new Error('invalid_action');
    }

    if (action.type !== 'reset' && !validPeople.includes(action.person)) {
      throw new Error('invalid_person');
    }

    if (action.type === 'reset') {
      const resetState = createDefaultState();
      this.writeState(resetState);
      return resetState;
    }

    const state = this.readState();
    const now = Date.now();
    const personLabel = action.person === 'ygor' ? 'Ygor' : 'Julianne';

    if (action.type === 'offense') {
      if (calculateStreak(state, now) > state.recordDays) {
        state.recordDays = calculateStreak(state, now);
        addMemory(state, `Novo recorde: ${state.recordDays} dias sem discussão`, 'record', now);
      }

      state[action.person] += 1;
      state.lastFightDate = now;
      addMemory(state, `${personLabel} realizou uma ofensa`, 'offense', now);
    }

    if (action.type === 'peace') {
      state[action.person] = Math.max(0, state[action.person] - 1);
      state.apologies += 1;
      state.peaceWins += 1;
      addMemory(state, `${personLabel} escolheu a paz`, 'peace', now);
      refreshRecord(state, now);
    }

    this.writeState(state);
    return state;
  }
}

export default {
  async fetch() {
    return new Response('Not Found', { status: 404 });
  }
};
