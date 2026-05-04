// ── Dashboard ────────────────────────────────────────────────────
const Dashboard = (() => {
  const load = async () => {
    const el = document.getElementById('dashboard-content');
    if (!el) return;
    el.innerHTML = `<div class="loader"><i class="fa-solid fa-spinner"></i></div>`;
    const user = App.getUser();
    if (user?.role === 'owner') await loadOwnerDashboard(el);
    else await loadWorkerDashboard(el);
  };

  const loadOwnerDashboard = async (el) => {
    const from = document.getElementById('dash-from')?.value;
    const to = document.getElementById('dash-to')?.value;
    let q = from ? `?from=${from}` : '';
    if (to) q += (q ? '&' : '?') + `to=${to}`;
    const data = await API.get(`/reports/summary${q}`);
    if (!data.success) { el.innerHTML = `<div class="empty-state"><i class="fa-solid fa-triangle-exclamation"></i><p>${data.message}</p></div>`; return; }
    const d = data.data;

    el.innerHTML = `
      <div class="stats-grid">
        <div class="stat-card blue">
          <div class="stat-icon"><i class="fa-solid fa-users"></i></div>
          <div class="stat-value">${d.workers.active}</div>
          <div class="stat-label">${I18n.t('active_workers')}</div>
          <div class="stat-sub">${d.workers.total} total</div>
        </div>
        <div class="stat-card green">
          <div class="stat-icon"><i class="fa-solid fa-ship"></i></div>
          <div class="stat-value">${d.trips.completed}</div>
          <div class="stat-label">${I18n.t('completed_trips')}</div>
          <div class="stat-sub">${d.trips.total} total</div>
        </div>
        <div class="stat-card green">
          <div class="stat-icon"><i class="fa-solid fa-indian-rupee-sign"></i></div>
          <div class="stat-value">${Utils.fmt(d.financials.totalRevenue)}</div>
          <div class="stat-label">${I18n.t('total_revenue')}</div>
          <div class="stat-sub">Avg ${Utils.fmt(d.financials.avgRevenuePerTrip)}/trip</div>
        </div>
        <div class="stat-card red">
          <div class="stat-icon"><i class="fa-solid fa-receipt"></i></div>
          <div class="stat-value">${Utils.fmt(d.financials.totalExpenses)}</div>
          <div class="stat-label">${I18n.t('total_expenses')}</div>
        </div>
        <div class="stat-card blue">
          <div class="stat-icon"><i class="fa-solid fa-chart-line"></i></div>
          <div class="stat-value">${Utils.fmt(d.financials.netProfit)}</div>
          <div class="stat-label">${I18n.t('net_profit')}</div>
        </div>
        <div class="stat-card yellow">
          <div class="stat-icon"><i class="fa-solid fa-fish"></i></div>
          <div class="stat-value">${Utils.fmtKg(d.financials.totalCatch)}</div>
          <div class="stat-label">${I18n.t('total_catch')}</div>
        </div>
        <div class="stat-card orange">
          <div class="stat-icon"><i class="fa-solid fa-clock"></i></div>
          <div class="stat-value">${d.payments.pending.count}</div>
          <div class="stat-label">${I18n.t('pending_payments')}</div>
          <div class="stat-sub">${Utils.fmt(d.payments.pending.amount)}</div>
        </div>
        <div class="stat-card green">
          <div class="stat-icon"><i class="fa-solid fa-check-circle"></i></div>
          <div class="stat-value">${d.payments.paid.count}</div>
          <div class="stat-label">${I18n.t('paid')}</div>
          <div class="stat-sub">${Utils.fmt(d.payments.paid.amount)}</div>
        </div>
      </div>
      <div class="charts-grid">
        <div class="chart-wrap">
          <div class="chart-title"><i class="fa-solid fa-chart-bar" style="color:var(--primary)"></i> ${I18n.t('monthly_report')}</div>
          <canvas id="monthly-chart" height="220"></canvas>
        </div>
        <div class="chart-wrap">
          <div class="chart-title"><i class="fa-solid fa-pie-chart" style="color:var(--accent)"></i> Payment Status</div>
          <canvas id="payment-chart" height="220"></canvas>
        </div>
      </div>
      ${d.payments.pending.count > 0 ? `
      <div class="alert alert-info" style="cursor:pointer" onclick="App.navigate('payments')">
        <i class="fa-solid fa-bell"></i>
        <strong>${d.payments.pending.count} payments</strong> pending approval — ${Utils.fmt(d.payments.pending.amount)} total.
        <strong>Click to review →</strong>
      </div>` : ''}
    `;
    renderCharts(d);
  };

  const loadWorkerDashboard = async (el) => {
    const data = await API.get('/users/me');
    const ps = data.paymentSummary || {};
    const user = data.data || App.getUser();
    el.innerHTML = `
      <div class="stats-grid">
        <div class="stat-card green">
          <div class="stat-icon"><i class="fa-solid fa-indian-rupee-sign"></i></div>
          <div class="stat-value">${Utils.fmt(ps.totalEarned)}</div>
          <div class="stat-label">${I18n.t('total_earned')}</div>
        </div>
        <div class="stat-card yellow">
          <div class="stat-icon"><i class="fa-solid fa-hand-holding-dollar"></i></div>
          <div class="stat-value">${Utils.fmt(ps.totalAdvance)}</div>
          <div class="stat-label">${I18n.t('my_advance_balance')}</div>
        </div>
        <div class="stat-card blue">
          <div class="stat-icon"><i class="fa-solid fa-scale-balanced"></i></div>
          <div class="stat-value">${Utils.fmt(ps.netBalance)}</div>
          <div class="stat-label">${I18n.t('net_balance')}</div>
        </div>
      </div>
      <div class="data-card" style="margin-top:1rem">
        <div class="section-title"><i class="fa-solid fa-user"></i> My Profile</div>
        <div class="form-row">
          <div><label style="color:var(--text2);font-size:.8rem">Name</label><p>${user.name}</p></div>
          <div><label style="color:var(--text2);font-size:.8rem">Username</label><p>${user.username}</p></div>
          <div><label style="color:var(--text2);font-size:.8rem">Daily Wage</label><p>${Utils.fmt(user.dailyWage)}</p></div>
          <div><label style="color:var(--text2);font-size:.8rem">Share %</label><p>${user.sharePercentage || 0}%</p></div>
        </div>
        <div style="margin-top:1rem">
          <button class="btn btn-primary" onclick="App.navigate('payments')"><i class="fa-solid fa-hand-holding-dollar"></i> ${I18n.t('request_advance')}</button>
          <button class="btn btn-ghost" onclick="Auth.showChangePinModal()" style="margin-left:.5rem"><i class="fa-solid fa-lock"></i> ${I18n.t('change_pin')}</button>
        </div>
      </div>`;
  };

  const renderCharts = async (d) => {
    // Monthly chart
    const mRes = await API.get(`/reports/monthly?year=${new Date().getFullYear()}`);
    if (mRes.success) {
      const months = mRes.data;
      const labels = months.map(m => ['', 'Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][m.month]);
      const ctx = document.getElementById('monthly-chart');
      if (!ctx) return;
      new Chart(ctx, {
        type: 'bar',
        data: {
          labels,
          datasets: [
            { label: 'Revenue', data: months.map(m => m.revenue), backgroundColor: 'rgba(59,130,246,0.7)', borderRadius: 4 },
            { label: 'Expenses', data: months.map(m => m.expenses), backgroundColor: 'rgba(239,68,68,0.7)', borderRadius: 4 },
            { label: 'Net Profit', data: months.map(m => m.netProfit), type: 'line', borderColor: '#10b981', backgroundColor: 'rgba(16,185,129,0.1)', fill: true, tension: 0.3 }
          ]
        },
        options: { responsive: true, plugins: { legend: { labels: { color: '#94a3b8', font: { size: 11 } } } }, scales: { x: { ticks: { color: '#64748b' }, grid: { color: 'rgba(255,255,255,0.05)' } }, y: { ticks: { color: '#64748b', callback: v => '₹'+v.toLocaleString('en-IN') }, grid: { color: 'rgba(255,255,255,0.05)' } } } }
      });
    }

    // Payment pie chart
    const ctx2 = document.getElementById('payment-chart');
    if (ctx2) {
      new Chart(ctx2, {
        type: 'doughnut',
        data: {
          labels: ['Pending', 'Approved', 'Paid'],
          datasets: [{ data: [d.payments.pending.count, d.payments.approved.count, d.payments.paid.count], backgroundColor: ['rgba(245,158,11,0.8)', 'rgba(59,130,246,0.8)', 'rgba(16,185,129,0.8)'], borderWidth: 0 }]
        },
        options: { responsive: true, plugins: { legend: { position: 'bottom', labels: { color: '#94a3b8', font: { size: 11 } } } }, cutout: '65%' }
      });
    }
  };

  return { load };
})();
