let sd = [];

document.addEventListener('DOMContentLoaded', () => {
  loadSched();
  const btn = document.getElementById('regenerateBtn');
  if (btn) btn.addEventListener('click', async () => {
    btn.disabled = true;
    try {
      const res = await fetch('/api/regenerate');
      if (res.ok) await loadSched();
    } finally {
      btn.disabled = false;
      btn.textContent = 'Regenerate';
    }
  });
  const inp = document.getElementById('searchInput');
  if (inp) {
    inp.addEventListener('input', () => {
      const q = (inp.value || '').trim().toLowerCase();
      document.querySelectorAll('.schedule-row').forEach((tr) => {
        const nm = (tr.getAttribute('data-person-name') || '').toLowerCase();
        tr.classList.toggle('tr-row-hidden', q.length > 0 && !nm.includes(q));
      });
    });
  }
  document.getElementById('scheduleContainer').addEventListener('click', (e) => {
    const cell = e.target.closest('td[data-role]');
    if (!cell) return;
    const rl = cell.getAttribute('data-role');
    const dIdx = parseInt(cell.getAttribute('data-day-index'), 10);
    if (rl && rl !== 'Open' && !isNaN(dIdx) && sd[dIdx]) {
      showRolePnl(sd[dIdx], rl);
    }
  });
  const closeBtn = document.querySelector('.role-panel-close');
  const pnl = document.getElementById('rolePanel');
  if (closeBtn && pnl) {
    closeBtn.addEventListener('click', () => { pnl.classList.add('hidden'); pnl.setAttribute('aria-hidden', 'true'); });
    pnl.addEventListener('click', (e) => { if (e.target === pnl) { pnl.classList.add('hidden'); pnl.setAttribute('aria-hidden', 'true'); } });
  }
});

function showRolePnl(day, rl) {
  const titleEl = document.getElementById('rolePanelTitle');
  const bodyEl = document.getElementById('rolePanelBody');
  if (!titleEl || !bodyEl) return;
  titleEl.textContent = rl;
  const slug = rl.toLowerCase().replace(/[^a-z]/g, '');
  const pnl = document.getElementById('rolePanel');
  pnl.setAttribute('data-role-slug', slug);
  const blks = day.timeBlocks || [];
  const ppl = day.people || [];
  let html = '<p class="role-panel-subtitle">' + escH(day.label) + ' — who has this role each block</p>';
  html += '<table class="role-panel-table"><thead><tr><th>Time</th><th>People</th></tr></thead><tbody>';
  blks.forEach((_, i) => {
    const asg = ppl.filter((p) => (p.schedule || [])[i] === rl);
    const tm = escH(blks[i]);
    let cell = '';
    if (asg.length) {
      cell = '<div class="role-panel-chips">' +
        asg.map((p) => '<span class="role-panel-chip">' + escH(p.name) + '</span>').join('') +
        '</div>';
    } else {
      cell = '<span class="role-panel-empty">—</span>';
    }
    html += '<tr><td class="role-panel-time">' + tm + '</td><td class="role-panel-people">' + cell + '</td></tr>';
  });
  html += '</tbody></table>';
  bodyEl.innerHTML = html;
  pnl.classList.remove('hidden');
  pnl.setAttribute('aria-hidden', 'false');
}

function escH(s) {
  const div = document.createElement('div');
  div.textContent = s;
  return div.innerHTML;
}

async function loadSched() {
  const ctr = document.getElementById('scheduleContainer');
  const to = 20000;
  try {
    let data = null;
    const ctrl = new AbortController();
    const tid = setTimeout(() => ctrl.abort(), to);
    try {
      const res = await fetch('/api/schedule', { signal: ctrl.signal });
      clearTimeout(tid);
      if (res.ok) data = await res.json();
    } catch (_) {
      clearTimeout(tid);
    }
    if (!data) {
      const staticRes = await fetch('schedule.json?t=' + Date.now(), { cache: 'no-store' });
      if (staticRes.ok) data = await staticRes.json();
    }
    if (!data) throw new Error('Failed to load');
    const days = data.days || (data.schedule && data.schedule.days) || [];
    if (!days.length) {
      ctr.innerHTML = '<div class="empty">No schedule. Check CSV path in config and regenerate.</div>';
      return;
    }
    sd = days;
    const blkMins = Number(data.blockDurationMinutes) || 30;
    const hrPerBlk = blkMins / 60;
    // static host has no api
    if (window.location.hostname.includes('github.io')) {
      const btn = document.getElementById('regenerateBtn');
      if (btn) btn.style.display = 'none';
    }
    ctr.innerHTML = '';
    days.forEach((day, dayIdx) => {
      const realIdx = dayIdx;
      const sec = document.createElement('section');
      sec.className = 'day-section';
      sec.setAttribute('data-day-index', String(realIdx));
      const title = document.createElement('h2');
      title.className = 'day-title';
      title.textContent = day.label;
      sec.appendChild(title);
      const tbl = document.createElement('table');
      tbl.className = 'schedule-table';
      const thead = document.createElement('thead');
      const hrow = document.createElement('tr');
      const thNm = document.createElement('th');
      thNm.className = 'col-name';
      thNm.textContent = 'Name';
      hrow.appendChild(thNm);
      (day.timeBlocks || []).forEach((blk) => {
        const th = document.createElement('th');
        th.className = 'col-time';
        th.textContent = blk;
        hrow.appendChild(th);
      });
      thead.appendChild(hrow);
      tbl.appendChild(thead);
      const tbody = document.createElement('tbody');
      (day.people || []).forEach((pers) => {
        const tr = document.createElement('tr');
        tr.className = 'schedule-row';
        tr.setAttribute('data-person-name', pers.name || '');
        const tdNm = document.createElement('td');
        tdNm.className = 'col-name';
        tdNm.textContent = pers.name;
        tr.appendChild(tdNm);
        (pers.schedule || []).forEach((st, ti) => {
          const td = document.createElement('td');
          td.textContent = st;
          td.className = 'cell cell--' + (st || 'open').toLowerCase().replace(/[^a-z]/g, '');
          if (st && st !== 'Open') {
            td.setAttribute('data-role', st);
            td.setAttribute('data-day-index', String(realIdx));
            td.style.cursor = 'pointer';
            td.title = 'Click to see who has ' + st + ' per time';
          }
          tr.appendChild(td);
        });
        tbody.appendChild(tr);
      });
      tbl.appendChild(tbody);
      const wrap = document.createElement('div');
      wrap.className = 'table-scroll';
      wrap.appendChild(tbl);
      sec.appendChild(wrap);

      const blks = day.timeBlocks || [];
      const cntPerBlk = blks.map((_, ti) => {
        const cnt = {};
        (day.people || []).forEach((p) => {
          const s = (p.schedule || [])[ti] || 'Open';
          cnt[s] = (cnt[s] || 0) + 1;
        });
        return cnt;
      });
      const allRl = [...new Set(cntPerBlk.flatMap((c) => Object.keys(c)))].sort();
      const sumTbl = document.createElement('table');
      sumTbl.className = 'schedule-table summary-table';
      const sumThead = document.createElement('thead');
      const sumHrow = document.createElement('tr');
      const sumThNm = document.createElement('th');
      sumThNm.className = 'col-name';
      sumThNm.textContent = 'Count by role';
      sumHrow.appendChild(sumThNm);
      blks.forEach((blk) => {
        const th = document.createElement('th');
        th.className = 'col-time';
        th.textContent = blk;
        sumHrow.appendChild(th);
      });
      sumThead.appendChild(sumHrow);
      sumTbl.appendChild(sumThead);
      const sumTbody = document.createElement('tbody');
      allRl.forEach((rl) => {
        const tr = document.createElement('tr');
        const tdLbl = document.createElement('td');
        tdLbl.className = 'col-name';
        tdLbl.textContent = rl;
        tdLbl.setAttribute('data-role', rl);
        tdLbl.setAttribute('data-day-index', String(realIdx));
        tdLbl.style.cursor = 'pointer';
        tdLbl.title = 'Click to see who has ' + rl + ' per time';
        tr.appendChild(tdLbl);
        cntPerBlk.forEach((cnt) => {
          const td = document.createElement('td');
          td.textContent = cnt[rl] || 0;
          td.className = 'cell cell--' + rl.toLowerCase().replace(/[^a-z]/g, '');
          tr.appendChild(td);
        });
        sumTbody.appendChild(tr);
      });
      sumTbl.appendChild(sumTbody);
      const sumTitle = document.createElement('h3');
      sumTitle.className = 'summary-title';
      sumTitle.textContent = 'Count per half-hour';
      sec.appendChild(sumTitle);
      const sumWrap = document.createElement('div');
      sumWrap.className = 'table-scroll';
      sumWrap.appendChild(sumTbl);
      sec.appendChild(sumWrap);

      if (day.scoutCheck && day.scoutCheck.length > 0) {
        const chkTtl = document.createElement('h3');
        chkTtl.className = 'summary-title';
        chkTtl.textContent = 'Scouting check';
        sec.appendChild(chkTtl);
        const chkTbl = document.createElement('table');
        chkTbl.className = 'schedule-table summary-table scout-check-table';
        chkTbl.innerHTML = '<thead><tr><th class="col-name">Name</th><th>Scouting hours</th><th>Hours in pits</th><th>Status</th></tr></thead>';
        const chkTbody = document.createElement('tbody');
        const pitRl = ['Pits', 'Ctrls Pit', 'Pit Lead', 'Mech Pit'];
        day.scoutCheck.forEach((row) => {
          const pers = (day.people || []).find((p) => p.name === row.name);
          const pitBlks = pers ? (pers.schedule || []).filter((s) => pitRl.includes(s)).length : 0;
          const hrsPit = (pitBlks * hrPerBlk).toFixed(1);
          const tr = document.createElement('tr');
          tr.className = 'scout-check--' + row.status;
          tr.innerHTML =
            '<td class="col-name">' +
            escH(row.name) +
            '</td><td>' +
            (row.scoutingBlocks * hrPerBlk).toFixed(1) + ' hr</td><td>' +
            hrsPit + ' hr</td><td>' +
            escH(row.status === 'exempt' ? 'Exempt' : row.status === 'none' ? 'No scouting' : row.status === 'low' ? 'Low' : 'OK') +
            '</td>';
          chkTbody.appendChild(tr);
        });
        chkTbl.appendChild(chkTbody);
        const chkWrap = document.createElement('div');
        chkWrap.className = 'table-scroll';
        chkWrap.appendChild(chkTbl);
        sec.appendChild(chkWrap);
      }

      ctr.appendChild(sec);
    });
  } catch (e) {
    const isTo = e.name === 'AbortError';
    const msg = isTo
      ? 'Schedule is taking a while. If the server is still building, try refreshing in a moment.'
      : 'Error loading schedule: ' + escH(e.message);
    ctr.innerHTML = '<div class="empty">' + msg + '</div>';
  }
}
