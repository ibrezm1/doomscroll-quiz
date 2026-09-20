// ==========================================================================
// DeepScroll Quiz Engine - Infinite Snap Feed, Auto-Prefetch & Scoring
// ==========================================================================

class QuizEngine {
  constructor() {
    this.feedElement = null;
    this.topic = '';
    this.plan = null;
    this.questions = [];
    this.batchIndex = 0;
    this.isFetchingNextBatch = false;
    this.observer = null;
    this.answeredQuestions = new Set();
    
    this.score = 0;
    this.streak = 0;
    this.maxStreak = 0;
    this.currentModuleIndex = 0;
    this.moduleQuestionsGenerated = 0;
    this.autoRetryAttempts = 0;
    this.sessionId = null;

    this.handleOptionSelect = this.handleOptionSelect.bind(this);
    this.handleIntersection = this.handleIntersection.bind(this);
  }

  init(feedElement) {
    this.feedElement = feedElement;
    this.setupIntersectionObserver();
  }

  setupIntersectionObserver() {
    if (this.observer) this.observer.disconnect();
    this.observer = new IntersectionObserver(this.handleIntersection, {
      root: this.feedElement,
      rootMargin: '0px',
      threshold: 0.6
    });
  }

  handleIntersection(entries) {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const index = parseInt(entry.target.dataset.index, 10);
        if (!isNaN(index)) this.onCardVisible(index);
      }
    });
  }

  onCardVisible(index) {
    const topicPill = document.getElementById('hud-topic');
    const qData = this.questions[index];
    if (topicPill && qData) {
      const modNum = qData.moduleIndex !== undefined ? qData.moduleIndex + 1 : 1;
      const totalMods = this.plan?.modules?.length || 1;
      topicPill.textContent = `[${modNum}/${totalMods}] ${qData.moduleTitle || this.topic}`;
    }

    const isNearEnd = (index >= this.questions.length - 2);
    const isFourthCard = ((index + 1) % 5 === 4);

    if ((isFourthCard || isNearEnd) && !this.isFetchingNextBatch) {
      this.fetchNextBatch();
    }
  }

  async startQuiz(topic, plan) {
    this.topic = topic;
    this.plan = plan;
    this.questions = [];
    this.batchIndex = 0;
    this.score = 0;
    this.streak = 0;
    this.maxStreak = 0;
    this.currentModuleIndex = 0;
    this.moduleQuestionsGenerated = 0;
    this.autoRetryAttempts = 0;
    this.sessionId = `topic_${Date.now()}`;
    this.answeredQuestions.clear();
    this.feedElement.innerHTML = '';
    this.updateHUD();

    this.saveState();
    this.showInitialLoader();
    await this.fetchNextBatch();
    this.feedElement.scrollTop = 0;
  }

  resumeSession(session) {
    this.sessionId = session.id;
    this.topic = session.topic;
    this.plan = session.plan;
    this.questions = session.questions || [];
    this.score = session.score || 0;
    this.streak = session.streak || 0;
    this.maxStreak = session.maxStreak || 0;
    this.currentModuleIndex = session.currentModuleIndex || 0;
    this.moduleQuestionsGenerated = session.moduleQuestionsGenerated || 0;
    this.answeredQuestions.clear();

    this.feedElement.innerHTML = '';
    this.updateHUD();

    if (this.questions.length > 0) {
      this.renderNewCards(this.questions, 0);
      const firstUnansweredIndex = this.questions.findIndex((q, i) => !this.answeredQuestions.has(i));
      const targetCardIndex = firstUnansweredIndex > -1 ? firstUnansweredIndex : Math.max(0, this.questions.length - 1);
      
      setTimeout(() => {
        const targetElem = document.getElementById(`card-${targetCardIndex}`);
        targetElem?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    } else {
      this.fetchNextBatch();
    }
  }

  saveState() {
    if (!this.topic || !window.topicHistoryManager) return;
    window.topicHistoryManager.saveSession({
      id: this.sessionId,
      topic: this.topic,
      difficulty: this.plan?.difficulty || 'Intermediate',
      plan: this.plan,
      questions: this.questions,
      score: this.score,
      streak: this.streak,
      maxStreak: this.maxStreak,
      currentModuleIndex: this.currentModuleIndex,
      moduleQuestionsGenerated: this.moduleQuestionsGenerated
    });
  }

  showInitialLoader() {
    const firstModule = this.plan?.modules?.[0];
    const moduleName = firstModule ? firstModule.title : this.topic;

    this.feedElement.innerHTML = `
      <div class="loading-card" id="feed-loader">
        <div class="spinner"></div>
        <div style="font-weight: 700; font-size: 1.1rem; color: #fff;">Curating Topic #1...</div>
        <div style="font-size: 0.85rem; color: var(--text-secondary); max-width: 300px; margin: 0 auto;">
          Generating tailored questions for: <br><strong style="color: #a78bfa;">${moduleName}</strong>
        </div>
      </div>
    `;
  }

  async fetchNextBatch() {
    if (this.isFetchingNextBatch) return;
    this.isFetchingNextBatch = true;
    this.batchIndex += 1;

    const modules = this.plan?.modules || [{ title: this.topic, targetQuestions: 5 }];
    const totalModules = modules.length;

    let currentModule = null;
    let targetCount = 5;

    if (this.currentModuleIndex >= totalModules) {
      currentModule = { title: `Capstone Review & Mastery`, summary: `Mixed review across ${this.topic}`, targetQuestions: 5 };
      targetCount = 5;
    } else {
      currentModule = modules[this.currentModuleIndex];
      const remaining = (currentModule.targetQuestions || 5) - this.moduleQuestionsGenerated;
      targetCount = Math.min(5, Math.max(1, remaining));
    }

    try {
      const newQuestions = await window.aiService.generateTopicBatch(
        this.topic, currentModule, this.currentModuleIndex, totalModules, targetCount, this.questions
      );

      document.getElementById('feed-loader')?.remove();

      if (newQuestions && newQuestions.length > 0) {
        const startIndex = this.questions.length;
        this.questions.push(...newQuestions);
        this.renderNewCards(newQuestions, startIndex);

        this.moduleQuestionsGenerated += newQuestions.length;
        const target = currentModule.targetQuestions || 5;
        if (this.moduleQuestionsGenerated >= target) {
          this.currentModuleIndex += 1;
          this.moduleQuestionsGenerated = 0;
        }
        this.autoRetryAttempts = 0;
        this.saveState();
      }
    } catch (err) {
      document.getElementById('feed-loader')?.remove();

      if (this.autoRetryAttempts < 3) {
        this.autoRetryAttempts += 1;
        setTimeout(() => {
          this.isFetchingNextBatch = false;
          this.fetchNextBatch();
        }, 2000);
        return;
      }

      if (this.questions.length === 0) {
        this.renderErrorCard(err);
      } else if (window.showToast) {
        window.showToast(`Error loading questions: ${err.message}`);
      }
    } finally {
      this.isFetchingNextBatch = false;
    }
  }

  renderNewCards(newQuestions, startIndex) {
    const totalMods = this.plan?.modules?.length || 1;
    newQuestions.forEach((q, offset) => {
      const globalIndex = startIndex + offset;
      const isBookmarked = window.bookmarksManager?.isBookmarked(q);
      const card = window.cardRenderer.createCardElement(q, globalIndex, totalMods, isBookmarked);

      card.querySelectorAll('.option-btn').forEach(btn => btn.addEventListener('click', this.handleOptionSelect));
      const bookmarkBtn = card.querySelector('.bookmark-rail-btn');
      bookmarkBtn?.addEventListener('click', () => window.bookmarksManager.toggleBookmark(q, bookmarkBtn));
      card.querySelector('.share-rail-btn')?.addEventListener('click', () => window.bookmarksManager.share(q));

      this.feedElement.appendChild(card);
      this.observer?.observe(card);
    });
  }

  handleOptionSelect(e) {
    const btn = e.currentTarget;
    const cardIndex = parseInt(btn.dataset.cardIndex, 10);
    const selectedOptionIndex = parseInt(btn.dataset.optionIndex, 10);
    const q = this.questions[cardIndex];

    if (!q || this.answeredQuestions.has(cardIndex)) return;
    this.answeredQuestions.add(cardIndex);

    const card = document.getElementById(`card-${cardIndex}`);
    if (!card) return;

    const isCorrect = selectedOptionIndex === q.correctAnswerIndex;
    if (isCorrect) {
      btn.classList.add('correct');
      if (window.soundEngine) window.soundEngine.playCorrect();
      this.score += 100;
      this.streak += 1;
      if (this.streak > this.maxStreak) this.maxStreak = this.streak;
      if (this.streak > 1 && this.streak % 3 === 0 && window.soundEngine) window.soundEngine.playStreak();
    } else {
      btn.classList.add('wrong');
      if (window.soundEngine) window.soundEngine.playIncorrect();
      this.streak = 0;
      card.querySelector(`[data-option-index="${q.correctAnswerIndex}"]`)?.classList.add('correct');
    }

    card.querySelectorAll('.option-btn').forEach(b => b.classList.add('disabled'));
    document.getElementById(`expl-${cardIndex}`)?.classList.add('visible');
    this.updateHUD();
    this.saveState();
  }

  renderErrorCard(err) {
    this.feedElement.innerHTML = `
      <div class="loading-card" id="error-card" style="padding: 24px; text-align: center;">
        <div style="font-size: 2.5rem; margin-bottom: 8px;">⚠️</div>
        <div style="font-size: 1.15rem; font-weight: 800; color: #fff; margin-bottom: 8px;">AI Quiz Generation Failed</div>
        <div style="font-size: 0.85rem; color: #fb7185; margin-bottom: 20px; line-height: 1.4; background: rgba(244,63,94,0.1); border: 1px solid rgba(244,63,94,0.3); padding: 10px 14px; border-radius: 12px;">
          ${err.message || 'Error communicating with AI.'}
        </div>
        <div style="display: flex; flex-direction: column; gap: 10px; width: 100%; max-width: 300px;">
          <button class="primary-btn" id="err-retry-btn" style="padding: 14px;">🔄 Retry Generation</button>
          <button class="secondary-btn" id="err-settings-btn" style="padding: 12px;">⚙️ Configure API Key</button>
        </div>
      </div>
    `;

    document.getElementById('err-retry-btn')?.addEventListener('click', () => this.startQuiz(this.topic, this.plan));
    document.getElementById('err-settings-btn')?.addEventListener('click', () => window.settingsManager?.open());
  }

  updateHUD() {
    const streakElem = document.getElementById('hud-streak-count');
    const scoreElem = document.getElementById('hud-score-count');
    const streakBadge = document.getElementById('hud-streak-badge');

    if (streakElem) streakElem.textContent = this.streak;
    if (scoreElem) scoreElem.textContent = this.score;
    if (streakBadge) {
      if (this.streak >= 3) streakBadge.classList.add('hot');
      else streakBadge.classList.remove('hot');
    }
  }
}

window.quizEngine = new QuizEngine();
