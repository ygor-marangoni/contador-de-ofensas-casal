const DAY_IN_MS = 86400000;
const STATE_ENDPOINT = '/api/state';
const ACTION_ENDPOINT = '/api/action';
const SHARED_SYNC_INTERVAL = 5000;

const defaultState = {
  ygor: 0,
  julianne: 0,
  apologies: 0,
  peaceWins: 0,
  recordDays: 0,
  lastFightDate: null,
  memories: []
};

const personLabels = {
  ygor: 'Ygor',
  julianne: 'Julianne'
};

let state = null;
let peaceToastTimer;
let syncToastTimer;
let syncPollTimer;
let syncRequestSequence = 0;
let lastAppliedRequestSequence = 0;
let lastAppliedMutationSequence = 0;
let syncErrorVisible = false;

const elements = {
  body: document.body,
  header: document.querySelector('#site-header'),
  nav: document.querySelector('#main-nav'),
  navToggle: document.querySelector('.nav-toggle'),
  peaceToast: document.querySelector('#peace-toast'),
  ygorScore: document.querySelector('#ygor-score'),
  julianneScore: document.querySelector('#julianne-score'),
  streak: document.querySelector('#streak-value'),
  record: document.querySelector('#record-value'),
  apologies: document.querySelector('#apologies-value'),
  peace: document.querySelector('#peace-value'),
  total: document.querySelector('#total-value'),
  memories: document.querySelector('#memories-list'),
  resetCountWrap: document.querySelector('.reset-count-wrap'),
  resetCount: document.querySelector('#reset-count')
};

elements.body.classList.add('is-state-loading');

function normalizeState(remoteState) {
  const source = remoteState && typeof remoteState === 'object' ? remoteState : {};

  return {
    ygor: Math.max(0, Number(source.ygor) || 0),
    julianne: Math.max(0, Number(source.julianne) || 0),
    apologies: Math.max(0, Number(source.apologies) || 0),
    peaceWins: Math.max(0, Number(source.peaceWins) || 0),
    recordDays: Math.max(0, Number(source.recordDays) || 0),
    lastFightDate: Number.isFinite(Number(source.lastFightDate)) && Number(source.lastFightDate) > 0
      ? Number(source.lastFightDate)
      : null,
    memories: Array.isArray(source.memories)
      ? source.memories.filter((memory) => memory && typeof memory.message === 'string').slice(0, 10)
      : []
  };
}

function statesMatch(nextState) {
  return state && JSON.stringify(state) === JSON.stringify(nextState);
}

function applyRemoteState(nextState, requestSequence, isMutation = false) {
  if (isMutation) {
    if (requestSequence < lastAppliedMutationSequence) return false;
    lastAppliedMutationSequence = requestSequence;
  } else if (requestSequence < lastAppliedRequestSequence || requestSequence < lastAppliedMutationSequence) {
    return false;
  }

  const normalizedState = normalizeState(nextState);
  const changed = !statesMatch(normalizedState);
  state = normalizedState;
  lastAppliedRequestSequence = Math.max(lastAppliedRequestSequence, requestSequence);
  elements.body.classList.remove('is-state-loading');

  if (changed) renderAll();
  return changed;
}

async function readJsonResponse(response) {
  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload?.state) {
    throw new Error(payload?.error || `API request failed with status ${response.status}`);
  }
  return payload.state;
}

async function fetchSharedState() {
  const response = await fetch(STATE_ENDPOINT, {
    method: 'GET',
    cache: 'no-store',
    headers: { Accept: 'application/json' }
  });

  return readJsonResponse(response);
}

async function sendAction(type, person) {
  const requestBody = type === 'reset' ? { type } : { type, person };
  const response = await fetch(ACTION_ENDPOINT, {
    method: 'POST',
    cache: 'no-store',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(requestBody)
  });

  return readJsonResponse(response);
}

function showSyncError(message = 'Não foi possível sincronizar. Tentando novamente...') {
  syncErrorVisible = true;
  window.clearTimeout(syncToastTimer);
  elements.peaceToast.textContent = message;
  elements.peaceToast.classList.remove('is-visible');
  void elements.peaceToast.offsetWidth;
  elements.peaceToast.classList.add('is-visible');
  syncToastTimer = window.setTimeout(() => {
    elements.peaceToast.classList.remove('is-visible');
    elements.peaceToast.textContent = '';
    syncErrorVisible = false;
  }, 3200);
}

function clearSyncError() {
  if (!syncErrorVisible) return;
  window.clearTimeout(syncToastTimer);
  elements.peaceToast.classList.remove('is-visible');
  elements.peaceToast.textContent = '';
  syncErrorVisible = false;
}

async function syncSharedState() {
  const requestSequence = ++syncRequestSequence;

  try {
    const remoteState = await fetchSharedState();
    applyRemoteState(remoteState, requestSequence, true);
    clearSyncError();
  } catch (error) {
    if (!state) elements.body.classList.remove('is-state-loading');
    showSyncError();
    console.warn('Não foi possível sincronizar o contador.', error);
  }
}

function scheduleSharedPolling() {
  window.clearTimeout(syncPollTimer);
  if (document.hidden) return;

  syncPollTimer = window.setTimeout(async () => {
    await syncSharedState();
    scheduleSharedPolling();
  }, SHARED_SYNC_INTERVAL);
}

function setupSharedSynchronization() {
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      window.clearTimeout(syncPollTimer);
      return;
    }

    void syncSharedState();
    scheduleSharedPolling();
  });

  window.addEventListener('focus', () => {
    void syncSharedState();
    scheduleSharedPolling();
  });

  void syncSharedState();
  scheduleSharedPolling();
}

function calculateStreak() {
  const lastFight = Number(state?.lastFightDate);
  if (!Number.isFinite(lastFight) || lastFight <= 0) return 0;
  const elapsed = Date.now() - lastFight;
  return Math.max(0, Math.floor(elapsed / DAY_IN_MS));
}

function renderCounters() {
  elements.ygorScore.textContent = state.ygor;
  elements.julianneScore.textContent = state.julianne;
}

function renderStats() {
  const streak = calculateStreak();

  elements.streak.textContent = streak;
  elements.record.textContent = state.recordDays;
  elements.apologies.textContent = state.apologies;
  elements.peace.textContent = state.peaceWins;
  elements.total.textContent = state.ygor + state.julianne;
}

function formatMemoryDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short' }).format(date).replace('.', '');
}

function renderMemories() {
  const hasMemories = state.memories.length > 0;
  if (elements.resetCountWrap) elements.resetCountWrap.hidden = !hasMemories;
  elements.memories.replaceChildren();

  if (!hasMemories) {
    const empty = document.createElement('p');
    empty.className = 'memory-empty';
    empty.textContent = 'Ainda não há registros. O próximo capítulo pode começar com um pedido de desculpas.';
    elements.memories.append(empty);
    return;
  }

  const memoryFragment = document.createDocumentFragment();

  state.memories.forEach((memory) => {
    const cardShadow = document.createElement('div');
    cardShadow.className = `memory-card-shadow ${memory.tone ? `is-${memory.tone}` : ''}`;

    const cardShell = document.createElement('div');
    cardShell.className = `memory-card-shell ${memory.tone ? `is-${memory.tone}` : ''}`;

    const card = document.createElement('article');
    card.className = `memory-card ${memory.tone ? `is-${memory.tone}` : ''}`;

    const memoryHead = document.createElement('div');
    memoryHead.className = 'memory-head';

    const icon = document.createElement('img');
    icon.className = 'memory-card-icon';
    icon.alt = '';
    icon.setAttribute('width', '34');
    icon.setAttribute('height', '34');
    icon.loading = 'lazy';
    icon.decoding = 'async';
    icon.setAttribute('aria-hidden', 'true');
    icon.src = memory.tone === 'peace'
      ? 'assets/icon-coracao-corativo.webp'
      : memory.tone === 'record'
        ? 'assets/icon-trofeu.webp'
        : memory.tone === 'offense'
          ? 'assets/icon-coracao-partido.webp'
          : 'assets/icon-coracao.webp';

    const type = document.createElement('span');
    type.className = 'memory-card-type';
    type.textContent = memory.tone === 'peace'
      ? 'vitória da paz'
      : memory.tone === 'record'
        ? 'novo recorde'
        : memory.tone === 'offense'
          ? 'registro do placar'
          : 'memória do casal';

    memoryHead.append(icon, type);

    const message = document.createElement('p');
    message.textContent = memory.message;

    const footer = document.createElement('div');
    footer.className = 'memory-footer';
    const date = document.createElement('time');
    const memoryDate = new Date(memory.createdAt);
    const safeDate = Number.isNaN(memoryDate.getTime()) ? new Date() : memoryDate;
    date.dateTime = safeDate.toISOString();
    date.textContent = formatMemoryDate(safeDate);
    const savedLabel = document.createElement('span');
    savedLabel.textContent = 'memória salva';
    footer.append(date, savedLabel);

    card.append(memoryHead, message, footer);
    cardShell.append(card);
    cardShadow.append(cardShell);
    memoryFragment.append(cardShadow);
  });

  elements.memories.append(memoryFragment);
}

function renderAll() {
  if (!state) return;
  renderCounters();
  renderStats();
  renderMemories();
}

function animateCounter(element) {
  element.classList.remove('is-bumping');
  void element.offsetWidth;
  element.classList.add('is-bumping');
}

function createParticles(type, element) {
  const layer = element.querySelector('.particle-layer');
  if (!layer) return;

  const asset = type === 'offense' ? 'assets/icon-coracao-partido.webp' : 'assets/icon-coracao-corativo.webp';
  const count = type === 'offense' ? 5 : 4;

  for (let index = 0; index < count; index += 1) {
    const particle = document.createElement('span');
    const image = document.createElement('img');
    const angle = -65 + (index * 27) + Math.round(Math.random() * 12 - 6);
    const distance = 30 + Math.round(Math.random() * 32);

    particle.className = 'particle';
    particle.style.setProperty('--dx', `${Math.cos(angle * Math.PI / 180) * distance}px`);
    particle.style.setProperty('--dy', `${-44 - Math.round(Math.random() * 40)}px`);
    particle.style.setProperty('--delay', `${index * 35}ms`);
    particle.style.setProperty('--rot', `${Math.round(Math.random() * 35 - 18)}deg`);
    image.src = asset;
    image.alt = '';
    image.setAttribute('aria-hidden', 'true');
    particle.append(image);
    particle.addEventListener('animationend', () => particle.remove(), { once: true });
    layer.append(particle);
  }
}

function impactButton(button, type) {
  button.classList.remove('is-impact');
  void button.offsetWidth;
  button.classList.add('is-impact');
  createParticles(type, button);
}

function showPeaceToast() {
  clearSyncError();
  window.clearTimeout(peaceToastTimer);
  elements.peaceToast.textContent = '+1 vitória da paz ♥';
  elements.peaceToast.classList.remove('is-visible');
  void elements.peaceToast.offsetWidth;
  elements.peaceToast.classList.add('is-visible');
  peaceToastTimer = window.setTimeout(() => {
    elements.peaceToast.classList.remove('is-visible');
    elements.peaceToast.textContent = '';
  }, 1550);
}

async function handleAction(button) {
  const { action, person } = button.dataset;
  if (!state || !person || !['ygor', 'julianne'].includes(person) || !['offense', 'peace'].includes(action)) return;

  impactButton(button, action);
  const requestSequence = ++syncRequestSequence;

  try {
    const remoteState = await sendAction(action, person);
    applyRemoteState(remoteState, requestSequence, true);
    animateCounter(elements[`${person}Score`]);
    if (action === 'peace') showPeaceToast();
    clearSyncError();
  } catch (error) {
    showSyncError('Não foi possível salvar. Tente novamente.');
    console.warn('Não foi possível salvar a ação do contador.', error);
  }
}

async function resetCount() {
  const confirmed = window.confirm('Resetar a contagem e apagar as memórias salvas?');
  if (!confirmed || !state) return;

  const requestSequence = ++syncRequestSequence;

  try {
    const remoteState = await sendAction('reset');
    applyRemoteState(remoteState, requestSequence);
    clearSyncError();
  } catch (error) {
    showSyncError('Não foi possível resetar. Tente novamente.');
    console.warn('Não foi possível resetar o contador.', error);
  }
}

function setupInteractions() {
  document.querySelectorAll('.arcade-button').forEach((button) => {
    button.addEventListener('click', () => { void handleAction(button); });
  });

  elements.resetCount?.addEventListener('click', () => { void resetCount(); });

  elements.navToggle.addEventListener('click', () => {
    const isOpen = elements.nav.classList.toggle('is-open');
    elements.navToggle.classList.toggle('is-open', isOpen);
    elements.header.classList.toggle('is-menu-open', isOpen);
    elements.navToggle.setAttribute('aria-expanded', String(isOpen));
    elements.navToggle.setAttribute('aria-label', isOpen ? 'Fechar menu' : 'Abrir menu');
  });

  document.querySelectorAll('.nav-link').forEach((link) => {
    link.addEventListener('click', () => {
      elements.nav.classList.remove('is-open');
      elements.navToggle.classList.remove('is-open');
      elements.header.classList.remove('is-menu-open');
      elements.navToggle.setAttribute('aria-expanded', 'false');
      elements.navToggle.setAttribute('aria-label', 'Abrir menu');
    });
  });

  window.addEventListener('scroll', () => {
    elements.header.classList.toggle('is-scrolled', window.scrollY > 10);
  }, { passive: true });
}

function setupSectionObserver() {
  const links = new Map([...document.querySelectorAll('.nav-link')].map((link) => [link.dataset.section, link]));
  const sections = [...document.querySelectorAll('#hero, #memories, #sobre')];

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      links.forEach((link) => link.classList.remove('is-active'));
      links.get(entry.target.id)?.classList.add('is-active');
    });
  }, { rootMargin: '-30% 0px -55% 0px', threshold: 0 });

  sections.forEach((section) => observer.observe(section));
}

function setupAboutCharacterScale() {
  const about = document.querySelector('#sobre');
  const characterLayer = about?.querySelector('.about-characters');
  const ygor = about?.querySelector('.about-character--ygor');
  const julianne = about?.querySelector('.about-character--julianne');
  if (!about || !characterLayer || !ygor || !julianne) return;

  const resetCharacterScale = () => {
    [ygor, julianne].forEach((character) => {
      character.style.removeProperty('width');
      character.style.removeProperty('left');
      character.style.removeProperty('right');
      character.style.removeProperty('bottom');
    });
  };

  const syncCharacterScale = () => {
    if (window.innerWidth <= 1200) {
      resetCharacterScale();
      return;
    }

    const sectionRect = about.getBoundingClientRect();
    const layerRect = characterLayer.getBoundingClientRect();
    const scale = Math.max(sectionRect.width / 1920, sectionRect.height / 1080);
    const renderedWidth = 1920 * scale;
    const renderedHeight = 1080 * scale;
    const offsetX = (sectionRect.width - renderedWidth) / 2;
    const offsetY = (sectionRect.height - renderedHeight) / 2;
    const layerOffsetX = sectionRect.left - layerRect.left;
    const layerBottom = layerRect.bottom;

    ygor.style.width = `${624 * scale * 1.08}px`;
    ygor.style.left = `${offsetX + layerOffsetX}px`;
    ygor.style.right = 'auto';
    const targetBottom = sectionRect.top + offsetY + renderedHeight;
    ygor.style.bottom = `${layerBottom - targetBottom}px`;

    julianne.style.width = `${742 * scale}px`;
    julianne.style.right = `${layerRect.right - (sectionRect.left + offsetX + renderedWidth)}px`;
    julianne.style.left = 'auto';
    julianne.style.bottom = `${layerBottom - targetBottom}px`;
  };

  syncCharacterScale();
  window.addEventListener('resize', syncCharacterScale, { passive: true });
  window.addEventListener('load', syncCharacterScale, { once: true });
  if ('ResizeObserver' in window) new ResizeObserver(syncCharacterScale).observe(about);
}

setupInteractions();
setupSectionObserver();
setupAboutCharacterScale();
setupSharedSynchronization();

window.setInterval(() => {
  if (state && !document.hidden) renderStats();
}, 60000);
