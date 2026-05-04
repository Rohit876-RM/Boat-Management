// ── Workers Module ───────────────────────────────────────────────
const Workers = (() => {
  let allWorkers = [];

  const load = async () => {
    const el = document.getElementById('workers-list');
    if (!el) return;
    el.innerHTML = `<div class="loader"><i class="fa-solid fa-spinner"></i></div>`;
    const user = App.getUser();
    if (user?.role !== 'owner') {
      el.innerHTML = `<div class="empty-state"><i class="fa-solid fa-lock"></i><p>Access denied</p></div>`;
      return;
    }
    const data = await API.get('/users?role=worker');
    if (!data.success) { el.innerHTML = `<div class="empty-state"><i class="fa-solid fa-triangle-exclamation"></i><p>${data.message}</p></div>`; return; }
    allWorkers = data.data;
    render(allWorkers);
  };

  const search = () => {
    const q = document.getElementById('worker-search')?.value?.toLowerCase() || '';
    render(allWorkers.filter(w => w.name.toLowerCase().includes(q) || w.username.toLowerCase().includes(q) || (w.phone || '').includes(q)));
  };

  const render = (workers) => {
    const el = document.getElementById('workers-list');
    if (!workers.length) { el.innerHTML = `<div class="empty-state"><i class="fa-solid fa-users"></i><p>${I18n.t('no_data')}</p></div>`; return; }
    el.innerHTML = `<div class="data-grid">${workers.map(w => workerCard(w)).join('')}</div>`;
  };

  const workerCard = (w) => `
    <div class="data-card" onclick="Workers.viewReport('${w._id}')">
      <div class="data-card-header">
        <div style="display:flex;align-items:center;gap:.8rem">
          <div class="worker-avatar">${w.name[0].toUpperCase()}</div>
          <div>
            <div class="data-card-title">${w.name}</div>
            <div style="color:var(--text2);font-size:.8rem">@${w.username}</div>
          </div>
        </div>
        ${Utils.statusBadge(w.isActive ? 'active' : 'inactive')}
      </div>
      <div class="data-card-meta">
        ${w.phone ? `<span><i class="fa-solid fa-phone" style="width:14px;color:var(--text3)"></i> ${w.phone}</span>` : ''}
        <span><i class="fa-solid fa-indian-rupee-sign" style="width:14px;color:var(--text3)"></i> ${Utils.fmt(w.dailyWage)}/day${w.sharePercentage > 0 ? ` · ${w.sharePercentage}% share` : ''}</span>
        <span><i class="fa-solid fa-calendar" style="width:14px;color:var(--text3)"></i> Joined ${Utils.date(w.joinDate)}</span>
      </div>
      <div class="data-card-actions" onclick="event.stopPropagation()">
        <button class="btn btn-ghost btn-sm" onclick="Workers.showForm('${w._id}')"><i class="fa-solid fa-edit"></i> Edit</button>
        <button class="btn btn-ghost btn-sm" onclick="Workers.viewReport('${w._id}')"><i class="fa-solid fa-chart-line"></i> Report</button>
        <button class="btn btn-sm" style="background:rgba(239,68,68,0.1);color:var(--danger)" onclick="Workers.remove('${w._id}','${w.name}')"><i class="fa-solid fa-trash"></i></button>
      </div>
    </div>`;

  const showForm = (id = null) => {
    const w = id ? allWorkers.find(x => x._id === id) : null;
    Modal.open({
      title: w ? I18n.t('edit_worker') : I18n.t('add_worker'),
      large: true,
      body: `
        <div class="form-row">
          <div class="form-group"><label>${I18n.t('worker_name')} *</label><input class="form-input" id="wf-name" value="${w?.name || ''}" placeholder="Full Name" /></div>
          <div class="form-group"><label>${I18n.t('username')} *</label><input class="form-input" id="wf-username" value="${w?.username || ''}" placeholder="username" ${w ? 'readonly' : ''} /></div>
        </div>
        ${!w ? `<div class="form-group"><label>${I18n.t('pin')} * (4-6 digits)</label><input class="form-input" id="wf-pin" type="password" placeholder="••••" maxlength="6" /></div>` : ''}
        <div class="form-row">
          <div class="form-group"><label>${I18n.t('phone')}</label><input class="form-input" id="wf-phone" value="${w?.phone || ''}" placeholder="+91 00000 00000" /></div>
          <div class="form-group"><label>${I18n.t('daily_wage')}</label><input class="form-input" id="wf-wage" type="number" value="${w?.dailyWage || 0}" min="0" /></div>
        </div>
        <div class="form-row">
          <div class="form-group"><label>${I18n.t('share_percent')}</label><input class="form-input" id="wf-share" type="number" value="${w?.sharePercentage || 0}" min="0" max="100" /></div>
          <div class="form-group"><label>${I18n.t('language')}</label>
            <select class="form-input" id="wf-lang">
              <option value="en" ${w?.preferredLanguage === 'en' ? 'selected' : ''}>English</option>
              <option value="hi" ${w?.preferredLanguage === 'hi' ? 'selected' : ''}>हिंदी</option>
              <option value="kn" ${w?.preferredLanguage === 'kn' ? 'selected' : ''}>ಕನ್ನಡ</option>
            </select>
          </div>
        </div>
        <div class="form-row">
          <div class="form-group"><label>${I18n.t('address')}</label><input class="form-input" id="wf-address" value="${w?.address || ''}" placeholder="Address" /></div>
          <div class="form-group" style="display:flex;align-items:center;gap:10px;margin-top:25px;">
            <input type="checkbox" id="wf-can-mark" ${w?.canMarkAttendance ? 'checked' : ''} style="width:20px;height:20px;accent-color:var(--primary);" />
            <label for="wf-can-mark" style="margin:0;cursor:pointer;">Can Mark Attendance</label>
          </div>
        </div>
        ${w ? `<div class="form-group"><label>Reset PIN (leave blank to keep)</label><input class="form-input" id="wf-pin" type="password" placeholder="New PIN" maxlength="6" /></div>` : ''}`,
      footer: `<button class="btn btn-ghost" onclick="Modal.close()">${I18n.t('cancel')}</button>
               <button class="btn btn-primary" onclick="Workers.save('${id || ''}')">${I18n.t('save')}</button>`
    });
  };

  const save = async (id) => {
    const body = {
      name: document.getElementById('wf-name')?.value.trim(),
      username: document.getElementById('wf-username')?.value.trim().toLowerCase(),
      phone: document.getElementById('wf-phone')?.value.trim(),
      dailyWage: parseFloat(document.getElementById('wf-wage')?.value) || 0,
      sharePercentage: parseFloat(document.getElementById('wf-share')?.value) || 0,
      preferredLanguage: document.getElementById('wf-lang')?.value,
      canMarkAttendance: document.getElementById('wf-can-mark')?.checked || false,
      address: document.getElementById('wf-address')?.value.trim()
    };
    const pin = document.getElementById('wf-pin')?.value.trim();
    if (pin) body.pin = pin;

    if (!body.name) { Toast.error('Name is required'); return; }
    const data = id ? await API.put(`/users/${id}`, body) : await API.post('/users', body);
    if (data.success) { Toast.success(data.message); Modal.close(); load(); }
    else Toast.error(data.message);
  };

  const remove = (id, name) => {
    Utils.confirm(`Remove worker "${name}"? They will be deactivated.`, async () => {
      const data = await API.delete(`/users/${id}`);
      if (data.success) { Toast.success(data.message); load(); }
      else Toast.error(data.message);
    });
  };

  const viewReport = async (id) => {
    const data = await API.get(`/reports/worker/${id}`);
    if (!data.success) { Toast.error(data.message); return; }
    const { worker, payments, summary } = data.data;
    Modal.open({
      title: `Report: ${worker.name}`,
      large: true,
      body: `
        <div class="stats-grid" style="grid-template-columns:repeat(3,1fr);margin-bottom:1rem">
          <div class="stat-card green" style="padding:.8rem"><div class="stat-value" style="font-size:1.2rem">${Utils.fmt(summary.totalEarned)}</div><div class="stat-label">${I18n.t('total_earned')}</div></div>
          <div class="stat-card yellow" style="padding:.8rem"><div class="stat-value" style="font-size:1.2rem">${Utils.fmt(summary.totalAdvance)}</div><div class="stat-label">${I18n.t('total_advance')}</div></div>
          <div class="stat-card blue" style="padding:.8rem"><div class="stat-value" style="font-size:1.2rem">${Utils.fmt(summary.netBalance)}</div><div class="stat-label">${I18n.t('net_balance')}</div></div>
        </div>
        <div class="table-wrap"><table>
          <thead><tr><th>#</th><th>Type</th><th>Amount</th><th>Status</th><th>Date</th></tr></thead>
          <tbody>${payments.slice(0,20).map(p => `
            <tr>
              <td>${p.paymentNumber}</td>
              <td>${Utils.statusBadge(p.type)}</td>
              <td class="amount-positive">${Utils.fmt(p.amount)}</td>
              <td>${Utils.statusBadge(p.status)}</td>
              <td>${Utils.date(p.createdAt)}</td>
            </tr>`).join('') || '<tr><td colspan="5" style="text-align:center;color:var(--text2)">No payments</td></tr>'}
          </tbody>
        </table></div>`,
      footer: `<button class="btn btn-ghost" onclick="Modal.close()">Close</button>
               <button class="btn btn-primary" onclick="Workers.printReport('${id}')"><i class="fa-solid fa-print"></i> Print</button>`
    });
  };

  const printReport = async (id) => {
    const data = await API.get(`/reports/worker/${id}`);
    if (!data.success) { Toast.error(data.message); return; }
    const { worker, payments, summary } = data.data;
    const content = `
      <div class="print-section">
        <div class="print-grid">
          <div><div class="print-label">Worker Name</div><div class="print-value">${worker.name}</div></div>
          <div><div class="print-label">Worker ID</div><div class="print-value">@${worker.username}</div></div>
          <div><div class="print-label">Phone</div><div class="print-value">${worker.phone || '—'}</div></div>
          <div><div class="print-label">Join Date</div><div class="print-value">${Utils.date(worker.joinDate)}</div></div>
        </div>
      </div>
      <div class="print-section" style="display:flex;gap:15px;margin-top:20px">
        <div style="flex:1;background:#f0fdf4;padding:15px;border-radius:8px;border:1px solid #bbf7d0;text-align:center">
          <div class="print-label" style="color:#166534">Total Earned</div><div class="print-value" style="font-size:20px;color:#15803d">${Utils.fmt(summary.totalEarned)}</div>
        </div>
        <div style="flex:1;background:#fffbeb;padding:15px;border-radius:8px;border:1px solid #fde68a;text-align:center">
          <div class="print-label" style="color:#92400e">Total Advance</div><div class="print-value" style="font-size:20px;color:#b45309">${Utils.fmt(summary.totalAdvance)}</div>
        </div>
        <div style="flex:1;background:#eff6ff;padding:15px;border-radius:8px;border:1px solid #bfdbfe;text-align:center">
          <div class="print-label" style="color:#1e40af">Net Balance</div><div class="print-value" style="font-size:20px;color:#1d4ed8">${Utils.fmt(summary.netBalance)}</div>
        </div>
      </div>
      <div class="print-section">
        <h3 style="font-size:14px;margin-bottom:10px;border-bottom:1px solid #e2e8f0;padding-bottom:5px">Transaction History (Last 20)</h3>
        <table>
          <thead><tr><th>#</th><th>Type</th><th>Amount</th><th>Status</th><th>Date</th></tr></thead>
          <tbody>${payments.slice(0, 20).map(p => `
            <tr>
              <td>${p.paymentNumber}</td>
              <td>${p.type.toUpperCase()}</td>
              <td class="${p.type === 'deduction' || p.type === 'reversal' ? 'amount-neg' : 'amount-pos'}">${Utils.fmt(p.amount)}</td>
              <td>${p.status.toUpperCase()}</td>
              <td>${Utils.date(p.createdAt)}</td>
            </tr>`).join('') || '<tr><td colspan="5" style="text-align:center">No records found</td></tr>'}
          </tbody>
        </table>
      </div>
    `;
    Utils.print(`Worker Report: ${worker.name}`, content);
  };

  return { load, search, showForm, save, remove, viewReport, printReport };
})();
