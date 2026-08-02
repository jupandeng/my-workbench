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
    const hasCache = loc && loc.lat;
    return `
      <div class="home-clock">
        <div class="time" id="wt-time">--:--:--</div>
        <div class="date" id="wt-date"></div>
      </div>
      <div class="card weather-main" id="wt-info">
        <div style="color:var(--text-secondary)">
          ${hasCache ? '更新天气中...' : '点击下方按钮获取天气'}
        </div>
      </div>
      <div id="wt-gps-area" style="text-align:center;margin-bottom:10px;${hasCache ? 'display:none' : ''}">
        <button class="btn btn-blue" id="wt-gps-btn" style="width:100%;padding:12px;font-size:15px">
          📍 使用我的位置
        </button>
        <div style="font-size:11px;color:var(--text-secondary);margin-top:4px">
          点击按钮后 iPhone 会询问定位权限
        </div>
      </div>
      <div class="card" style="margin-top:4px">
        <div style="font-size:12px;color:var(--text-secondary);margin-bottom:6px">
          🌍 或搜索全球任意城市
        </div>
        <div style="display:flex;gap:8px">
          <input id="city-input" class="todo-input" style="flex:1;text-align:center" placeholder="输入城市名，如：东京、伦敦、纽约...">
          <button class="btn btn-blue" id="city-btn">查询</button>
        </div>
        <div id="city-suggestions" style="margin-top:8px;max-height:160px;overflow-y:auto;display:flex;flex-wrap:wrap;gap:5px"></div>
        <div id="city-search-status" style="font-size:11px;color:var(--text-secondary);margin-top:6px;text-align:center"></div>
      </div>
      <button class="btn btn-small" id="wt-refresh" style="font-size:11px;color:var(--text-secondary);display:none;margin:8px auto;width:fit-content">
        📍 使用当前位置
      </button>
      <div id="wt-error-msg" style="display:none;text-align:center;padding:4px"></div>
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
    if (!navigator.geolocation) {
      return { error: '浏览器不支持GPS' };
    }

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
            timeout: 10000, maximumAge: 600000, enableHighAccuracy: false
          });
        });
        const coords = { lat: pos.coords.latitude, lon: pos.coords.longitude };
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
        if (err.code === 1) {
          return { error: '定位权限被拒绝，请在手机设置中允许' };
        }
      }
    }

    const cached = Storage.get('location');
    if (cached) return { coords: cached };

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

    if (permissionDenied) {
      return { error: '定位权限已被拒绝，请手动搜索城市' };
    }
    return { error: '自动定位失败，请手动搜索城市' };
  },

  async loadWeather(container) {
    const info = container.querySelector('#wt-info');
    const gpsArea = container.querySelector('#wt-gps-area');
    const gpsBtn = container.querySelector('#wt-gps-btn');
    const refreshBtn = container.querySelector('#wt-refresh');
    const errorMsg = container.querySelector('#wt-error-msg');

    // 渲染快捷城市按钮
    this.renderCitySuggestions(container);

    // 绑定搜索
    this.bindCitySearch(container);

    // 如果有缓存位置，直接加载天气（不需要权限）
    const cached = this.locationCache;
    if (cached && cached.lat) {
      await this.fetchWeather(info, cached.lat, cached.lon, cached.city);
      if (refreshBtn) refreshBtn.style.display = '';
      if (gpsArea) gpsArea.style.display = 'none';
    }

    // GPS 按钮：用户主动点击才触发（iOS 要求 user gesture）
    const doGPS = async () => {
      if (gpsArea) gpsArea.style.display = 'none';
      info.innerHTML = '<div style="color:var(--text-secondary);padding:20px">📍 正在获取位置...</div>';
      // 清除旧缓存，强制重新定位
      this.locationCache = null;
      Storage.remove('location');
      const r = await this.getLocation();
      if (r.coords) {
        this.locationCache = r.coords;
        await this.fetchWeather(info, r.coords.lat, r.coords.lon, r.coords.city);
        if (refreshBtn) refreshBtn.style.display = '';
        if (errorMsg) errorMsg.style.display = 'none';
      } else {
        info.innerHTML = `<div style="color:var(--text-secondary);padding:20px;text-align:center">
          <div style="font-size:48px;margin-bottom:8px">📍</div>
          <div style="font-size:14px">${r.error || '定位失败'}</div>
          <div style="font-size:12px;margin-top:6px">请在 iPhone「设置 → Safari → 位置」中允许，<br>然后使用下方搜索框查天气</div>
        </div>`;
        if (gpsArea) gpsArea.style.display = 'block';
      }
    };

    if (gpsBtn) gpsBtn.onclick = doGPS;
    if (refreshBtn) refreshBtn.onclick = doGPS;
  },

  renderCitySuggestions(container) {
    const regions = {
      '🇨🇳 中国': ['北京', '上海', '广州', '深圳', '成都', '杭州', '南京', '武汉', '西安', '重庆', '香港', '澳门', '台北', '天津', '苏州', '长沙', '青岛', '大连', '厦门', '郑州', '昆明'],
      '🌏 亚洲': ['东京', '大阪', '首尔', '釜山', '新加坡', '吉隆坡', '曼谷', '清迈', '河内', '胡志明市', '雅加达', '巴厘岛', '马尼拉', '金边', '万象', '仰光', '迪拜', '阿布扎比', '多哈', '利雅得', '伊斯坦布尔', '安卡拉', '耶路撒冷', '德黑兰', '孟买', '新德里', '班加罗尔', '加尔各答', '伊斯兰堡', '达卡', '科伦坡', '加德满都', '乌兰巴托', '塔什干'],
      '🇪🇺 欧洲': ['伦敦', '巴黎', '柏林', '罗马', '马德里', '巴塞罗那', '莫斯科', '圣彼得堡', '阿姆斯特丹', '布鲁塞尔', '维也纳', '布拉格', '布达佩斯', '华沙', '斯德哥尔摩', '哥本哈根', '赫尔辛基', '奥斯陆', '里斯本', '雅典', '都柏林', '苏黎世', '日内瓦', '米兰', '威尼斯', '佛罗伦萨', '慕尼黑', '法兰克福', '汉堡', '基辅', '明斯克'],
      '🇺🇸 北美': ['纽约', '洛杉矶', '芝加哥', '旧金山', '西雅图', '华盛顿', '波士顿', '迈阿密', '拉斯维加斯', '圣地亚哥', '波特兰', '费城', '亚特兰大', '休斯顿', '达拉斯', '多伦多', '温哥华', '蒙特利尔', '卡尔加里', '墨西哥城', '坎昆'],
      '🌏 大洋洲': ['悉尼', '墨尔本', '布里斯班', '珀斯', '阿德莱德', '奥克兰', '惠灵顿', '基督城', '皇后镇', '斐济'],
      '🌎 南美': ['圣保罗', '里约热内卢', '布宜诺斯艾利斯', '圣地亚哥', '利马', '波哥大', '基多', '蒙得维的亚', '加拉加斯'],
      '🌍 非洲': ['开罗', '内罗毕', '开普敦', '约翰内斯堡', '拉各斯', '卡萨布兰卡', '马拉喀什', '达累斯萨拉姆', '亚的斯亚贝巴', '毛里求斯']
    };

    const el = container.querySelector('#city-suggestions');
    if (!el) return;

    let html = '';
    for (const [region, cities] of Object.entries(regions)) {
      html += `<div style="width:100%;font-size:10px;color:var(--text-secondary);margin-top:6px;padding-left:2px">${region}</div>`;
      html += cities.map(c => `<button class="btn btn-small city-chip" style="font-size:10px;padding:3px 7px">${c}</button>`).join('');
    }
    el.innerHTML = html;

    el.querySelectorAll('.city-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        const input = container.querySelector('#city-input');
        input.value = chip.textContent;
        container.querySelector('#city-btn').click();
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
      info.innerHTML = '<div style="color:var(--text-secondary);padding:20px">天气获取失败<br><span style="font-size:13px">请检查网络后重试</span></div>';
    }
  },

  bindCitySearch(container) {
    const btn = container.querySelector('#city-btn');
    const input = container.querySelector('#city-input');
    const status = container.querySelector('#city-search-status');
    if (!btn || !input) return;

    const search = async () => {
      const city = input.value.trim();
      if (!city) return;
      const info = container.querySelector('#wt-info');
      info.innerHTML = '<div style="color:var(--text-secondary);padding:20px">🔍 搜索中...</div>';
      if (status) status.textContent = `正在查找「${city}」...`;
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
          if (status) status.textContent = `✅ 已定位到 ${r.name}`;

          const refreshBtn = container.querySelector('#wt-refresh');
          if (refreshBtn) refreshBtn.style.display = '';
          const errorMsg = container.querySelector('#wt-error-msg');
          if (errorMsg) errorMsg.style.display = 'none';
        } else {
          info.innerHTML = `<div style="color:var(--text-secondary);padding:20px;text-align:center">未找到「${this.escape(city)}」<br><span style="font-size:13px">请尝试其他拼写或城市名</span></div>`;
          if (status) status.textContent = `未找到「${city}」，请尝试其他名称`;
        }
      } catch {
        info.innerHTML = '<div style="color:var(--text-secondary);padding:20px;text-align:center">搜索失败，请检查网络</div>';
        if (status) status.textContent = '网络错误，请重试';
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
