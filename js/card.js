// ==========================================================================
// DeepScroll Card Renderer - 100dvh Snap Card DOM Component
// ==========================================================================

class CardRenderer {
  createCardElement(q, index, totalMilestones, isBookmarked) {
    const card = document.createElement('div');
    card.className = 'quiz-card';
    card.dataset.index = index;
    card.id = `card-${index}`;

    const perplexityUrl = this.getPerplexityUrl(q);
    const modNum = q.moduleIndex !== undefined ? q.moduleIndex + 1 : 1;
    const modTitle = q.moduleTitle || 'Review';

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
          <span class="module-tag">Topic ${modNum}/${totalMilestones}: ${this.escapeHtml(modTitle)}</span>
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

    return card;
  }

  getPerplexityUrl(q) {
    const query = q.perplexityQuery || `Explain in depth with examples: ${q.question}`;
    return `https://www.perplexity.ai/search?q=${encodeURIComponent(query)}`;
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

window.cardRenderer = new CardRenderer();
