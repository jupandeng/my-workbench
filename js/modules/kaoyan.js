const KaoyanModule = {
  id: 'kaoyan',
  name: '28考研',
  icon: '📚',
  color: '#5856D6',

  defaultSubjects: [
    { name: '数学', icon: '📐', progress: 0, color: '#007AFF' },
    { name: '英语', icon: '🔤', progress: 0, color: '#FF9500' },
    { name: '政治', icon: '📖', progress: 0, color: '#FF3B30' },
    { name: '专业课', icon: '💻', progress: 0, color: '#34C759' }
  ],

  init(container) {
    const data = Storage.get('kaoyan', this.defaultData());
    container.innerHTML = this.render(data);
    this.bindEvents(container, data);
  },

  destroy() {},

  defaultData() {
    return {
      examDate: '2027-12-20',
      subjects: JSON.parse(JSON.stringify(this.defaultSubjects)),
      dailyTasks: [],
      studyLog: {}
    };
  },

  getSummary() {
    const data = Storage.get('kaoyan', this.defaultData());
    const days = this.calcDays(data.examDate);
    if (days <= 0) return '考研加油！';
    const avgProgress = Math.round(data.subjects.reduce((s, sub) => s + sub.progress, 0) / data.subjects.length);
    return `倒计时 ${days} 天 · 进度 ${avgProgress}%`;
  },

  calcDays(examDate) {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const exam = new Date(examDate);
    exam.setHours(0, 0, 0, 0);
    return Math.ceil((exam - now) / (1000 * 60 * 60 * 24));
  },

  today() {
    return new Date().toISOString().split('T')[0];
  },

  render(data) {
    const days = this.calcDays(data.examDate);

    const subjectCards = data.subjects.map(sub => `
      <div class="kaoyan-subject" data-sub="${sub.name}">
        <div class="sub-header">
          <span>${sub.icon} ${this.escape(sub.name)}</span>
          <span style="font-size:13px;font-weight:600;color:${sub.color}">${sub.progress}%</span>
        </div>
        <div class="sub-bar"><div class="sub-fill" style="width:${sub.progress}%;background:${sub.color}"></div></div>
        <div style="display:flex;gap:6px;margin-top:8px">
          <button class="btn btn-small sub-btn" data-sub="${sub.name}" data-delta="10">+10%</button>
          <button class="btn btn-small sub-btn" data-sub="${sub.name}" data-delta="5">+5%</button>
          <button class="btn btn-small sub-btn" data-sub="${sub.name}" data-delta="-10">-10%</button>
        </div>
      </div>
    `).join('');

    const today = this.today();
    const todayTasks = (data.dailyTasks || []).filter(t => t.date === today);
    const taskList = todayTasks.map((t, i) => `
      <div class="todo-item">
        <div class="todo-check ${t.done ? 'done' : ''}" data-kaoyan-idx="${i}"></div>
        <span class="todo-text ${t.done ? 'done' : ''}">${this.escape(t.text)}</span>
        <span class="todo-del" data-kaoyan-idx="${i}">✕</span>
      </div>
    `).join('');

    // Study log for today
    const todayHours = (data.studyLog && data.studyLog[today]) || 0;

    return `
      <div class="card" style="text-align:center">
        <div style="font-size:14px;color:var(--text-secondary);margin-bottom:4px">
          📅 ${data.examDate} · 目标：28考研上岸
        </div>
        <div style="font-size:64px;font-weight:200;color:${days <= 30 ? 'var(--red)' : 'var(--blue)'}">
          ${days > 0 ? days : '🎉'}
        </div>
        <div style="font-size:15px;color:var(--text-secondary)">
          ${days > 0 ? `距离考研还有 <strong>${days}</strong> 天` : '考试已结束'}
        </div>
        ${days > 0 ? `<button class="btn btn-small" id="change-date" style="margin-top:8px">修改考试日期</button>` : ''}
      </div>

      <div class="card">
        <div class="card-title">📊 科目进度</div>
        ${subjectCards}
        <button class="btn btn-small" id="add-subject" style="margin-top:10px">+ 自定义科目</button>
      </div>

      <div class="card">
        <div class="section-header">
          <span class="card-title">📝 今日学习</span>
          <span style="font-size:12px;color:var(--text-secondary)">⏱ ${todayHours}h</span>
        </div>
        ${taskList || '<div class="empty" style="padding:16px">今天还没有学习任务</div>'}
        <div class="todo-input-row" style="margin-top:10px;margin-bottom:0">
          <input class="todo-input" id="kaoyan-input" placeholder="添加学习任务...">
          <button class="btn btn-blue" id="kaoyan-add">添加</button>
        </div>
        <div style="margin-top:10px;display:flex;gap:8px;align-items:center">
          <span style="font-size:13px;color:var(--text-secondary)">今日学时</span>
          <input class="f-input" id="study-hours" type="number" value="${todayHours}" min="0" max="24" step="0.5" style="width:70px">
          <span style="font-size:13px;color:var(--text-secondary)">h</span>
          <button class="btn btn-small" id="save-hours">保存</button>
        </div>
      </div>

      <div class="card">
        <div class="card-title">🔥 本周学习记录</div>
        ${this.renderWeekLog(data)}
      </div>
    `;
  },

  renderWeekLog(data) {
    const weekDays = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().split('T')[0];
      const hours = (data.studyLog && data.studyLog[key]) || 0;
      const label = ['日','一','二','三','四','五','六'][d.getDay()];
      const height = Math.min(hours * 10, 80);
      weekDays.push(`
        <div class="week-day">
          <div class="study-bar"><div class="study-fill" style="height:${height}px"></div></div>
          <div style="font-size:10px;color:var(--text-secondary)">${hours}h</div>
          <div class="week-label">${label}</div>
        </div>
      `);
    }
    return `<div class="week-row" style="align-items:flex-end;gap:8px">${weekDays.join('')}</div>`;
  },

  bindEvents(container, data) {
    container.querySelector('#change-date')?.addEventListener('click', () => {
      const input = document.createElement('input');
      input.type = 'date';
      input.value = data.examDate;
      input.style.cssText = 'width:100%;padding:10px;border-radius:10px;border:none;background:rgba(118,118,128,0.12);font-size:15px;color:var(--text)';
      const btn = document.createElement('button');
      btn.className = 'btn btn-blue';
      btn.textContent = '确认';
      btn.style.cssText = 'width:100%;margin-top:8px';

      const card = container.querySelector('.card');
      const old = card.querySelector('div:first-child');
      old.innerHTML = '';
      old.appendChild(input);
      old.appendChild(btn);

      btn.addEventListener('click', () => {
        data.examDate = input.value;
        Storage.set('kaoyan', data);
        this.init(container);
      });
    });

    container.querySelectorAll('.sub-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const subName = btn.dataset.sub;
        const delta = parseInt(btn.dataset.delta);
        const sub = data.subjects.find(s => s.name === subName);
        if (sub) {
          sub.progress = Math.max(0, Math.min(100, sub.progress + delta));
          Storage.set('kaoyan', data);
          this.init(container);
        }
      });
    });

    container.querySelector('#add-subject')?.addEventListener('click', () => {
      const name = prompt('输入科目名称：');
      if (!name || !name.trim()) return;
      data.subjects.push({ name: name.trim(), icon: '📌', progress: 0, color: '#' + Math.floor(Math.random()*16777215).toString(16).padStart(6,'0') });
      Storage.set('kaoyan', data);
      this.init(container);
    });

    container.querySelector('#kaoyan-add')?.addEventListener('click', () => {
      const input = container.querySelector('#kaoyan-input');
      const text = input.value.trim();
      if (!text) return;
      const today = this.today();
      if (!data.dailyTasks) data.dailyTasks = [];
      data.dailyTasks.push({ text, done: false, date: today });
      Storage.set('kaoyan', data);
      this.init(container);
    });

    container.querySelector('#save-hours')?.addEventListener('click', () => {
      const hours = parseFloat(container.querySelector('#study-hours').value) || 0;
      const today = this.today();
      if (!data.studyLog) data.studyLog = {};
      data.studyLog[today] = hours;
      Storage.set('kaoyan', data);
      this.init(container);
    });

    container.querySelectorAll('.todo-check[data-kaoyan-idx]').forEach(check => {
      check.addEventListener('click', () => {
        const idx = parseInt(check.dataset.kaoyanIdx);
        const today = this.today();
        const tasks = data.dailyTasks.filter(t => t.date === today);
        tasks[idx].done = !tasks[idx].done;
        Storage.set('kaoyan', data);
        this.init(container);
      });
    });

    container.querySelectorAll('.todo-del[data-kaoyan-idx]').forEach(del => {
      del.addEventListener('click', () => {
        const idx = parseInt(del.dataset.kaoyanIdx);
        const today = this.today();
        const tasks = data.dailyTasks.filter(t => t.date === today);
        tasks.splice(idx, 1);
        data.dailyTasks = data.dailyTasks.filter(t => t.date !== today).concat(tasks);
        Storage.set('kaoyan', data);
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
