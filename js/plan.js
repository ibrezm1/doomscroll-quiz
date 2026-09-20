// ==========================================================================
// DeepScroll Learning Plan Manager & Interactive Editor
// ==========================================================================

class PlanManager {
  constructor() {
    this.currentPlan = null;
    this.container = null;
  }

  init(containerElement) {
    this.container = containerElement;
  }

  setPlan(plan) {
    this.currentPlan = JSON.parse(JSON.stringify(plan));
    this.render();
  }

  getPlan() {
    return this.currentPlan;
  }

  render() {
    if (!this.container || !this.currentPlan) return;

    const { title, summary, difficulty, modules } = this.currentPlan;

    // Calculate Total Questions
    const totalQuestions = modules.reduce((sum, m) => sum + (parseInt(m.targetQuestions, 10) || 5), 0);

    // Update Header
    const planTitleElem = document.getElementById('plan-display-title');
    const planSummaryElem = document.getElementById('plan-display-summary');
    const planBadgeElem = document.getElementById('plan-display-badge');

    if (planTitleElem) planTitleElem.textContent = title || `Learning Plan`;
    if (planSummaryElem) planSummaryElem.textContent = summary || `Review and adjust your learning milestones below:`;
    if (planBadgeElem) planBadgeElem.textContent = `${difficulty || 'Intermediate'} • ${modules.length} Milestones • 🎯 ${totalQuestions} Total Questions`;

    // Render Modules List
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
          
          <!-- Question Allocation Stepper -->
          <div class="plan-q-alloc-row">
            <span class="plan-q-alloc-label">Questions:</span>
            <div class="q-stepper">
              <button class="q-stepper-btn minus-btn" data-index="${idx}" title="Decrease questions">−</button>
              <span class="q-stepper-val">${mod.targetQuestions} Qs</span>
              <button class="q-stepper-btn plus-btn" data-index="${idx}" title="Increase questions">+</button>
            </div>
          </div>
        </div>
        <div class="plan-item-actions">
          <button class="plan-action-btn delete-btn" title="Delete Module" data-index="${idx}">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
          </button>
        </div>
      `;

      // Input listeners for real-time state sync
      const titleInput = item.querySelector('[data-field="title"]');
      const summaryInput = item.querySelector('[data-field="summary"]');
      const deleteBtn = item.querySelector('.delete-btn');
      const minusBtn = item.querySelector('.minus-btn');
      const plusBtn = item.querySelector('.plus-btn');

      titleInput.addEventListener('input', (e) => {
        this.currentPlan.modules[idx].title = e.target.value;
      });

      summaryInput.addEventListener('input', (e) => {
        this.currentPlan.modules[idx].summary = e.target.value;
      });

      deleteBtn.addEventListener('click', () => {
        this.removeModule(idx);
      });

      minusBtn.addEventListener('click', () => {
        if (this.currentPlan.modules[idx].targetQuestions > 1) {
          this.currentPlan.modules[idx].targetQuestions -= 1;
          this.render();
          if (window.soundEngine) window.soundEngine.playTap();
        }
      });

      plusBtn.addEventListener('click', () => {
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
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}

window.planManager = new PlanManager();
