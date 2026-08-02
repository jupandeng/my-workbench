const TodoModule = {
  id: 'todo',
  name: '待办',
  icon: '✅',
  color: '#34C759',

  init(container) {
    container.innerHTML = this.render();
    this.renderList(container);
    this.bindEvents(container);
  },

  destroy() {},

  getSummary() {
    const todos = Storage.get('todos', []);
    const undone = todos.filter(t => !t.done).length;
    return undone ? `待完成 ${undone} 项` : '全部完成 ✓';
  },

  render() {
    return `
      <div class="todo-input-row">
        <input class="todo-input" id="todo-input" placeholder="添加新任务..." autocomplete="off">
        <button class="btn btn-blue" id="todo-add">添加</button>
      </div>
      <div id="todo-list"></div>
      <div class="empty" id="todo-empty" style="display:none">
        <div class="empty-icon">📝</div>
        <div>还没有任务，添加一个吧</div>
      </div>
    `;
  },

  renderList(container) {
    const todos = Storage.get('todos', []);
    const list = container.querySelector('#todo-list');
    const empty = container.querySelector('#todo-empty');

    if (!todos.length) {
      list.innerHTML = '';
      if (empty) empty.style.display = 'block';
      return;
    }
    if (empty) empty.style.display = 'none';

    list.innerHTML = todos.map((t, i) => `
      <div class="todo-item" data-index="${i}">
        <div class="todo-check${t.done ? ' done' : ''}" data-action="toggle" data-index="${i}"></div>
        <span class="todo-text${t.done ? ' done' : ''}">${this.escape(t.text)}</span>
        <span class="todo-del" data-action="del" data-index="${i}">删除</span>
      </div>
    `).join('');
  },

  bindEvents(container) {
    const input = container.querySelector('#todo-input');
    const addBtn = container.querySelector('#todo-add');
    const list = container.querySelector('#todo-list');

    const add = () => {
      const text = input.value.trim();
      if (!text) return;
      const todos = Storage.get('todos', []);
      todos.push({ text, done: false });
      Storage.set('todos', todos);
      input.value = '';
      this.renderList(container);
    };

    addBtn.addEventListener('click', add);
    input.addEventListener('keydown', e => { if (e.key === 'Enter') add(); });

    list.addEventListener('click', e => {
      const btn = e.target.closest('[data-action]');
      if (!btn) return;
      const idx = parseInt(btn.dataset.index);
      const todos = Storage.get('todos', []);

      if (btn.dataset.action === 'toggle') {
        todos[idx].done = !todos[idx].done;
      } else if (btn.dataset.action === 'del') {
        todos.splice(idx, 1);
      }
      Storage.set('todos', todos);
      this.renderList(container);
    });
  },

  escape(str) {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
};
