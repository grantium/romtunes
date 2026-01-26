// Settings Modal Management
let currentSettings = {};
let syncProfiles = [];
let isScraping = false;
let syncRomIds = null; // Track ROM IDs to sync (null = all ROMs)

// DOM Elements
const settingsBtn = document.getElementById('settings-btn');
const settingsModal = document.getElementById('settings-modal');
const settingsClose = document.getElementById('settings-close');
const settingsCancel = document.getElementById('settings-cancel');
const settingsSave = document.getElementById('settings-save');
const profilesContainer = document.getElementById('profiles-container');
const scrapeArtworkBtn = document.getElementById('scrape-artwork-btn');

const syncBtn = document.getElementById('sync-btn');
const syncModal = document.getElementById('sync-modal');
const syncClose = document.getElementById('sync-close');
const syncCancel = document.getElementById('sync-cancel');
const syncStart = document.getElementById('sync-start');
const syncProfileSelect = document.getElementById('sync-profile-select');
const syncProgressContainer = document.getElementById('sync-progress-container');
const syncProgressBar = document.getElementById('sync-progress-bar');
const syncProgressText = document.getElementById('sync-progress-text');
const syncStatus = document.getElementById('sync-status');

// Import from Device Modal
const importDeviceBtn = document.getElementById('import-from-device-btn');
const importDeviceModal = document.getElementById('import-device-modal');
const importDeviceClose = document.getElementById('import-device-close');
const importDeviceCancel = document.getElementById('import-device-cancel');
const importDeviceStart = document.getElementById('import-device-start');
const importDeviceStatus = document.getElementById('import-device-status');
const importDeviceResults = document.getElementById('import-device-results');
const importSummary = document.getElementById('import-summary');
const importRomsContainer = document.getElementById('import-roms-container');
const importSelectAll = document.getElementById('import-select-all');
const importDeselectAll = document.getElementById('import-deselect-all');

let foundRoms = [];
let selectedImportRoms = new Set();

// Tab Management
const tabBtns = document.querySelectorAll('.tab-btn');
const tabContents = document.querySelectorAll('.tab-content');

// Initialize
async function initSettings() {
  await loadSettings();
  setupSettingsListeners();
}

// Setup Event Listeners
function setupSettingsListeners() {
  settingsBtn.addEventListener('click', openSettings);
  settingsClose.addEventListener('click', closeSettings);
  settingsCancel.addEventListener('click', closeSettings);
  settingsSave.addEventListener('click', saveSettings);

  syncBtn.addEventListener('click', openSyncModal);
  syncClose.addEventListener('click', closeSyncModal);
  syncCancel.addEventListener('click', closeSyncModal);
  syncStart.addEventListener('click', startSync);

  // Update sync stats when profile changes
  if (syncProfileSelect) {
    syncProfileSelect.addEventListener('change', async () => {
      const profileId = syncProfileSelect.value;
      if (profileId) {
        await loadSyncStats(profileId);
      }
    });
  }

  // Verify sync status
  const verifySyncBtn = document.getElementById('verify-sync-status-btn');
  if (verifySyncBtn) {
    verifySyncBtn.addEventListener('click', startVerifySyncStatus);
  }

  // Import from device
  if (importDeviceBtn) {
    importDeviceBtn.addEventListener('click', openImportDeviceModal);
  }
  if (importDeviceClose) {
    importDeviceClose.addEventListener('click', closeImportDeviceModal);
  }
  if (importDeviceCancel) {
    importDeviceCancel.addEventListener('click', closeImportDeviceModal);
  }
  if (importDeviceStart) {
    importDeviceStart.addEventListener('click', startImport);
  }
  if (importSelectAll) {
    importSelectAll.addEventListener('click', () => {
      foundRoms.forEach(rom => selectedImportRoms.add(rom.path));
      renderImportRoms();
      updateImportButton();
    });
  }
  if (importDeselectAll) {
    importDeselectAll.addEventListener('click', () => {
      selectedImportRoms.clear();
      renderImportRoms();
      updateImportButton();
    });
  }

  // Scrape artwork from toolbar
  if (scrapeArtworkBtn) {
    scrapeArtworkBtn.addEventListener('click', startBulkScrape);
  }

  // Scraper provider selection
  const scraperProvider = document.getElementById('scraper-provider');
  if (scraperProvider) {
    scraperProvider.addEventListener('change', () => {
      updateScraperProviderUI(scraperProvider.value);
    });
  }

  // Tab switching
  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const tabName = btn.dataset.tab;
      switchTab(tabName);
    });
  });

  // Listen for sync progress
  window.electronAPI.onSyncProgress((progress) => {
    updateSyncProgress(progress);
  });

  // Scraper handlers
  const testScraperBtn = document.getElementById('test-scraper-btn');
  const bulkScrapeBtn = document.getElementById('bulk-scrape-btn');

  if (testScraperBtn) {
    testScraperBtn.addEventListener('click', testScraperConnection);
  }

  if (bulkScrapeBtn) {
    bulkScrapeBtn.addEventListener('click', startBulkScrape);
  }

  // Listen for scrape progress
  window.electronAPI.onScrapeProgress((progress) => {
    updateScrapeProgress(progress);
  });
}

function switchTab(tabName) {
  tabBtns.forEach(btn => {
    if (btn.dataset.tab === tabName) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });

  tabContents.forEach(content => {
    if (content.id === `${tabName}-tab`) {
      content.classList.add('active');
    } else {
      content.classList.remove('active');
    }
  });
}

async function loadSettings() {
  currentSettings = await window.electronAPI.getConfig();
  syncProfiles = await window.electronAPI.getSyncProfiles();
  renderProfiles();
  populateSyncProfileSelect();
  updateSyncStatusDisplay();
  loadScraperSettings();
  loadArtworkSettings();
}

function loadArtworkSettings() {
  const artworkConfig = currentSettings.artwork || {};
  const boxartPrefs = artworkConfig.boxartPreferences || {};

  const boxartStyle = document.getElementById('boxart-style');
  const boxartRegion = document.getElementById('boxart-region');
  const boxartDownloadAll = document.getElementById('boxart-download-all');
  const boxartAutoConvert = document.getElementById('boxart-auto-convert');

  if (boxartStyle) boxartStyle.value = boxartPrefs.preferredStyle || '2d';
  if (boxartRegion) boxartRegion.value = boxartPrefs.preferredRegion || 'us';
  if (boxartDownloadAll) boxartDownloadAll.checked = boxartPrefs.downloadAllVariants || false;
  if (boxartAutoConvert) boxartAutoConvert.checked = boxartPrefs.autoConvert !== false; // Default true
}

function loadScraperSettings() {
  const scraperConfig = currentSettings.scraper || {};

  const scraperEnabled = document.getElementById('scraper-enabled');
  const scraperProvider = document.getElementById('scraper-provider');
  const thegamesdbApiKey = document.getElementById('thegamesdb-apikey');
  const scraperUsername = document.getElementById('scraper-username');
  const scraperPassword = document.getElementById('scraper-password');
  const scraperBoxart = document.getElementById('scraper-boxart');
  const scraperScreenshot = document.getElementById('scraper-screenshot');
  const scraperBanner = document.getElementById('scraper-banner');
  const scraperFanart = document.getElementById('scraper-fanart');

  if (scraperEnabled) scraperEnabled.checked = scraperConfig.enabled || false;
  if (scraperProvider) {
    scraperProvider.value = scraperConfig.provider || 'thegamesdb';
    updateScraperProviderUI(scraperProvider.value);
  }

  // Load TheGamesDB API key
  if (thegamesdbApiKey) {
    const thegamesdbConfig = scraperConfig.thegamesdb || {};
    thegamesdbApiKey.value = thegamesdbConfig.apiKey || '';
  }

  // Load ScreenScraper credentials
  if (scraperUsername) scraperUsername.value = scraperConfig.credentials?.username || '';
  if (scraperPassword) scraperPassword.value = scraperConfig.credentials?.password || '';

  const artworkTypes = scraperConfig.artworkTypes || ['boxart', 'screenshot'];
  if (scraperBoxart) scraperBoxart.checked = artworkTypes.includes('boxart');
  if (scraperScreenshot) scraperScreenshot.checked = artworkTypes.includes('screenshot');
  if (scraperBanner) scraperBanner.checked = artworkTypes.includes('banner');
  if (scraperFanart) scraperFanart.checked = artworkTypes.includes('fanart');
}

function updateScraperProviderUI(provider) {
  const thegamesdbSection = document.getElementById('thegamesdb-credentials');
  const screenscraperSection = document.getElementById('screenscraper-credentials');

  if (thegamesdbSection) {
    thegamesdbSection.style.display = provider === 'thegamesdb' ? 'block' : 'none';
  }
  if (screenscraperSection) {
    screenscraperSection.style.display = provider === 'screenscraper' ? 'block' : 'none';
  }
}

function renderProfiles() {
  profilesContainer.innerHTML = syncProfiles
    .map(
      profile => `
    <div class="profile-card" data-profile-id="${profile.id}">
      <div class="profile-header">
        <div class="profile-name">
          ${profile.name}
          ${profile.firmware ? `<span style="font-size: 11px; color: #888; margin-left: 8px;">(${profile.firmware})</span>` : ''}
        </div>
        <div class="profile-toggle">
          <span>Enabled</span>
          <label class="toggle-switch">
            <input type="checkbox" ${profile.enabled ? 'checked' : ''}
                   onchange="toggleProfile('${profile.id}', this.checked)">
            <span class="toggle-slider"></span>
          </label>
        </div>
      </div>

      <div class="profile-path">
        <label class="setting-label">Base Path</label>
        <div class="profile-path-input">
          <input type="text" class="setting-input"
                 value="${profile.basePath || ''}"
                 placeholder="Select folder..."
                 id="path-${profile.id}"
                 readonly />
          <button class="btn-small" onclick="selectBasePath('${profile.id}')">
            Browse
          </button>
        </div>
      </div>

      <details class="profile-artwork-settings" style="margin-top: 12px;">
        <summary style="cursor: pointer; font-size: 13px; color: #888; margin-bottom: 8px; user-select: none;">
          Artwork Settings
        </summary>
        <div class="artwork-settings-grid">
          <div class="setting-row">
            <label class="small-label">Artwork Folder:</label>
            <input type="text" class="small-input"
                   value="${profile.artworkSettings?.folder || 'Imgs'}"
                   placeholder="Imgs"
                   onchange="updateArtworkSetting('${profile.id}', 'folder', this.value)" />
          </div>

          <div class="setting-row">
            <label class="small-label">Dimensions:</label>
            <div style="display: flex; gap: 4px; align-items: center;">
              <input type="number" class="small-input"
                     value="${profile.artworkSettings?.dimensions?.width || 251}"
                     onchange="updateArtworkSetting('${profile.id}', 'width', parseInt(this.value))"
                     style="width: 70px;" />
              <span style="color: #666;">×</span>
              <input type="number" class="small-input"
                     value="${profile.artworkSettings?.dimensions?.height || 361}"
                     onchange="updateArtworkSetting('${profile.id}', 'height', parseInt(this.value))"
                     style="width: 70px;" />
            </div>
          </div>

          <div class="setting-row">
            <label class="small-label">Format:</label>
            <select class="small-select"
                    onchange="updateArtworkSetting('${profile.id}', 'format', this.value)">
              <option value="png" ${profile.artworkSettings?.format === 'png' ? 'selected' : ''}>PNG</option>
              <option value="jpg" ${profile.artworkSettings?.format === 'jpg' ? 'selected' : ''}>JPG</option>
            </select>
          </div>

          <div class="setting-row">
            <label class="small-label">Preferred Style:</label>
            <select class="small-select"
                    onchange="updateArtworkSetting('${profile.id}', 'preferredType', this.value)">
              <option value="2d" ${profile.artworkSettings?.preferredType === '2d' ? 'selected' : ''}>2D (Flat)</option>
              <option value="3d" ${profile.artworkSettings?.preferredType === '3d' ? 'selected' : ''}>3D (Perspective)</option>
            </select>
          </div>

          <div class="setting-row">
            <label class="small-label">Preferred Region:</label>
            <select class="small-select"
                    onchange="updateArtworkSetting('${profile.id}', 'preferredRegion', this.value)">
              <option value="us" ${profile.artworkSettings?.preferredRegion === 'us' ? 'selected' : ''}>US</option>
              <option value="eu" ${profile.artworkSettings?.preferredRegion === 'eu' ? 'selected' : ''}>EU</option>
              <option value="jp" ${profile.artworkSettings?.preferredRegion === 'jp' ? 'selected' : ''}>JP</option>
              <option value="wor" ${profile.artworkSettings?.preferredRegion === 'wor' ? 'selected' : ''}>World</option>
            </select>
          </div>
        </div>
      </details>

      <details class="profile-mappings">
        <summary>System Folder Mappings (${Object.keys(profile.systemMappings || {}).length})</summary>
        <div class="mapping-list">
          ${Object.entries(profile.systemMappings || {})
            .map(
              ([system, folder]) => `
            <div class="mapping-item">
              <span class="mapping-system" title="${system}">${system}</span>
              <input type="text"
                     class="mapping-folder-input"
                     value="${folder}"
                     data-profile="${profile.id}"
                     data-system="${system}"
                     placeholder="Folder path (e.g., roms/NES)"/>
              <button class="btn-small btn-danger"
                      onclick="removeMapping('${profile.id}', '${system}')"
                      title="Remove mapping">✕</button>
            </div>
          `
            )
            .join('')}
          <div class="mapping-add">
            <button class="btn-small" onclick="showAddMappingDialog('${profile.id}')">
              + Add System Mapping
            </button>
          </div>
        </div>
      </details>
    </div>
  `
    )
    .join('');

  // Setup listeners for mapping inputs after rendering
  setTimeout(() => setupMappingListeners(), 100);
}

async function toggleProfile(profileId, enabled) {
  await window.electronAPI.updateSyncProfile(profileId, { enabled });
  const profile = syncProfiles.find(p => p.id === profileId);
  if (profile) {
    profile.enabled = enabled;
  }
  populateSyncProfileSelect();
}

async function selectBasePath(profileId) {
  const folderPath = await window.electronAPI.selectFolder();

  if (folderPath) {
    await window.electronAPI.updateSyncProfile(profileId, { basePath: folderPath });
    const profile = syncProfiles.find(p => p.id === profileId);
    if (profile) {
      profile.basePath = folderPath;
    }
    document.getElementById(`path-${profileId}`).value = folderPath;
  }
}

function populateSyncProfileSelect() {
  const enabledProfiles = syncProfiles.filter(p => p.enabled && p.basePath);

  syncProfileSelect.innerHTML = enabledProfiles.length
    ? enabledProfiles
        .map(
          p => `
      <option value="${p.id}">${p.name} (${p.basePath})</option>
    `
        )
        .join('')
    : '<option value="">No enabled profiles</option>';

  syncBtn.disabled = enabledProfiles.length === 0;
}

async function updateSyncStatusDisplay() {
  const status = await window.electronAPI.getSyncStatus();
  syncStatus.innerHTML = `
    <strong>Sync Status:</strong><br/>
    ${status.synced} of ${status.total} ROMs synced
    ${status.unsynced > 0 ? `<br/><span style="color: #f39c12">${status.unsynced} ROMs need syncing</span>` : ''}
  `;
}

function openSettings() {
  loadSettings();
  settingsModal.classList.add('active');
}

function closeSettings() {
  settingsModal.classList.remove('active');
}

async function saveSettings() {
  // Save artwork settings
  const artworkEnabled = document.getElementById('artwork-enabled').checked;
  const artworkDefaultType = document.getElementById('artwork-default-type').value;

  await window.electronAPI.setConfig('artwork.enabled', artworkEnabled);
  await window.electronAPI.setConfig('artwork.defaultType', artworkDefaultType);

  // Save boxart preferences
  const boxartStyle = document.getElementById('boxart-style')?.value || '2d';
  const boxartRegion = document.getElementById('boxart-region')?.value || 'us';
  const boxartDownloadAll = document.getElementById('boxart-download-all')?.checked || false;
  const boxartAutoConvert = document.getElementById('boxart-auto-convert')?.checked !== false;

  await window.electronAPI.setConfig('artwork.boxartPreferences', {
    preferredStyle: boxartStyle,
    preferredRegion: boxartRegion,
    fallbackRegions: ['wor', 'us', 'eu', 'jp'],
    downloadAllVariants: boxartDownloadAll,
    autoConvert: boxartAutoConvert
  });

  // Save scraper settings
  const scraperEnabled = document.getElementById('scraper-enabled').checked;
  const scraperProvider = document.getElementById('scraper-provider').value;
  const thegamesdbApiKey = document.getElementById('thegamesdb-apikey').value;
  const scraperUsername = document.getElementById('scraper-username').value;
  const scraperPassword = document.getElementById('scraper-password').value;

  const artworkTypes = [];
  if (document.getElementById('scraper-boxart').checked) artworkTypes.push('boxart');
  if (document.getElementById('scraper-screenshot').checked) artworkTypes.push('screenshot');
  if (document.getElementById('scraper-banner').checked) artworkTypes.push('banner');
  if (document.getElementById('scraper-fanart').checked) artworkTypes.push('fanart');

  await window.electronAPI.setConfig('scraper.enabled', scraperEnabled);
  await window.electronAPI.setConfig('scraper.provider', scraperProvider);
  await window.electronAPI.setConfig('scraper.thegamesdb', {
    apiKey: thegamesdbApiKey
  });
  await window.electronAPI.setConfig('scraper.credentials', {
    username: scraperUsername,
    password: scraperPassword
  });
  await window.electronAPI.setConfig('scraper.artworkTypes', artworkTypes);

  closeSettings();
  alert('Settings saved successfully!');
}

async function openSyncModal(romIds = null) {
  syncRomIds = romIds;
  updateSyncStatusDisplay();

  // Update modal text to show if syncing selection
  const modalHeader = syncModal.querySelector('.modal-header h2');
  if (romIds && romIds.length > 0) {
    modalHeader.textContent = `Sync ${romIds.length} Selected ROM${romIds.length > 1 ? 's' : ''} to Device`;
  } else {
    modalHeader.textContent = 'Sync ROMs to Device';
  }

  // Load sync stats for the selected profile
  const profileId = syncProfileSelect.value;
  if (profileId) {
    await loadSyncStats(profileId);
  }

  syncModal.classList.add('active');
}

function closeSyncModal() {
  syncModal.classList.remove('active');
  syncProgressContainer.style.display = 'none';
  syncProgressBar.style.width = '0%';
  syncRomIds = null; // Reset
}

// Expose function to open sync modal with selection (called from renderer.js)
window.openSyncModalWithSelection = function(romIds) {
  openSyncModal(romIds);
};

async function startSync() {
  const profileId = syncProfileSelect.value;

  if (!profileId) {
    alert('Please select a profile');
    return;
  }

  const syncArtwork = document.getElementById('sync-artwork-check').checked;
  const syncSaves = document.getElementById('sync-saves-check').checked;

  // Verify profile first
  const verification = await window.electronAPI.verifySync(profileId);

  if (!verification.valid) {
    alert(`Cannot sync: ${verification.message}`);
    return;
  }

  // Disable buttons during sync
  syncStart.disabled = true;
  syncCancel.disabled = true;
  syncProgressContainer.style.display = 'block';

  // Clear progress log
  const progressLog = document.getElementById('sync-progress-log');
  if (progressLog) {
    progressLog.innerHTML = '';
  }

  try {
    // Sync ROMs (pass selected ROM IDs and options)
    const options = { syncSaves };
    const result = await window.electronAPI.syncRoms(profileId, syncRomIds, options);

    if (result.errors.length > 0) {
      console.error('Sync errors:', result.errors);
    }

    // Sync artwork if requested
    if (syncArtwork) {
      syncProgressText.textContent = 'Syncing artwork...';
      await window.electronAPI.syncArtwork(profileId, syncRomIds, ['boxart', 'screenshot']);
    }

    // Success
    syncProgressBar.style.width = '100%';
    let statusText = `Sync complete! ${result.synced} ROMs synced, ${result.skipped} skipped`;

    if (result.saves && (result.saves.copied > 0 || result.saves.skipped > 0)) {
      statusText += `\nSave files: ${result.saves.copied} synced, ${result.saves.skipped} skipped`;
    }

    if (result.errors.length > 0) {
      statusText += ` (${result.errors.length} ROM errors)`;
    }

    if (result.saves && result.saves.errors.length > 0) {
      statusText += ` (${result.saves.errors.length} save errors)`;
    }

    syncProgressText.textContent = statusText;

    // Show helpful message if provided
    if (result.message) {
      syncProgressText.textContent += `\n${result.message}`;
    }

    // Update stats and reload ROMs to show updated sync badges
    await updateSyncStatusDisplay();
    if (window.loadSaves) {
      await window.loadSaves();
    }
    if (window.updateStats) {
      await window.updateStats();
    }
    if (window.loadRoms) {
      await window.loadRoms();
    }

    setTimeout(() => {
      closeSyncModal();
      syncStart.disabled = false;
      syncCancel.disabled = false;
    }, 2000);
  } catch (error) {
    alert(`Sync failed: ${error.message}`);
    syncStart.disabled = false;
    syncCancel.disabled = false;
  }
}

async function startVerifySyncStatus() {
  const profileId = syncProfileSelect.value;

  if (!profileId) {
    alert('Please select a profile');
    return;
  }

  // Verify profile first
  const verification = await window.electronAPI.verifySync(profileId);

  if (!verification.valid) {
    alert(`Cannot verify: ${verification.message}`);
    return;
  }

  const verifySyncBtn = document.getElementById('verify-sync-status-btn');
  const originalText = verifySyncBtn.textContent;

  // Disable button and show progress
  verifySyncBtn.disabled = true;
  verifySyncBtn.textContent = 'Verifying...';
  syncProgressContainer.style.display = 'block';
  syncProgressText.textContent = 'Starting verification...';
  syncProgressBar.style.width = '0%';

  // Clear progress log
  const progressLog = document.getElementById('sync-progress-log');
  if (progressLog) {
    progressLog.innerHTML = '';
  }

  try {
    // Listen for progress updates
    window.electronAPI.onVerifyProgress((progress) => {
      updateVerifyProgress(progress);
    });

    const result = await window.electronAPI.verifySyncStatus(profileId);

    // Success
    syncProgressBar.style.width = '100%';
    let statusText = `Verification complete!\n${result.synced} ROMs on device, ${result.notOnDevice} not on device`;

    if (result.missingFiles > 0) {
      statusText += `\n${result.missingFiles} missing file${result.missingFiles > 1 ? 's' : ''} removed from library`;
    }

    if (result.errors.length > 0) {
      statusText += ` (${result.errors.length} errors)`;
    }

    syncProgressText.textContent = statusText;

    // Update stats and reload ROMs to show updated badges
    await updateSyncStatusDisplay();
    if (window.loadSaves) {
      await window.loadSaves();
    }
    if (window.updateStats) {
      await window.updateStats();
    }
    if (window.loadRoms) {
      await window.loadRoms();
    }

    setTimeout(() => {
      syncProgressContainer.style.display = 'none';
      verifySyncBtn.disabled = false;
      verifySyncBtn.textContent = originalText;
    }, 2000);
  } catch (error) {
    alert(`Verification failed: ${error.message}`);
    syncProgressContainer.style.display = 'none';
    verifySyncBtn.disabled = false;
    verifySyncBtn.textContent = originalText;
  } finally {
    // Clean up listener
    window.electronAPI.removeVerifyProgressListener();
  }
}

function updateVerifyProgress(progress) {
  const percent = (progress.current / progress.total) * 100;
  syncProgressBar.style.width = `${percent}%`;
  syncProgressText.textContent = `Verifying... (${progress.current}/${progress.total})`;

  // Add to progress log
  const progressLog = document.getElementById('sync-progress-log');
  if (progressLog) {
    const entry = document.createElement('div');
    entry.className = `sync-log-entry ${progress.status}`;

    const statusIcon = {
      synced: '✓',
      not_on_device: '✗',
      removed: '🗑',
      error: '⚠'
    }[progress.status] || '•';

    let text = `${statusIcon} ${progress.rom}`;
    if (progress.devicePath) {
      text += ` → ${progress.devicePath}`;
    }
    if (progress.reason) {
      text += ` (${progress.reason})`;
    }
    if (progress.error) {
      text += ` (${progress.error})`;
    }

    entry.textContent = text;

    // Keep only last 20 entries
    while (progressLog.children.length >= 20) {
      progressLog.removeChild(progressLog.firstChild);
    }

    progressLog.appendChild(entry);
    progressLog.scrollTop = progressLog.scrollHeight;
  }
}

function updateSyncProgress(progress) {
  const percent = (progress.current / progress.total) * 100;
  syncProgressBar.style.width = `${percent}%`;
  syncProgressText.textContent = `Syncing... (${progress.current}/${progress.total})`;

  // Add to progress log
  const progressLog = document.getElementById('sync-progress-log');
  if (progressLog) {
    const entry = document.createElement('div');
    entry.className = `sync-log-entry ${progress.status}`;

    const statusIcon = {
      'copied': '✓',
      'skipped': '⊘',
      'error': '✗'
    }[progress.status] || '•';

    entry.textContent = `${statusIcon} ${progress.rom} → ${progress.targetPath}`;

    progressLog.appendChild(entry);
    // Auto-scroll to bottom
    progressLog.scrollTop = progressLog.scrollHeight;
  }
}

// Scraper Functions
async function testScraperConnection() {
  const resultSpan = document.getElementById('scraper-test-result');
  resultSpan.textContent = 'Testing...';
  resultSpan.style.color = '#888';

  // Save credentials first
  const username = document.getElementById('scraper-username').value;
  const password = document.getElementById('scraper-password').value;

  await window.electronAPI.setConfig('scraper.credentials', {
    username,
    password
  });

  const result = await window.electronAPI.testScraperCredentials();

  if (result.success) {
    resultSpan.textContent = '✓ Connection successful!';
    resultSpan.style.color = '#4caf50';
  } else {
    resultSpan.textContent = `✗ ${result.error}`;
    resultSpan.style.color = '#f44336';
  }
}

async function startBulkScrape() {
  if (isScraping) {
    alert('Scraping already in progress');
    return;
  }

  const confirmed = confirm(
    'This will scrape artwork for all ROMs that don\'t have box art.\n\n' +
    'ScreenScraper has rate limits (2 seconds per request), so this may take a while.\n\n' +
    'Continue?'
  );

  if (!confirmed) return;

  isScraping = true;
  const bulkScrapeBtn = document.getElementById('bulk-scrape-btn');
  bulkScrapeBtn.disabled = true;
  bulkScrapeBtn.textContent = 'Scraping...';

  const artworkTypes = [];
  if (document.getElementById('scraper-boxart').checked) artworkTypes.push('boxart');
  if (document.getElementById('scraper-screenshot').checked) artworkTypes.push('screenshot');
  if (document.getElementById('scraper-banner').checked) artworkTypes.push('banner');
  if (document.getElementById('scraper-fanart').checked) artworkTypes.push('fanart');

  try {
    const result = await window.electronAPI.bulkScrape(null, artworkTypes);

    alert(
      `Bulk scrape complete!\n\n` +
      `Scraped: ${result.scraped}\n` +
      `Skipped: ${result.skipped}\n` +
      `Failed: ${result.failed}`
    );

    await window.loadRoms();
    await window.updateStats();
  } catch (error) {
    alert(`Bulk scrape failed: ${error.message}`);
  } finally {
    isScraping = false;
    bulkScrapeBtn.disabled = false;
    bulkScrapeBtn.textContent = 'Scrape All ROMs';
  }
}

// Expose function to scrape selected ROMs (called from renderer.js)
window.startBulkScrapeWithSelection = async function(romIds) {
  if (isScraping) {
    alert('Scraping already in progress');
    return;
  }

  isScraping = true;
  const scrapeSelectedBtn = document.getElementById('scrape-selected-btn');
  if (scrapeSelectedBtn) {
    scrapeSelectedBtn.disabled = true;
    scrapeSelectedBtn.textContent = 'Scraping...';
  }

  const artworkTypes = [];
  if (document.getElementById('scraper-boxart').checked) artworkTypes.push('boxart');
  if (document.getElementById('scraper-screenshot').checked) artworkTypes.push('screenshot');
  if (document.getElementById('scraper-banner').checked) artworkTypes.push('banner');
  if (document.getElementById('scraper-fanart').checked) artworkTypes.push('fanart');

  try {
    const result = await window.electronAPI.bulkScrape(romIds, artworkTypes);

    alert(
      `Bulk scrape complete!\n\n` +
      `Scraped: ${result.scraped}\n` +
      `Failed: ${result.failed}\n` +
      `Skipped: ${result.skipped}\n` +
      `Total: ${result.total}`
    );

    // Reload ROMs to show new artwork
    if (typeof loadRoms === 'function') {
      await loadRoms();
    }
  } catch (error) {
    alert(`Bulk scrape failed: ${error.message}`);
  } finally {
    isScraping = false;
    bulkScrapeBtn.disabled = false;
    bulkScrapeBtn.textContent = 'Scrape All ROMs';
  }
}

function updateScrapeProgress(progress) {
  const bulkScrapeBtn = document.getElementById('bulk-scrape-btn');
  const scrapeArtworkBtn = document.getElementById('scrape-artwork-btn');

  const statusEmoji = {
    'success': '✓',
    'failed': '✗',
    'error': '✗',
    'skipped': '⊘'
  };

  const emoji = statusEmoji[progress.status] || '';
  const displayText = `${emoji} ${progress.current}/${progress.total}: ${progress.rom}`;
  const detailText = progress.message ? `\n${progress.message}` : '';

  console.log(`[Scrape Progress] ${displayText}${detailText}`);

  if (bulkScrapeBtn) {
    bulkScrapeBtn.textContent = `Scraping... (${progress.current}/${progress.total})`;
    bulkScrapeBtn.title = `${progress.rom}: ${progress.message || progress.status}`;
  }

  if (scrapeArtworkBtn) {
    scrapeArtworkBtn.textContent = `🎨 Scraping... (${progress.current}/${progress.total})`;
    scrapeArtworkBtn.title = `${progress.rom}: ${progress.message || progress.status}`;
  }
}

async function saveMapping(profileId, system, folder) {
  const profile = syncProfiles.find(p => p.id === profileId);
  if (profile) {
    profile.systemMappings[system] = folder;
    await window.electronAPI.updateSyncProfile(profileId, {
      systemMappings: profile.systemMappings
    });
  }
}

async function removeMapping(profileId, system) {
  const confirmed = confirm(`Remove ${system} mapping?`);
  if (!confirmed) return;

  const profile = syncProfiles.find(p => p.id === profileId);
  if (profile) {
    delete profile.systemMappings[system];
    await window.electronAPI.updateSyncProfile(profileId, {
      systemMappings: profile.systemMappings
    });
    renderProfiles();
  }
}

// Add System Mapping Modal
let currentMappingProfileId = null;
const addMappingModal = document.getElementById('add-mapping-modal');
const addMappingClose = document.getElementById('add-mapping-close');
const addMappingCancel = document.getElementById('add-mapping-cancel');
const addMappingSave = document.getElementById('add-mapping-save');
const mappingSystemSelect = document.getElementById('mapping-system-select');
const mappingFolderInput = document.getElementById('mapping-folder-input');

if (addMappingClose) {
  addMappingClose.addEventListener('click', closeAddMappingDialog);
}
if (addMappingCancel) {
  addMappingCancel.addEventListener('click', closeAddMappingDialog);
}
if (addMappingSave) {
  addMappingSave.addEventListener('click', saveNewMapping);
}

function showAddMappingDialog(profileId) {
  console.log('[Mapping] Opening add mapping dialog for profile:', profileId);
  currentMappingProfileId = profileId;

  // Reset form
  mappingSystemSelect.value = '';
  mappingFolderInput.value = '';

  // Show modal
  addMappingModal.classList.add('active');
}

function closeAddMappingDialog() {
  addMappingModal.classList.remove('active');
  currentMappingProfileId = null;
}

async function saveNewMapping() {
  const system = mappingSystemSelect.value;
  const folder = mappingFolderInput.value.trim();

  if (!system) {
    alert('Please select a system');
    return;
  }

  if (!folder) {
    alert('Please enter a folder path');
    return;
  }

  const profile = syncProfiles.find(p => p.id === currentMappingProfileId);
  if (profile) {
    console.log('[Mapping] Adding mapping:', system, '->', folder);

    if (!profile.systemMappings) {
      profile.systemMappings = {};
    }

    profile.systemMappings[system] = folder;

    await window.electronAPI.updateSyncProfile(currentMappingProfileId, {
      systemMappings: profile.systemMappings
    });

    closeAddMappingDialog();
    renderProfiles();
  }
}

// Auto-save mappings when inputs change
function setupMappingListeners() {
  const mappingInputs = document.querySelectorAll('.mapping-folder-input');
  mappingInputs.forEach(input => {
    let timeout;
    input.addEventListener('input', (e) => {
      clearTimeout(timeout);
      timeout = setTimeout(() => {
        const profileId = e.target.dataset.profile;
        const system = e.target.dataset.system;
        const folder = e.target.value;
        saveMapping(profileId, system, folder);
      }, 1000); // Save 1 second after user stops typing
    });
  });
}

async function updateArtworkSetting(profileId, setting, value) {
  const profile = syncProfiles.find(p => p.id === profileId);
  if (!profile) return;

  if (!profile.artworkSettings) {
    profile.artworkSettings = {
      enabled: true,
      folder: 'Imgs',
      dimensions: { width: 251, height: 361 },
      format: 'png',
      preferredType: '2d',
      preferredRegion: 'us'
    };
  }

  // Update the specific setting
  if (setting === 'width' || setting === 'height') {
    profile.artworkSettings.dimensions[setting] = value;
  } else {
    profile.artworkSettings[setting] = value;
  }

  // Save to config
  await window.electronAPI.updateSyncProfile(profileId, {
    artworkSettings: profile.artworkSettings
  });

  console.log(`Updated ${setting} for profile ${profileId}:`, value);
}

// Import from Device Modal
async function openImportDeviceModal() {
  const profileId = syncProfileSelect.value;

  if (!profileId) {
    alert('Please select a device profile first');
    return;
  }

  // Reset state
  foundRoms = [];
  selectedImportRoms.clear();

  // Show modal
  importDeviceModal.classList.add('active');
  importDeviceStatus.style.display = 'block';
  importDeviceResults.style.display = 'none';
  importDeviceStart.disabled = true;

  // Scan device
  try {
    const result = await window.electronAPI.scanDeviceForRoms(profileId);

    foundRoms = result.roms;

    if (foundRoms.length === 0) {
      importDeviceStatus.innerHTML = `
        <p style="color: #888;">No new ROMs found on device.</p>
        <p style="font-size: 12px; color: #666; margin-top: 8px;">
          All ROMs on this device are already in your library.
        </p>
      `;
    } else {
      // Show results
      importDeviceStatus.style.display = 'none';
      importDeviceResults.style.display = 'block';

      importSummary.innerHTML = `
        Found <strong>${foundRoms.length}</strong> ROM${foundRoms.length > 1 ? 's' : ''} on device that ${foundRoms.length > 1 ? 'are' : 'is'} not in your library.
      `;

      // Auto-select all
      foundRoms.forEach(rom => selectedImportRoms.add(rom.path));

      renderImportRoms();
      updateImportButton();
    }
  } catch (error) {
    importDeviceStatus.innerHTML = `
      <p style="color: #d9534f;">Error scanning device: ${error.message}</p>
    `;
  }
}

function closeImportDeviceModal() {
  importDeviceModal.classList.remove('active');
  foundRoms = [];
  selectedImportRoms.clear();
}

function renderImportRoms() {
  importRomsContainer.innerHTML = foundRoms.map(rom => {
    const isSelected = selectedImportRoms.has(rom.path);
    const sizeStr = formatBytes(rom.size);

    return `
      <div class="import-rom-item">
        <input type="checkbox"
               ${isSelected ? 'checked' : ''}
               onchange="toggleImportRom('${rom.path}')" />
        <div class="import-rom-info">
          <div class="import-rom-name">${rom.name}</div>
          <div class="import-rom-meta">${rom.system} • ${rom.extension}</div>
        </div>
        <div class="import-rom-size">${sizeStr}</div>
      </div>
    `;
  }).join('');
}

function toggleImportRom(romPath) {
  if (selectedImportRoms.has(romPath)) {
    selectedImportRoms.delete(romPath);
  } else {
    selectedImportRoms.add(romPath);
  }
  updateImportButton();
}

function updateImportButton() {
  importDeviceStart.disabled = selectedImportRoms.size === 0;
  importDeviceStart.textContent = `Import ${selectedImportRoms.size} ROM${selectedImportRoms.size !== 1 ? 's' : ''}`;
}

async function startImport() {
  const profileId = syncProfileSelect.value;
  const romPaths = Array.from(selectedImportRoms);

  if (romPaths.length === 0) {
    return;
  }

  // Disable button
  importDeviceStart.disabled = true;
  importDeviceStart.textContent = 'Importing...';

  try {
    const result = await window.electronAPI.importFromDevice(profileId, romPaths);

    alert(
      `Import complete!\n\n` +
      `Imported: ${result.imported}\n` +
      `Skipped: ${result.skipped}\n` +
      (result.errors.length > 0 ? `Errors: ${result.errors.length}` : '')
    );

    // Close modal and refresh library
    closeImportDeviceModal();

    // Refresh ROM list
    if (window.loadRoms) {
      await window.loadRoms();
    }
    if (window.updateStats) {
      await window.updateStats();
    }
  } catch (error) {
    alert(`Import failed: ${error.message}`);
    importDeviceStart.disabled = false;
    updateImportButton();
  }
}

function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Sync History Modal
const syncHistoryModal = document.getElementById('sync-history-modal');
const syncHistoryClose = document.getElementById('sync-history-close');
const syncHistoryCancel = document.getElementById('sync-history-cancel');
const viewSyncHistoryBtn = document.getElementById('view-sync-history-btn');
const clearHistoryBtn = document.getElementById('clear-history-btn');
const historyProfileFilter = document.getElementById('history-profile-filter');
const syncHistoryContainer = document.getElementById('sync-history-container');
const syncStatsContainer = document.getElementById('sync-stats-container');

// Setup sync history listeners
if (viewSyncHistoryBtn) {
  viewSyncHistoryBtn.addEventListener('click', openSyncHistoryModal);
}
if (syncHistoryClose) {
  syncHistoryClose.addEventListener('click', closeSyncHistoryModal);
}
if (syncHistoryCancel) {
  syncHistoryCancel.addEventListener('click', closeSyncHistoryModal);
}
if (clearHistoryBtn) {
  clearHistoryBtn.addEventListener('click', clearSyncHistory);
}
if (historyProfileFilter) {
  historyProfileFilter.addEventListener('change', loadSyncHistory);
}

async function openSyncHistoryModal() {
  syncHistoryModal.classList.add('active');

  // Populate profile filter
  await loadProfileFilter();

  // Load history
  await loadSyncHistory();
}

function closeSyncHistoryModal() {
  syncHistoryModal.classList.remove('active');
}

async function loadProfileFilter() {
  const profiles = await window.electronAPI.getSyncProfiles();

  historyProfileFilter.innerHTML = '<option value="all">All Profiles</option>';
  profiles.forEach(profile => {
    const option = document.createElement('option');
    option.value = profile.id;
    option.textContent = profile.name || profile.id;
    historyProfileFilter.appendChild(option);
  });
}

async function loadSyncHistory() {
  const profileId = historyProfileFilter.value === 'all' ? null : historyProfileFilter.value;
  const history = await window.electronAPI.getSyncHistory(50, profileId);

  if (history.length === 0) {
    syncHistoryContainer.innerHTML = `
      <div style="text-align: center; padding: 40px; color: #666;">
        No sync history found
      </div>
    `;
    return;
  }

  syncHistoryContainer.innerHTML = history.map(item => {
    const timestamp = new Date(item.timestamp).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    const duration = item.duration ? `${(item.duration / 1000).toFixed(1)}s` : '—';
    const statusClass = item.status || 'success';
    const statusLabel = item.status === 'partial' ? 'Partial Success' : item.status;

    return `
      <div class="history-item">
        <div class="history-header">
          <div class="history-title">${item.profileName || item.profileId}</div>
          <div style="display: flex; align-items: center; gap: 12px;">
            <span class="history-status ${statusClass}">${statusLabel}</span>
            <span class="history-timestamp">${timestamp}</span>
          </div>
        </div>
        <div class="history-stats">
          <div class="history-stat">
            <div class="history-stat-label">ROMs Synced</div>
            <div class="history-stat-value">${item.romsSynced || 0}</div>
          </div>
          <div class="history-stat">
            <div class="history-stat-label">ROMs Skipped</div>
            <div class="history-stat-value">${item.romsSkipped || 0}</div>
          </div>
          <div class="history-stat">
            <div class="history-stat-label">Saves Synced</div>
            <div class="history-stat-value">${item.savesCopied || 0}</div>
          </div>
          <div class="history-stat">
            <div class="history-stat-label">Errors</div>
            <div class="history-stat-value">${item.romsErrored || 0}</div>
          </div>
          <div class="history-stat">
            <div class="history-stat-label">Duration</div>
            <div class="history-stat-value">${duration}</div>
          </div>
          <div class="history-stat">
            <div class="history-stat-label">Data Synced</div>
            <div class="history-stat-value">${formatBytes(item.totalSize || 0)}</div>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

async function clearSyncHistory() {
  const confirmed = confirm('Are you sure you want to clear all sync history?\n\nThis action cannot be undone.');

  if (confirmed) {
    await window.electronAPI.clearSyncHistory();
    await loadSyncHistory();
  }
}

async function loadSyncStats(profileId) {
  if (!syncStatsContainer) return;

  try {
    const stats = await window.electronAPI.getSyncStats(profileId);
    const lastSync = await window.electronAPI.getLastSync(profileId);

    if (stats && stats.totalSyncs > 0) {
      syncStatsContainer.style.display = 'block';

      const lastSyncTime = lastSync ? new Date(lastSync.timestamp).toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      }) : 'Never';

      document.getElementById('sync-last-time').textContent = lastSyncTime;
      document.getElementById('sync-roms-count').textContent = stats.totalRomsSynced || 0;
      document.getElementById('sync-saves-count').textContent = stats.totalSavesCopied || 0;
    } else {
      syncStatsContainer.style.display = 'none';
    }
  } catch (error) {
    console.error('Failed to load sync stats:', error);
  }
}

// Make functions globally accessible
window.toggleProfile = toggleProfile;
window.selectBasePath = selectBasePath;
window.removeMapping = removeMapping;
window.showAddMappingDialog = showAddMappingDialog;
window.updateArtworkSetting = updateArtworkSetting;
window.toggleImportRom = toggleImportRom;

// Initialize on load
initSettings();
