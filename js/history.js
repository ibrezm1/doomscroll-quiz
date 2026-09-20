// ==========================================================================
// DeepScroll Topic History Manager (LocalStorage Topic Persistence & Resume)
// ==========================================================================

class TopicHistoryManager {
  constructor() {
    this.storageKey = 'ds_topics_history';
    this.activeSessionId = null;
  }

  getAll() {
    try {
      return JSON.parse(localStorage.getItem(this.storageKey) || '[]');
    } catch (e) {
      return [];
    }
  }

  saveSession({ id, topic, difficulty, plan, questions = [], score = 0, streak = 0, maxStreak = 0, currentModuleIndex = 0, moduleQuestionsGenerated = 0 }) {
    const list = this.getAll();
    const sessionId = id || `topic_${Date.now()}`;
    this.activeSessionId = sessionId;

    const existingIndex = list.findIndex(s => s.id === sessionId || s.topic.toLowerCase() === topic.toLowerCase());
    
    const sessionData = {
      id: sessionId,
      topic: topic,
      difficulty: difficulty || 'Intermediate',
      plan: plan,
      questions: questions,
      score: score,
      streak: streak,
      maxStreak: maxStreak,
      currentModuleIndex: currentModuleIndex,
      moduleQuestionsGenerated: moduleQuestionsGenerated,
      updatedAt: Date.now(),
      totalQuestionsAnswered: questions.length
    };

    if (existingIndex > -1) {
      list[existingIndex] = { ...list[existingIndex], ...sessionData };
    } else {
      list.unshift(sessionData);
    }

    localStorage.setItem(this.storageKey, JSON.stringify(list));
    window.dispatchEvent(new CustomEvent('ds_topics_updated'));
    return sessionData;
  }

  deleteSession(id) {
    const list = this.getAll().filter(s => s.id !== id);
    localStorage.setItem(this.storageKey, JSON.stringify(list));
    window.dispatchEvent(new CustomEvent('ds_topics_updated'));
    if (window.showToast) window.showToast('Topic removed from history');
  }

  getSession(id) {
    return this.getAll().find(s => s.id === id) || null;
  }

  renderPromptList(container, countBadge) {
    if (!container) return;
    const list = this.getAll();
    const sectionContainer = document.getElementById('saved-topics-container');

    if (list.length === 0) {
      if (sectionContainer) sectionContainer.style.display = 'none';
      return;
    }

    if (sectionContainer) sectionContainer.style.display = 'block';
    if (countBadge) countBadge.textContent = list.length;

    container.innerHTML = list.map(s => {
      const totalMods = s.plan?.modules?.length || 1;
      const curMod = Math.min(s.currentModuleIndex + 1, totalMods);
      const qCount = s.questions?.length || 0;
      const timeStr = new Date(s.updatedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

      return `
        <div class="saved-topic-card" id="session_${s.id}">
          <div class="saved-topic-header">
            <span class="saved-topic-badge">${s.difficulty} • Milestone ${curMod}/${totalMods}</span>
            <button class="delete-topic-btn" data-id="${s.id}" title="Delete Topic History">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
            </button>
          </div>
          
          <div class="saved-topic-title">${this.escape(s.topic)}</div>
          
          <div class="saved-topic-stats">
            <span>⚡ ${s.score || 0} XP</span>
            <span>•</span>
            <span>🔥 Streak: ${s.maxStreak || 0}</span>
            <span>•</span>
            <span>📝 ${qCount} Qs</span>
            <span>•</span>
            <span>${timeStr}</span>
          </div>

          <button class="resume-topic-btn" data-id="${s.id}">
            <span>▶ Pick Up Where You Left Off</span>
          </button>
        </div>
      `;
    }).join('');

    // Attach Listeners
    container.querySelectorAll('.resume-topic-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.id;
        this.resume(id);
      });
    });

    container.querySelectorAll('.delete-topic-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = btn.dataset.id;
        this.deleteSession(id);
        this.renderPromptList(container, countBadge);
      });
    });
  }

  resume(id) {
    const session = this.getSession(id);
    if (!session) return;

    this.activeSessionId = session.id;
    if (window.soundEngine) window.soundEngine.playTap();

    // Switch screen to quiz
    const screenPrompt = document.getElementById('screen-prompt');
    const screenPlan = document.getElementById('screen-plan');
    const screenQuiz = document.getElementById('screen-quiz');
    [screenPrompt, screenPlan].forEach(s => s?.classList.remove('active'));
    screenQuiz?.classList.add('active');

    // Resume Quiz Engine with saved state
    window.quizEngine.resumeSession(session);
    if (window.showToast) window.showToast(`Resumed "${session.topic}"! ⚡`);
  }

  escape(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}

window.topicHistoryManager = new TopicHistoryManager();
