const WeatherModule = {
  id: 'weather',
  name: '天气',
  icon: '⏰',
  color: '#FF9500',
  clockTimer: null,
  weatherData: null,

  init(container) {
    container.innerHTML = this.render();
    this.startClock();
    this.loadWeather(container);
  },

  destroy() {
    if (this.clockTimer) { clearInterval(this.clockTimer); this.clockTimer = null; }
  },

  getSummary() {
    if (this.weatherData) {
      return `${this.weatherData.temp}° ${this.weatherData.desc}`;
    }
    return '加载中...';
  },

  render() {
    return `
      <div class="home-clock">
        <div class="time" id="wt-time">--:--:--</div>
        <div class="date" id="wt-date"></div>
      </div>
      <div class="card weather-main" id="wt-info">
        <div style="color:var(--text-secondary)">正在获取天气...</div>
      </div>
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

  // 三层降级获取位置：GPS → IP 定位 → 缓存 → 手动
  async getLocation() {
    // 1. 尝试浏览器 GPS 定位（仅 HTTPS 可用）
    try {
      const pos = await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 4000 });
      });
      const coords = { lat: pos.coords.latitude, lon: pos.coords.longitude };
      Storage.set('location', coords);
      return coords;
    } catch {}

    // 2. 尝试 IP 定位（HTTP 下也能用）
    try {
      const resp = await fetch('https://ipapi.co/json/', { signal: AbortSignal.timeout(4000) });
      if (resp.ok) {
        const data = await resp.json();
        if (data.latitude && data.longitude) {
          const coords = { lat: data.latitude, lon: data.longitude, city: data.city };
          Storage.set('location', coords);
          return coords;
        }
      }
    } catch {}

    // 3. 使用缓存的定位
    const cached = Storage.get('location');
    if (cached) return cached;

    // 4. 全部失败
    return null;
  },

  async loadWeather(container) {
    const info = container.querySelector('#wt-info');
    info.innerHTML = '<div style="color:var(--text-secondary)">正在获取位置...</div>';

    const loc = await this.getLocation();
    if (!loc) {
      info.innerHTML = `
        <div style="color:var(--text-secondary);padding:10px">
          无法自动定位<br><br>
          <div style="font-size:13px">请手动输入城市名：</div>
          <div style="display:flex;gap:8px;margin-top:8px;justify-content:center">
            <input id="city-input" class="todo-input" style="max-width:140px;text-align:center" placeholder="如：北京">
            <button class="btn btn-small btn-blue" id="city-btn">查询</button>
          </div>
        </div>
      `;
      this.bindCitySearch(container);
      return;
    }

    await this.fetchWeather(info, loc.lat, loc.lon);
  },

  async fetchWeather(info, lat, lon) {
    info.innerHTML = '<div style="color:var(--text-secondary)">正在获取天气...</div>';
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

      this.weatherData = { temp, desc };
      info.innerHTML = `
        <div class="weather-temp">${temp}°</div>
        <div class="weather-desc">${desc}</div>
        <div class="weather-detail">
          <span>💧 湿度 ${hum}%</span>
          <span>🌬 风速 ${wind} km/h</span>
        </div>
      `;
    } catch {
      info.innerHTML = '<div style="color:var(--text-secondary);padding:20px">天气数据获取失败<br>请检查网络后重试</div>';
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
      try {
        const resp = await fetch(
          `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=zh`
        );
        const data = await resp.json();
        if (data.results && data.results.length) {
          const r = data.results[0];
          const coords = { lat: r.latitude, lon: r.longitude, city: r.name };
          Storage.set('location', coords);
          await this.fetchWeather(info, r.latitude, r.longitude);
        } else {
          info.innerHTML = '<div style="color:var(--text-secondary);padding:20px">未找到该城市<br>请尝试其他城市名</div>';
        }
      } catch {
        info.innerHTML = '<div style="color:var(--text-secondary);padding:20px">查询失败，请检查网络</div>';
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
  }
};
