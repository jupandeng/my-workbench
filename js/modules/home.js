const HomeModule = {
  id: 'home',
  name: '首页',
  icon: '🏠',
  color: '#007AFF',
  clockTimer: null,

  init(container) {
    container.innerHTML = this.render();
    this.startClock();
    this.renderSummaries(container);
    this.bindClicks(container);
  },

  destroy() {
    if (this.clockTimer) { clearInterval(this.clockTimer); this.clockTimer = null; }
  },

  getSummary() {
    return null;
  },

  render() {
    return `
      <div class="home-clock">
        <div class="time" id="home-time">--:--</div>
        <div class="date" id="home-date"></div>
      </div>
      <div id="home-weather" class="card" style="min-height:50px;text-align:center;color:var(--text-secondary)">加载天气中...</div>
      <div class="module-grid" id="home-grid"></div>
    `;
  },

  startClock() {
    const update = () => {
      const now = new Date();
      const timeEl = document.getElementById('home-time');
      const dateEl = document.getElementById('home-date');
      if (timeEl) timeEl.textContent = now.toLocaleTimeString('zh-CN', { hour12: false });
      if (dateEl) {
        dateEl.textContent = now.toLocaleDateString('zh-CN', {
          year: 'numeric', month: 'long', day: 'numeric',
          weekday: 'long'
        });
      }
    };
    update();
    this.clockTimer = setInterval(update, 1000);
  },

  renderSummaries(container) {
    const grid = container.querySelector('#home-grid');
    const weatherCard = container.querySelector('#home-weather');
    const mods = App.modules.filter(m => m.id !== 'home');

    // Weather summary (rely on weather module's cached data)
    this.loadWeatherCard(weatherCard);

    // Module cards
    const cards = mods.map(m => {
      const summary = typeof m.getSummary === 'function' ? m.getSummary() : null;
      const text = summary || '点击查看';
      return `<div class="module-card" data-nav="${m.id}">
        <div class="mc-icon">${m.icon}</div>
        <div class="mc-name">${m.name}</div>
        <div class="mc-summary">${text}</div>
      </div>`;
    });
    grid.innerHTML = cards.join('');
  },

  async loadWeatherCard(el) {
    const result = await WeatherModule.getLocation();
    const loc = result.coords || null;
    if (!loc) {
      el.innerHTML = '<span style="color:var(--text-secondary)">点击天气卡片设置城市</span>';
      return;
    }
    try {
      const resp = await fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${loc.lat}&longitude=${loc.lon}&current=temperature_2m,weather_code&timezone=auto`
      );
      if (!resp.ok) throw new Error('API error');
      const data = await resp.json();
      if (!data.current) throw new Error('No current data');
      const temp = Math.round(data.current.temperature_2m);
      const code = data.current.weather_code;
      const desc = WeatherModule.getDesc(code);
      WeatherModule.weatherData = { temp, desc };
      el.innerHTML = `<span style="font-size:32px;font-weight:200;">${temp}°</span> <span style="font-size:15px;color:var(--text-secondary);">${desc}</span>`;
    } catch {
      el.innerHTML = '<span style="color:var(--text-secondary)">天气获取失败</span>';
    }
  },

  bindClicks(container) {
    container.querySelectorAll('.module-card').forEach(card => {
      card.addEventListener('click', () => {
        App.navigate(card.dataset.nav);
      });
    });
  }
};
