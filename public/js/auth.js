// ── Auth Module ──────────────────────────────────────────────────
const Auth = (() => {
  const login = async (e) => {
    e.preventDefault();
    const btn = document.getElementById('login-btn');
    const errEl = document.getElementById('login-error');
    const username = document.getElementById('login-username').value.trim();
    const pin = document.getElementById('login-pin').value.trim();
    errEl.classList.add('hidden');
    btn.disabled = true;
    btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> ${I18n.t('logging_in')}`;

    try {
      const data = await API.postNoAuth('/auth/login', { username, pin });
      if (data.success) {
        localStorage.setItem('accessToken', data.accessToken);
        localStorage.setItem('refreshToken', data.refreshToken);
        App.setUser(data.user);
        await I18n.load(data.user.preferredLanguage || 'en');
        Toast.success(`${I18n.t('hello')} ${data.user.name}! ${I18n.t('welcome_back')}`);
        speak(`Welcome ${data.user.name}`);
        App.showApp();
      } else {
        errEl.textContent = data.message || I18n.t('login_failed');
        errEl.classList.remove('hidden');
      }
    } catch (err) {
      errEl.textContent = I18n.t('login_failed');
      errEl.classList.remove('hidden');
    }
    btn.disabled = false;
    btn.innerHTML = `<i class="fa-solid fa-right-to-bracket"></i> <span>${I18n.t('login')}</span>`;
  };

  const logout = async () => {
    try {
      const rt = localStorage.getItem('refreshToken');
      await API.postNoAuth('/auth/logout', { refreshToken: rt });
    } catch { }
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('currentUser');
    speak('Goodbye! Logged out successfully.');
    location.reload();
  };

  const togglePin = () => {
    const input = document.getElementById('login-pin');
    const icon = document.getElementById('pin-eye');
    if (input.type === 'password') { input.type = 'text'; icon.className = 'fa-solid fa-eye-slash'; }
    else { input.type = 'password'; icon.className = 'fa-solid fa-eye'; }
  };

  const speak = (text) => {
    if (!text || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = I18n.getLang() === 'hi' ? 'hi-IN' : I18n.getLang() === 'kn' ? 'kn-IN' : 'en-IN';
    u.rate = 0.9;
    window.speechSynthesis.speak(u);
  };

  const speakWelcome = () => speak(`Welcome to Fishing Boat Management System. Please enter your username and PIN to login.`);
  const speakPage = () => {
    const title = document.getElementById('page-title')?.textContent || '';
    speak(`You are on the ${title} page.`);
  };

  const changePin = async (e) => {
    e.preventDefault();
    const currentPin = document.getElementById('cp-current').value;
    const newPin = document.getElementById('cp-new').value;
    const data = await API.post('/auth/change-pin', { currentPin, newPin });
    if (data.success) { Toast.success('PIN changed!'); Modal.close(); }
    else Toast.error(data.message);
  };

  const showChangePinModal = () => {
    Modal.open({
      title: I18n.t('change_pin'),
      body: `
        <div class="form-group">
          <label>${I18n.t('current_pin')}</label>
          <input type="password" class="form-input" id="cp-current" maxlength="6" placeholder="••••" />
        </div>
        <div class="form-group">
          <label>${I18n.t('new_pin')}</label>
          <input type="password" class="form-input" id="cp-new" maxlength="6" placeholder="••••" />
        </div>`,
      footer: `<button class="btn btn-ghost" onclick="Modal.close()">${I18n.t('cancel')}</button>
               <button class="btn btn-primary" onclick="Auth.changePin(event)">${I18n.t('save')}</button>`
    });
  };

  return { login, logout, togglePin, speakWelcome, speakPage, speak, changePin, showChangePinModal };
})();
