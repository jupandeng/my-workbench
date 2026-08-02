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
          🔄 重新定位
        </button>
      </div>
      <div id="wt-manual-box" style="display:none"></div>
      <div id="wt-error-msg" style="display:none;text-align:center;padding:8px"></div>
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

  // 返回 { coords } 或 { error: '原因' }
  async getLocation() {
    // 1. 检查 GPS 硬件是否可用
    if (!navigator.geolocation) {
      return { error: '浏览器不支持GPS，请手动搜索城市' };
    }

    // 2. 检查权限状态（如果之前被拒绝，直接跳过）
    let permissionDenied = false;
    try {
      if (navigator.permissions) {
        const perm = await navigator.permissions.query({ name: 'geolocation' });
        if (perm.state === 'denied') permissionDenied = true;
      }
    } catch {}

    if (!permissionDenied) {
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
        return { coords };
      } catch (err) {
        // err.code: 1=PERMISSION_DENIED, 2=POSITION_UNAVAILABLE, 3=TIMEOUT
        if (err.code === 1) {
          return { error: '定位权限被拒绝了' };
        }
        // 其他错误继续尝试 IP 定位
      }
    } else {
      // 权限已被拒绝，不尝试 GPS
    }

    // 3. 有缓存直接返回
    const cached = Storage.get('location');
    if (cached) return { coords: cached };

    // 4. IP 定位（ipapi.co 国内可能慢，加 api.ip.sb 备用）
    const ipApis = [
      { url: 'https://api.ip.sb/geoip', map: d => ({ lat: d.latitude, lon: d.longitude, city: d.city || '' }) },
      { url: 'https://ipapi.co/json/', map: d => ({ lat: d.latitude, lon: d.longitude, city: d.city || d.region || '' }) }
    ];
    for (const api of ipApis) {
      try {
        const resp = await fetch(api.url, { signal: AbortSignal.timeout(4000) });
        if (resp.ok) {
          const data = await resp.json();
          const coords = api.map(data);
          if (coords.lat && coords.lon) {
            Storage.set('location', coords);
            return { coords };
          }
        }
      } catch {}
    }

    // 5. 全部失败
    if (permissionDenied) {
      return { error: '定位权限已被拒绝，请在 iPhone「设置 → Safari → 位置」中允许访问' };
    }
    return { error: '自动定位失败，请手动搜索城市' };
  },

  async loadWeather(container) {
    const info = container.querySelector('#wt-info');
    const refreshBtn = container.querySelector('#wt-refresh');
    const manualBtn = container.querySelector('#wt-manual');
    const manualBox = container.querySelector('#wt-manual-box');
    const errorMsg = container.querySelector('#wt-error-msg');

    // 如果有缓存位置，先显示缓存天气（秒出）
    const cached = this.locationCache;
    if (cached) {
      await this.fetchWeather(info, cached.lat, cached.lon, cached.city);
      refreshBtn.style.display = '';
      manualBtn.textContent = '🔍 切换城市';
    }

    // 后台重新定位
    const result = await this.getLocation();
    if (result.coords) {
      this.locationCache = result.coords;
      await this.fetchWeather(info, result.coords.lat, result.coords.lon, result.coords.city);
      refreshBtn.style.display = '';
      manualBtn.textContent = '🔍 切换城市';
      if (errorMsg) errorMsg.style.display = 'none';
    } else if (result.error) {
      // 显示具体错误原因
      if (!cached) {
        info.innerHTML = `
          <div style="color:var(--text-secondary);padding:10px;text-align:center">
            <div style="font-size:48px;margin-bottom:8px">🌍</div>
            <div style="font-size:14px;margin-bottom:6px">${result.error}</div>
            <div style="font-size:12px;color:var(--text-secondary)">点击下方按钮搜索城市</div>
          </div>
        `;
      }
      if (errorMsg) {
        errorMsg.style.display = 'block';
        errorMsg.innerHTML = `<span style="font-size:11px;color:var(--text-secondary)">${result.error}</span>`;
      }
    }

    // 手动搜索按钮
    manualBtn.onclick = () => {
      if (manualBox.style.display === 'none') {
        manualBox.style.display = 'block';
        manualBox.innerHTML = `
          <div class="card" style="margin-top:10px">
            <div style="font-size:13px;color:var(--text-secondary);margin-bottom:6px">输入城市名搜索天气</div>
            <div style="display:flex;gap:8px;align-items:center">
              <input id="city-input" class="todo-input" style="flex:1;text-align:center" placeholder="如：武汉">
              <button class="btn btn-blue" id="city-btn">搜索</button>
            </div>
            <div id="city-suggestions" style="margin-top:8px;display:flex;flex-wrap:wrap;gap:6px"></div>
          </div>
        `;
        this.renderCitySuggestions(manualBox);
        this.bindCitySearch(container);
        // 聚焦输入框
        setTimeout(() => { const inp = manualBox.querySelector('#city-input'); if (inp) inp.focus(); }, 100);
      } else {
        manualBox.style.display = 'none';
      }
    };

    // 刷新按钮
    refreshBtn.onclick = async () => {
      info.innerHTML = '<div style="color:var(--text-secondary);padding:20px">🔄 定位中...</div>';
      this.locationCache = null;
      Storage.remove('location');
      const result = await this.getLocation();
      if (result.coords) {
        this.locationCache = result.coords;
        await this.fetchWeather(info, result.coords.lat, result.coords.lon, result.coords.city);
        if (errorMsg) errorMsg.style.display = 'none';
      } else {
        info.innerHTML = `
          <div style="color:var(--text-secondary);padding:10px;text-align:center">
            <div style="font-size:14px;margin-bottom:6px">${result.error}</div>
          </div>
        `;
      }
    };
  },

  renderCitySuggestions(box) {
    const suggestions = [
      '北京', '上海', '广州', '深圳', '成都', '杭州', '南京', '武汉', '西安', '重庆',
      '香港', '澳门', '台北', '东京', '大阪', '首尔', '釜山',
      '新加坡', '吉隆坡', '曼谷', '河内', '胡志明市', '雅加达', '马尼拉', '金边', '万象',
      '迪拜', '多哈', '利雅得', '伊斯坦布尔', '安卡拉', '耶路撒冷', '德黑兰',
      '伦敦', '巴黎', '柏林', '罗马', '马德里', '巴塞罗那', '莫斯科', '阿姆斯特丹', '布鲁塞尔', '维也纳', '布拉格', '布达佩斯', '华沙', '斯德哥尔摩', '哥本哈根', '赫尔辛基', '里斯本', '雅典', '都柏林', '苏黎世', '日内瓦',
      '纽约', '洛杉矶', '芝加哥', '旧金山', '西雅图', '华盛顿', '波士顿', '迈阿密', '多伦多', '温哥华', '蒙特利尔', '墨西哥城',
      '悉尼', '墨尔本', '布里斯班', '奥克兰', '惠灵顿',
      '圣保罗', '布宜诺斯艾利斯', '圣地亚哥', '利马', '波哥大',
      '开罗', '内罗毕', '开普敦', '约翰内斯堡', '拉各斯', '卡萨布兰卡',
      '孟买', '新德里', '班加罗尔', '加尔各答', '伊斯兰堡', '达卡',
      '基辅', '明斯克', '塔什干', '乌兰巴托'
    ];
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

          const manualBox = container.querySelector('#wt-manual-box');
          if (manualBox) manualBox.style.display = 'none';
          const refreshBtn = container.querySelector('#wt-refresh');
          if (refreshBtn) refreshBtn.style.display = '';
          const manualBtn = container.querySelector('#wt-manual');
          if (manualBtn) manualBtn.textContent = '🔍 切换城市';
          const errorMsg = container.querySelector('#wt-error-msg');
          if (errorMsg) errorMsg.style.display = 'none';
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
