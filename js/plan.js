// ==========================================================================
// DeepScroll Learning Plan Manager & Dual Visual/JSON Editor
// ==========================================================================

class PlanManager {
  constructor() {
    this.currentPlan = null;
    this.container = null;
    this.activeMode = 'visual'; // 'visual' | 'json'
  }

  init(containerElement) {
    this.container = containerElement;
    this.bindToolbarEvents();
  }

  setPlan(plan) {
    this.currentPlan = JSON.parse(JSON.stringify(plan));
    this.render();
  }

  getPlan() {
    return this.currentPlan;
  }

  bindToolbarEvents() {
    const tabVisual = document.getElementById('plan-tab-visual');
    const tabJson = document.getElementById('plan-tab-json');
    const visualContainer = document.getElementById('plan-visual-container');
    const jsonContainer = document.getElementById('plan-json-container');
    const jsonInput = document.getElementById('plan-json-input');
    const formatBtn = document.getElementById('plan-json-format-btn');
    const copyBtn = document.getElementById('plan-json-copy-btn');
    const applyBtn = document.getElementById('plan-json-apply-btn');

    tabVisual?.addEventListener('click', () => {
      if (this.activeMode === 'json') {
        const success = this.applyJsonChanges(false);
        if (!success) return; // don't switch if invalid JSON
      }
      this.activeMode = 'visual';
      tabVisual.classList.add('active');
      tabJson?.classList.remove('active');
      if (visualContainer) visualContainer.style.display = 'block';
      if (jsonContainer) jsonContainer.style.display = 'none';
    });

    tabJson?.addEventListener('click', () => {
      this.activeMode = 'json';
      tabJson.classList.add('active');
      tabVisual?.classList.remove('active');
      if (visualContainer) visualContainer.style.display = 'none';
      if (jsonContainer) jsonContainer.style.display = 'block';
      if (jsonInput) jsonInput.value = JSON.stringify(this.currentPlan, null, 2);
      this.clearJsonError();
    });

    formatBtn?.addEventListener('click', () => {
      try {
        const parsed = JSON.parse(jsonInput?.value || '{}');
        if (jsonInput) jsonInput.value = JSON.stringify(parsed, null, 2);
        this.clearJsonError();
        if (window.showToast) window.showToast('JSON Formatted! ✨');
      } catch (e) {
        this.showJsonError(`Invalid JSON: ${e.message}`);
      }
    });

    copyBtn?.addEventListener('click', () => {
      const code = jsonInput?.value || JSON.stringify(this.currentPlan, null, 2);
      navigator.clipboard.writeText(code).then(() => {
        if (copyBtn) copyBtn.textContent = 'Copied! ✓';
        setTimeout(() => { if (copyBtn) copyBtn.textContent = '📋 Copy'; }, 2000);
      });
    });

    applyBtn?.addEventListener('click', () => {
      this.applyJsonChanges(true);
    });
  }

  applyJsonChanges(notify = true) {
    const jsonInput = document.getElementById('plan-json-input');
    const raw = jsonInput?.value?.trim();
    if (!raw) return false;

    try {
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') throw new Error('Root must be a valid JSON object');
      if (!Array.isArray(parsed.modules) || parsed.modules.length === 0) {
        throw new Error('"modules" must be an array with at least 1 milestone');
      }

      parsed.modules = parsed.modules.map((m, idx) => ({
        id: m.id || idx + 1,
        title: m.title || `Milestone ${idx + 1}`,
        summary: m.summary || '',
        keyConcepts: Array.isArray(m.keyConcepts) ? m.keyConcepts : [],
        targetQuestions: Math.max(1, parseInt(m.targetQuestions, 10) || 5)
      }));

      this.currentPlan = parsed;
      this.render();
      this.clearJsonError();
      if (notify && window.showToast) window.showToast('Curriculum plan updated from JSON! ✓');
      return true;
    } catch (err) {
      this.showJsonError(err.message);
      return false;
    }
  }

  showJsonError(msg) {
    const errBox = document.getElementById('plan-json-error');
    if (errBox) {
      errBox.style.display = 'block';
      errBox.textContent = msg;
    }
  }

  clearJsonError() {
    const errBox = document.getElementById('plan-json-error');
    if (errBox) errBox.style.display = 'none';
  }

  render() {
    if (!this.container || !this.currentPlan) return;
    const { title, summary, difficulty, modules } = this.currentPlan;
    const totalQuestions = modules.reduce((sum, m) => sum + (parseInt(m.targetQuestions, 10) || 5), 0);

    const planTitleElem = document.getElementById('plan-display-title');
    const planSummaryElem = document.getElementById('plan-display-summary');
    const planBadgeElem = document.getElementById('plan-display-badge');

    if (planTitleElem) planTitleElem.textContent = title || `Learning Plan`;
    if (planSummaryElem) planSummaryElem.textContent = summary || `Review and adjust your learning milestones below:`;
    if (planBadgeElem) planBadgeElem.textContent = `${difficulty || 'Intermediate'} • ${modules.length} Milestones • 🎯 ${totalQuestions} Total Questions`;

    this.container.innerHTML = '';
    modules.forEach((mod, idx) => {
      if (!mod.targetQuestions) mod.targetQuestions = 5;

      const item = document.createElement('div');
      item.className = 'plan-item';
      item.dataset.index = idx;

      item.innerHTML = `
        <div class="plan-item-index">${idx + 1}</div>
        <div class="plan-item-content">
          <input type="text" class="plan-item-input" value="${this.escapeHtml(mod.title)}" data-field="title" placeholder="Module Title" />
          <input type="text" class="plan-item-detail" value="${this.escapeHtml(mod.summary || (mod.keyConcepts ? mod.keyConcepts.join(', ') : ''))}" data-field="summary" placeholder="Key concepts or focus areas" />
          
          <div class="plan-q-alloc-row">
            <span class="plan-q-alloc-label">Questions:</span>
            <div class="q-stepper">
              <button class="q-stepper-btn minus-btn" data-index="${idx}">−</button>
              <span class="q-stepper-val">${mod.targetQuestions} Qs</span>
              <button class="q-stepper-btn plus-btn" data-index="${idx}">+</button>
            </div>
          </div>
        </div>
        <div class="plan-item-actions">
          <button class="plan-action-btn delete-btn" title="Delete Module" data-index="${idx}">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
          </button>
        </div>
      `;

      item.querySelector('[data-field="title"]')?.addEventListener('input', (e) => {
        this.currentPlan.modules[idx].title = e.target.value;
      });

      item.querySelector('[data-field="summary"]')?.addEventListener('input', (e) => {
        this.currentPlan.modules[idx].summary = e.target.value;
      });

      item.querySelector('.delete-btn')?.addEventListener('click', () => this.removeModule(idx));

      item.querySelector('.minus-btn')?.addEventListener('click', () => {
        if (this.currentPlan.modules[idx].targetQuestions > 1) {
          this.currentPlan.modules[idx].targetQuestions -= 1;
          this.render();
          if (window.soundEngine) window.soundEngine.playTap();
        }
      });

      item.querySelector('.plus-btn')?.addEventListener('click', () => {
        if (this.currentPlan.modules[idx].targetQuestions < 30) {
          this.currentPlan.modules[idx].targetQuestions += 1;
          this.render();
          if (window.soundEngine) window.soundEngine.playTap();
        }
      });

      this.container.appendChild(item);
    });
  }

  addModule() {
    if (!this.currentPlan) return;
    const newIdx = this.currentPlan.modules.length + 1;
    this.currentPlan.modules.push({
      id: newIdx,
      title: `Milestone ${newIdx}: New Topic`,
      summary: `Focus on core principles and practical examples`,
      keyConcepts: ['Concepts', 'Best Practices'],
      targetQuestions: 5
    });
    this.render();
    if (window.soundEngine) window.soundEngine.playTap();
  }

  removeModule(index) {
    if (!this.currentPlan || this.currentPlan.modules.length <= 1) {
      if (window.showToast) window.showToast('You must have at least 1 module in the plan');
      return;
    }
    this.currentPlan.modules.splice(index, 1);
    this.render();
    if (window.soundEngine) window.soundEngine.playTap();
  }

  escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
}

window.planManager = new PlanManager();
