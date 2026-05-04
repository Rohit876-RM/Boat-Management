// ── Modal ────────────────────────────────────────────────────────
const Modal = (() => {
  const overlay = () => document.getElementById('modal-overlay');

  const open = ({ title, body, footer = '', large = false }) => {
    document.getElementById('modal-title').textContent = title;
    document.getElementById('modal-body').innerHTML = body;
    document.getElementById('modal-footer').innerHTML = footer;
    overlay().classList.add('open');
    if (large) overlay().classList.add('modal-lg');
    else overlay().classList.remove('modal-lg');
  };

  const _doClose = () => {
    overlay().classList.remove('open');
    const mb = document.getElementById('modal-body');
    const mf = document.getElementById('modal-footer');
    if (mb) mb.innerHTML = '';
    if (mf) mf.innerHTML = '';
  };

  // Close when clicking the dark backdrop (not the modal box itself)
  overlay()?.addEventListener('click', (e) => {
    if (e.target === overlay()) _doClose();
  });

  return { open, close: _doClose };
})();

// ── Toast Notifications ──────────────────────────────────────────
const Toast = (() => {
  const show = (msg, type = 'info', duration = 3500) => {
    const tc = document.getElementById('toast-container');
    const icons = { success: 'fa-check-circle', error: 'fa-circle-exclamation', info: 'fa-circle-info', warning: 'fa-triangle-exclamation' };
    const t = document.createElement('div');
    t.className = `toast ${type}`;
    t.innerHTML = `<i class="fa-solid ${icons[type] || icons.info}" style="color:var(--${type === 'success' ? 'success' : type === 'error' ? 'danger' : type === 'warning' ? 'warning' : 'primary'})"></i><span>${msg}</span>`;
    tc.appendChild(t);
    setTimeout(() => { t.style.opacity = '0'; t.style.transition = '0.4s'; setTimeout(() => t.remove(), 400); }, duration);
  };
  return { show, success: m => show(m, 'success'), error: m => show(m, 'error'), info: m => show(m, 'info'), warning: m => show(m, 'warning') };
})();

// ── Utilities ────────────────────────────────────────────────────
const Utils = {
  fmt: (n) => '₹' + Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 }),
  fmtKg: (n) => Number(n || 0).toLocaleString('en-IN') + ' kg',
  date: (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—',
  ago: (d) => {
    if (!d) return '—';
    const diff = Date.now() - new Date(d).getTime();
    const days = Math.floor(diff / 86400000);
    if (days === 0) return 'Today';
    if (days === 1) return 'Yesterday';
    if (days < 30) return `${days}d ago`;
    if (days < 365) return `${Math.floor(days / 30)}mo ago`;
    return `${Math.floor(days / 365)}y ago`;
  },
  statusBadge: (s) => `<span class="badge badge-${s}">${I18n.t(s) || s}</span>`,
  roleBadge: (r) => `<span class="badge badge-${r}">${I18n.t(r) || r}</span>`,
  confirm: (msg, fn) => {
    Modal.open({
      title: I18n.t('confirm'),
      body: `<p style="font-size:1rem;text-align:center;padding:1rem 0">${msg}</p>`,
      footer: `<button class="btn btn-ghost" onclick="Modal.close()">Cancel</button>
               <button class="btn btn-danger" onclick="Modal.close();(${fn})()">Confirm</button>`
    });
  },
  print: (title, content) => {
    const win = window.open('', '_blank');
    win.document.write(`
      <html>
        <head>
          <title>${title}</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&display=swap');
            body { font-family: 'Inter', sans-serif; padding: 40px; color: #1e293b; background: #fff; line-height: 1.5; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            .print-header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #e2e8f0; padding-bottom: 20px; }
            .print-header h1 { margin: 0; color: #2563eb; font-size: 24px; text-transform: uppercase; letter-spacing: 1px; font-weight: 800; }
            .print-header p { margin: 5px 0 0; color: #64748b; font-size: 14px; font-weight: 600; }
            .print-section { margin-bottom: 25px; }
            .print-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 20px; }
            .print-label { font-size: 11px; color: #64748b; text-transform: uppercase; font-weight: 700; margin-bottom: 4px; letter-spacing: 0.5px; }
            .print-value { font-size: 15px; font-weight: 600; color: #1e293b; }
            table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 13px; }
            th { text-align: left; padding: 12px; background: #f8fafc; color: #475569; border-bottom: 2px solid #e2e8f0; font-weight: 700; text-transform: uppercase; font-size: 11px; }
            td { padding: 12px; border-bottom: 1px solid #f1f5f9; color: #334155; }
            .amount-pos { color: #10b981; font-weight: 700; }
            .amount-neg { color: #ef4444; font-weight: 700; }
            .footer { text-align: center; margin-top: 50px; color: #94a3b8; font-size: 11px; border-top: 1px solid #f1f5f9; padding-top: 20px; font-weight: 500; }
            @media print {
              body { padding: 20px; }
              @page { margin: 1cm; }
            }
          </style>
        </head>
        <body>
          <div class="print-header">
            <h1>FISHING BOAT MANAGEMENT</h1>
            <p>${title}</p>
          </div>
          ${content}
          <div class="footer">
            <p>This is a computer-generated document. Generated on ${new Date().toLocaleString()}</p>
            <p>&copy; ${new Date().getFullYear()} Fishing Boat Business Management System</p>
          </div>
          <script>
            window.onload = () => {
              setTimeout(() => {
                window.print();
                window.onafterprint = () => window.close();
                // For browsers that don't support onafterprint
                setTimeout(() => { if(!window.closed) window.close(); }, 500);
              }, 500);
            };
          </script>
        </body>
      </html>
    `);
    win.document.close();
  }
};
