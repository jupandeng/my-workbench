const ScheduleModule = {
  id: 'schedule',
  name: '课程',
  icon: '📚',
  color: '#5856D6',
  days: ['周一', '周二', '周三', '周四', '周五', '周六', '周日'],
  periods: ['第1节', '第2节', '第3节', '第4节', '第5节'],

  init(container) {
    container.innerHTML = this.render();
    this.renderTable(container);
    this.bindEvents(container);
  },

  destroy() {},

  getSummary() {
    const courses = Storage.get('schedule', {});
    const today = (new Date().getDay() + 6) % 7;
    const dayCourses = [];
    for (let p = 0; p < 5; p++) {
      const key = `${today}-${p}`;
      if (courses[key]) dayCourses.push(courses[key]);
    }
    if (dayCourses.length) {
      return `今日 ${dayCourses.length} 节课`;
    }
    return '今日无课';
  },

  render() {
    let table = '<table class="schedule-table"><thead><tr><th></th>';
    for (const d of this.days) {
      table += `<th>${d}</th>`;
    }
    table += '</tr></thead><tbody>';

    for (let p = 0; p < 5; p++) {
      table += `<tr><td>${this.periods[p]}</td>`;
      for (let d = 0; d < 7; d++) {
        const key = `${d}-${p}`;
        table += `<td class="schedule-cell" data-day="${d}" data-period="${p}" data-key="${key}"></td>`;
      }
      table += '</tr>';
    }
    table += '</tbody></table>';
    return table;
  },

  renderTable(container) {
    const courses = Storage.get('schedule', {});
    container.querySelectorAll('.schedule-cell').forEach(td => {
      const key = td.dataset.key;
      const c = courses[key];
      if (c) {
        td.classList.add('has-course');
        td.innerHTML = `${this.escape(c.name)}<br><span class="course-room">${this.escape(c.room || '')}</span>`;
      } else {
        td.classList.remove('has-course');
        td.innerHTML = '';
      }
    });
  },

  bindEvents(container) {
    container.addEventListener('click', e => {
      const cell = e.target.closest('.schedule-cell');
      if (!cell) return;
      this.openModal(cell.dataset.day, cell.dataset.period, cell.dataset.key);
    });
  },

  openModal(day, period, key) {
    const courses = Storage.get('schedule', {});
    const existing = courses[key] || null;

    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal">
        <h3>${this.days[day]} ${this.periods[period]}</h3>
        <label>课程名称</label>
        <input id="s-name" value="${this.escape(existing?.name || '')}" placeholder="如：高等数学">
        <label>教室</label>
        <input id="s-room" value="${this.escape(existing?.room || '')}" placeholder="如：教一 301">
        <label>老师</label>
        <input id="s-teacher" value="${this.escape(existing?.teacher || '')}" placeholder="如：王老师">
        <div class="modal-btns">
          ${existing ? '<button class="btn btn-small" id="s-del" style="color:var(--red);margin-right:auto">删除</button>' : ''}
          <button class="btn btn-small btn-cancel" id="s-cancel">取消</button>
          <button class="btn btn-small btn-blue" id="s-save">保存</button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    overlay.querySelector('#s-cancel').onclick = () => overlay.remove();
    overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });

    overlay.querySelector('#s-save').onclick = () => {
      const name = overlay.querySelector('#s-name').value.trim();
      if (!name) return;
      const courses = Storage.get('schedule', {});
      courses[key] = {
        name,
        room: overlay.querySelector('#s-room').value.trim(),
        teacher: overlay.querySelector('#s-teacher').value.trim()
      };
      Storage.set('schedule', courses);
      overlay.remove();
      // Re-render
      const container = document.getElementById('content');
      this.renderTable(container);
    };

    if (existing) {
      overlay.querySelector('#s-del').onclick = () => {
        const courses = Storage.get('schedule', {});
        delete courses[key];
        Storage.set('schedule', courses);
        overlay.remove();
        const container = document.getElementById('content');
        this.renderTable(container);
      };
    }
  },

  escape(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
};
