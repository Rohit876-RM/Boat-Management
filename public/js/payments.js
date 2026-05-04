// ── Payments Module ──────────────────────────────────────────────
const Payments = (() => {
  let allPayments = [];
  let workersList = [];

  const load = async () => {
    const el = document.getElementById('payments-list');
    if (!el) return;
    el.innerHTML = `<div class="loader"><i class="fa-solid fa-spinner"></i></div>`;
    const status = document.getElementById('pay-status-filter')?.value || '';
    const q = status ? `?status=${status}` : '';
    const data = await API.get(`/payments${q}`);
    if (!data.success) { el.innerHTML = `<div class="empty-state"><i class="fa-solid fa-triangle-exclamation"></i><p>${data.message}</p></div>`; return; }
    allPayments = data.data;
    const user = App.getUser();
    const hasPending = allPayments.some(p => p.status === 'pending');
    const bulkBtn = document.getElementById('btn-bulk-approve');
    if (bulkBtn) bulkBtn.style.display = user?.role === 'owner' && hasPending ? '' : 'none';
    render(allPayments);
  };

  const render = (payments) => {
    const el = document.getElementById('payments-list');
    const user = App.getUser();
    if (!payments.length) { el.innerHTML = `<div class="empty-state"><i class="fa-solid fa-money-bill-wave"></i><p>${I18n.t('no_data')}</p></div>`; return; }
    el.innerHTML = `<div class="table-wrap"><table>
      <thead><tr><th>#</th><th>${I18n.t('worker_name')}</th><th>Type</th><th>Amount</th><th>Trip</th><th>Method</th><th>Status</th><th>Date</th><th>Actions</th></tr></thead>
      <tbody>${payments.map(p => `
        <tr>
          <td><strong>${p.paymentNumber}</strong></td>
          <td>${p.worker?.name || '—'}</td>
          <td>${Utils.statusBadge(p.type)}</td>
          <td class="${p.type === 'deduction' || p.type === 'reversal' ? 'amount-negative' : 'amount-positive'}">${Utils.fmt(p.amount)}</td>
          <td>${p.trip?.tripNumber || '—'}</td>
          <td><small style="color:var(--text2)">${p.paymentMethod}</small></td>
          <td>${Utils.statusBadge(p.status)}</td>
          <td><small style="color:var(--text2)">${Utils.date(p.createdAt)}</small></td>
          <td>${actionButtons(p, user)}</td>
        </tr>`).join('')}
      </tbody>
    </table></div>`;
  };

  const actionButtons = (p, user) => {
    if (user?.role !== 'owner') return '';
    let btns = '';
    if (p.status === 'pending') {
      btns += `<button class="btn btn-success btn-sm btn-icon" onclick="Payments.approve('${p._id}')" title="Approve"><i class="fa-solid fa-check"></i></button>
               <button class="btn btn-danger btn-sm btn-icon" onclick="Payments.reject('${p._id}')" title="Reject"><i class="fa-solid fa-xmark"></i></button>`;
    }
    if (p.status === 'approved') {
      btns += `<button class="btn btn-primary btn-sm" onclick="Payments.markPaid('${p._id}')"><i class="fa-solid fa-hand-holding-dollar"></i> Pay</button>`;
    }
    if (p.status === 'paid') {
      btns += `<button class="btn btn-warning btn-sm btn-icon" onclick="Payments.showReversal('${p._id}')" title="Reverse"><i class="fa-solid fa-rotate-left"></i></button>`;
    }
    btns += `<button class="btn btn-ghost btn-sm btn-icon" onclick="Payments.printReceipt('${p._id}')" title="Print Receipt"><i class="fa-solid fa-print"></i></button>`;
    return btns;
  };

  const loadWorkers = async () => {
    if (workersList.length) return;
    const data = await API.get('/users?role=worker&isActive=true');
    if (data.success) workersList = data.data;
  };

  const showForm = async () => {
    const user = App.getUser();
    await loadWorkers();
    const workerSel = user?.role === 'owner' ? `
      <div class="form-group"><label>${I18n.t('worker_name')} *</label>
        <select class="form-input" id="pf-worker"><option value="">Select worker...</option>${workersList.map(w => `<option value="${w._id}">${w.name}</option>`).join('')}</select>
      </div>
      <div class="form-group"><label>Type</label>
        <select class="form-input" id="pf-type">
          <option value="advance">Advance</option><option value="bonus">Bonus</option>
          <option value="deduction">Deduction</option><option value="wage">Wage</option>
        </select>
      </div>` :
      `<input type="hidden" id="pf-type" value="advance" /><p class="alert alert-info"><i class="fa-solid fa-circle-info"></i> Workers can only request advances.</p>`;

    Modal.open({
      title: user?.role === 'owner' ? 'New Payment' : I18n.t('request_advance'),
      body: `
        ${workerSel}
        <div class="form-group"><label>${I18n.t('amount')} *</label><input class="form-input" id="pf-amount" type="number" min="1" placeholder="0" /></div>
        <div class="form-group"><label>${I18n.t('description')}</label><input class="form-input" id="pf-desc" placeholder="Reason / notes" /></div>
        <div class="form-group"><label>${I18n.t('payment_method')}</label>
          <select class="form-input" id="pf-method">
            <option value="cash">Cash</option><option value="bank_transfer">Bank Transfer</option><option value="upi">UPI</option>
          </select>
        </div>`,
      footer: `<button class="btn btn-ghost" onclick="Modal.close()">${I18n.t('cancel')}</button>
               <button class="btn btn-primary" onclick="Payments.save()">${user?.role === 'owner' ? I18n.t('save') : I18n.t('request_advance')}</button>`
    });
  };

  const save = async () => {
    const amount = parseFloat(document.getElementById('pf-amount')?.value) || 0;
    const body = {
      worker: document.getElementById('pf-worker')?.value || undefined,
      type: document.getElementById('pf-type')?.value || 'advance',
      amount,
      description: document.getElementById('pf-desc')?.value.trim(),
      paymentMethod: document.getElementById('pf-method')?.value
    };
    if (!amount || amount <= 0) { Toast.error('Valid amount required'); return; }
    const data = await API.post('/payments', body);
    if (data.success) { Toast.success(data.message); Modal.close(); load(); }
    else Toast.error(data.message);
  };

  const approve = (id) => {
    Modal.open({
      title: I18n.t('confirm_approve'),
      body: `<div class="form-group"><label>${I18n.t('approval_notes')}</label><input class="form-input" id="appr-notes" placeholder="Optional notes" /></div>`,
      footer: `<button class="btn btn-ghost" onclick="Modal.close()">${I18n.t('cancel')}</button>
               <button class="btn btn-success" onclick="Payments._approve('${id}')">${I18n.t('approve')}</button>`
    });
  };

  const _approve = async (id) => {
    const notes = document.getElementById('appr-notes')?.value;
    const data = await API.post(`/payments/${id}/approve`, { notes });
    if (data.success) { Toast.success('Payment approved!'); Modal.close(); load(); }
    else Toast.error(data.message);
  };

  const reject = (id) => {
    Modal.open({
      title: I18n.t('confirm_reject'),
      body: `<div class="form-group"><label>${I18n.t('approval_notes')}</label><input class="form-input" id="rej-notes" placeholder="Reason for rejection" /></div>`,
      footer: `<button class="btn btn-ghost" onclick="Modal.close()">${I18n.t('cancel')}</button>
               <button class="btn btn-danger" onclick="Payments._reject('${id}')">${I18n.t('reject')}</button>`
    });
  };

  const _reject = async (id) => {
    const notes = document.getElementById('rej-notes')?.value;
    const data = await API.post(`/payments/${id}/reject`, { notes });
    if (data.success) { Toast.success('Payment rejected.'); Modal.close(); load(); }
    else Toast.error(data.message);
  };

  const markPaid = async (id) => {
    Utils.confirm('Mark this payment as PAID?', async () => {
      const data = await API.post(`/payments/${id}/pay`, { paymentMethod: 'cash' });
      if (data.success) { Toast.success('Marked as paid!'); load(); }
      else Toast.error(data.message);
    });
  };

  const showReversal = (id) => {
    Modal.open({
      title: 'Reverse Payment',
      body: `<div class="form-group"><label>${I18n.t('reversal_reason')} *</label><input class="form-input" id="rev-reason" placeholder="Reason..." /></div>`,
      footer: `<button class="btn btn-ghost" onclick="Modal.close()">${I18n.t('cancel')}</button>
               <button class="btn btn-warning" onclick="Payments._reverse('${id}')">${I18n.t('reverse')}</button>`
    });
  };

  const _reverse = async (id) => {
    const reason = document.getElementById('rev-reason')?.value.trim();
    if (!reason) { Toast.error('Reason is required'); return; }
    const data = await API.post(`/payments/${id}/reverse`, { reason });
    if (data.success) { Toast.success('Payment reversed.'); Modal.close(); load(); }
    else Toast.error(data.message);
  };

  const bulkApprove = () => {
    Utils.confirm('Approve ALL pending payments?', async () => {
      const pendingIds = allPayments.filter(p => p.status === 'pending').map(p => p._id);
      const data = await API.post('/payments/bulk-approve', { paymentIds: pendingIds });
      if (data.success) { Toast.success(data.message); load(); }
      else Toast.error(data.message);
    });
  };

  const printReceipt = (id) => {
    const p = allPayments.find(x => x._id === id);
    if (!p) return;
    const content = `
      <div class="print-section">
        <div class="print-grid">
          <div><div class="print-label">Receipt No</div><div class="print-value">${p.paymentNumber}</div></div>
          <div><div class="print-label">Date</div><div class="print-value">${Utils.date(p.createdAt)}</div></div>
          <div><div class="print-label">Worker Name</div><div class="print-value">${p.worker?.name || '—'}</div></div>
          <div><div class="print-label">Status</div><div class="print-value">${p.status.toUpperCase()}</div></div>
        </div>
      </div>
      <div class="print-section">
        <table>
          <thead><tr><th>Description</th><th style="text-align:right">Details</th></tr></thead>
          <tbody>
            <tr><td>Payment Type</td><td style="text-align:right">${p.type.toUpperCase()}</td></tr>
            <tr><td>Payment Method</td><td style="text-align:right">${p.paymentMethod.toUpperCase()}</td></tr>
            ${p.trip ? `<tr><td>Trip Reference</td><td style="text-align:right">${p.trip.tripNumber}</td></tr>` : ''}
            <tr style="font-size:16px;background:#f8fafc"><td><strong>TOTAL AMOUNT</strong></td><td style="text-align:right"><strong>${Utils.fmt(p.amount)}</strong></td></tr>
          </tbody>
        </table>
      </div>
      ${p.description ? `<div class="print-section"><div class="print-label">Notes / Description</div><div class="print-value">${p.description}</div></div>` : ''}
      <div class="print-section" style="margin-top:40px;display:flex;justify-content:space-between">
        <div style="text-align:center;width:150px;border-top:1px solid #64748b;padding-top:10px;font-size:12px;color:#64748b">Worker Signature</div>
        <div style="text-align:center;width:150px;border-top:1px solid #64748b;padding-top:10px;font-size:12px;color:#64748b">Authorized Signatory</div>
      </div>
    `;
    Utils.print(`Payment Receipt: ${p.paymentNumber}`, content);
  };

  return { load, showForm, save, approve, _approve, reject, _reject, markPaid, showReversal, _reverse, bulkApprove, printReceipt };
})();
