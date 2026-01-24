// Settings Modal Management
let currentSettings = {};
let syncProfiles = [];
let isScraping = false;

// DOM Elements
const settingsBtn = document.getElementById('settings-btn');
const settingsModal = document.getElementById('settings-modal');
const settingsClose = document.getElementById('settings-close');
const settingsCancel = document.getElementById('settings-cancel');
const settingsSave = document.getElementById('settings-save');
const profilesContainer = document.getElementById('profiles-container');

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
  const scraperUsername = document.getElementById('scraper-username');
  const scraperPassword = document.getElementById('scraper-password');
  const scraperBoxart = document.getElementById('scraper-boxart');
  const scraperScreenshot = document.getElementById('scraper-screenshot');
  const scraperBanner = document.getElementById('scraper-banner');
  const scraperFanart = document.getElementById('scraper-fanart');

  if (scraperEnabled) scraperEnabled.checked = scraperConfig.enabled || false;
  if (scraperUsername) scraperUsername.value = scraperConfig.credentials?.username || '';
  if (scraperPassword) scraperPassword.value = scraperConfig.credentials?.password || '';

  const artworkTypes = scraperConfig.artworkTypes || ['boxart', 'screenshot'];
  if (scraperBoxart) scraperBoxart.checked = artworkTypes.includes('boxart');
  if (scraperScreenshot) scraperScreenshot.checked = artworkTypes.includes('screenshot');
  if (scraperBanner) scraperBanner.checked = artworkTypes.includes('banner');
  if (scraperFanart) scraperFanart.checked = artworkTypes.includes('fanart');
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

      ${profile.artworkSettings ? `
      <div style="font-size: 12px; color: #888; margin-top: 8px; padding: 8px; background: rgba(255,255,255,0.02); border-radius: 4px;">
        📦 Box Art: ${profile.artworkSettings.dimensions.width}x${profile.artworkSettings.dimensions.height} ${profile.artworkSettings.format.toUpperCase()}
        (${profile.artworkSettings.preferredType === '2d' ? '2D' : '3D'} style, ${profile.artworkSettings.preferredRegion.toUpperCase()} region)
      </div>
      ` : ''}

      <details class="profile-mappings">
        <summary>System Folder Mappings (${Object.keys(profile.systemMappings || {}).length})</summary>
        <div class="mapping-list">
          ${Object.entries(profile.systemMappings || {})
            .map(
              ([system, folder]) => `
            <div class="mapping-item">
              <span class="mapping-system" title="${system}">${system}</span>
              <span class="mapping-folder">${folder}</span>
            </div>
          `
            )
            .join('')}
        </div>
      </details>
    </div>
  `
    )
    .join('');
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
  const scraperUsername = document.getElementById('scraper-username').value;
  const scraperPassword = document.getElementById('scraper-password').value;

  const artworkTypes = [];
  if (document.getElementById('scraper-boxart').checked) artworkTypes.push('boxart');
  if (document.getElementById('scraper-screenshot').checked) artworkTypes.push('screenshot');
  if (document.getElementById('scraper-banner').checked) artworkTypes.push('banner');
  if (document.getElementById('scraper-fanart').checked) artworkTypes.push('fanart');

  await window.electronAPI.setConfig('scraper.enabled', scraperEnabled);
  await window.electronAPI.setConfig('scraper.credentials', {
    username: scraperUsername,
    password: scraperPassword
  });
  await window.electronAPI.setConfig('scraper.artworkTypes', artworkTypes);

  closeSettings();
  alert('Settings saved successfully!');
}

function openSyncModal() {
  updateSyncStatusDisplay();
  syncModal.classList.add('active');
}

function closeSyncModal() {
  syncModal.classList.remove('active');
  syncProgressContainer.style.display = 'none';
  syncProgressBar.style.width = '0%';
}

async function startSync() {
  const profileId = syncProfileSelect.value;

  if (!profileId) {
    alert('Please select a profile');
    return;
  }

  const syncArtwork = document.getElementById('sync-artwork-check').checked;

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

  try {
    // Sync ROMs
    const result = await window.electronAPI.syncRoms(profileId);

    if (result.errors.length > 0) {
      console.error('Sync errors:', result.errors);
    }

    // Sync artwork if requested
    if (syncArtwork) {
      syncProgressText.textContent = 'Syncing artwork...';
      await window.electronAPI.syncArtwork(profileId, null, ['boxart', 'screenshot']);
    }

    // Success
    syncProgressBar.style.width = '100%';
    syncProgressText.textContent = `Sync complete! ${result.synced} ROMs synced, ${result.skipped} skipped`;

    if (result.errors.length > 0) {
      syncProgressText.textContent += ` (${result.errors.length} errors)`;
    }

    // Update stats
    await updateSyncStatusDisplay();
    await updateStats();

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

function updateSyncProgress(progress) {
  const percent = (progress.current / progress.total) * 100;
  syncProgressBar.style.width = `${percent}%`;
  syncProgressText.textContent = `Syncing ${progress.rom} (${progress.current}/${progress.total})`;
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
  if (bulkScrapeBtn) {
    bulkScrapeBtn.textContent = `Scraping... (${progress.current}/${progress.total})`;
  }
}

// Make functions globally accessible
window.toggleProfile = toggleProfile;
window.selectBasePath = selectBasePath;

// Initialize on load
initSettings();
