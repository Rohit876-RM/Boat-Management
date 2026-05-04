// ── App: Router & State Management ──────────────────────────────
const App = (() => {
  let state = { user: null, lang: 'en', currentView: 'dashboard' };

  const ownerNav = [
    { key: 'dashboard', icon: 'fa-gauge', view: 'dashboard' },
    { key: 'workers', icon: 'fa-users', view: 'workers' },
    { key: 'attendance', icon: 'fa-calendar-check', view: 'attendance' },
    { key: 'trips', icon: 'fa-ship', view: 'trips' },
    { key: 'payments', icon: 'fa-money-bill-wave', view: 'payments' },
    { key: 'reports', icon: 'fa-chart-bar', view: 'reports' },
    { key: 'settings', icon: 'fa-gear', view: 'settings' },
  ];
  const workerNav = [
    { key: 'dashboard', icon: 'fa-gauge', view: 'dashboard' },
    { key: 'my_trips', icon: 'fa-ship', view: 'trips' },
    { key: 'my_earnings', icon: 'fa-money-bill-wave', view: 'payments' },
    { key: 'profile', icon: 'fa-user', view: 'profile' },
    { key: 'settings', icon: 'fa-gear', view: 'settings' },
  ];

  const init = async () => {
    // Theme setup
    const savedTheme = localStorage.getItem('theme') || 'dark';
    if (savedTheme === 'light') {
      document.body.classList.add('light-theme');
      const icon = document.getElementById('theme-icon');
      if (icon) {
        icon.classList.remove('fa-moon');
        icon.classList.add('fa-sun');
      }
    }

    const savedLang = localStorage.getItem('lang') || 'en';
    await I18n.load(savedLang);
    state.lang = savedLang;

    const token = localStorage.getItem('accessToken');
    const savedUser = localStorage.getItem('currentUser');
    if (token && savedUser) {
      state.user = JSON.parse(savedUser);
      showApp();
    } else {
      showLanguageScreen();
    }
  };

  const selectLanguage = async (lang) => {
    state.lang = lang;
    await I18n.load(lang);
    showScreen('login-screen');
  };

  const switchLang = async (lang) => {
    state.lang = lang;
    await I18n.load(lang);
    if (state.user) await API.patch('/users/me/language', { language: lang });
    renderCurrentView();
  };

  const showLanguageScreen = () => showScreen('lang-screen');

  const showScreen = (id) => {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    const el = document.getElementById(id);
    if (el) el.classList.add('active');
  };

  const showApp = () => {
    showScreen('app-shell');
    buildNav();
    updateSidebarUser();
    navigate(state.currentView || 'dashboard');
    checkDbStatus();
    if (state.user?.role === 'owner') pollPendingCount();
  };

  const buildNav = () => {
    let nav = state.user?.role === 'owner' ? ownerNav : [...workerNav];
    
    if (state.user?.role === 'worker' && state.user?.canMarkAttendance) {
      nav.splice(2, 0, { key: 'attendance', icon: 'fa-calendar-check', view: 'attendance' });
    }

    const navEl = document.getElementById('sidebar-nav');
    navEl.innerHTML = nav.map(item => `
      <div class="nav-item" onclick="App.navigate('${item.view}')" id="nav-${item.view}">
        <i class="fa-solid ${item.icon}"></i>
        <span class="i18n" data-key="${item.key}">${I18n.t(item.key)}</span>
      </div>
    `).join('');
  };

  const updateSidebarUser = () => {
    const u = state.user;
    if (!u) return;
    document.getElementById('sidebar-name').textContent = u.name;
    document.getElementById('sidebar-role').textContent = I18n.t(u.role);
    document.getElementById('sidebar-role').className = `user-role badge badge-${u.role}`;
    document.getElementById('sidebar-avatar').textContent = u.name ? u.name[0].toUpperCase() : '👤';
  };

  const navigate = (view) => {
    state.currentView = view;
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    const viewEl = document.getElementById(`view-${view}`);
    if (viewEl) viewEl.classList.add('active');
    const navItem = document.getElementById(`nav-${view}`);
    if (navItem) navItem.classList.add('active');

    const titles = { dashboard: 'dashboard', workers: 'workers', trips: state.user?.role === 'worker' ? 'my_trips' : 'trips', payments: state.user?.role === 'worker' ? 'my_earnings' : 'payments', reports: 'reports', settings: 'settings', profile: 'profile' };
    document.getElementById('page-title').textContent = I18n.t(titles[view] || view);

    // Lazy-load view data
    if (view === 'dashboard') Dashboard.load();
    else if (view === 'workers') Workers.load();
    else if (view === 'attendance') Attendance.load();
    else if (view === 'trips') Trips.load();
    else if (view === 'payments') Payments.load();
    else if (view === 'reports') Reports.load();
    else if (view === 'profile') ProfileView.load();
    else if (view === 'settings') SettingsView.load();

    // Close sidebar on mobile
    if (window.innerWidth <= 768) toggleSidebar(false);
  };

  const renderCurrentView = () => navigate(state.currentView || 'dashboard');

  const toggleSidebar = (forceOpen) => {
    const sb = document.getElementById('sidebar');
    if (forceOpen === false) sb.classList.remove('open');
    else if (forceOpen === true) sb.classList.add('open');
    else sb.classList.toggle('open');
  };

  const getUser = () => state.user;
  const setUser = (u) => { state.user = u; localStorage.setItem('currentUser', JSON.stringify(u)); };

  const checkDbStatus = async () => {
    try {
      const res = await fetch('/api/health');
      const data = await res.json();
      const indicator = document.getElementById('db-indicator');
      if (data.db === 'connected') { indicator.classList.add('online'); indicator.title = 'Database: Connected'; }
      else { indicator.classList.remove('online'); indicator.title = 'Database: Disconnected'; }
    } catch { }
  };

  const pollPendingCount = async () => {
    try {
      const data = await API.get('/payments/pending-count');
      if (data.success) {
        const cnt = data.count;
        const wrap = document.getElementById('pending-badge-wrap');
        const el = document.getElementById('pending-count');
        if (cnt > 0) { wrap.style.display = ''; el.textContent = cnt > 99 ? '99+' : cnt; }
        else { wrap.style.display = 'none'; }
      }
    } catch { }
    setTimeout(pollPendingCount, 30000);
  };

  const printPage = () => window.print();

  const toggleTheme = () => {
    const body = document.body;
    const isLight = body.classList.toggle('light-theme');
    localStorage.setItem('theme', isLight ? 'light' : 'dark');
    
    const icon = document.getElementById('theme-icon');
    if (icon) {
      if (isLight) {
        icon.classList.remove('fa-moon');
        icon.classList.add('fa-sun');
      } else {
        icon.classList.remove('fa-sun');
        icon.classList.add('fa-moon');
      }
    }
  };

  return { init, selectLanguage, switchLang, showLanguageScreen, navigate, toggleSidebar, getUser, setUser, showApp, printPage, toggleTheme };
})();
