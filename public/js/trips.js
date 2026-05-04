// ── Trips Module ─────────────────────────────────────────────────
const Trips = (() => {
  let workersList = [];

  const load = async () => {
    const el = document.getElementById('trips-list');
    if (!el) return;
    el.innerHTML = `<div class="loader"><i class="fa-solid fa-spinner"></i></div>`;
    const status = document.getElementById('trip-status-filter')?.value || '';
    const q = status ? `?status=${status}` : '';
    const data = await API.get(`/trips${q}`);
    if (!data.success) { el.innerHTML = `<div class="empty-state"><i class="fa-solid fa-triangle-exclamation"></i><p>${data.message}</p></div>`; return; }
    const trips = data.data;
    if (!trips.length) { el.innerHTML = `<div class="empty-state"><i class="fa-solid fa-ship"></i><p>${I18n.t('no_data')}</p></div>`; return; }
    el.innerHTML = `<div class="table-wrap"><table>
      <thead><tr><th>#</th><th>Boat</th><th>Departure</th><th>Return</th><th>Crew</th><th>Catch</th><th>Revenue</th><th>Status</th><th>Actions</th></tr></thead>
      <tbody>${trips.map(t => `
        <tr>
          <td><strong>${t.tripNumber}</strong></td>
          <td>${t.boat}</td>
          <td>${Utils.date(t.departureDate)}</td>
          <td>${Utils.date(t.returnDate)}</td>
          <td>${t.crew?.length || 0}</td>
          <td>${Utils.fmtKg(t.totalCatch)}</td>
          <td class="amount-positive">${Utils.fmt(t.grossRevenue)}</td>
          <td>${Utils.statusBadge(t.status)}</td>
          <td>
            <button class="btn btn-ghost btn-sm" onclick="Trips.viewTrip('${t._id}')"><i class="fa-solid fa-eye"></i></button>
            ${App.getUser()?.role === 'owner' && t.status !== 'completed' && t.status !== 'cancelled' ? `
              <button class="btn btn-ghost btn-sm" onclick="Trips.showForm('${t._id}')" title="Edit Trip"><i class="fa-solid fa-edit"></i></button>
              ${t.status !== 'cancelled' ? `
                <button class="btn btn-primary btn-sm" onclick="Trips.showUpdateCatchForm('${t._id}')" title="Log Daily Catch"><i class="fa-solid fa-fish"></i></button>
                <button class="btn btn-success btn-sm" onclick="Trips.showCompleteForm('${t._id}')" title="Complete Trip"><i class="fa-solid fa-flag-checkered"></i></button>
              ` : ''}
            ` : ''}
          </td>
        </tr>`).join('')}
      </tbody>
    </table></div>`;
  };

  const loadWorkers = async () => {
    if (workersList.length) return;
    const data = await API.get('/users?role=worker&isActive=true');
    if (data.success) workersList = data.data;
  };

  const showForm = async (id = null) => {
    await loadWorkers();
    let trip = null;
    if (id) { const d = await API.get(`/trips/${id}`); trip = d.data; }

    const workerOptions = workersList.map(w => `<option value="${w._id}">${w.name} (@${w.username})</option>`).join('');

    Modal.open({
      title: trip ? 'Edit Trip' : I18n.t('add_trip'),
      large: true,
      body: `
        <div class="form-row">
          <div class="form-group"><label>${I18n.t('boat_name')} *</label><input class="form-input" id="tf-boat" value="${trip?.boat || ''}" placeholder="Boat name" /></div>
          <div class="form-group"><label>${I18n.t('location')}</label><input class="form-input" id="tf-location" value="${trip?.location || ''}" placeholder="Fishing area" /></div>
        </div>
        <div class="form-row">
          <div class="form-group"><label>${I18n.t('departure')} *</label><input class="form-input" type="date" id="tf-depart" value="${trip?.departureDate ? trip.departureDate.split('T')[0] : ''}" /></div>
          <div class="form-group"><label>${I18n.t('return')}</label><input class="form-input" type="date" id="tf-return" value="${trip?.returnDate ? trip.returnDate.split('T')[0] : ''}" /></div>
        </div>
        <div class="form-group"><label>${I18n.t('captain')} *</label>
          <select class="form-input" id="tf-captain"><option value="">Select captain...</option>${workerOptions}</select>
        </div>
        <div class="form-group"><label>${I18n.t('crew')}</label>
          <select class="form-input" id="tf-crew" multiple style="height:120px">${workerOptions}</select>
          <small style="color:var(--text2)">Hold Ctrl/Cmd to select multiple</small>
        </div>
        <div class="form-group"><label>${I18n.t('notes')}</label><input class="form-input" id="tf-notes" value="${trip?.notes || ''}" placeholder="Optional notes" /></div>`,
      footer: `<button class="btn btn-ghost" onclick="Modal.close()">${I18n.t('cancel')}</button>
               <button class="btn btn-primary" onclick="Trips.save('${id || ''}')">${I18n.t('save')}</button>`
    });

    // Pre-select captain
    if (trip?.captain) document.getElementById('tf-captain').value = trip.captain._id || trip.captain;
  };

  const save = async (id) => {
    const boat = document.getElementById('tf-boat')?.value.trim();
    const departureDate = document.getElementById('tf-depart')?.value;
    const returnDate = document.getElementById('tf-return')?.value;
    const captain = document.getElementById('tf-captain')?.value;
    const location = document.getElementById('tf-location')?.value.trim();
    const notes = document.getElementById('tf-notes')?.value.trim();
    const crewSel = document.getElementById('tf-crew');
    const crew = crewSel ? Array.from(crewSel.selectedOptions).map(o => ({ worker: o.value })) : [];

    if (!boat || !departureDate || !captain) { Toast.error('Boat, departure date, and captain are required.'); return; }

    const body = { boat, departureDate, captain, location, notes, crew };
    if (returnDate) body.returnDate = returnDate;

    const data = id ? await API.put(`/trips/${id}`, body) : await API.post('/trips', body);
    if (data.success) { Toast.success(data.message); Modal.close(); load(); }
    else Toast.error(data.message);
  };

  const showCompleteForm = (id) => {
    Modal.open({
      title: 'Complete Trip & Log Catch',
      large: true,
      body: `
        <div class="form-group"><label>${I18n.t('return')}</label><input class="form-input" type="date" id="comp-return" /></div>
        <div class="section-title"><i class="fa-solid fa-fish"></i> Catch Data</div>
        <div id="catch-rows">
          <div class="form-row-3" style="gap:.5rem;margin-bottom:.5rem">
            <input class="form-input catch-fish" placeholder="Fish type" />
            <input class="form-input catch-qty" type="number" placeholder="Qty (kg)" min="0" />
            <input class="form-input catch-price" type="number" placeholder="₹/kg" min="0" />
          </div>
        </div>
        <button class="btn btn-ghost btn-sm add-row-btn" onclick="Trips.addCatchRow()"><i class="fa-solid fa-plus"></i> ${I18n.t('add_catch_row')}</button>
        <hr class="divider" />
        <div class="section-title"><i class="fa-solid fa-receipt"></i> Expenses</div>
        <div id="expense-rows">
          <div class="form-row-3" style="gap:.5rem;margin-bottom:.5rem">
            <select class="form-input exp-cat">
              <option value="fuel">Fuel</option><option value="ice">Ice</option>
              <option value="food">Food</option><option value="maintenance">Maintenance</option>
              <option value="port_fee">Port Fee</option><option value="other">Other</option>
            </select>
            <input class="form-input exp-amt" type="number" placeholder="Amount (₹)" min="0" />
            <input class="form-input exp-desc" placeholder="Description" />
          </div>
        </div>
        <button class="btn btn-ghost btn-sm add-row-btn" onclick="Trips.addExpenseRow()"><i class="fa-solid fa-plus"></i> ${I18n.t('add_expense_row')}</button>`,
      footer: `<button class="btn btn-ghost" onclick="Modal.close()">${I18n.t('cancel')}</button>
               <button class="btn btn-success" onclick="Trips.completeTrip('${id}')"><i class="fa-solid fa-flag-checkered"></i> ${I18n.t('complete_trip')}</button>`
    });
  };

  const showUpdateCatchForm = (id) => {
    Modal.open({
      title: 'Log Daily Catch & Expenses',
      large: true,
      body: `
        <div class="alert alert-info"><i class="fa-solid fa-info-circle"></i> Log catches for active trips without completing the trip.</div>
        <div class="section-title"><i class="fa-solid fa-fish"></i> Catch Data</div>
        <div id="catch-rows">
          <div class="form-row-3" style="gap:.5rem;margin-bottom:.5rem">
            <input class="form-input catch-fish" placeholder="Fish type" />
            <input class="form-input catch-qty" type="number" placeholder="Qty (kg)" min="0" />
            <input class="form-input catch-price" type="number" placeholder="₹/kg" min="0" />
          </div>
        </div>
        <button class="btn btn-ghost btn-sm add-row-btn" onclick="Trips.addCatchRow()"><i class="fa-solid fa-plus"></i> ${I18n.t('add_catch_row')}</button>
        <hr class="divider" />
        <div class="section-title"><i class="fa-solid fa-receipt"></i> Expenses</div>
        <div id="expense-rows">
          <div class="form-row-3" style="gap:.5rem;margin-bottom:.5rem">
            <select class="form-input exp-cat">
              <option value="fuel">Fuel</option><option value="ice">Ice</option>
              <option value="food">Food</option><option value="maintenance">Maintenance</option>
              <option value="port_fee">Port Fee</option><option value="other">Other</option>
            </select>
            <input class="form-input exp-amt" type="number" placeholder="Amount (₹)" min="0" />
            <input class="form-input exp-desc" placeholder="Description" />
          </div>
        </div>
        <button class="btn btn-ghost btn-sm add-row-btn" onclick="Trips.addExpenseRow()"><i class="fa-solid fa-plus"></i> ${I18n.t('add_expense_row')}</button>`,
      footer: `<button class="btn btn-ghost" onclick="Modal.close()">${I18n.t('cancel')}</button>
               <button class="btn btn-primary" onclick="Trips.updateCatch('${id}')"><i class="fa-solid fa-save"></i> Save Log</button>`
    });
  };

  const addCatchRow = () => {
    const div = document.createElement('div');
    div.className = 'form-row-3';
    div.style.cssText = 'gap:.5rem;margin-bottom:.5rem';
    div.innerHTML = `<input class="form-input catch-fish" placeholder="Fish type" /><input class="form-input catch-qty" type="number" placeholder="Qty (kg)" min="0" /><input class="form-input catch-price" type="number" placeholder="₹/kg" min="0" />`;
    document.getElementById('catch-rows').appendChild(div);
  };

  const addExpenseRow = () => {
    const div = document.createElement('div');
    div.className = 'form-row-3';
    div.style.cssText = 'gap:.5rem;margin-bottom:.5rem';
    div.innerHTML = `<select class="form-input exp-cat"><option value="fuel">Fuel</option><option value="ice">Ice</option><option value="food">Food</option><option value="maintenance">Maintenance</option><option value="port_fee">Port Fee</option><option value="other">Other</option></select><input class="form-input exp-amt" type="number" placeholder="Amount (₹)" min="0" /><input class="form-input exp-desc" placeholder="Description" />`;
    document.getElementById('expense-rows').appendChild(div);
  };

  const completeTrip = async (id) => {
    const returnDate = document.getElementById('comp-return')?.value;
    const fishRows = document.querySelectorAll('#catch-rows .form-row-3');
    const expRows = document.querySelectorAll('#expense-rows .form-row-3');

    const catchData = Array.from(fishRows).map(r => {
      const q = parseFloat(r.querySelector('.catch-qty')?.value) || 0;
      const p = parseFloat(r.querySelector('.catch-price')?.value) || 0;
      return { fishType: r.querySelector('.catch-fish')?.value, quantity: q, pricePerKg: p, totalValue: q * p };
    }).filter(c => c.fishType && c.quantity > 0);

    const expenses = Array.from(expRows).map(r => ({
      category: r.querySelector('.exp-cat')?.value,
      amount: parseFloat(r.querySelector('.exp-amt')?.value) || 0,
      description: r.querySelector('.exp-desc')?.value
    })).filter(e => e.amount > 0);

    const data = await API.post(`/trips/${id}/complete`, { returnDate, catchData, expenses });
    if (data.success) { Toast.success(data.message); Modal.close(); load(); }
    else Toast.error(data.message);
  };

  const updateCatch = async (id) => {
    const fishRows = document.querySelectorAll('#catch-rows .form-row-3');
    const expRows = document.querySelectorAll('#expense-rows .form-row-3');

    const catchData = Array.from(fishRows).map(r => {
      const q = parseFloat(r.querySelector('.catch-qty')?.value) || 0;
      const p = parseFloat(r.querySelector('.catch-price')?.value) || 0;
      return { fishType: r.querySelector('.catch-fish')?.value, quantity: q, pricePerKg: p, totalValue: q * p };
    }).filter(c => c.fishType && c.quantity > 0);

    const expenses = Array.from(expRows).map(r => ({
      category: r.querySelector('.exp-cat')?.value,
      amount: parseFloat(r.querySelector('.exp-amt')?.value) || 0,
      description: r.querySelector('.exp-desc')?.value
    })).filter(e => e.amount > 0);

    if (!catchData.length && !expenses.length) {
      Toast.error('Please enter at least one catch or expense.');
      return;
    }

    const data = await API.post(`/trips/${id}/update-catch`, { catchData, expenses });
    if (data.success) { Toast.success(data.message); Modal.close(); load(); }
    else Toast.error(data.message);
  };

  const viewTrip = async (id) => {
    const { data: t } = await API.get(`/trips/${id}`);
    if (!t) { Toast.error('Trip not found'); return; }
    Modal.open({
      title: `${t.tripNumber} — ${t.boat}`,
      large: true,
      body: `
        <div class="form-row" style="margin-bottom:1rem">
          <div><label style="color:var(--text2);font-size:.8rem">Departure</label><p>${Utils.date(t.departureDate)}</p></div>
          <div><label style="color:var(--text2);font-size:.8rem">Return</label><p>${Utils.date(t.returnDate)}</p></div>
          <div><label style="color:var(--text2);font-size:.8rem">Status</label><p>${Utils.statusBadge(t.status)}</p></div>
          <div><label style="color:var(--text2);font-size:.8rem">Location</label><p>${t.location || '—'}</p></div>
        </div>
        <div class="stats-grid" style="grid-template-columns:repeat(3,1fr)">
          <div class="stat-card green" style="padding:.8rem"><div class="stat-value" style="font-size:1.1rem">${Utils.fmt(t.grossRevenue)}</div><div class="stat-label">Revenue</div></div>
          <div class="stat-card red" style="padding:.8rem"><div class="stat-value" style="font-size:1.1rem">${Utils.fmt(t.totalExpenses)}</div><div class="stat-label">Expenses</div></div>
          <div class="stat-card blue" style="padding:.8rem"><div class="stat-value" style="font-size:1.1rem">${Utils.fmt(t.netRevenue)}</div><div class="stat-label">Net</div></div>
        </div>
        ${t.catchData?.length ? `
        <div class="section-title" style="margin-top:1rem"><i class="fa-solid fa-fish"></i> Catch</div>
        <div class="table-wrap"><table><thead><tr><th>Fish</th><th>Qty</th><th>₹/kg</th><th>Total</th></tr></thead>
        <tbody>${t.catchData.map(c => `<tr><td>${c.fishType}</td><td>${c.quantity}kg</td><td>${Utils.fmt(c.pricePerKg)}</td><td class="amount-positive">${Utils.fmt(c.totalValue)}</td></tr>`).join('')}</tbody></table></div>` : ''}
        ${t.crew?.length ? `
        <div class="section-title" style="margin-top:1rem"><i class="fa-solid fa-users"></i> Crew</div>
        <div class="table-wrap"><table><thead><tr><th>Name</th><th>Role</th><th>Wage/day</th><th>Share%</th></tr></thead>
        <tbody>${t.crew.map(c => `<tr><td>${c.worker?.name || '—'}</td><td>${c.role}</td><td>${Utils.fmt(c.dailyWage)}</td><td>${c.sharePercentage}%</td></tr>`).join('')}</tbody></table></div>` : ''}`,
      footer: `<button class="btn btn-ghost" onclick="Modal.close()">Close</button><button class="btn btn-primary" onclick="window.print()"><i class="fa-solid fa-print"></i> Print</button>`
    });
  };

  return { load, showForm, save, showCompleteForm, showUpdateCatchForm, addCatchRow, addExpenseRow, completeTrip, updateCatch, viewTrip };
})();
