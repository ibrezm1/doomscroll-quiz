// ==========================================================================
// DeepScroll App Controller - Global Orchestrator & Screen Navigation
// ==========================================================================

document.addEventListener('DOMContentLoaded', () => {
  // Navigation & Prompt Elements
  const screenPrompt = document.getElementById('screen-prompt');
  const screenPlan = document.getElementById('screen-plan');
  const screenQuiz = document.getElementById('screen-quiz');
  const topHud = document.getElementById('top-hud');
  
  const topicInput = document.getElementById('topic-input');
  const generatePlanBtn = document.getElementById('generate-plan-btn');
  const difficultyChips = document.querySelectorAll('.difficulty-chip');
  const presetPills = document.querySelectorAll('.preset-pill');

  const addModuleBtn = document.getElementById('add-module-btn');
  const startQuizBtn = document.getElementById('start-quiz-btn');
  const regenPlanBtn = document.getElementById('regen-plan-btn');

  const audioBtn = document.getElementById('audio-btn');
  const audioIcon = document.getElementById('audio-icon');
  const bookmarkHudBtn = document.getElementById('bookmark-hud-btn');
  const bookmarksModal = document.getElementById('bookmarks-modal');
  const closeBookmarksBtn = document.getElementById('close-bookmarks-btn');
  const bookmarksList = document.getElementById('bookmarks-list');

  let currentDifficulty = 'Intermediate';
  let activeTopic = '';

  // Initialize Subsystems
  window.planManager.init(document.getElementById('plan-list'));
  window.quizEngine.init(document.getElementById('quiz-feed'));
  window.logsManager.init();
  window.settingsManager.init();

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
    setTimeout(() => toast.classList.remove('show'), 2800);
  };

  const exitQuizBtn = document.getElementById('exit-quiz-btn');

  // Screen Switching
  function showScreen(screenId) {
    [screenPrompt, screenPlan, screenQuiz].forEach(s => s?.classList.remove('active'));
    document.getElementById(screenId)?.classList.add('active');
    topHud.style.display = 'flex';
    if (exitQuizBtn) {
      exitQuizBtn.style.display = (screenId === 'screen-quiz') ? 'flex' : 'none';
    }
  }

  exitQuizBtn?.addEventListener('click', () => {
    window.quizEngine?.exitQuiz();
  });

  function updateAudioIcon() {
    audioIcon.innerHTML = window.soundEngine.muted
      ? `<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><line x1="23" y1="9" x2="17" y2="15"></line><line x1="17" y1="9" x2="23" y2="15"></line>`
      : `<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path>`;
  }

  // Difficulty & Presets
  difficultyChips.forEach(chip => {
    chip.addEventListener('click', () => {
      difficultyChips.forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      currentDifficulty = chip.dataset.level;
      if (window.soundEngine) window.soundEngine.playTap();
    });
  });

  presetPills.forEach(pill => {
    pill.addEventListener('click', () => {
      topicInput.value = pill.textContent;
      if (window.soundEngine) window.soundEngine.playTap();
    });
  });

  audioBtn?.addEventListener('click', () => {
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

    if (!window.aiService.hasValidKey()) {
      window.showToast('Please enter your API Key in Settings ⚙️.');
      window.settingsManager.open();
      return;
    }

    activeTopic = topic;
    generatePlanBtn.disabled = true;
    generatePlanBtn.innerHTML = `<div class="spinner" style="width:20px;height:20px;border-width:2px;"></div><span>Generating AI Curriculum...</span>`;

    try {
      const plan = await window.aiService.generateLearningPlan(topic, currentDifficulty);
      window.planManager.setPlan(plan);
      showScreen('screen-plan');
    } catch (err) {
      window.showToast(err.message || 'Failed to generate plan.');
      if (err.message.includes('API Key') || err.message.includes('401')) {
        window.settingsManager.open();
      }
    } finally {
      generatePlanBtn.disabled = false;
      generatePlanBtn.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"></path></svg>Generate Learning Plan`;
    }
  }

  generatePlanBtn?.addEventListener('click', handleGeneratePlan);
  topicInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleGeneratePlan();
    }
  });

  addModuleBtn?.addEventListener('click', () => window.planManager.addModule());
  regenPlanBtn?.addEventListener('click', () => showScreen('screen-prompt'));

  startQuizBtn?.addEventListener('click', () => {
    if (window.planManager?.activeMode === 'json') {
      const ok = window.planManager.applyJsonChanges(false);
      if (!ok) return; // Don't start if JSON syntax error
    }

    const finalPlan = window.planManager.getPlan();
    if (!finalPlan?.modules?.length) {
      window.showToast('Please add at least 1 milestone');
      return;
    }
    if (window.soundEngine) window.soundEngine.playTap();
    showScreen('screen-quiz');
    window.quizEngine.startQuiz(activeTopic, finalPlan);
  });

  // Bookmarks Drawer
  bookmarkHudBtn?.addEventListener('click', () => {
    window.bookmarksManager.renderList(bookmarksList);
    bookmarksModal?.classList.add('active');
  });

  // Saved Topics Rendering Function
  function refreshSavedTopics() {
    const container = document.getElementById('saved-topics-list');
    const countBadge = document.getElementById('saved-topics-count');
    window.topicHistoryManager?.renderPromptList(container, countBadge);
  }

  const editTopicsJsonBtn = document.getElementById('edit-topics-json-btn');
  editTopicsJsonBtn?.addEventListener('click', () => {
    window.topicHistoryManager?.openJsonEditor();
  });

  window.addEventListener('ds_topics_updated', refreshSavedTopics);

  regenPlanBtn?.addEventListener('click', () => {
    refreshSavedTopics();
    showScreen('screen-prompt');
  });

  // Keyboard navigation
  window.addEventListener('keydown', (e) => {
    if (screenQuiz?.classList.contains('active')) {
      const feed = document.getElementById('quiz-feed');
      if (e.key === 'ArrowDown') feed?.scrollBy({ top: window.innerHeight * 0.9, behavior: 'smooth' });
      if (e.key === 'ArrowUp') feed?.scrollBy({ top: -window.innerHeight * 0.9, behavior: 'smooth' });
    }
  });

  updateAudioIcon();
  refreshSavedTopics();
});
