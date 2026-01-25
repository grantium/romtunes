// State
let currentView = 'grid';
let currentFilter = { system: 'all', search: '', sortBy: 'name', sortOrder: 'ASC', favorite: false };
let roms = [];
let selectedRoms = new Set(); // Track selected ROM IDs

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
    await loadDevices();
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

  // Device refresh button
  const refreshDevicesBtn = document.getElementById('refresh-devices-btn');
  if (refreshDevicesBtn) {
    refreshDevicesBtn.addEventListener('click', async () => {
      refreshDevicesBtn.style.transform = 'rotate(360deg)';
      refreshDevicesBtn.style.transition = 'transform 0.5s';
      await loadDevices();
      setTimeout(() => {
        refreshDevicesBtn.style.transform = '';
      }, 500);
    });
  }

  viewBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      currentView = btn.dataset.view;
      viewBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      renderRoms();
    });
  });

  // Selection bar buttons
  const selectAllBtn = document.getElementById('select-all-btn');
  const deselectAllBtn = document.getElementById('deselect-all-btn');
  const syncSelectedBtn = document.getElementById('sync-selected-btn');
  const scrapeSelectedBtn = document.getElementById('scrape-selected-btn');

  if (selectAllBtn) {
    selectAllBtn.addEventListener('click', () => {
      roms.forEach(rom => selectedRoms.add(rom.id));
      updateSelectionBar();
      renderRoms();
    });
  }

  if (deselectAllBtn) {
    deselectAllBtn.addEventListener('click', () => {
      selectedRoms.clear();
      updateSelectionBar();
      renderRoms();
    });
  }

  if (syncSelectedBtn) {
    syncSelectedBtn.addEventListener('click', () => {
      // Open sync modal with selected ROMs
      window.openSyncModalWithSelection(Array.from(selectedRoms));
    });
  }

  if (scrapeSelectedBtn) {
    scrapeSelectedBtn.addEventListener('click', async () => {
      if (selectedRoms.size === 0) {
        alert('No ROMs selected');
        return;
      }
      const confirmed = confirm(`Scrape artwork for ${selectedRoms.size} selected ROMs?`);
      if (confirmed) {
        await window.startBulkScrapeWithSelection(Array.from(selectedRoms));
      }
    });
  }

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
// Set up scan progress listener
window.electronAPI.onScanProgress((data) => {
  const { scannedFiles, foundRoms, currentFile, currentPath } = data;
  const progressText = `Scanning: ${foundRoms} ROMs found (${scannedFiles} files scanned)`;
  updateLoadingText(progressText);
});

function updateLoadingText(text) {
  const loadingTextEl = document.getElementById('loading-text');
  if (loadingTextEl) {
    loadingTextEl.textContent = text;
  }
}

async function handleImport() {
  // Show import options menu
  const choice = confirm('Click OK to import a folder of ROMs, or Cancel to select individual ROM files.');

  if (choice) {
    // Import folder
    const folderPath = await window.electronAPI.selectFolder();

    if (folderPath) {
      showLoading('Starting scan...');
      const result = await window.electronAPI.scanRoms(folderPath);
      hideLoading();

      if (result.success) {
        const message = `Successfully imported ${result.count} ROMs!\n\n` +
          `Files scanned: ${result.scannedFiles}\n` +
          `ROMs found: ${result.count + (result.duplicates || 0)}\n` +
          `Duplicates skipped: ${result.duplicates || 0}\n` +
          `Time: ${result.duration || '?'}s`;
        alert(message);
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

// Load Devices
async function loadDevices() {
  const devicesList = document.getElementById('devices-list');

  try {
    const devices = await window.electronAPI.getDeviceStatus();

    if (devices.length === 0) {
      devicesList.innerHTML = '<li style="padding: 8px 12px; font-size: 11px; color: #666;">No devices configured</li>';
      return;
    }

    devicesList.innerHTML = devices
      .map(device => `
        <li class="device-item">
          <div class="device-status ${device.connected ? 'connected' : 'disconnected'}"></div>
          <div class="device-info">
            <div class="device-name">${device.name}</div>
            <div class="device-path">${device.connected ? device.path : 'Not connected'}</div>
          </div>
        </li>
      `)
      .join('');
  } catch (error) {
    console.error('Error loading devices:', error);
    devicesList.innerHTML = '<li style="padding: 8px 12px; font-size: 11px; color: #ef4444;">Error loading devices</li>';
  }
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

    const isSelected = selectedRoms.has(rom.id);
    const syncStatus = rom.synced ? 'synced' : 'not-synced';
    const syncLabel = rom.synced ? '✓ Synced' : 'Not Synced';

    card.innerHTML = `
      <input type="checkbox" class="rom-checkbox" data-id="${rom.id}" ${isSelected ? 'checked' : ''} />
      <div class="rom-cover">
        ${coverContent}
        <div class="rom-sync-status ${syncStatus}">${syncLabel}</div>
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

    // Add checkbox toggle
    const checkbox = card.querySelector('.rom-checkbox');
    checkbox.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleRomSelection(rom.id);
    });

    // Add favorite toggle
    const favoriteBtn = card.querySelector('.rom-favorite');
    favoriteBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      await toggleFavorite(rom.id, !rom.favorite);
    });

    // Add click handler to open detail modal
    card.addEventListener('click', (e) => {
      // Don't open modal if clicking checkbox or favorite
      if (e.target.classList.contains('rom-checkbox') || e.target.classList.contains('rom-favorite')) {
        return;
      }
      console.log('ROM card clicked:', rom.name);
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

// Render List View - iTunes-style Table
function renderListView() {
  const list = document.createElement('div');
  list.className = 'rom-list';

  // Create table header
  const header = document.createElement('div');
  header.className = 'rom-table-header';

  const columns = [
    { key: null, label: '', isCheckbox: true },  // Checkbox column
    { key: null, label: '' },  // Favorite star column (not sortable)
    { key: null, label: '' },  // Artwork column (not sortable)
    { key: 'name', label: 'Name' },
    { key: 'system', label: 'System' },
    { key: 'extension', label: 'Type' },
    { key: 'size', label: 'Size' },
    { key: 'synced', label: 'Sync Status' },
    { key: 'dateAdded', label: 'Date Added' }
  ];

  columns.forEach(column => {
    const cell = document.createElement('div');
    cell.className = 'rom-table-header-cell';

    if (column.isCheckbox) {
      // Add select-all checkbox
      const selectAllCheckbox = document.createElement('input');
      selectAllCheckbox.type = 'checkbox';
      selectAllCheckbox.className = 'rom-row-checkbox';
      selectAllCheckbox.id = 'select-all-checkbox';
      selectAllCheckbox.checked = selectedRoms.size === roms.length && roms.length > 0;
      selectAllCheckbox.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleSelectAll();
      });
      cell.appendChild(selectAllCheckbox);
    } else {
      cell.textContent = column.label;

      if (column.key) {
        cell.classList.add('sortable');

        // Add sorted indicator if this is the current sort column
        if (currentFilter.sortBy === column.key) {
          cell.classList.add(currentFilter.sortOrder === 'ASC' ? 'sorted-asc' : 'sorted-desc');
        }

        // Add click handler for sorting
        cell.addEventListener('click', () => {
          handleColumnSort(column.key);
        });
      }
    }

    header.appendChild(cell);
  });

  list.appendChild(header);

  // Create table body
  const body = document.createElement('div');
  body.className = 'rom-table-body';

  roms.forEach(rom => {
    const row = document.createElement('div');
    row.className = 'rom-row';

    // Check for artwork
    const artworkPath = rom.boxart ? `file://${rom.boxart}` : null;
    const artworkContent = artworkPath
      ? `<img src="${artworkPath}" alt="${rom.name}" />`
      : getSystemIcon(rom.system);

    // Format date
    const dateAdded = rom.dateAdded
      ? new Date(rom.dateAdded).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
      : '—';

    const isSelected = selectedRoms.has(rom.id);
    if (isSelected) {
      row.classList.add('selected');
    }

    const syncStatus = rom.synced ? 'synced' : 'not-synced';
    const syncLabel = rom.synced ? '✓ Synced' : 'Not Synced';

    row.innerHTML = `
      <div class="rom-row-checkbox-cell">
        <input type="checkbox" class="rom-row-checkbox" data-id="${rom.id}" ${isSelected ? 'checked' : ''} />
      </div>
      <div class="rom-row-favorite ${rom.favorite ? 'active' : ''}" data-id="${rom.id}">
        ${rom.favorite ? '⭐' : '☆'}
      </div>
      <div class="rom-row-artwork">
        ${artworkContent}
      </div>
      <div class="rom-row-name" title="${rom.name}">${rom.name}</div>
      <div class="rom-row-system" title="${rom.system}">${rom.system}</div>
      <div class="rom-row-extension">${rom.extension || '—'}</div>
      <div class="rom-row-size">${formatBytes(rom.size)}</div>
      <div class="rom-row-sync-status ${syncStatus}">${syncLabel}</div>
      <div class="rom-row-date">${dateAdded}</div>
    `;

    // Add checkbox toggle
    const checkbox = row.querySelector('.rom-row-checkbox');
    checkbox.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleRomSelection(rom.id);
    });

    // Add favorite toggle
    const favoriteBtn = row.querySelector('.rom-row-favorite');
    favoriteBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      await toggleFavorite(rom.id, !rom.favorite);
    });

    // Add click handler to open detail modal
    row.addEventListener('click', (e) => {
      // Don't open modal if clicking checkbox or favorite
      if (e.target.classList.contains('rom-row-checkbox') || e.target.classList.contains('rom-row-favorite')) {
        return;
      }
      console.log('ROM row clicked:', rom.name);
      openRomDetail(rom);
    });

    body.appendChild(row);
  });

  list.appendChild(body);

  romContainer.innerHTML = '';
  romContainer.appendChild(list);
  console.log(`Rendered ${roms.length} ROMs in list view`);
}

// Handle column sorting in table view
function handleColumnSort(columnKey) {
  // If clicking the same column, toggle sort order
  if (currentFilter.sortBy === columnKey) {
    currentFilter.sortOrder = currentFilter.sortOrder === 'ASC' ? 'DESC' : 'ASC';
  } else {
    // New column, default to ascending
    currentFilter.sortBy = columnKey;
    currentFilter.sortOrder = 'ASC';
  }

  // Reload with new sort
  loadRoms();
}

// Toggle Favorite
async function toggleFavorite(id, favorite) {
  await window.electronAPI.updateRom(id, { favorite: favorite ? 1 : 0 });
  await loadRoms();
  await updateStats();
}

// Toggle ROM Selection
function toggleRomSelection(id) {
  if (selectedRoms.has(id)) {
    selectedRoms.delete(id);
  } else {
    selectedRoms.add(id);
  }
  updateSelectionBar();
  renderRoms(); // Re-render to update checkboxes
}

// Toggle Select All
function toggleSelectAll() {
  if (selectedRoms.size === roms.length) {
    // Deselect all
    selectedRoms.clear();
  } else {
    // Select all
    selectedRoms.clear();
    roms.forEach(rom => selectedRoms.add(rom.id));
  }
  updateSelectionBar();
  renderRoms(); // Re-render to update checkboxes
}

// Update Selection Bar
function updateSelectionBar() {
  const selectionBar = document.getElementById('selection-bar');
  const selectionCount = document.getElementById('selection-count');

  if (selectedRoms.size > 0) {
    selectionBar.style.display = 'flex';
    selectionCount.textContent = selectedRoms.size;
  } else {
    selectionBar.style.display = 'none';
  }
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

// Show in Folder button
const showRomLocationBtn = document.getElementById('show-rom-location');
showRomLocationBtn.addEventListener('click', async () => {
  if (currentRom && currentRom.path) {
    const result = await window.electronAPI.showItemInFolder(currentRom.path);
    if (!result.success) {
      alert(`Could not show file location: ${result.error}`);
    }
  }
});

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

  // Load and display saves
  await loadRomSaves(rom.id);

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

async function loadRomSaves(romId) {
  const savesList = document.getElementById('detail-saves-list');
  const saves = await window.electronAPI.getSaves(romId);

  if (!saves || saves.length === 0) {
    savesList.innerHTML = '<div class="saves-empty">No save files found</div>';
    return;
  }

  savesList.innerHTML = saves
    .map(save => {
      const fileSize = save.size ? formatBytes(save.size) : '—';
      const lastModified = save.lastModified
        ? new Date(save.lastModified).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          })
        : '—';

      const saveType = getSaveType(save.filename);

      return `
        <div class="save-item">
          <div class="save-info">
            <div class="save-filename" title="${save.filename}">${save.filename}</div>
            <div class="save-meta">${saveType} • ${fileSize} • ${lastModified}</div>
          </div>
          <div class="save-actions">
            <button class="btn-small btn-danger" onclick="deleteSaveFile(${save.id})">Delete</button>
          </div>
        </div>
      `;
    })
    .join('');
}

function getSaveType(filename) {
  const ext = filename.split('.').pop().toLowerCase();
  const types = {
    'sav': 'SRAM Save',
    'srm': 'SRAM Save',
    'eep': 'EEPROM Save',
    'fla': 'Flash Save',
    'state': 'Save State',
    'st0': 'Save State',
    'st1': 'Save State',
    'st2': 'Save State',
    'st3': 'Save State',
    'st4': 'Save State',
    'st5': 'Save State',
    'st6': 'Save State',
    'st7': 'Save State',
    'st8': 'Save State',
    'st9': 'Save State'
  };
  return types[ext] || 'Save File';
}

async function deleteSaveFile(saveId) {
  const confirmed = confirm('Are you sure you want to delete this save file?\n\nThis action cannot be undone!');

  if (confirmed) {
    showLoading('Deleting save file...');
    const result = await window.electronAPI.deleteSave(saveId);
    hideLoading();

    if (result.success) {
      // Reload saves for current ROM
      if (currentRom) {
        await loadRomSaves(currentRom.id);
      }
    } else {
      alert(`Error deleting save: ${result.error}`);
    }
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

// Manage Folders Modal
const manageFoldersBtn = document.getElementById('manage-folders-btn');
const manageFoldersModal = document.getElementById('manage-folders-modal');
const manageFoldersClose = document.getElementById('manage-folders-close');
const manageFoldersCancel = document.getElementById('manage-folders-cancel');
const foldersContainer = document.getElementById('folders-container');

if (manageFoldersBtn) {
  manageFoldersBtn.addEventListener('click', openManageFoldersModal);
}
if (manageFoldersClose) {
  manageFoldersClose.addEventListener('click', closeManageFoldersModal);
}
if (manageFoldersCancel) {
  manageFoldersCancel.addEventListener('click', closeManageFoldersModal);
}

async function openManageFoldersModal() {
  manageFoldersModal.classList.add('active');
  await loadIndexedFolders();
}

function closeManageFoldersModal() {
  manageFoldersModal.classList.remove('active');
}

async function loadIndexedFolders() {
  foldersContainer.innerHTML = '<div style="text-align: center; padding: 40px; color: #666;">Loading...</div>';

  const folders = await window.electronAPI.getIndexedFolders();

  if (folders.length === 0) {
    foldersContainer.innerHTML = '<div style="text-align: center; padding: 40px; color: #666;">No indexed folders found</div>';
    return;
  }

  foldersContainer.innerHTML = folders.map(folder => `
    <div class="folder-item">
      <div class="folder-info">
        <div class="folder-path" title="${folder.path}">${folder.path}</div>
        <div class="folder-meta">${folder.count} ROM${folder.count !== 1 ? 's' : ''} • ${formatBytes(folder.size)}</div>
      </div>
      <div class="folder-actions">
        <button class="btn-small btn-secondary" onclick="showFolderInExplorer('${folder.path.replace(/'/g, "\\'")}')">
          📁 Show
        </button>
        <button class="btn-small btn-danger" onclick="removeFolder('${folder.path.replace(/'/g, "\\'")}')">
          Remove
        </button>
      </div>
    </div>
  `).join('');
}

async function showFolderInExplorer(folderPath) {
  await window.electronAPI.openPath(folderPath);
}

async function removeFolder(folderPath) {
  const confirmed = confirm(
    `Remove all ROMs from this folder?\n\n` +
    `Folder: ${folderPath}\n\n` +
    `This only removes them from RomTunes - the files will remain on your disk.`
  );

  if (confirmed) {
    showLoading('Removing ROMs...');
    const result = await window.electronAPI.deleteRomsByFolder(folderPath);
    hideLoading();

    if (result.success) {
      alert(`Successfully removed ${result.count} ROM${result.count !== 1 ? 's' : ''} from library.`);
      await loadIndexedFolders();
      await loadRoms();
      await loadSystems();
      await updateStats();
    } else {
      alert(`Error removing ROMs: ${result.error}`);
    }
  }
}

// Initialize the app
init();
