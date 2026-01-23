// State
let currentView = 'grid';
let currentFilter = { system: 'all', search: '', sortBy: 'name', sortOrder: 'ASC', favorite: false };
let roms = [];

// DOM Elements
const importBtn = document.getElementById('import-btn');
const searchInput = document.getElementById('search-input');
const sortSelect = document.getElementById('sort-select');
const viewBtns = document.querySelectorAll('.view-btn');
const romContainer = document.getElementById('rom-container');
const emptyState = document.getElementById('empty-state');
const loadingOverlay = document.getElementById('loading-overlay');
const loadingText = document.getElementById('loading-text');
const systemsList = document.getElementById('systems-list');
const navItems = document.querySelectorAll('.nav-item');

// Initialize
async function init() {
  await loadRoms();
  await loadSystems();
  await updateStats();
  setupEventListeners();
}

// Setup Event Listeners
function setupEventListeners() {
  importBtn.addEventListener('click', handleImport);
  searchInput.addEventListener('input', handleSearch);
  sortSelect.addEventListener('change', handleSort);

  viewBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      currentView = btn.dataset.view;
      viewBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      renderRoms();
    });
  });

  navItems.forEach(item => {
    item.addEventListener('click', () => {
      const filter = item.dataset.filter;
      if (filter === 'favorites') {
        currentFilter.favorite = true;
        currentFilter.system = 'all';
      } else if (filter === 'all') {
        currentFilter.favorite = false;
        currentFilter.system = 'all';
      }

      navItems.forEach(i => i.classList.remove('active'));
      item.classList.add('active');

      // Remove active from system items
      document.querySelectorAll('#systems-list .nav-item').forEach(i => i.classList.remove('active'));

      loadRoms();
    });
  });
}

// Handle Import
async function handleImport() {
  const folderPath = await window.electronAPI.selectFolder();

  if (folderPath) {
    showLoading('Scanning for ROMs...');

    const result = await window.electronAPI.scanRoms(folderPath);

    hideLoading();

    if (result.success) {
      alert(`Successfully imported ${result.count} ROMs!`);
      await loadRoms();
      await loadSystems();
      await updateStats();
    } else {
      alert(`Error importing ROMs: ${result.error}`);
    }
  }
}

// Handle Search
function handleSearch(e) {
  currentFilter.search = e.target.value;
  loadRoms();
}

// Handle Sort
function handleSort(e) {
  currentFilter.sortBy = e.target.value;
  loadRoms();
}

// Load ROMs
async function loadRoms() {
  roms = await window.electronAPI.getRoms(currentFilter);
  renderRoms();
}

// Load Systems
async function loadSystems() {
  const systems = await window.electronAPI.getSystems();

  systemsList.innerHTML = systems
    .map(
      system => `
      <li class="nav-item" data-filter="system" data-system="${system.system}">
        <span class="icon">${getSystemIcon(system.system)}</span>
        <span class="label">${system.system}</span>
        <span class="count">${system.count}</span>
      </li>
    `
    )
    .join('');

  // Add event listeners to system items
  systemsList.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', () => {
      currentFilter.system = item.dataset.system;
      currentFilter.favorite = false;

      // Remove active from all nav items
      document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
      item.classList.add('active');

      loadRoms();
    });
  });
}

// Update Stats
async function updateStats() {
  const stats = await window.electronAPI.getStats();

  document.getElementById('stat-total').textContent = stats.totalRoms;
  document.getElementById('stat-systems').textContent = stats.systemCount;
  document.getElementById('stat-size').textContent = formatBytes(stats.totalSize);
  document.getElementById('total-count').textContent = stats.totalRoms;

  const favoriteCount = roms.filter(rom => rom.favorite).length;
  document.getElementById('favorites-count').textContent = favoriteCount;
}

// Render ROMs
function renderRoms() {
  if (roms.length === 0) {
    romContainer.innerHTML = '';
    romContainer.appendChild(emptyState);
    return;
  }

  if (currentView === 'grid') {
    renderGridView();
  } else {
    renderListView();
  }
}

// Render Grid View
function renderGridView() {
  const grid = document.createElement('div');
  grid.className = 'rom-grid';

  roms.forEach(rom => {
    const card = document.createElement('div');
    card.className = 'rom-card';
    card.innerHTML = `
      <div class="rom-cover">
        ${getSystemIcon(rom.system)}
        <div class="rom-favorite ${rom.favorite ? 'active' : ''}" data-id="${rom.id}">
          ${rom.favorite ? '⭐' : '☆'}
        </div>
      </div>
      <div class="rom-info">
        <div class="rom-name" title="${rom.name}">${rom.name}</div>
        <div class="rom-system">${rom.system}</div>
        <div class="rom-size">${formatBytes(rom.size)}</div>
      </div>
    `;

    // Add favorite toggle
    const favoriteBtn = card.querySelector('.rom-favorite');
    favoriteBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      await toggleFavorite(rom.id, !rom.favorite);
    });

    grid.appendChild(card);
  });

  romContainer.innerHTML = '';
  romContainer.appendChild(grid);
}

// Render List View
function renderListView() {
  const list = document.createElement('div');
  list.className = 'rom-list';

  roms.forEach(rom => {
    const row = document.createElement('div');
    row.className = 'rom-row';
    row.innerHTML = `
      <div class="rom-row-icon">${getSystemIcon(rom.system)}</div>
      <div class="rom-row-info">
        <div class="rom-row-name" title="${rom.name}">${rom.name}</div>
        <div class="rom-row-path" title="${rom.path}">${rom.path}</div>
      </div>
      <div class="rom-row-system">${rom.system}</div>
      <div class="rom-row-size">${formatBytes(rom.size)}</div>
      <div class="rom-row-favorite ${rom.favorite ? 'active' : ''}" data-id="${rom.id}">
        ${rom.favorite ? '⭐' : '☆'}
      </div>
    `;

    // Add favorite toggle
    const favoriteBtn = row.querySelector('.rom-row-favorite');
    favoriteBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      await toggleFavorite(rom.id, !rom.favorite);
    });

    list.appendChild(row);
  });

  romContainer.innerHTML = '';
  romContainer.appendChild(list);
}

// Toggle Favorite
async function toggleFavorite(id, favorite) {
  await window.electronAPI.updateRom(id, { favorite: favorite ? 1 : 0 });
  await loadRoms();
  await updateStats();
}

// Get System Icon
function getSystemIcon(system) {
  const icons = {
    'Nintendo Entertainment System': '🎮',
    'Super Nintendo': '🎮',
    'Game Boy': '🎮',
    'Game Boy Color': '🎮',
    'Game Boy Advance': '🎮',
    'Nintendo 64': '🎮',
    'Nintendo DS': '🎮',
    'Nintendo 3DS': '🎮',
    'Sega Genesis': '🎮',
    'Game Gear': '🎮',
    'Sega Master System': '🎮',
    'PlayStation/GameCube/Wii': '💿',
    'PlayStation': '💿',
    'GameCube': '💿',
    'PSP': '💿'
  };
  return icons[system] || '🎮';
}

// Format Bytes
function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Show Loading
function showLoading(text = 'Loading...') {
  loadingText.textContent = text;
  loadingOverlay.classList.add('active');
}

// Hide Loading
function hideLoading() {
  loadingOverlay.classList.remove('active');
}

// Initialize the app
init();
