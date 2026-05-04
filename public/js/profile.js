// ── Profile View ─────────────────────────────────────────────────
const ProfileView = (() => {
  const load = async () => {
    const el = document.getElementById('profile-content');
    if (!el) return;
    const user = App.getUser();
    if (!user) return;

    el.innerHTML = `<div class="loader"><i class="fa-solid fa-spinner"></i></div>`;

    // Fetch worker payments for earnings summary
    let paymentsHtml = '';
    try {
      const data = await API.get('/payments');
      if (data.success) {
        const payments = data.data.slice(0, 10);
        const totalEarned = data.data.filter(p => p.status === 'paid' && (p.type === 'wage' || p.type === 'bonus')).reduce((a, p) => a + p.amount, 0);
        const totalAdvance = data.data.filter(p => p.status === 'paid' && p.type === 'advance').reduce((a, p) => a + p.amount, 0);
        const totalDeduction = data.data.filter(p => p.status === 'paid' && p.type === 'deduction').reduce((a, p) => a + p.amount, 0);
        const net = totalEarned - totalAdvance - totalDeduction;

        paymentsHtml = `
          <div class="stats-grid" style="grid-template-columns:repeat(2,1fr);gap:1rem;margin-bottom:1.5rem">
            <div class="stat-card green" style="padding:1rem">
              <div class="stat-value" style="font-size:1.3rem">${Utils.fmt(totalEarned)}</div>
              <div class="stat-label">${I18n.t('total_earned')}</div>
            </div>
            <div class="stat-card yellow" style="padding:1rem">
              <div class="stat-value" style="font-size:1.3rem">${Utils.fmt(totalAdvance)}</div>
              <div class="stat-label">${I18n.t('total_advance')}</div>
            </div>
            <div class="stat-card red" style="padding:1rem">
              <div class="stat-value" style="font-size:1.3rem">${Utils.fmt(totalDeduction)}</div>
              <div class="stat-label">Deductions</div>
            </div>
            <div class="stat-card blue" style="padding:1rem">
              <div class="stat-value" style="font-size:1.3rem">${Utils.fmt(net)}</div>
              <div class="stat-label">${I18n.t('net_balance')}</div>
            </div>
          </div>
          <h3 style="margin-bottom:1rem;color:var(--text1);font-size:1rem">Recent Payments</h3>
          ${payments.length ? `
            <div class="table-wrap"><table>
              <thead><tr><th>#</th><th>Type</th><th>Amount</th><th>Status</th><th>Date</th></tr></thead>
              <tbody>${payments.map(p => `
                <tr>
                  <td><strong>${p.paymentNumber}</strong></td>
                  <td>${Utils.statusBadge(p.type)}</td>
                  <td class="${p.type === 'deduction' ? 'amount-negative' : 'amount-positive'}">${Utils.fmt(p.amount)}</td>
                  <td>${Utils.statusBadge(p.status)}</td>
                  <td><small style="color:var(--text2)">${Utils.date(p.createdAt)}</small></td>
                </tr>`).join('')}
              </tbody>
            </table></div>
          ` : `<div class="empty-state"><i class="fa-solid fa-money-bill-wave"></i><p>${I18n.t('no_data')}</p></div>`}`;
      }
    } catch (err) {
      paymentsHtml = `<p style="color:var(--text2)">${I18n.t('no_data')}</p>`;
    }

    el.innerHTML = `
      <div style="max-width:700px;margin:0 auto">
        <div class="data-card" style="margin-bottom:1.5rem">
          <div class="data-card-header" style="gap:1.2rem">
            <div class="worker-avatar" style="width:60px;height:60px;font-size:1.5rem;flex-shrink:0">${user.name ? user.name[0].toUpperCase() : '?'}</div>
            <div>
              <div class="data-card-title" style="font-size:1.3rem">${user.name}</div>
              <div style="color:var(--text2);font-size:.9rem">@${user.username}</div>
              <div style="margin-top:.4rem">${Utils.roleBadge(user.role)}</div>
            </div>
          </div>
          <div class="data-card-meta" style="margin-top:1rem">
            ${user.phone ? `<span><i class="fa-solid fa-phone" style="width:16px;color:var(--text3)"></i> ${user.phone}</span>` : ''}
            ${user.dailyWage ? `<span><i class="fa-solid fa-indian-rupee-sign" style="width:16px;color:var(--text3)"></i> ${Utils.fmt(user.dailyWage)}/day</span>` : ''}
            ${user.sharePercentage > 0 ? `<span><i class="fa-solid fa-percent" style="width:16px;color:var(--text3)"></i> ${user.sharePercentage}% trip share</span>` : ''}
            ${user.joinDate ? `<span><i class="fa-solid fa-calendar" style="width:16px;color:var(--text3)"></i> Joined ${Utils.date(user.joinDate)}</span>` : ''}
          </div>
          <div class="data-card-actions" style="margin-top:1rem">
            <button class="btn btn-ghost btn-sm" onclick="Auth.showChangePinModal()">
              <i class="fa-solid fa-lock"></i> ${I18n.t('change_pin')}
            </button>
            <button class="btn btn-primary btn-sm" onclick="Payments.showForm()">
              <i class="fa-solid fa-hand-holding-dollar"></i> ${I18n.t('request_advance')}
            </button>
          </div>
        </div>
        ${paymentsHtml}
      </div>`;
  };

  return { load };
})();

// ── Settings View ────────────────────────────────────────────────
const SettingsView = (() => {
  const load = () => {
    const el = document.getElementById('settings-content');
    if (!el) return;
    const user = App.getUser();

    el.innerHTML = `
      <div style="max-width:600px;margin:0 auto;display:flex;flex-direction:column;gap:1.2rem">

        <div class="data-card">
          <div class="data-card-title" style="margin-bottom:1rem"><i class="fa-solid fa-globe"></i> ${I18n.t('language')}</div>
          <p style="color:var(--text2);font-size:.9rem;margin-bottom:1rem">Choose your preferred display language</p>
          <div style="display:flex;gap:.8rem;flex-wrap:wrap">
            <button class="lang-btn-sm ${I18n.getLang()==='en'?'active':''}" onclick="App.switchLang('en')">🇬🇧 English</button>
            <button class="lang-btn-sm ${I18n.getLang()==='hi'?'active':''}" onclick="App.switchLang('hi')">🇮🇳 हिंदी</button>
            <button class="lang-btn-sm ${I18n.getLang()==='kn'?'active':''}" onclick="App.switchLang('kn')">🏴 ಕನ್ನಡ</button>
          </div>
        </div>

        <div class="data-card">
          <div class="data-card-title" style="margin-bottom:1rem"><i class="fa-solid fa-lock"></i> ${I18n.t('security')}</div>
          <p style="color:var(--text2);font-size:.9rem;margin-bottom:1rem">Change your login PIN</p>
          <button class="btn btn-primary" onclick="Auth.showChangePinModal()">
            <i class="fa-solid fa-key"></i> ${I18n.t('change_pin')}
          </button>
        </div>

        <div class="data-card">
          <div class="data-card-title" style="margin-bottom:1rem"><i class="fa-solid fa-volume-high"></i> ${I18n.t('audio_guide')}</div>
          <p style="color:var(--text2);font-size:.9rem;margin-bottom:1rem">Test the audio guide feature</p>
          <button class="btn btn-ghost" onclick="Auth.speakPage()">
            <i class="fa-solid fa-play"></i> Play Audio Guide
          </button>
        </div>

        ${user?.role === 'owner' ? `
        <div class="data-card">
          <div class="data-card-title" style="margin-bottom:1rem"><i class="fa-solid fa-circle-info"></i> System Info</div>
          <div style="display:flex;flex-direction:column;gap:.5rem;color:var(--text2);font-size:.9rem">
            <span><i class="fa-solid fa-ship" style="width:20px;color:var(--primary)"></i> Fishing Boat Management System v1.0</span>
            <span><i class="fa-solid fa-user-shield" style="width:20px;color:var(--primary)"></i> Role: Owner (Full Access)</span>
            <span><i class="fa-solid fa-database" style="width:20px;color:var(--primary)"></i> Database: MongoDB</span>
          </div>
        </div>` : ''}

        <div class="data-card" style="border-color:rgba(239,68,68,0.3)">
          <div class="data-card-title" style="margin-bottom:1rem;color:var(--danger)"><i class="fa-solid fa-right-from-bracket"></i> Logout</div>
          <p style="color:var(--text2);font-size:.9rem;margin-bottom:1rem">Sign out of your account securely</p>
          <button class="btn btn-danger" onclick="Auth.logout()">
            <i class="fa-solid fa-right-from-bracket"></i> ${I18n.t('logout')}
          </button>
        </div>
      </div>`;
  };

  return { load };
})();
