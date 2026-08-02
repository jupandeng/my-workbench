const ShortcutsModule = {
  id: 'shortcuts',
  name: '快捷',
  icon: '🔗',
  color: '#FF3B30',

  presetLinks: [
    { name: '百度', url: 'https://www.baidu.com', color: '#3388FF' },
    { name: 'GitHub', url: 'https://github.com', color: '#24292e' },
    { name: 'B站', url: 'https://www.bilibili.com', color: '#FB7299' },
    { name: '知乎', url: 'https://www.zhihu.com', color: '#0066FF' },
    { name: 'CSDN', url: 'https://www.csdn.net', color: '#FC5531' },
    { name: 'MDN', url: 'https://developer.mozilla.org', color: '#000' },
    { name: 'LeetCode', url: 'https://leetcode.cn', color: '#FFA116' },
    { name: '掘金', url: 'https://juejin.cn', color: '#1E80FF' },
  ],

  init(container) {
    container.innerHTML = this.render();
    this.renderLinks(container);
    this.renderCountdowns(container);
    this.bindEvents(container);
  },

  destroy() {},

  getSummary() {
    const countdowns = Storage.get('countdowns', []);
    if (countdowns.length) {
      const nearest = [...countdowns].sort((a, b) => new Date(a.date) - new Date(b.date))[0];
      const days = this.calcDays(nearest.date);
      if (isNaN(days)) return '点击添加倒数日';
      return `${nearest.name}: ${days}天`;
    }
    return '点击添加倒数日';
  },

  render() {
    return `
      <div class="card">
        <div class="section-header">
          <div class="card-title">快捷链接</div>
          <button class="add-btn" id="link-add-btn">+</button>
        </div>
        <div class="link-grid" id="link-grid"></div>
      </div>
      <div class="card">
        <div class="section-header">
          <div class="card-title">倒数日</div>
          <button class="add-btn" id="countdown-add-btn">+</button>
        </div>
        <div class="countdown-list" id="countdown-list"></div>
      </div>
    `;
  },

  renderLinks(container) {
    const links = Storage.get('links', this.presetLinks);
    const grid = container.querySelector('#link-grid');
    grid.innerHTML = links.map((l, i) => `
      <div class="link-item" data-link="${i}">
        <div class="link-icon" style="background:${l.color || '#8e8e93'}">${l.name[0]}</div>
        <div class="link-name">${this.escape(l.name)}</div>
      </div>
    `).join('');
  },

  renderCountdowns(container) {
    const countdowns = Storage.get('countdowns', []);
    const list = container.querySelector('#countdown-list');
    if (!countdowns.length) {
      list.innerHTML = '<div class="empty"><div class="empty-icon">📅</div><div>还没有倒数日</div></div>';
      return;
    }
    const sorted = [...countdowns].sort((a, b) => new Date(a.date) - new Date(b.date));
    list.innerHTML = sorted.map((c, i) => {
      const days = this.calcDays(c.date);
      const label = isNaN(days) ? '日期无效' : (days < 0 ? '已过' : days + '天');
      return `<div class="countdown-item">
        <div>
          <div style="font-weight:500">${this.escape(c.name)}</div>
          <div style="font-size:12px;color:var(--text-secondary)">${c.date}</div>
        </div>
        <div style="display:flex;align-items:center;gap:8px">
          <span class="countdown-days">${label}</span>
          <span class="todo-del" data-action="del-cd" data-index="${countdowns.indexOf(c)}">删除</span>
        </div>
      </div>`;
    }).join('');
  },

  calcDays(dateStr) {
    const target = new Date(dateStr);
    if (isNaN(target.getTime())) return NaN;
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    target.setHours(0, 0, 0, 0);
    return Math.ceil((target - now) / (1000 * 60 * 60 * 24));
  },

  bindEvents(container) {
    // Link click
    container.querySelector('#link-grid').addEventListener('click', e => {
      const item = e.target.closest('.link-item');
      if (!item) return;
      const links = Storage.get('links', this.presetLinks);
      const idx = parseInt(item.dataset.link);
      if (links[idx]) window.open(links[idx].url, '_blank');
    });

    // Add link
    container.querySelector('#link-add-btn').addEventListener('click', () => {
      this.showModal('链接', { name: '', url: '', color: '#007AFF' }, (data) => {
        const links = Storage.get('links', this.presetLinks);
        links.push(data);
        Storage.set('links', links);
        this.renderLinks(container);
      });
    });

    // Add countdown
    container.querySelector('#countdown-add-btn').addEventListener('click', () => {
      this.showModal('倒数日', { name: '', date: '' }, (data) => {
        const countdowns = Storage.get('countdowns', []);
        countdowns.push(data);
        Storage.set('countdowns', countdowns);
        this.renderCountdowns(container);
      });
    });

    // Delete countdown
    container.querySelector('#countdown-list').addEventListener('click', e => {
      const del = e.target.closest('[data-action="del-cd"]');
      if (!del) return;
      const countdowns = Storage.get('countdowns', []);
      countdowns.splice(parseInt(del.dataset.index), 1);
      Storage.set('countdowns', countdowns);
      this.renderCountdowns(container);
    });
  },

  showModal(title, defaults, onSave) {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';

    const fields = Object.keys(defaults).filter(k => k !== 'color').map(k =>
      `<label>${k === 'name' ? '名称' : k === 'url' ? '网址' : k === 'date' ? '日期' : k}</label>
       <input id="m-${k}" value="${this.escape(defaults[k])}" placeholder="${k === 'url' ? 'https://' : k === 'date' ? '2026-08-15' : ''}" type="${k === 'date' ? 'date' : 'text'}">`
    ).join('');

    overlay.innerHTML = `
      <div class="modal">
        <h3>添加${title}</h3>
        ${fields}
        <div class="modal-btns">
          <button class="btn btn-small btn-cancel" id="m-cancel">取消</button>
          <button class="btn btn-small btn-blue" id="m-save">保存</button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);
    overlay.querySelector('#m-cancel').onclick = () => overlay.remove();
    overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });

    overlay.querySelector('#m-save').onclick = () => {
      const data = {};
      for (const k of Object.keys(defaults)) {
        const el = overlay.querySelector(`#m-${k}`);
        if (el) data[k] = el.value.trim();
      }
      if (!data.name) return;
      overlay.remove();
      onSave(data);
    };
  },

  escape(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
};
