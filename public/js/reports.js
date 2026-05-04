// ── Reports Module ───────────────────────────────────────────────
const Reports = (() => {
  const load = async () => {
    const yr = document.getElementById('report-year');
    if (yr && !yr.options.length) {
      const y = new Date().getFullYear();
      for (let i = y; i >= y - 4; i--) { const o = new Option(i, i); yr.appendChild(o); }
    }
    await loadMonthly();
    await loadFishTypes();
  };

  const loadMonthly = async () => {
    const year = document.getElementById('report-year')?.value || new Date().getFullYear();
    const el = document.getElementById('reports-content');
    if (!el) return;
    el.innerHTML = `<div class="loader"><i class="fa-solid fa-spinner"></i></div>`;
    const [mRes, sRes] = await Promise.all([
      API.get(`/reports/monthly?year=${year}`),
      API.get('/reports/summary')
    ]);
    if (!mRes.success) { el.innerHTML = `<div class="empty-state"><i class="fa-solid fa-triangle-exclamation"></i><p>${mRes.message}</p></div>`; return; }
    const months = mRes.data;
    const totRevenue = months.reduce((s, m) => s + m.revenue, 0);
    const totExpenses = months.reduce((s, m) => s + m.expenses, 0);
    const totProfit = months.reduce((s, m) => s + m.netProfit, 0);
    const totCatch = months.reduce((s, m) => s + m.totalCatch, 0);
    const totTrips = months.reduce((s, m) => s + m.tripCount, 0);

    el.innerHTML = `
      <div class="stats-grid" style="margin-bottom:1.5rem">
        <div class="stat-card green"><div class="stat-icon"><i class="fa-solid fa-indian-rupee-sign"></i></div><div class="stat-value">${Utils.fmt(totRevenue)}</div><div class="stat-label">Total Revenue ${year}</div></div>
        <div class="stat-card red"><div class="stat-icon"><i class="fa-solid fa-receipt"></i></div><div class="stat-value">${Utils.fmt(totExpenses)}</div><div class="stat-label">Total Expenses</div></div>
        <div class="stat-card blue"><div class="stat-icon"><i class="fa-solid fa-chart-line"></i></div><div class="stat-value">${Utils.fmt(totProfit)}</div><div class="stat-label">Net Profit</div></div>
        <div class="stat-card yellow"><div class="stat-icon"><i class="fa-solid fa-fish"></i></div><div class="stat-value">${Utils.fmtKg(totCatch)}</div><div class="stat-label">Total Catch</div></div>
        <div class="stat-card orange"><div class="stat-icon"><i class="fa-solid fa-ship"></i></div><div class="stat-value">${totTrips}</div><div class="stat-label">Trips Completed</div></div>
      </div>
      <div class="charts-grid">
        <div class="chart-wrap">
          <div class="chart-title"><i class="fa-solid fa-chart-bar" style="color:var(--primary)"></i> Monthly Revenue vs Expenses (${year})</div>
          <canvas id="rep-monthly-chart" height="250"></canvas>
        </div>
        <div class="chart-wrap">
          <div class="chart-title"><i class="fa-solid fa-chart-line" style="color:var(--success)"></i> Net Profit Trend</div>
          <canvas id="rep-profit-chart" height="250"></canvas>
        </div>
      </div>
      <div id="fish-types-section"></div>
      <div class="chart-wrap" style="margin-top:1rem">
        <div class="section-title"><i class="fa-solid fa-table"></i> Monthly Breakdown</div>
        <div class="table-wrap"><table>
          <thead><tr><th>Month</th><th>Trips</th><th>Revenue</th><th>Expenses</th><th>Net Profit</th><th>Catch</th></tr></thead>
          <tbody>${months.map((m, i) => `
            <tr>
              <td>${['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][i]}</td>
              <td>${m.tripCount}</td>
              <td class="amount-positive">${Utils.fmt(m.revenue)}</td>
              <td class="amount-negative">${Utils.fmt(m.expenses)}</td>
              <td class="${m.netProfit >= 0 ? 'amount-positive' : 'amount-negative'}">${Utils.fmt(m.netProfit)}</td>
              <td>${Utils.fmtKg(m.totalCatch)}</td>
            </tr>`).join('')}
          </tbody>
        </table></div>
      </div>`;

    renderMonthlyCharts(months);
  };

  const loadFishTypes = async () => {
    const data = await API.get('/reports/fish-types');
    const sec = document.getElementById('fish-types-section');
    if (!sec || !data.success) return;
    const fish = data.data;
    if (!fish.length) return;
    sec.innerHTML = `
      <div class="charts-grid" style="margin-top:1rem">
        <div class="chart-wrap">
          <div class="chart-title"><i class="fa-solid fa-fish" style="color:var(--accent)"></i> Catch by Fish Type</div>
          <canvas id="fish-chart" height="250"></canvas>
        </div>
        <div class="chart-wrap">
          <div class="chart-title"><i class="fa-solid fa-table"></i> Fish Type Details</div>
          <div class="table-wrap"><table>
            <thead><tr><th>Fish</th><th>Qty (kg)</th><th>Revenue</th><th>Avg Price</th></tr></thead>
            <tbody>${fish.map(f => `
              <tr>
                <td>${f._id || 'Unknown'}</td>
                <td>${Utils.fmtKg(f.totalQuantity)}</td>
                <td class="amount-positive">${Utils.fmt(f.totalValue)}</td>
                <td>${Utils.fmt(f.avgPrice)}/kg</td>
              </tr>`).join('')}
            </tbody>
          </table></div>
        </div>
      </div>`;

    setTimeout(() => {
      const ctx = document.getElementById('fish-chart');
      if (!ctx) return;
      new Chart(ctx, {
        type: 'doughnut',
        data: {
          labels: fish.map(f => f._id || 'Unknown'),
          datasets: [{ data: fish.map(f => f.totalValue), backgroundColor: ['#3b82f6','#06b6d4','#10b981','#f59e0b','#ef4444','#8b5cf6','#ec4899','#f97316'], borderWidth: 0 }]
        },
        options: { responsive: true, plugins: { legend: { position: 'bottom', labels: { color: '#94a3b8', font: { size: 11 } } } }, cutout: '60%' }
      });
    }, 100);
  };

  const renderMonthlyCharts = (months) => {
    setTimeout(() => {
      const labels = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
      const ctx1 = document.getElementById('rep-monthly-chart');
      if (ctx1) new Chart(ctx1, {
        type: 'bar',
        data: {
          labels,
          datasets: [
            { label: 'Revenue', data: months.map(m => m.revenue), backgroundColor: 'rgba(59,130,246,0.75)', borderRadius: 4 },
            { label: 'Expenses', data: months.map(m => m.expenses), backgroundColor: 'rgba(239,68,68,0.75)', borderRadius: 4 }
          ]
        },
        options: { responsive: true, plugins: { legend: { labels: { color: '#94a3b8' } } }, scales: { x: { ticks: { color: '#64748b' }, grid: { color: 'rgba(255,255,255,0.05)' } }, y: { ticks: { color: '#64748b', callback: v => '₹' + v.toLocaleString('en-IN') }, grid: { color: 'rgba(255,255,255,0.05)' } } } }
      });
      const ctx2 = document.getElementById('rep-profit-chart');
      if (ctx2) new Chart(ctx2, {
        type: 'line',
        data: {
          labels,
          datasets: [{ label: 'Net Profit', data: months.map(m => m.netProfit), borderColor: '#10b981', backgroundColor: 'rgba(16,185,129,0.1)', fill: true, tension: 0.4, pointBackgroundColor: '#10b981', pointRadius: 4 }]
        },
        options: { responsive: true, plugins: { legend: { labels: { color: '#94a3b8' } } }, scales: { x: { ticks: { color: '#64748b' }, grid: { color: 'rgba(255,255,255,0.05)' } }, y: { ticks: { color: '#64748b', callback: v => '₹' + v.toLocaleString('en-IN') }, grid: { color: 'rgba(255,255,255,0.05)' } } } }
      });
    }, 100);
  };

  return { load, loadMonthly };
})();

// ── Profile View ─────────────────────────────────────────────────
const ProfileView = (() => {
  const load = async () => {
    const el = document.getElementById('profile-content');
    if (!el) return;
    const data = await API.get('/users/me');
    if (!data.success) { el.innerHTML = '<p>Error loading profile</p>'; return; }
    const u = data.data;
    const ps = data.paymentSummary || {};
    el.innerHTML = `
      <div class="data-card" style="max-width:500px">
        <div style="display:flex;align-items:center;gap:1rem;margin-bottom:1.5rem">
          <div class="worker-avatar" style="width:64px;height:64px;font-size:2rem">${u.name[0].toUpperCase()}</div>
          <div><div style="font-size:1.2rem;font-weight:700">${u.name}</div><div style="color:var(--text2)">@${u.username}</div>${Utils.roleBadge(u.role)}</div>
        </div>
        <div class="form-row" style="margin-bottom:1rem">
          <div><label style="color:var(--text2);font-size:.8rem">Phone</label><p>${u.phone || '—'}</p></div>
          <div><label style="color:var(--text2);font-size:.8rem">Language</label><p>${u.preferredLanguage?.toUpperCase()}</p></div>
          <div><label style="color:var(--text2);font-size:.8rem">Daily Wage</label><p>${Utils.fmt(u.dailyWage)}</p></div>
          <div><label style="color:var(--text2);font-size:.8rem">Share %</label><p>${u.sharePercentage || 0}%</p></div>
        </div>
        ${u.role === 'worker' ? `
        <div class="stats-grid" style="grid-template-columns:repeat(3,1fr);margin-bottom:1rem">
          <div class="stat-card green" style="padding:.8rem"><div class="stat-value" style="font-size:1rem">${Utils.fmt(ps.totalEarned)}</div><div class="stat-label">Earned</div></div>
          <div class="stat-card yellow" style="padding:.8rem"><div class="stat-value" style="font-size:1rem">${Utils.fmt(ps.totalAdvance)}</div><div class="stat-label">Advance</div></div>
          <div class="stat-card blue" style="padding:.8rem"><div class="stat-value" style="font-size:1rem">${Utils.fmt(ps.netBalance)}</div><div class="stat-label">Balance</div></div>
        </div>` : ''}
        <div style="display:flex;gap:.5rem">
          <button class="btn btn-primary" onclick="Auth.showChangePinModal()"><i class="fa-solid fa-lock"></i> ${I18n.t('change_pin')}</button>
          <button class="btn btn-ghost" onclick="App.navigate('payments')"><i class="fa-solid fa-money-bill-wave"></i> ${I18n.t('request_advance')}</button>
        </div>
      </div>`;
  };
  return { load };
})();

// ── Settings View ─────────────────────────────────────────────────
const SettingsView = (() => {
  const load = () => {
    const el = document.getElementById('settings-content');
    if (!el) return;
    el.innerHTML = `
      <div class="data-card" style="max-width:500px">
        <div class="section-title"><i class="fa-solid fa-globe"></i> Language</div>
        <div class="lang-buttons" style="justify-content:flex-start">
          <button class="lang-btn" onclick="App.switchLang('en')">🇬🇧<span class="lang-name">English</span></button>
          <button class="lang-btn" onclick="App.switchLang('hi')">🇮🇳<span class="lang-name">हिंदी</span></button>
          <button class="lang-btn" onclick="App.switchLang('kn')">🏴<span class="lang-name">ಕನ್ನಡ</span></button>
        </div>
        <hr class="divider" />
        <div class="section-title"><i class="fa-solid fa-shield-halved"></i> Security</div>
        <button class="btn btn-primary" onclick="Auth.showChangePinModal()"><i class="fa-solid fa-lock"></i> ${I18n.t('change_pin')}</button>
        <hr class="divider" />
        <div class="section-title"><i class="fa-solid fa-volume-high"></i> Audio</div>
        <button class="btn btn-ghost" onclick="Auth.speakPage()"><i class="fa-solid fa-play"></i> Test Audio Guide</button>
      </div>`;
  };
  return { load };
})();
