const App = {
  modules: [],
  activeId: 'home',

  register(mod) {
    this.modules.push(mod);
  },

  getModule(id) {
    return this.modules.find(m => m.id === id);
  },

  navigate(id) {
    if (this.activeId === id) return;
    const prev = this.getModule(this.activeId);
    if (prev && prev.destroy) prev.destroy();

    this.activeId = id;
    const mod = this.getModule(id);
    const container = document.getElementById('content');
    container.innerHTML = '';
    if (mod && mod.init) mod.init(container);

    this.renderTabs();
  },

  renderTabs() {
    const bar = document.getElementById('tab-bar');
    bar.innerHTML = this.modules.map(m => {
      const active = m.id === this.activeId ? ' active' : '';
      return `<div class="tab-item${active}" data-id="${m.id}">
        <span class="tab-icon">${m.icon}</span>
        <span>${m.name}</span>
      </div>`;
    }).join('');

    bar.querySelectorAll('.tab-item').forEach(el => {
      el.addEventListener('click', () => this.navigate(el.dataset.id));
    });
  },

  init() {
    // 注册顺序决定 Tab 顺序
    this.register(HomeModule);
    this.register(WeatherModule);
    this.register(ScheduleModule);
    this.register(TodoModule);
    this.register(ShortcutsModule);

    this.renderTabs();
    this.navigate('home');
  }
};

document.addEventListener('DOMContentLoaded', () => App.init());
