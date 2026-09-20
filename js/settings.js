// ==========================================================================
// DeepScroll Settings Modal & Model Selector Controller
// ==========================================================================

class SettingsManager {
  constructor() {
    this.modal = null;
    this.loadedOrModels = [];
    this.isFreeOnly = true;
  }

  init() {
    this.modal = document.getElementById('settings-modal');
    this.bindEvents();
  }

  bindEvents() {
    const settingsBtn = document.getElementById('settings-btn');
    const closeBtn = document.getElementById('close-settings-btn');
    const saveBtn = document.getElementById('save-settings-btn');
    const testConnBtn = document.getElementById('test-conn-btn');

    const tabGemini = document.getElementById('tab-gemini');
    const tabOpenRouter = document.getElementById('tab-openrouter');
    const toggleFreeOnlyBtn = document.getElementById('toggle-free-only-btn');
    const toggleAllModelsBtn = document.getElementById('toggle-all-models-btn');
    const orSearchInput = document.getElementById('or-model-search');
    const refreshBtn = document.getElementById('refresh-or-models-btn');
    const topFreeBtn = document.getElementById('pick-top-free-btn');

    settingsBtn?.addEventListener('click', () => this.open());
    closeBtn?.addEventListener('click', () => this.close());
    this.modal?.addEventListener('click', (e) => { if (e.target === this.modal) this.close(); });

    tabGemini?.addEventListener('click', () => this.setProvider('gemini'));
    tabOpenRouter?.addEventListener('click', () => this.setProvider('openrouter'));

    toggleFreeOnlyBtn?.addEventListener('click', () => {
      this.isFreeOnly = true;
      toggleFreeOnlyBtn.classList.add('active');
      toggleAllModelsBtn?.classList.remove('active');
      this.renderModelOptions();
    });

    toggleAllModelsBtn?.addEventListener('click', () => {
      this.isFreeOnly = false;
      toggleAllModelsBtn.classList.add('active');
      toggleFreeOnlyBtn?.classList.remove('active');
      this.renderModelOptions();
    });

    orSearchInput?.addEventListener('input', () => this.renderModelOptions());
    refreshBtn?.addEventListener('click', () => this.loadModels(true));

    topFreeBtn?.addEventListener('click', () => {
      const best = this.loadedOrModels.find(m => m.isFree && m.id.includes('gemini-2.0-flash')) 
                || this.loadedOrModels.find(m => m.isFree && m.id.includes('llama-3.3'))
                || this.loadedOrModels.find(m => m.isFree);
      if (best) {
        window.aiService.openRouterModel = best.id;
        this.renderModelOptions();
        const select = document.getElementById('openrouter-model-select');
        if (select) select.value = best.id;
        if (window.showToast) window.showToast(`Selected ${best.name}! ⚡`);
      }
    });

    saveBtn?.addEventListener('click', () => this.save());
    testConnBtn?.addEventListener('click', () => this.testConnection());
  }

  open() {
    this.loadCurrentValues();
    const testStatus = document.getElementById('test-status');
    if (testStatus) testStatus.style.display = 'none';
    this.modal?.classList.add('active');
  }

  close() {
    this.modal?.classList.remove('active');
  }

  loadCurrentValues() {
    const geminiKey = document.getElementById('gemini-key-input');
    const geminiModel = document.getElementById('gemini-model-select');
    const orKey = document.getElementById('openrouter-key-input');
    const webSearch = document.getElementById('web-search-toggle');

    if (geminiKey) geminiKey.value = window.aiService.geminiKey;
    if (geminiModel) geminiModel.value = window.aiService.geminiModel;
    if (orKey) orKey.value = window.aiService.openRouterKey;
    if (webSearch) webSearch.checked = window.aiService.webSearchEnabled;

    this.setProvider(window.aiService.provider);
    this.loadModels(false);
  }

  setProvider(provider) {
    const tabGemini = document.getElementById('tab-gemini');
    const tabOpenRouter = document.getElementById('tab-openrouter');
    const geminiFields = document.getElementById('gemini-fields');
    const orFields = document.getElementById('openrouter-fields');

    if (provider === 'gemini') {
      tabGemini?.classList.add('active');
      tabOpenRouter?.classList.remove('active');
      if (geminiFields) geminiFields.style.display = 'block';
      if (orFields) orFields.style.display = 'none';
    } else {
      tabOpenRouter?.classList.add('active');
      tabGemini?.classList.remove('active');
      if (geminiFields) geminiFields.style.display = 'none';
      if (orFields) orFields.style.display = 'block';
      if (this.loadedOrModels.length === 0) this.loadModels(false);
    }
  }

  async loadModels(forceRefresh = false) {
    const refreshBtn = document.getElementById('refresh-or-models-btn');
    const countLabel = document.getElementById('or-model-count');
    refreshBtn?.classList.add('spinning');
    if (countLabel) countLabel.textContent = 'Fetching models...';

    try {
      this.loadedOrModels = await window.aiService.fetchOpenRouterModels(forceRefresh);
      this.renderModelOptions();
      if (forceRefresh && window.showToast) window.showToast(`Loaded ${this.loadedOrModels.length} models!`);
    } catch (err) {
      if (countLabel) countLabel.textContent = 'Error loading models';
    } finally {
      refreshBtn?.classList.remove('spinning');
    }
  }

  renderModelOptions() {
    const select = document.getElementById('openrouter-model-select');
    const searchInput = document.getElementById('or-model-search');
    const countLabel = document.getElementById('or-model-count');
    if (!select) return;

    const searchTerm = (searchInput?.value || '').toLowerCase().trim();
    const current = window.aiService.openRouterModel || 'google/gemini-2.0-flash-exp:free';

    const filtered = this.loadedOrModels.filter(m => {
      if (this.isFreeOnly && !m.isFree) return false;
      if (searchTerm) return m.name.toLowerCase().includes(searchTerm) || m.id.toLowerCase().includes(searchTerm);
      return true;
    });

    select.innerHTML = '';
    if (filtered.length === 0) {
      select.innerHTML = '<option value="">No matching models</option>';
    } else {
      filtered.forEach(m => {
        const opt = document.createElement('option');
        opt.value = m.id;
        opt.textContent = `${m.isFree ? '⚡ FREE' : '💲 PAID'} | ${m.name}`;
        if (m.id === current) opt.selected = true;
        select.appendChild(opt);
      });
    }

    if (countLabel) {
      const freeCount = this.loadedOrModels.filter(m => m.isFree).length;
      countLabel.textContent = this.isFreeOnly 
        ? `Showing ${filtered.length} free models (of ${freeCount})`
        : `Showing ${filtered.length} of ${this.loadedOrModels.length} models`;
    }
  }

  save() {
    const activeTab = document.getElementById('tab-gemini')?.classList.contains('active') ? 'gemini' : 'openrouter';
    const geminiKey = document.getElementById('gemini-key-input')?.value;
    const geminiModel = document.getElementById('gemini-model-select')?.value;
    const orKey = document.getElementById('openrouter-key-input')?.value;
    const orModel = document.getElementById('openrouter-model-select')?.value;
    const webSearch = document.getElementById('web-search-toggle')?.checked;

    window.aiService.saveConfig({
      provider: activeTab,
      geminiKey, geminiModel,
      openRouterKey: orKey, openRouterModel: orModel,
      webSearchEnabled: webSearch
    });

    this.close();
    if (window.showToast) window.showToast('API Settings Saved! ⚡');
  }

  async testConnection() {
    const btn = document.getElementById('test-conn-btn');
    const status = document.getElementById('test-status');
    const activeTab = document.getElementById('tab-gemini')?.classList.contains('active') ? 'gemini' : 'openrouter';
    const chosenModel = activeTab === 'gemini'
      ? document.getElementById('gemini-model-select')?.value
      : document.getElementById('openrouter-model-select')?.value;

    this.save();
    if (btn) { btn.disabled = true; btn.textContent = 'Testing...'; }
    if (status) {
      status.style.display = 'block';
      status.className = 'test-status loading';
      status.textContent = `Pinging ${activeTab === 'gemini' ? 'Google Gemini' : 'OpenRouter'} (${chosenModel})...`;
    }

    try {
      const res = await window.aiService.testConnection();
      if (status) {
        status.className = 'test-status success';
        status.innerHTML = `<strong>✓ Connected!</strong> ${res.provider} • ${res.latency}ms ⚡`;
      }
      if (window.soundEngine) window.soundEngine.playCorrect();
    } catch (err) {
      if (status) {
        status.className = 'test-status error';
        status.innerHTML = `<strong>✗ Connection Failed:</strong> ${err.message || 'Check key & connection.'}`;
      }
      if (window.soundEngine) window.soundEngine.playIncorrect();
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = 'Test Connection'; }
    }
  }
}

window.settingsManager = new SettingsManager();
