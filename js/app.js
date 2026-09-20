// ==========================================================================
// DeepScroll App Controller - Navigation, Settings, and Flow Management
// ==========================================================================

document.addEventListener('DOMContentLoaded', () => {
  // Elements
  const screenPrompt = document.getElementById('screen-prompt');
  const screenPlan = document.getElementById('screen-plan');
  const screenQuiz = document.getElementById('screen-quiz');
  const topHud = document.getElementById('top-hud');
  
  // Prompt Elements
  const topicInput = document.getElementById('topic-input');
  const generatePlanBtn = document.getElementById('generate-plan-btn');
  const difficultyChips = document.querySelectorAll('.difficulty-chip');
  const presetPills = document.querySelectorAll('.preset-pill');

  // Plan Elements
  const planList = document.getElementById('plan-list');
  const addModuleBtn = document.getElementById('add-module-btn');
  const startQuizBtn = document.getElementById('start-quiz-btn');
  const regenPlanBtn = document.getElementById('regen-plan-btn');

  // Settings Modal Elements
  const settingsBtn = document.getElementById('settings-btn');
  const settingsModal = document.getElementById('settings-modal');
  const closeSettingsBtn = document.getElementById('close-settings-btn');
  const saveSettingsBtn = document.getElementById('save-settings-btn');
  const testConnBtn = document.getElementById('test-conn-btn');
  const testStatus = document.getElementById('test-status');

  const tabGemini = document.getElementById('tab-gemini');
  const tabOpenRouter = document.getElementById('tab-openrouter');
  const geminiFields = document.getElementById('gemini-fields');
  const openRouterFields = document.getElementById('openrouter-fields');

  const geminiKeyInput = document.getElementById('gemini-key-input');
  const geminiModelSelect = document.getElementById('gemini-model-select');
  const openRouterKeyInput = document.getElementById('openrouter-key-input');
  const openRouterModelSelect = document.getElementById('openrouter-model-select');
  const webSearchToggle = document.getElementById('web-search-toggle');

  // OpenRouter Model Filter & Refresh Elements
  const refreshOrModelsBtn = document.getElementById('refresh-or-models-btn');
  const toggleFreeOnlyBtn = document.getElementById('toggle-free-only-btn');
  const toggleAllModelsBtn = document.getElementById('toggle-all-models-btn');
  const orModelSearch = document.getElementById('or-model-search');
  const orModelCount = document.getElementById('or-model-count');
  const pickTopFreeBtn = document.getElementById('pick-top-free-btn');

  // Audio Toggle
  const audioBtn = document.getElementById('audio-btn');
  const audioIcon = document.getElementById('audio-icon');

  // Bookmarks Modal
  const bookmarkHudBtn = document.getElementById('bookmark-hud-btn');
  const bookmarksModal = document.getElementById('bookmarks-modal');
  const closeBookmarksBtn = document.getElementById('close-bookmarks-btn');
  const bookmarksList = document.getElementById('bookmarks-list');

  // State
  let currentDifficulty = 'Intermediate';
  let activeTopic = '';
  let loadedOrModels = [];
  let isFreeOnlyFilter = true;

  // Initialize Engines
  window.planManager.init(planList);
  window.quizEngine.init(document.getElementById('quiz-feed'));

  // Toast Function
  window.showToast = function(msg) {
    let toast = document.getElementById('global-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'global-toast';
      toast.className = 'toast';
      document.body.appendChild(toast);
    }
    toast.textContent = msg;
    toast.classList.add('show');
    setTimeout(() => {
      toast.classList.remove('show');
    }, 2800);
  };

  // Screen Switching
  function showScreen(screenId) {
    [screenPrompt, screenPlan, screenQuiz].forEach(screen => {
      screen.classList.remove('active');
    });

    const target = document.getElementById(screenId);
    if (target) {
      target.classList.add('active');
    }

    if (screenId === 'screen-quiz') {
      topHud.style.display = 'flex';
    } else {
      topHud.style.display = 'flex';
    }
  }

  // Load Saved Settings into Inputs
  function loadSettings() {
    geminiKeyInput.value = window.aiService.geminiKey;
    geminiModelSelect.value = window.aiService.geminiModel;
    openRouterKeyInput.value = window.aiService.openRouterKey;
    if (webSearchToggle) {
      webSearchToggle.checked = window.aiService.webSearchEnabled;
    }

    setProviderTab(window.aiService.provider);
    updateAudioIcon();
    loadOpenRouterModels(false);
  }

  // OpenRouter Dynamic Models Loader & Filter
  async function loadOpenRouterModels(forceRefresh = false) {
    if (refreshOrModelsBtn) refreshOrModelsBtn.classList.add('spinning');
    if (orModelCount) orModelCount.textContent = 'Fetching models...';

    try {
      loadedOrModels = await window.aiService.fetchOpenRouterModels(forceRefresh);
      renderOpenRouterModelOptions();
      if (forceRefresh && window.showToast) {
        window.showToast(`Updated! Loaded ${loadedOrModels.length} models.`);
      }
    } catch (err) {
      console.error('Error fetching OpenRouter models:', err);
      if (orModelCount) orModelCount.textContent = 'Error loading models';
    } finally {
      if (refreshOrModelsBtn) refreshOrModelsBtn.classList.remove('spinning');
    }
  }

  function renderOpenRouterModelOptions() {
    if (!openRouterModelSelect) return;

    const searchTerm = (orModelSearch?.value || '').toLowerCase().trim();
    const currentSelected = window.aiService.openRouterModel || 'google/gemini-2.0-flash-exp:free';

    const filtered = loadedOrModels.filter(m => {
      if (isFreeOnlyFilter && !m.isFree) return false;
      if (searchTerm) {
        return m.name.toLowerCase().includes(searchTerm) || m.id.toLowerCase().includes(searchTerm);
      }
      return true;
    });

    openRouterModelSelect.innerHTML = '';

    if (filtered.length === 0) {
      const opt = document.createElement('option');
      opt.value = '';
      opt.textContent = 'No matching models found';
      openRouterModelSelect.appendChild(opt);
    } else {
      filtered.forEach(m => {
        const opt = document.createElement('option');
        opt.value = m.id;
        const tag = m.isFree ? '⚡ FREE' : '💲 PAID';
        opt.textContent = `${tag} | ${m.name}`;
        if (m.id === currentSelected) {
          opt.selected = true;
        }
        openRouterModelSelect.appendChild(opt);
      });
    }

    // Ensure currently selected model is present in dropdown if not in filtered list
    if (currentSelected && !filtered.some(m => m.id === currentSelected)) {
      const customOpt = document.createElement('option');
      customOpt.value = currentSelected;
      customOpt.textContent = `★ Current: ${currentSelected}`;
      customOpt.selected = true;
      openRouterModelSelect.prepend(customOpt);
    }

    if (orModelCount) {
      const freeCount = loadedOrModels.filter(m => m.isFree).length;
      orModelCount.textContent = isFreeOnlyFilter 
        ? `Showing ${filtered.length} free models (out of ${freeCount})`
        : `Showing ${filtered.length} of ${loadedOrModels.length} models`;
    }
  }

  // Model Filter Event Listeners
  if (toggleFreeOnlyBtn && toggleAllModelsBtn) {
    toggleFreeOnlyBtn.addEventListener('click', () => {
      isFreeOnlyFilter = true;
      toggleFreeOnlyBtn.classList.add('active');
      toggleAllModelsBtn.classList.remove('active');
      renderOpenRouterModelOptions();
    });

    toggleAllModelsBtn.addEventListener('click', () => {
      isFreeOnlyFilter = false;
      toggleAllModelsBtn.classList.add('active');
      toggleFreeOnlyBtn.classList.remove('active');
      renderOpenRouterModelOptions();
    });
  }

  if (orModelSearch) {
    orModelSearch.addEventListener('input', () => {
      renderOpenRouterModelOptions();
    });
  }

  if (refreshOrModelsBtn) {
    refreshOrModelsBtn.addEventListener('click', () => {
      loadOpenRouterModels(true);
    });
  }

  if (openRouterModelSelect) {
    openRouterModelSelect.addEventListener('change', (e) => {
      if (e.target.value) {
        window.aiService.openRouterModel = e.target.value;
      }
    });
  }

  if (pickTopFreeBtn) {
    pickTopFreeBtn.addEventListener('click', () => {
      // Find top free gemini or llama or deepseek
      const topFree = loadedOrModels.find(m => m.isFree && m.id.includes('gemini-2.0-flash')) 
                   || loadedOrModels.find(m => m.isFree && m.id.includes('llama-3.3'))
                   || loadedOrModels.find(m => m.isFree);

      if (topFree) {
        window.aiService.openRouterModel = topFree.id;
        openRouterModelSelect.value = topFree.id;
        renderOpenRouterModelOptions();
        openRouterModelSelect.value = topFree.id;
        if (window.showToast) window.showToast(`Selected ${topFree.name}! ⚡`);
      }
    });
  }

  function setProviderTab(provider) {
    if (provider === 'gemini') {
      tabGemini.classList.add('active');
      tabOpenRouter.classList.remove('active');
      geminiFields.style.display = 'block';
      openRouterFields.style.display = 'none';
    } else {
      tabOpenRouter.classList.add('active');
      tabGemini.classList.remove('active');
      geminiFields.style.display = 'none';
      openRouterFields.style.display = 'block';
      if (loadedOrModels.length === 0) {
        loadOpenRouterModels(false);
      }
    }
  }

  function updateAudioIcon() {
    if (window.soundEngine.muted) {
      audioIcon.innerHTML = `<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><line x1="23" y1="9" x2="17" y2="15"></line><line x1="17" y1="9" x2="23" y2="15"></line>`;
    } else {
      audioIcon.innerHTML = `<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path>`;
    }
  }

  // Event Listeners for Provider Tabs
  tabGemini.addEventListener('click', () => setProviderTab('gemini'));
  tabOpenRouter.addEventListener('click', () => setProviderTab('openrouter'));

  // Settings Open/Close
  settingsBtn.addEventListener('click', () => {
    loadSettings();
    testStatus.style.display = 'none';
    settingsModal.classList.add('active');
  });

  closeSettingsBtn.addEventListener('click', () => {
    settingsModal.classList.remove('active');
  });

  settingsModal.addEventListener('click', (e) => {
    if (e.target === settingsModal) settingsModal.classList.remove('active');
  });

  // Save Settings
  saveSettingsBtn.addEventListener('click', () => {
    const activeTab = tabGemini.classList.contains('active') ? 'gemini' : 'openrouter';
    window.aiService.saveConfig({
      provider: activeTab,
      geminiKey: geminiKeyInput.value,
      geminiModel: geminiModelSelect.value,
      openRouterKey: openRouterKeyInput.value,
      openRouterModel: openRouterModelSelect.value,
      webSearchEnabled: webSearchToggle ? webSearchToggle.checked : false
    });
    settingsModal.classList.remove('active');
    window.showToast('API Settings Saved! ⚡');
  });

  // Test Connection with Detailed Status Feedback
  testConnBtn.addEventListener('click', async () => {
    const activeTab = tabGemini.classList.contains('active') ? 'gemini' : 'openrouter';
    const chosenModel = activeTab === 'gemini' ? geminiModelSelect.value : openRouterModelSelect.value;
    
    window.aiService.saveConfig({
      provider: activeTab,
      geminiKey: geminiKeyInput.value,
      geminiModel: geminiModelSelect.value,
      openRouterKey: openRouterKeyInput.value,
      openRouterModel: openRouterModelSelect.value,
      webSearchEnabled: webSearchToggle ? webSearchToggle.checked : false
    });

    testConnBtn.disabled = true;
    testConnBtn.innerHTML = `
      <span class="spinner" style="width:14px;height:14px;border-width:2px;display:inline-block;vertical-align:middle;margin-right:6px;"></span>
      Testing ${activeTab === 'gemini' ? 'Gemini' : 'OpenRouter'}...
    `;
    
    testStatus.style.display = 'block';
    testStatus.className = 'test-status loading';
    testStatus.innerHTML = `
      <div style="display:flex;align-items:center;gap:8px;">
        <span class="spinner" style="width:14px;height:14px;border-width:2px;"></span>
        <span>Pinging ${activeTab === 'gemini' ? 'Google Gemini' : 'OpenRouter'} (${chosenModel})...</span>
      </div>
    `;

    try {
      const res = await window.aiService.testConnection();
      testStatus.className = 'test-status success';
      testStatus.innerHTML = `
        <div style="font-weight: 800; font-size: 0.88rem; margin-bottom: 4px; display:flex; align-items:center; gap:6px;">
          <span>✓</span>
          <span>Connection Verified!</span>
        </div>
        <div style="font-size: 0.78rem; opacity: 0.9; line-height: 1.4;">
          <div>• <strong>Provider:</strong> ${res.provider}</div>
          <div>• <strong>Model:</strong> ${res.model}</div>
          <div>• <strong>Latency:</strong> ${res.latency} ms ⚡</div>
          <div>• <strong>Status:</strong> Ready for Quiz Doomscrolling</div>
        </div>
      `;
      if (window.soundEngine) window.soundEngine.playCorrect();
    } catch (err) {
      testStatus.className = 'test-status error';
      testStatus.innerHTML = `
        <div style="font-weight: 800; font-size: 0.88rem; margin-bottom: 4px; display:flex; align-items:center; gap:6px;">
          <span>✗</span>
          <span>Connection Failed</span>
        </div>
        <div style="font-size: 0.78rem; opacity: 0.95; line-height: 1.4;">
          ${err.message || 'Could not verify connection. Please check your API key and network.'}
        </div>
      `;
      if (window.soundEngine) window.soundEngine.playIncorrect();
    } finally {
      testConnBtn.disabled = false;
      testConnBtn.innerHTML = `<span>Test Connection</span>`;
    }
  });

  // Difficulty Chips
  difficultyChips.forEach(chip => {
    chip.addEventListener('click', () => {
      difficultyChips.forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      currentDifficulty = chip.dataset.level;
      if (window.soundEngine) window.soundEngine.playTap();
    });
  });

  // Presets
  presetPills.forEach(pill => {
    pill.addEventListener('click', () => {
      topicInput.value = pill.textContent;
      if (window.soundEngine) window.soundEngine.playTap();
    });
  });

  // Audio Toggle
  audioBtn.addEventListener('click', () => {
    window.soundEngine.toggleMute();
    updateAudioIcon();
  });

  // Generate Plan Trigger
  async function handleGeneratePlan() {
    const topic = topicInput.value.trim();
    if (!topic) {
      window.showToast('Please enter a topic to learn');
      topicInput.focus();
      return;
    }

    activeTopic = topic;
    generatePlanBtn.disabled = true;
    generatePlanBtn.innerHTML = `
      <div class="spinner" style="width:20px;height:20px;border-width:2px;"></div>
      Generating Learning Plan...
    `;

    try {
      const plan = await window.aiService.generateLearningPlan(topic, currentDifficulty);
      window.planManager.setPlan(plan);
      showScreen('screen-plan');
    } catch (err) {
      window.showToast('Failed to generate plan: ' + err.message);
    } finally {
      generatePlanBtn.disabled = false;
      generatePlanBtn.innerHTML = `
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"></path></svg>
        Generate Learning Plan
      `;
    }
  }

  generatePlanBtn.addEventListener('click', handleGeneratePlan);
  topicInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleGeneratePlan();
    }
  });

  // Plan Screen Actions
  addModuleBtn.addEventListener('click', () => {
    window.planManager.addModule();
  });

  regenPlanBtn.addEventListener('click', () => {
    showScreen('screen-prompt');
  });

  startQuizBtn.addEventListener('click', () => {
    const finalPlan = window.planManager.getPlan();
    if (!finalPlan || !finalPlan.modules || finalPlan.modules.length === 0) {
      window.showToast('Please add at least 1 milestone');
      return;
    }

    if (window.soundEngine) window.soundEngine.playTap();
    showScreen('screen-quiz');
    window.quizEngine.startQuiz(activeTopic, finalPlan);
  });

  // Bookmarks Modal
  bookmarkHudBtn.addEventListener('click', () => {
    renderBookmarksList();
    bookmarksModal.classList.add('active');
  });

  closeBookmarksBtn.addEventListener('click', () => {
    bookmarksModal.classList.remove('active');
  });

  bookmarksModal.addEventListener('click', (e) => {
    if (e.target === bookmarksModal) bookmarksModal.classList.remove('active');
  });

  function renderBookmarksList() {
    const bookmarks = window.quizEngine.bookmarkedQuestions;
    if (!bookmarks || bookmarks.length === 0) {
      bookmarksList.innerHTML = `
        <div style="text-align: center; color: var(--text-muted); padding: 40px 10px;">
          <div style="font-size: 2rem; margin-bottom: 8px;">📑</div>
          <div style="font-weight: 700;">No saved questions yet</div>
          <div style="font-size: 0.8rem; margin-top: 4px;">Tap the bookmark icon on any card during the quiz to save it here.</div>
        </div>
      `;
      return;
    }

    bookmarksList.innerHTML = bookmarks.map((b, idx) => {
      const perplexityUrl = window.quizEngine.getPerplexityUrl(b);
      return `
        <div class="plan-item" style="flex-direction: column; gap: 8px;">
          <div style="display: flex; justify-content: space-between; width: 100%; align-items: center;">
            <span class="module-tag">${b.moduleTitle || 'Review'}</span>
            <button class="plan-action-btn delete-bookmark-btn" data-index="${idx}" title="Remove">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
            </button>
          </div>
          <div style="font-weight: 700; font-size: 0.92rem; color: #fff;">${b.question}</div>
          <div style="font-size: 0.8rem; color: var(--text-secondary);">${b.explanation}</div>
          <a href="${perplexityUrl}" target="_blank" rel="noopener noreferrer" class="perplexity-btn" style="padding: 8px 12px; margin-top: 4px;">
            Ask Perplexity Deep Dive ↗
          </a>
        </div>
      `;
    }).join('');

    // Attach remove listeners
    const deleteBtns = bookmarksList.querySelectorAll('.delete-bookmark-btn');
    deleteBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        const idx = parseInt(btn.dataset.index, 10);
        window.quizEngine.bookmarkedQuestions.splice(idx, 1);
        localStorage.setItem('ds_bookmarks', JSON.stringify(window.quizEngine.bookmarkedQuestions));
        renderBookmarksList();
      });
    });
  }

  // Keyboard navigation for testing (Arrow Up / Down)
  window.addEventListener('keydown', (e) => {
    if (screenQuiz.classList.contains('active')) {
      const feed = document.getElementById('quiz-feed');
      if (e.key === 'ArrowDown') {
        feed.scrollBy({ top: window.innerHeight * 0.9, behavior: 'smooth' });
      } else if (e.key === 'ArrowUp') {
        feed.scrollBy({ top: -window.innerHeight * 0.9, behavior: 'smooth' });
      }
    }
  });

  // Initial setup check
  loadSettings();
});
