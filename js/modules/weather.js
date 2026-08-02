const WeatherModule = {
  id: 'weather',
  name: '天气',
  icon: '⏰',
  color: '#FF9500',
  clockTimer: null,
  weatherData: null,
  locationCache: null,

  init(container) {
    this.locationCache = Storage.get('location');
    container.innerHTML = this.render();
    this.startClock();
    this.loadWeather(container);
  },

  destroy() {
    if (this.clockTimer) { clearInterval(this.clockTimer); this.clockTimer = null; }
  },

  getSummary() {
    if (this.weatherData) return `${this.weatherData.temp}° ${this.weatherData.desc}`;
    return '加载中...';
  },

  render() {
    const loc = this.locationCache;
    const cityHint = loc && loc.city ? `📍 ${loc.city}` : '';
    return `
      <div class="home-clock">
        <div class="time" id="wt-time">--:--:--</div>
        <div class="date" id="wt-date"></div>
      </div>
      <div class="card weather-main" id="wt-info">
        <div style="color:var(--text-secondary)">
          ${loc ? '更新天气中...' : '正在自动定位...'}
          ${cityHint ? `<br><span style="font-size:12px">${cityHint}</span>` : ''}
        </div>
      </div>
      <div style="text-align:center;margin-top:8px">
        <button class="btn btn-small" id="wt-manual" style="font-size:11px;color:var(--text-secondary)">
          🔍 手动搜索城市
        </button>
        <button class="btn btn-small" id="wt-refresh" style="font-size:11px;color:var(--text-secondary);display:none">
          🔄 刷新
        </button>
      </div>
      <div id="wt-manual-box" style="display:none"></div>
    `;
  },

  startClock() {
    const update = () => {
      const now = new Date();
      const timeEl = document.getElementById('wt-time');
      const dateEl = document.getElementById('wt-date');
      if (timeEl) timeEl.textContent = now.toLocaleTimeString('zh-CN', { hour12: false });
      if (dateEl) {
        dateEl.textContent = now.toLocaleDateString('zh-CN', {
          year: 'numeric', month: 'long', day: 'numeric', weekday: 'long'
        });
      }
    };
    update();
    this.clockTimer = setInterval(update, 1000);
  },

  // 自动获取位置：GPS → 缓存 → IP → 手动
  async getLocation() {
    // 1. 尝试 GPS（HTTPS 下可用，iPhone Safari 会弹授权）
    try {
      const pos = await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          timeout: 10000,
          maximumAge: 600000,
          enableHighAccuracy: false
        });
      });
      const coords = { lat: pos.coords.latitude, lon: pos.coords.longitude };
      // 反查城市名
      try {
        const resp = await fetch(
          `https://geocoding-api.open-meteo.com/v1/search?latitude=${coords.lat}&longitude=${coords.lon}&count=1&language=zh`,
          { signal: AbortSignal.timeout(3000) }
        );
        if (resp.ok) {
          const data = await resp.json();
          if (data.results && data.results.length) {
            coords.city = data.results[0].name;
          }
        }
      } catch {}
      Storage.set('location', coords);
      return coords;
    } catch {}

    // 2. 先返回缓存（如果有的话）
    const cached = Storage.get('location');
    if (cached) return cached;

    // 3. IP 定位兜底
    try {
      const resp = await fetch('https://ipapi.co/json/', { signal: AbortSignal.timeout(5000) });
      if (resp.ok) {
        const data = await resp.json();
        if (data.latitude && data.longitude) {
          const coords = { lat: data.latitude, lon: data.longitude, city: data.city || data.region };
          Storage.set('location', coords);
          return coords;
        }
      }
    } catch {}

    return null;
  },

  async loadWeather(container) {
    const info = container.querySelector('#wt-info');
    const refreshBtn = container.querySelector('#wt-refresh');
    const manualBtn = container.querySelector('#wt-manual');
    const manualBox = container.querySelector('#wt-manual-box');

    // 如果有缓存位置，先显示缓存天气
    const cached = this.locationCache;
    if (cached) {
      await this.fetchWeather(info, cached.lat, cached.lon, cached.city);
      refreshBtn.style.display = '';
      manualBtn.textContent = '🔍 切换城市';
    }

    // 后台重新定位（获取更精确的位置）
    const loc = await this.getLocation();
    if (loc) {
      this.locationCache = loc;
      await this.fetchWeather(info, loc.lat, loc.lon, loc.city);
      refreshBtn.style.display = '';
      manualBtn.textContent = '🔍 切换城市';
    } else if (!cached) {
      // 没有任何位置信息，显示手动输入
      info.innerHTML = `
        <div style="color:var(--text-secondary);padding:10px">
          <div style="font-size:48px;margin-bottom:8px">🌍</div>
          无法自动定位，请手动输入城市
        </div>
      `;
    }

    // 手动搜索按钮
    manualBtn.onclick = () => {
      if (manualBox.style.display === 'none') {
        manualBox.style.display = 'block';
        manualBox.innerHTML = `
          <div class="card" style="margin-top:10px">
            <div style="display:flex;gap:8px;align-items:center">
              <input id="city-input" class="todo-input" style="flex:1;text-align:center" placeholder="输入城市名，如：武汉">
              <button class="btn btn-blue" id="city-btn">搜索</button>
            </div>
            <div id="city-suggestions" style="margin-top:8px;display:flex;flex-wrap:wrap;gap:6px"></div>
          </div>
        `;
        this.renderCitySuggestions(manualBox);
        this.bindCitySearch(container);
      } else {
        manualBox.style.display = 'none';
      }
    };

    // 刷新按钮
    refreshBtn.onclick = async () => {
      info.innerHTML = '<div style="color:var(--text-secondary);padding:20px">定位中...</div>';
      this.locationCache = null;
      Storage.remove('location');
      const newLoc = await this.getLocation();
      if (newLoc) {
        this.locationCache = newLoc;
        await this.fetchWeather(info, newLoc.lat, newLoc.lon, newLoc.city);
      }
    };
  },

  renderCitySuggestions(box) {
    const suggestions = ['武汉', '北京', '上海', '广州', '深圳', '成都', '杭州', '南京', '西安', '重庆'];
    const el = box.querySelector('#city-suggestions');
    if (!el) return;
    el.innerHTML = suggestions.map(c =>
      `<button class="btn btn-small city-chip">${c}</button>`
    ).join('');
    el.querySelectorAll('.city-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        const input = box.querySelector('#city-input');
        input.value = chip.textContent;
        box.querySelector('#city-btn').click();
      });
    });
  },

  async fetchWeather(info, lat, lon, cityName) {
    info.innerHTML = '<div style="color:var(--text-secondary);padding:20px">获取天气中...</div>';
    try {
      const resp = await fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code&timezone=auto`
      );
      if (!resp.ok) throw new Error('API error');
      const data = await resp.json();
      if (!data.current) throw new Error('No current data');
      const cur = data.current;
      const temp = Math.round(cur.temperature_2m);
      const desc = this.getDesc(cur.weather_code);
      const hum = cur.relative_humidity_2m;
      const wind = Math.round(cur.wind_speed_10m);
      const locLine = cityName ? `<div style="font-size:12px;color:var(--text-secondary);margin-top:2px">📍 ${cityName}</div>` : '';

      this.weatherData = { temp, desc };
      info.innerHTML = `
        ${locLine}
        <div class="weather-temp">${temp}°</div>
        <div class="weather-desc">${desc}</div>
        <div class="weather-detail">
          <span>💧 湿度 ${hum}%</span>
          <span>🌬 风速 ${wind} km/h</span>
        </div>
      `;
    } catch {
      info.innerHTML = '<div style="color:var(--text-secondary);padding:20px">天气获取失败<br><span style="font-size:13px">下拉刷新或检查网络</span></div>';
    }
  },

  bindCitySearch(container) {
    const btn = container.querySelector('#city-btn');
    const input = container.querySelector('#city-input');
    if (!btn || !input) return;

    const search = async () => {
      const city = input.value.trim();
      if (!city) return;
      const info = container.querySelector('#wt-info');
      info.innerHTML = '<div style="color:var(--text-secondary);padding:20px">搜索中...</div>';
      try {
        const resp = await fetch(
          `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=zh`
        );
        const data = await resp.json();
        if (data.results && data.results.length) {
          const r = data.results[0];
          const coords = { lat: r.latitude, lon: r.longitude, city: r.name };
          Storage.set('location', coords);
          this.locationCache = coords;
          await this.fetchWeather(info, r.latitude, r.longitude, r.name);

          // 隐藏搜索框
          const manualBox = container.querySelector('#wt-manual-box');
          if (manualBox) manualBox.style.display = 'none';
          const refreshBtn = container.querySelector('#wt-refresh');
          if (refreshBtn) refreshBtn.style.display = '';
          const manualBtn = container.querySelector('#wt-manual');
          if (manualBtn) manualBtn.textContent = '🔍 切换城市';
        } else {
          info.innerHTML = `<div style="color:var(--text-secondary);padding:20px">未找到「${this.escape(city)}」<br><span style="font-size:13px">请尝试其他城市名</span></div>`;
        }
      } catch {
        info.innerHTML = '<div style="color:var(--text-secondary);padding:20px">搜索失败，请检查网络</div>';
      }
    };

    btn.addEventListener('click', search);
    input.addEventListener('keydown', e => { if (e.key === 'Enter') search(); });
  },

  getDesc(code) {
    if (code <= 3) return '☀️ 晴朗';
    if (code <= 48) return '☁️ 多云';
    if (code <= 57) return '🌫️ 雾';
    if (code <= 67) return '🌧️ 小雨';
    if (code <= 77) return '❄️ 雪';
    if (code <= 82) return '🌧️ 阵雨';
    return '⛈️ 雷雨';
  },

  escape(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }
};
