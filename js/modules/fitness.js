const FitnessModule = {
  id: 'fitness',
  name: '健身',
  icon: '💪',
  color: '#FF9500',

  init(container) {
    const data = Storage.get('fitness', { workouts: {}, presets: ['俯卧撑', '深蹲', '平板支撑', '引体向上', '哑铃弯举', '卧推', '硬拉', '跑步', '跳绳', '仰卧起坐'] });
    container.innerHTML = this.render(data);
    this.bindEvents(container, data);
  },

  destroy() {},

  getSummary() {
    const data = Storage.get('fitness', { workouts: {} });
    const today = this.today();
    const todayWorkout = data.workouts[today];
    if (todayWorkout && todayWorkout.length > 0) {
      const total = todayWorkout.reduce((s, e) => s + e.sets, 0);
      return `今日 ${todayWorkout.length} 个动作 · ${total} 组`;
    }
    return '今日还未训练';
  },

  today() {
    return new Date().toISOString().split('T')[0];
  },

  render(data) {
    const today = this.today();
    const todayWorkout = data.workouts[today] || [];
    const weekCount = Object.keys(data.workouts).filter(d => {
      const date = new Date(d);
      const now = new Date();
      const weekAgo = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7);
      return date >= weekAgo;
    }).length;

    const exerciseList = todayWorkout.map((ex, i) => `
      <div class="ex-item">
        <span class="ex-name">${this.escape(ex.name)}</span>
        <span class="ex-detail">${ex.sets}组 × ${ex.reps}${ex.weight > 0 ? ` · ${ex.weight}kg` : ''}</span>
        <button class="ex-del" data-idx="${i}">✕</button>
      </div>
    `).join('');

    return `
      <div class="card">
        <div class="section-header">
          <span class="card-title">💪 今日训练</span>
          <span style="font-size:12px;color:var(--text-secondary)">本周 ${weekCount} 天</span>
        </div>
        <div id="today-exercises">${exerciseList || '<div class="empty"><div class="empty-icon">🏋️</div>今天还没开练</div>'}</div>
        <button class="btn btn-blue" id="start-workout" style="width:100%;margin-top:12px">+ 添加动作</button>
      </div>

      <div class="card" id="add-exercise-card" style="display:none">
        <div class="card-title">添加训练动作</div>
        <div style="margin-bottom:8px;display:flex;flex-wrap:wrap;gap:6px" id="preset-btns">
          ${data.presets.map(p => `<button class="btn btn-small preset-btn">${this.escape(p)}</button>`).join('')}
        </div>
        <input class="f-input" id="ex-name" placeholder="动作名称" style="margin-bottom:8px;width:100%">
        <div style="display:flex;gap:8px;margin-bottom:8px">
          <input class="f-input" id="ex-sets" type="number" placeholder="组数" value="3" min="1" style="flex:1">
          <input class="f-input" id="ex-reps" type="number" placeholder="次数" value="12" min="1" style="flex:1">
          <input class="f-input" id="ex-weight" type="number" placeholder="重量kg" value="0" min="0" style="flex:1">
        </div>
        <div style="display:flex;gap:8px">
          <button class="btn btn-blue" id="add-exercise" style="flex:1">添加</button>
          <button class="btn btn-cancel" id="cancel-add">取消</button>
        </div>
      </div>

      <div class="card">
        <div class="card-title">📊 本周记录</div>
        <div id="week-log">
          ${this.renderWeekLog(data)}
        </div>
      </div>
    `;
  },

  renderWeekLog(data) {
    const weekDays = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().split('T')[0];
      const w = data.workouts[key];
      const label = ['日','一','二','三','四','五','六'][d.getDay()];
      const count = w ? w.length : 0;
      weekDays.push(`
        <div class="week-day ${count > 0 ? 'trained' : ''}">
          <div class="week-dot">${count > 0 ? '✓' : '·'}</div>
          <div class="week-label">${label}</div>
          <div style="font-size:10px;color:var(--text-secondary)">${count > 0 ? count+'项' : ''}</div>
        </div>
      `);
    }
    return `<div class="week-row">${weekDays.join('')}</div>`;
  },

  bindEvents(container, data) {
    container.querySelector('#start-workout')?.addEventListener('click', () => {
      container.querySelector('#add-exercise-card').style.display = 'block';
    });
    container.querySelector('#cancel-add')?.addEventListener('click', () => {
      container.querySelector('#add-exercise-card').style.display = 'none';
    });

    container.querySelectorAll('.preset-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        container.querySelector('#ex-name').value = btn.textContent;
      });
    });

    container.querySelector('#add-exercise')?.addEventListener('click', () => {
      const name = container.querySelector('#ex-name').value.trim();
      const sets = parseInt(container.querySelector('#ex-sets').value) || 0;
      const reps = parseInt(container.querySelector('#ex-reps').value) || 0;
      const weight = parseInt(container.querySelector('#ex-weight').value) || 0;
      if (!name || sets <= 0 || reps <= 0) return;

      const today = this.today();
      if (!data.workouts[today]) data.workouts[today] = [];
      data.workouts[today].push({ name, sets, reps, weight });
      Storage.set('fitness', data);
      this.init(container);
    });

    container.querySelectorAll('.ex-del').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.idx);
        const today = this.today();
        data.workouts[today].splice(idx, 1);
        if (data.workouts[today].length === 0) delete data.workouts[today];
        Storage.set('fitness', data);
        this.init(container);
      });
    });
  },

  escape(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }
};
