// ==========================================================================
// DeepScroll Bookmarks & Share Manager
// ==========================================================================

class BookmarksManager {
  constructor() {
    this.bookmarks = JSON.parse(localStorage.getItem('ds_bookmarks') || '[]');
  }

  isBookmarked(q) {
    return this.bookmarks.some(b => b.id === q.id || b.question === q.question);
  }

  toggleBookmark(q, btn) {
    const idx = this.bookmarks.findIndex(b => b.id === q.id || b.question === q.question);
    if (idx > -1) {
      this.bookmarks.splice(idx, 1);
      btn?.classList.remove('active');
      btn?.querySelector('svg')?.setAttribute('fill', 'none');
      if (window.showToast) window.showToast('Question removed from bookmarks');
    } else {
      this.bookmarks.push(q);
      btn?.classList.add('active');
      btn?.querySelector('svg')?.setAttribute('fill', 'currentColor');
      if (window.showToast) window.showToast('Question saved to bookmarks! 🌟');
    }
    localStorage.setItem('ds_bookmarks', JSON.stringify(this.bookmarks));
  }

  share(q) {
    const shareText = `DeepScroll Quiz: ${q.question}\nCan you solve it?`;
    if (navigator.share) {
      navigator.share({ title: 'DeepScroll Quiz Challenge', text: shareText, url: window.location.href }).catch(() => {});
    } else if (navigator.clipboard) {
      navigator.clipboard.writeText(`${shareText}\n${window.location.href}`);
      if (window.showToast) window.showToast('Question link copied to clipboard!');
    }
  }

  renderList(containerElement) {
    if (!containerElement) return;
    if (this.bookmarks.length === 0) {
      containerElement.innerHTML = `
        <div style="text-align: center; color: var(--text-muted); padding: 40px 10px;">
          <div style="font-size: 2rem; margin-bottom: 8px;">📑</div>
          <div style="font-weight: 700; color:#fff;">No saved questions yet</div>
          <div style="font-size: 0.8rem; margin-top: 4px;">Tap the bookmark icon on any card during the quiz to save it.</div>
        </div>
      `;
      return;
    }

    containerElement.innerHTML = this.bookmarks.map((b, idx) => {
      const perplexityUrl = window.cardRenderer.getPerplexityUrl(b);
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

    containerElement.querySelectorAll('.delete-bookmark-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.index, 10);
        this.bookmarks.splice(idx, 1);
        localStorage.setItem('ds_bookmarks', JSON.stringify(this.bookmarks));
        this.renderList(containerElement);
      });
    });
  }
}

window.bookmarksManager = new BookmarksManager();
