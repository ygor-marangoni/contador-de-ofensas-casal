const STORAGE_KEY = 'contador-ofensas';
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

const personLabels = {
  ygor: 'Ygor',
  julianne: 'Julianne'
};

let state = loadState();
let peaceToastTimer;

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
  resetCount: document.querySelector('#reset-count')
};

function loadState() {
  try {
    const savedState = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (!savedState || typeof savedState !== 'object') return { ...defaultState };

    return {
      ...defaultState,
      ...savedState,
      ygor: Math.max(0, Number(savedState.ygor) || 0),
      julianne: Math.max(0, Number(savedState.julianne) || 0),
      apologies: Math.max(0, Number(savedState.apologies) || 0),
      peaceWins: Math.max(0, Number(savedState.peaceWins) || 0),
      recordDays: Math.max(0, Number(savedState.recordDays) || 0),
      memories: Array.isArray(savedState.memories) ? savedState.memories.slice(0, 10) : []
    };
  } catch (error) {
    console.warn('Não foi possível carregar o progresso salvo.', error);
    return { ...defaultState };
  }
}

function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (error) {
    console.warn('Não foi possível salvar o progresso.', error);
  }
}

function calculateStreak() {
  const lastFight = Number(state.lastFightDate);
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
  const recordChanged = streak > state.recordDays;
  if (recordChanged) state.recordDays = streak;

  elements.streak.textContent = streak;
  elements.record.textContent = state.recordDays;
  elements.apologies.textContent = state.apologies;
  elements.peace.textContent = state.peaceWins;
  elements.total.textContent = state.ygor + state.julianne;

  if (recordChanged) saveState();
}

function formatMemoryDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short' }).format(date).replace('.', '');
}

function renderMemories() {
  elements.memories.replaceChildren();

  if (!state.memories.length) {
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
    icon.width = 34;
    icon.height = 34;
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
  renderCounters();
  renderStats();
  renderMemories();
}

function addMemory(message, tone = 'neutral') {
  state.memories.unshift({ message, tone, createdAt: Date.now() });
  state.memories = state.memories.slice(0, 10);
  saveState();
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

function incrementOffense(person) {
  const streakBeforeFight = calculateStreak();
  if (streakBeforeFight > state.recordDays) {
    state.recordDays = streakBeforeFight;
    addMemory(`Novo recorde: ${streakBeforeFight} dias sem discussão`, 'record');
  }

  state[person] += 1;
  state.lastFightDate = Date.now();
  addMemory(`${personLabels[person]} registrou uma ofensa`, 'offense');
  saveState();
  renderCounters();
  renderStats();
  animateCounter(elements[`${person}Score`]);
}

function showPeaceToast() {
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

function decrementOffense(person) {
  state[person] = Math.max(0, state[person] - 1);
  state.apologies += 1;
  state.peaceWins += 1;
  addMemory(`${personLabels[person]} escolheu a paz`, 'peace');
  saveState();
  renderCounters();
  renderStats();
  animateCounter(elements[`${person}Score`]);
  showPeaceToast();
}

function handleAction(button) {
  const { action, person } = button.dataset;
  if (!person || !['ygor', 'julianne'].includes(person)) return;

  impactButton(button, action);
  if (action === 'offense') incrementOffense(person);
  if (action === 'peace') decrementOffense(person);
}

function resetCount() {
  const confirmed = window.confirm('Resetar a contagem e apagar as memórias salvas?');
  if (!confirmed) return;

  state = { ...defaultState, memories: [] };
  saveState();
  renderAll();
}

function setupInteractions() {
  document.querySelectorAll('.arcade-button').forEach((button) => {
    button.addEventListener('click', () => handleAction(button));
  });

  elements.resetCount?.addEventListener('click', resetCount);

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

renderAll();
setupInteractions();
setupSectionObserver();
setupAboutCharacterScale();

setInterval(() => {
  renderStats();
}, 60000);
