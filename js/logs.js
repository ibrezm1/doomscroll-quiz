// ==========================================================================
// DeepScroll Logs Manager - Real-time AI Request & Response JSON Inspector
// ==========================================================================

class LogsManager {
  constructor() {
    this.modal = null;
    this.listContainer = null;
    this.badgeCount = null;
    this.filter = 'all'; // 'all' | 'success' | 'error'
  }

  init({ modalId = 'logs-modal', listId = 'logs-list', badgeId = 'logs-badge-count' } = {}) {
    this.modal = document.getElementById(modalId);
    this.listContainer = document.getElementById(listId);
    this.badgeCount = document.getElementById(badgeId);

    this.bindEvents();
    this.updateBadge();
  }

  bindEvents() {
    const hudBtn = document.getElementById('logs-hud-btn');
    const closeBtn = document.getElementById('close-logs-btn');
    const clearBtn = document.getElementById('clear-logs-btn');

    const filterAll = document.getElementById('filter-logs-all');
    const filterSuccess = document.getElementById('filter-logs-success');
    const filterError = document.getElementById('filter-logs-error');

    if (hudBtn) {
      hudBtn.addEventListener('click', () => this.open());
    }

    if (closeBtn) {
      closeBtn.addEventListener('click', () => this.close());
    }

    if (this.modal) {
      this.modal.addEventListener('click', (e) => {
        if (e.target === this.modal) this.close();
      });
    }

    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        if (window.aiService) window.aiService.clearLogs();
        this.render();
        this.updateBadge();
        if (window.showToast) window.showToast('All API logs cleared');
      });
    }

    const setFilter = (mode, activeBtn) => {
      this.filter = mode;
      [filterAll, filterSuccess, filterError].forEach(btn => btn?.classList.remove('active'));
      activeBtn?.classList.add('active');
      this.render();
    };

    filterAll?.addEventListener('click', () => setFilter('all', filterAll));
    filterSuccess?.addEventListener('click', () => setFilter('success', filterSuccess));
    filterError?.addEventListener('click', () => setFilter('error', filterError));

    // Listen for live log entries from AIService
    window.addEventListener('ds_log_updated', () => {
      this.updateBadge();
      if (this.isOpen()) this.render();
    });
  }

  open() {
    this.render();
    this.modal?.classList.add('active');
  }

  close() {
    this.modal?.classList.remove('active');
  }

  isOpen() {
    return this.modal?.classList.contains('active');
  }

  updateBadge() {
    if (!this.badgeCount || !window.aiService) return;
    const count = window.aiService.getLogs().length;
    this.badgeCount.textContent = count;
    this.badgeCount.style.display = count > 0 ? 'flex' : 'none';
  }

  render() {
    if (!this.listContainer || !window.aiService) return;
    const allLogs = window.aiService.getLogs();

    const filtered = allLogs.filter(item => {
      if (this.filter === 'success') return item.success;
      if (this.filter === 'error') return !item.success;
      return true;
    });

    if (filtered.length === 0) {
      this.listContainer.innerHTML = `
        <div style="text-align: center; color: var(--text-muted); padding: 40px 10px;">
          <div style="font-size: 2rem; margin-bottom: 8px;">📡</div>
          <div style="font-weight: 700; color: #fff;">No API call logs recorded</div>
          <div style="font-size: 0.8rem; margin-top: 4px;">Outbound requests and response JSON will appear here in real-time.</div>
        </div>
      `;
      return;
    }

    this.listContainer.innerHTML = filtered.map(log => {
      const isSuccess = log.success;
      const statusClass = isSuccess ? 'status-ok' : 'status-err';
      const cardClass = isSuccess ? 'success' : 'error';
      const statusText = isSuccess ? `${log.status || 200} OK` : `${log.status || 'ERR'}`;
      const statusIcon = isSuccess ? '🟢' : '🔴';

      const requestJSON = JSON.stringify(log.request || {}, null, 2);
      const responseJSON = JSON.stringify(log.response || {}, null, 2);

      return `
        <div class="log-row-card ${cardClass}" id="${log.id}">
          <!-- Clickable Row Header -->
          <div class="log-row-header" data-log-id="${log.id}">
            <div class="log-row-left">
              <span class="log-status-dot">${statusIcon}</span>
              <div class="log-row-info">
                <div class="log-row-title">${this.escape(log.type || 'AI CALL')}</div>
                <div class="log-row-submeta">
                  <span>${log.provider || 'AI'} • ${this.escape(log.model || 'default')}</span>
                  <span>•</span>
                  <span>${log.time}</span>
                </div>
              </div>
            </div>

            <div class="log-row-right">
              <span class="log-meta-tag ${statusClass}">
                ${statusText} • ${log.latency || 0}ms
              </span>
              <button class="log-details-toggle-btn" data-log-id="${log.id}" title="Inspect Details">
                <span>Details</span>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"></polyline></svg>
              </button>
            </div>
          </div>

          <!-- Collapsible Request & Response Info -->
          <div class="log-row-body" id="body_${log.id}">
            <div class="log-meta-grid">
              <div class="log-meta-item"><strong>Provider:</strong> ${log.provider || 'AI'}</div>
              <div class="log-meta-item"><strong>Model:</strong> ${this.escape(log.model || 'default')}</div>
              <div class="log-meta-item"><strong>Status:</strong> ${log.status || 200}</div>
              <div class="log-meta-item"><strong>Latency:</strong> ${log.latency || 0} ms</div>
              <div class="log-meta-item" style="grid-column: 1 / -1;"><strong>Timestamp:</strong> ${log.time}</div>
              ${log.url ? `<div class="log-meta-item" style="grid-column: 1 / -1; word-break: break-all;"><strong>Endpoint:</strong> ${this.escape(log.url)}</div>` : ''}
            </div>

            <!-- Request Payload -->
            <div class="log-section-box">
              <div class="log-section-header">
                <span>📤 Request Payload & Prompt</span>
                <button class="copy-json-btn" data-target="${log.id}_req">Copy Input JSON</button>
              </div>
              <div class="json-viewer-wrapper">
                <pre class="json-code" id="${log.id}_req"><code>${this.escape(requestJSON)}</code></pre>
              </div>
            </div>

            <!-- Response JSON -->
            <div class="log-section-box">
              <div class="log-section-header">
                <span>📥 Response Output JSON</span>
                <button class="copy-json-btn" data-target="${log.id}_res">Copy Output JSON</button>
              </div>
              <div class="json-viewer-wrapper">
                <pre class="json-code" id="${log.id}_res" style="color: ${isSuccess ? '#34d399' : '#fb7185'};"><code>${this.escape(responseJSON)}</code></pre>
              </div>
            </div>
          </div>
        </div>
      `;
    }).join('');

    // Accordion Toggle
    this.listContainer.querySelectorAll('.log-row-header').forEach(header => {
      header.addEventListener('click', (e) => {
        if (e.target.closest('.copy-json-btn')) return;
        const logId = header.dataset.logId;
        const card = document.getElementById(logId);
        card?.classList.toggle('expanded');
      });
    });

    // Copy JSON Buttons
    this.listContainer.querySelectorAll('.copy-json-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        e.preventDefault();
        const targetId = btn.dataset.target;
        const targetElem = document.getElementById(targetId);
        if (targetElem) {
          navigator.clipboard.writeText(targetElem.textContent).then(() => {
            const orig = btn.textContent;
            btn.textContent = 'Copied! ✓';
            setTimeout(() => { btn.textContent = orig; }, 2000);
          });
        }
      });
    });
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

window.logsManager = new LogsManager();
