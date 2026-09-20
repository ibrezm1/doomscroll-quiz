// ==========================================================================
// DeepScroll Quiz Engine - Infinite Doomscroll Feed with Batched AI Prefetching
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
    
    // Stats
    this.score = 0;
    this.streak = 0;
    this.maxStreak = 0;
    this.bookmarkedQuestions = JSON.parse(localStorage.getItem('ds_bookmarks') || '[]');

    // Bindings
    this.handleOptionSelect = this.handleOptionSelect.bind(this);
    this.handleIntersection = this.handleIntersection.bind(this);
  }

  init(feedElement) {
    this.feedElement = feedElement;
    this.setupIntersectionObserver();
  }

  setupIntersectionObserver() {
    if (this.observer) this.observer.disconnect();

    const options = {
      root: this.feedElement,
      rootMargin: '0px',
      threshold: 0.6 // Card is considered active when 60% visible
    };

    this.observer = new IntersectionObserver(this.handleIntersection, options);
  }

  handleIntersection(entries) {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const card = entry.target;
        const index = parseInt(card.dataset.index, 10);

        if (!isNaN(index)) {
          this.onCardVisible(index, card);
        }
      }
    });
  }

  onCardVisible(index, cardElement) {
    // Update Topic HUD Pill
    const topicPill = document.getElementById('hud-topic');
    const qData = this.questions[index];
    if (topicPill && qData) {
      topicPill.textContent = qData.moduleTitle || this.topic;
    }

    // Crucial Requirement: When the user reaches the 4th question of the batch (or within 2 cards of end),
    // trigger background AI prefetch for the next 5 questions.
    const isFourthQuestionOfBatch = (index % 5 === 3);
    const isNearEndOfList = (index >= this.questions.length - 2);

    if ((isFourthQuestionOfBatch || isNearEndOfList) && !this.isFetchingNextBatch) {
      console.log(`[DoomScroll] Triggering background prefetch at card #${index + 1}`);
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
    this.answeredQuestions.clear();
    this.feedElement.innerHTML = '';
    this.updateHUD();

    // Show initial loading skeleton / card
    this.showInitialLoader();

    // Fetch Batch 1 (First 5 questions)
    await this.fetchNextBatch();

    // Scroll to top card
    this.feedElement.scrollTop = 0;
  }

  showInitialLoader() {
    this.feedElement.innerHTML = `
      <div class="loading-card" id="feed-loader">
        <div class="spinner"></div>
        <div style="font-weight: 700; font-size: 1.1rem; color: #fff;">Curating Batch #1...</div>
        <div style="font-size: 0.85rem; color: var(--text-secondary);">Synthesizing challenging questions on ${this.topic}</div>
      </div>
    `;
  }

  async fetchNextBatch() {
    if (this.isFetchingNextBatch) return;
    this.isFetchingNextBatch = true;
    this.batchIndex += 1;

    console.log(`[DoomScroll] Requesting Batch #${this.batchIndex} (5 questions)...`);

    try {
      const newQuestions = await window.aiService.generateQuestionBatch(
        this.topic,
        this.plan,
        this.batchIndex,
        5,
        this.questions
      );

      // Remove initial loader if present
      const initialLoader = document.getElementById('feed-loader');
      if (initialLoader) initialLoader.remove();

      if (newQuestions && newQuestions.length > 0) {
        const startIndex = this.questions.length;
        this.questions.push(...newQuestions);
        this.renderNewCards(newQuestions, startIndex);
      }
    } catch (err) {
      console.error('Failed to load question batch:', err);
      const initialLoader = document.getElementById('feed-loader');
      if (initialLoader) initialLoader.remove();

      if (this.questions.length === 0) {
        // Display interactive error card
        this.feedElement.innerHTML = `
          <div class="loading-card" id="error-card" style="padding: 24px; text-align: center;">
            <div style="font-size: 2.5rem; margin-bottom: 8px;">⚠️</div>
            <div style="font-size: 1.15rem; font-weight: 800; color: #fff; margin-bottom: 8px;">AI Quiz Generation Failed</div>
            <div style="font-size: 0.85rem; color: #fb7185; margin-bottom: 20px; line-height: 1.4; background: rgba(244,63,94,0.1); border: 1px solid rgba(244,63,94,0.3); padding: 10px 14px; border-radius: 12px;">
              ${this.escapeHtml(err.message || 'Error communicating with AI.')}
            </div>
            <div style="display: flex; flex-direction: column; gap: 10px; width: 100%; max-width: 300px;">
              <button class="primary-btn" id="err-retry-btn" style="padding: 14px;">🔄 Retry Generation</button>
              <button class="secondary-btn" id="err-settings-btn" style="padding: 12px;">⚙️ Configure API Key</button>
              <button class="secondary-btn" id="err-logs-btn" style="padding: 12px;">📟 Inspect Logs</button>
            </div>
          </div>
        `;

        const retryBtn = document.getElementById('err-retry-btn');
        const settingsBtn = document.getElementById('err-settings-btn');
        const logsBtn = document.getElementById('err-logs-btn');

        if (retryBtn) retryBtn.addEventListener('click', () => {
          this.startQuiz(this.topic, this.plan);
        });

        if (settingsBtn) settingsBtn.addEventListener('click', () => {
          const sm = document.getElementById('settings-modal');
          if (sm) sm.classList.add('active');
        });

        if (logsBtn) logsBtn.addEventListener('click', () => {
          const lm = document.getElementById('logs-modal');
          if (lm) lm.classList.add('active');
        });
      } else {
        if (window.showToast) window.showToast(`Batch #${this.batchIndex} error: ${err.message}`);
      }
    } finally {
      this.isFetchingNextBatch = false;
    }
  }

  renderNewCards(newQuestions, startIndex) {
    newQuestions.forEach((q, offset) => {
      const globalIndex = startIndex + offset;
      const card = this.createCardElement(q, globalIndex);
      this.feedElement.appendChild(card);
      if (this.observer) this.observer.observe(card);
    });
  }

  createCardElement(q, index) {
    const card = document.createElement('div');
    card.className = 'quiz-card';
    card.dataset.index = index;
    card.id = `card-${index}`;

    const isBookmarked = this.bookmarkedQuestions.some(b => b.id === q.id || (b.question === q.question));
    const perplexityUrl = this.getPerplexityUrl(q);

    card.innerHTML = `
      <!-- Action Rail (TikTok / Shorts Style) -->
      <div class="action-rail">
        <button class="rail-btn bookmark-rail-btn ${isBookmarked ? 'active' : ''}" title="Save Question" data-index="${index}">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="${isBookmarked ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path></svg>
          <span class="rail-btn-label">Save</span>
        </button>

        <a href="${perplexityUrl}" target="_blank" rel="noopener noreferrer" class="rail-btn perplexity-rail" title="Ask Perplexity AI">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><path d="M12 16v-4M12 8h.01"></path></svg>
          <span class="rail-btn-label">Research</span>
        </a>

        <button class="rail-btn share-rail-btn" title="Share Question" data-index="${index}">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="18" cy="5" r="3"></circle><circle cx="6" cy="12" r="3"></circle><circle cx="18" cy="19" r="3"></circle><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line></svg>
          <span class="rail-btn-label">Share</span>
        </button>
      </div>

      <!-- Main Question Content Area -->
      <div class="card-main">
        <div class="card-tag-row">
          <span class="module-tag">${this.escapeHtml(q.moduleTitle || this.topic)}</span>
          <span class="card-index-tag">Card #${index + 1}</span>
        </div>

        <h2 class="question-text">${this.escapeHtml(q.question)}</h2>

        ${q.codeSnippet ? `<pre class="code-block"><code>${this.escapeHtml(q.codeSnippet)}</code></pre>` : ''}

        <!-- Options Grid -->
        <div class="options-grid">
          ${q.options.map((opt, optIdx) => {
            const letter = ['A', 'B', 'C', 'D'][optIdx] || String.fromCharCode(65 + optIdx);
            return `
              <button class="option-btn" data-card-index="${index}" data-option-index="${optIdx}">
                <div class="option-letter">${letter}</div>
                <div class="option-text">${this.escapeHtml(opt)}</div>
              </button>
            `;
          }).join('')}
        </div>

        <!-- Explanation & Perplexity CTA Panel -->
        <div class="explanation-panel" id="expl-${index}">
          <div class="explanation-header">
            <span class="explanation-badge">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
              Key Takeaway
            </span>
          </div>
          <p class="explanation-text">${this.escapeHtml(q.explanation)}</p>
          <a href="${perplexityUrl}" target="_blank" rel="noopener noreferrer" class="perplexity-btn">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>
            Ask Perplexity Deep Dive ↗
          </a>
        </div>
      </div>

      <!-- Bottom Swipe Hint -->
      <div class="swipe-hint">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"></polyline></svg>
        <span>Swipe up for next challenge</span>
      </div>
    `;

    // Attach Listeners
    const optionButtons = card.querySelectorAll('.option-btn');
    optionButtons.forEach(btn => btn.addEventListener('click', this.handleOptionSelect));

    const bookmarkBtn = card.querySelector('.bookmark-rail-btn');
    if (bookmarkBtn) {
      bookmarkBtn.addEventListener('click', () => this.toggleBookmark(q, bookmarkBtn));
    }

    const shareBtn = card.querySelector('.share-rail-btn');
    if (shareBtn) {
      shareBtn.addEventListener('click', () => this.shareQuestion(q));
    }

    return card;
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

    const allButtons = card.querySelectorAll('.option-btn');
    const isCorrect = selectedOptionIndex === q.correctAnswerIndex;

    // Sound and visual feedback
    if (isCorrect) {
      btn.classList.add('correct');
      if (window.soundEngine) window.soundEngine.playCorrect();
      this.score += 100;
      this.streak += 1;
      if (this.streak > this.maxStreak) this.maxStreak = this.streak;
      if (this.streak > 1 && this.streak % 3 === 0 && window.soundEngine) {
        window.soundEngine.playStreak();
      }
    } else {
      btn.classList.add('wrong');
      if (window.soundEngine) window.soundEngine.playIncorrect();
      this.streak = 0;
      // Highlight the correct answer for learning
      const correctBtn = card.querySelector(`[data-option-index="${q.correctAnswerIndex}"]`);
      if (correctBtn) correctBtn.classList.add('correct');
    }

    // Disable all options
    allButtons.forEach(b => b.classList.add('disabled'));

    // Reveal Explanation Panel
    const explPanel = document.getElementById(`expl-${cardIndex}`);
    if (explPanel) {
      explPanel.classList.add('visible');
    }

    this.updateHUD();
  }

  getPerplexityUrl(q) {
    const query = q.perplexityQuery || `Explain in depth with examples: ${q.question} (Topic: ${this.topic})`;
    return `https://www.perplexity.ai/search?q=${encodeURIComponent(query)}`;
  }

  toggleBookmark(q, btn) {
    const existingIndex = this.bookmarkedQuestions.findIndex(b => b.id === q.id || b.question === q.question);
    if (existingIndex > -1) {
      this.bookmarkedQuestions.splice(existingIndex, 1);
      btn.classList.remove('active');
      btn.querySelector('svg').setAttribute('fill', 'none');
      if (window.showToast) window.showToast('Question removed from bookmarks');
    } else {
      this.bookmarkedQuestions.push(q);
      btn.classList.add('active');
      btn.querySelector('svg').setAttribute('fill', 'currentColor');
      if (window.showToast) window.showToast('Question saved to bookmarks! 🌟');
    }
    localStorage.setItem('ds_bookmarks', JSON.stringify(this.bookmarkedQuestions));
  }

  shareQuestion(q) {
    const shareText = `DeepScroll Quiz: ${q.question}\nCan you solve it?`;
    if (navigator.share) {
      navigator.share({
        title: 'DeepScroll Quiz Challenge',
        text: shareText,
        url: window.location.href
      }).catch(() => {});
    } else if (navigator.clipboard) {
      navigator.clipboard.writeText(`${shareText}\n${window.location.href}`);
      if (window.showToast) window.showToast('Question link copied to clipboard!');
    }
  }

  updateHUD() {
    const streakElem = document.getElementById('hud-streak-count');
    const scoreElem = document.getElementById('hud-score-count');
    const streakBadge = document.getElementById('hud-streak-badge');

    if (streakElem) streakElem.textContent = this.streak;
    if (scoreElem) scoreElem.textContent = this.score;

    if (streakBadge) {
      if (this.streak >= 3) {
        streakBadge.classList.add('hot');
      } else {
        streakBadge.classList.remove('hot');
      }
    }
  }

  escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}

window.quizEngine = new QuizEngine();
