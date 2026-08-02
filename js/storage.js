const Storage = {
  get(key, fallback = null) {
    try {
      const v = localStorage.getItem('wb_' + key);
      return v ? JSON.parse(v) : fallback;
    } catch { return fallback; }
  },

  set(key, value) {
    localStorage.setItem('wb_' + key, JSON.stringify(value));
  },

  remove(key) {
    localStorage.removeItem('wb_' + key);
  }
};
