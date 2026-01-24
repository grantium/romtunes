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
  try {
    console.log('Initializing RomTunes...');
    await loadRoms();
    await loadSystems();
    await updateStats();
    setupEventListeners();
    console.log('RomTunes initialized successfully');
  } catch (error) {
    console.error('Error during initialization:', error);
    alert('Failed to initialize RomTunes. Check the console for details.');
  }
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
  // Show import options menu
  const choice = confirm('Click OK to import a folder of ROMs, or Cancel to select individual ROM files.');

  if (choice) {
    // Import folder
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
  } else {
    // Import files
    const filePaths = await window.electronAPI.selectFiles();

    if (filePaths) {
      showLoading('Importing ROM files...');
      const result = await window.electronAPI.importFiles(filePaths);
      hideLoading();

      if (result.success) {
        alert(`Successfully imported ${result.count} ROM file(s)!`);
        await loadRoms();
        await loadSystems();
        await updateStats();
      } else {
        alert(`Error importing files: ${result.error}`);
      }
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
  console.log('loadRoms() called');
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

  try {
    if (currentView === 'grid') {
      renderGridView();
    } else {
      renderListView();
    }
  } catch (error) {
    console.error('Error rendering ROMs:', error);
    alert('Error rendering ROMs. Check the console for details.');
  }
}

// Render Grid View
function renderGridView() {
  const grid = document.createElement('div');
  grid.className = 'rom-grid';

  for (const rom of roms) {
    const card = document.createElement('div');
    card.className = 'rom-card';

    // Check for artwork
    const artworkPath = rom.boxart ? `file://${rom.boxart}` : null;
    const coverContent = artworkPath
      ? `<img src="${artworkPath}" alt="${rom.name}" />`
      : getSystemIcon(rom.system);

    card.innerHTML = `
      <div class="rom-cover">
        ${coverContent}
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

    // Add click handler to open detail modal
    card.addEventListener('click', (e) => {
      console.log('ROM card clicked:', rom.name);
      console.log('Event target:', e.target);
      console.log('Current target:', e.currentTarget);
      openRomDetail(rom);
    });

    grid.appendChild(card);
  }

  romContainer.innerHTML = '';
  romContainer.appendChild(grid);
  console.log(`Rendered ${roms.length} ROMs in grid view`);

  // Debug: Check if anything is blocking clicks
  setTimeout(() => {
    const loadingActive = document.querySelector('.loading-overlay.active');
    const modalActive = document.querySelector('.modal.active');
    const firstCard = document.querySelector('.rom-card');
    console.log('Loading overlay active?', !!loadingActive);
    console.log('Modal active?', !!modalActive);
    console.log('Grid element exists?', !!document.querySelector('.rom-grid'));
    console.log('First card exists?', !!firstCard);

    // Test if we can programmatically click a card
    if (firstCard) {
      console.log('Testing programmatic click on first card...');
      window.testClick = () => {
        firstCard.click();
      };
      console.log('Run testClick() in console to test if event listener works');
    }
  }, 100);
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

    // Add click handler to open detail modal
    row.addEventListener('click', () => {
      console.log('ROM row clicked:', rom.name);
      openRomDetail(rom);
    });

    list.appendChild(row);
  });

  romContainer.innerHTML = '';
  romContainer.appendChild(list);
  console.log(`Rendered ${roms.length} ROMs in list view`);
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

// ROM Detail Modal
let currentRom = null;
const romDetailModal = document.getElementById('rom-detail-modal');
const romDetailClose = document.getElementById('rom-detail-close');
const romDetailCancel = document.getElementById('rom-detail-cancel');
const romDeleteBtn = document.getElementById('rom-delete');
const importBoxartBtn = document.getElementById('import-boxart');
const importScreenshotBtn = document.getElementById('import-screenshot');
const scrapeRomBtn = document.getElementById('scrape-rom-btn');

romDetailClose.addEventListener('click', closeRomDetail);
romDetailCancel.addEventListener('click', closeRomDetail);
romDeleteBtn.addEventListener('click', deleteCurrentRom);
importBoxartBtn.addEventListener('click', () => importArtwork('boxart'));
importScreenshotBtn.addEventListener('click', () => importArtwork('screenshot'));
scrapeRomBtn.addEventListener('click', scrapeCurrentRom);

async function openRomDetail(rom) {
  console.log('Opening ROM detail for:', rom);
  currentRom = rom;

  // Set basic info
  document.getElementById('rom-detail-title').textContent = rom.name;
  document.getElementById('detail-name').textContent = rom.name;
  document.getElementById('detail-system').textContent = rom.system;
  document.getElementById('detail-filename').textContent = rom.filename;
  document.getElementById('detail-size').textContent = formatBytes(rom.size);
  document.getElementById('detail-path').textContent = rom.path;

  // Load and display artwork
  await loadRomArtwork(rom.id);

  romDetailModal.classList.add('active');
}

function closeRomDetail() {
  romDetailModal.classList.remove('active');
  currentRom = null;
}

async function loadRomArtwork(romId) {
  const artworkDisplay = document.getElementById('rom-artwork-display');
  const artPath = await window.electronAPI.getArtworkPath(romId, 'boxart');

  if (artPath) {
    artworkDisplay.innerHTML = `<img src="file://${artPath}" alt="Box Art" />`;
  } else {
    artworkDisplay.innerHTML = '<div class="artwork-placeholder">🎮</div>';
  }
}

async function importArtwork(artworkType) {
  if (!currentRom) return;

  const imagePath = await window.electronAPI.selectImage();

  if (imagePath) {
    showLoading('Importing artwork...');

    const result = await window.electronAPI.importArtwork(
      currentRom.id,
      artworkType,
      imagePath
    );

    hideLoading();

    if (result.success) {
      // Reload ROM data and artwork
      await loadRomArtwork(currentRom.id);
      await loadRoms();

      alert('Artwork imported successfully!');
    } else {
      alert(`Error importing artwork: ${result.error}`);
    }
  }
}

async function deleteCurrentRom() {
  if (!currentRom) return;

  const confirmed = confirm(`Are you sure you want to delete "${currentRom.name}" from your library?\n\nNote: This will only remove it from the library, not delete the file.`);

  if (confirmed) {
    await window.electronAPI.deleteRom(currentRom.id);
    closeRomDetail();
    await loadRoms();
    await updateStats();
  }
}

async function scrapeCurrentRom() {
  if (!currentRom) return;

  const config = await window.electronAPI.getConfig();

  if (!config.scraper?.enabled) {
    const goToSettings = confirm(
      'ScreenScraper is not configured.\n\n' +
      'Would you like to go to Settings to set it up?'
    );

    if (goToSettings) {
      closeRomDetail();
      document.getElementById('settings-btn').click();
      // Switch to scraper tab
      setTimeout(() => {
        const scraperTab = document.querySelector('[data-tab="scraper"]');
        if (scraperTab) scraperTab.click();
      }, 100);
    }
    return;
  }

  showLoading('Searching ScreenScraper...');
  scrapeRomBtn.disabled = true;

  try {
    const artworkTypes = config.scraper.artworkTypes || ['boxart', 'screenshot'];
    const result = await window.electronAPI.scrapeRom(currentRom.id, artworkTypes);

    hideLoading();

    if (result.success) {
      alert(
        `Successfully scraped artwork!\n\n` +
        `Game: ${result.gameInfo.name}\n` +
        `Downloaded: ${Object.keys(result.downloadedArtwork).join(', ')}`
      );

      // Reload ROM data and artwork
      await loadRomArtwork(currentRom.id);
      await loadRoms();
    } else {
      alert(`Scraping failed: ${result.error}`);
    }
  } catch (error) {
    hideLoading();
    alert(`Scraping error: ${error.message}`);
  } finally {
    scrapeRomBtn.disabled = false;
  }
}

// Initialize the app
init();
