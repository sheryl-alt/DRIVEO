/* DRIVEO AUTH - Node.js/Express + MySQL + JWT. UI existing tetap dipakai. */
(function () {
  const AUTH_BASE = 'http://localhost:5000/api/auth';
  const LOGIN_URL = (role) => `${AUTH_BASE}/${role === 'admin' ? 'admin' : 'user'}/login`;
  const REGISTER_URL = `${AUTH_BASE}/register`;
  const LOGOUT_URL = `${AUTH_BASE}/logout`;
  const SESSION_URL = `${AUTH_BASE}/session`;
  let currentRole = 'user';

  function modal() {
    return document.getElementById('login-modal') || document.getElementById('loginModal');
  }

  function closeModal() {
    const m = modal();
    if (!m) return;
    m.classList.add('hidden');
    m.classList.remove('flex');
  }

  function showAlert(message, success) {
    const ids = currentRole === 'admin' ? ['admin-alert'] : ['user-alert'];
    let el = ids.map(id => document.getElementById(id)).find(Boolean);
    if (!el) {
      el = document.createElement('div');
      el.id = 'driveo-auth-alert';
      const m = modal();
      const form = m?.querySelector('form');
      if (form) form.parentNode.insertBefore(el, form);
    }
    el.textContent = message;
    el.className = 'mb-4 p-3 rounded-lg text-xs leading-snug ' + (success
      ? 'bg-green-50 text-green-700 border border-green-100'
      : 'bg-red-50 text-red-700 border border-red-100');
    el.classList.remove('hidden');
  }

  function setRole(role) {
    currentRole = role === 'admin' ? 'admin' : 'user';
  }

  function getRole() {
    const userPane = document.getElementById('user-tab-pane');
    const adminPane = document.getElementById('admin-tab-pane');
    if (adminPane && !adminPane.classList.contains('hidden')) return 'admin';
    if (userPane && !userPane.classList.contains('hidden')) return 'user';

    const title = document.getElementById('loginTitle') || document.getElementById('loginModalTitle');
    if (title && /ADMIN/i.test(title.textContent || '')) return 'admin';

    const adminBtn = document.getElementById('tabAdminBtn') || document.getElementById('tab-admin-btn');
    if (adminBtn && /bg-white/.test(adminBtn.className || '')) return 'admin';
    return currentRole;
  }

  function getCredentials() {
    const role = getRole();
    setRole(role);
    const emailIds = role === 'admin'
      ? ['admin-email', 'loginEmailInput', 'login-email-input']
      : ['user-email', 'loginEmailInput', 'login-email-input'];
    const passwordIds = role === 'admin'
      ? ['admin-password', 'loginPasswordInput', 'login-password-input']
      : ['user-password', 'loginPasswordInput', 'login-password-input'];
    const find = ids => ids.map(id => document.getElementById(id)).find(Boolean);
    return { role, email: find(emailIds), password: find(passwordIds) };
  }

  async function login(event) {
    if (event) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }

    const { role, email, password } = getCredentials();
    const emailValue = email?.value?.trim() || '';
    const passwordValue = password?.value || '';
    if (!emailValue || !passwordValue) {
      showAlert('Email dan password wajib diisi.', false);
      return false;
    }

    const body = new URLSearchParams();
    body.set('email', emailValue);
    body.set('password', passwordValue);

    try {
      const response = await fetch(LOGIN_URL(role), {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8', 'Accept': 'application/json' },
        credentials: 'include',
        body
      });
      const result = await response.json();

      if (!response.ok || !result.success) {
        showAlert(result.message || 'Login gagal.', false);
        return false;
      }

      if (role === 'admin' && result.user?.role !== 'admin') {
        showAlert('Akun ini bukan akun admin.', false);
        return false;
      }

      sessionStorage.setItem('driveo_user', JSON.stringify(result.user || {}));
      if (result.token) sessionStorage.setItem('driveo_token', result.token);
      showAlert('Login berhasil.', true);

      setTimeout(() => {
        closeModal();
        if (window.parent && window.parent !== window) {
          window.parent.postMessage({
            type: role === 'admin' ? 'DRIVEO_ADMIN_LOGIN_SUCCESS' : 'DRIVEO_LOGIN_SUCCESS',
            user: result.user
          }, window.location.origin);
        }
      }, 350);
      return true;
    } catch (error) {
      console.error('DRIVEO login error:', error);
      showAlert('Tidak dapat terhubung ke server Node.js. Pastikan backend DRIVEO berjalan di port 5000.', false);
      return false;
    }
  }

  window.handleUserSubmit = function (event) { setRole('user'); return login(event); };
  window.handleAdminSubmit = function (event) { setRole('admin'); return login(event); };

  function addRegisterModal() {
    if (document.getElementById('driveo-register-modal')) return;
    const wrapper = document.createElement('div');
    wrapper.id = 'driveo-register-modal';
    wrapper.className = 'fixed inset-0 z-[60] hidden items-center justify-center p-3 sm:p-4 bg-black/40 backdrop-blur-sm';
    wrapper.style.cssText = 'position:fixed;inset:0;z-index:2147483001;overflow-y:auto;box-sizing:border-box;';
    wrapper.innerHTML = `
      <div class="relative w-full max-w-[400px] bg-white rounded-2xl border border-neutral-200 shadow-2xl overflow-hidden p-6" style="font-family:Poppins,sans-serif">
        <div class="flex items-center justify-between pb-4 border-b border-neutral-100">
          <div class="flex items-center" aria-label="Logo DRIVEO"><svg class="h-[18px] w-[102px] flex-shrink-0" width="102" height="18" viewBox="0 0 102 18" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M7.92001 0.479998C9.36001 0.479998 10.664 0.663998 11.832 1.032C13.016 1.384 14.024 1.912 14.856 2.616C15.704 3.32 16.36 4.2 16.824 5.256C17.288 6.296 17.52 7.504 17.52 8.88C17.52 10.256 17.288 11.472 16.824 12.528C16.36 13.568 15.704 14.44 14.856 15.144C14.024 15.848 13.016 16.384 11.832 16.752C10.664 17.104 9.36001 17.28 7.92001 17.28H7.33137e-06V0.479998H7.92001ZM3.48001 2.28V15.48H7.92001C8.73601 15.48 9.49601 15.36 10.2 15.12C10.92 14.864 11.544 14.472 12.072 13.944C12.6 13.4 13.016 12.712 13.32 11.88C13.64 11.048 13.8 10.048 13.8 8.88C13.8 7.712 13.64 6.712 13.32 5.88C13.016 5.048 12.6 4.368 12.072 3.84C11.544 3.296 10.92 2.904 10.2 2.664C9.49601 2.408 8.73601 2.28 7.92001 2.28H3.48001ZM28.7963 0.479998C29.9963 0.479998 31.0683 0.615998 32.0123 0.887998C32.9723 1.144 33.7803 1.528 34.4363 2.04C35.0923 2.536 35.5963 3.152 35.9483 3.888C36.3003 4.608 36.4763 5.432 36.4763 6.36C36.4763 7.64 36.1563 8.72 35.5163 9.6C34.8763 10.48 33.9563 11.152 32.7563 11.616L36.7163 17.28H32.7563L29.2283 12.24H28.7963H23.6363V17.28H20.1563V0.479998H28.7963ZM23.6363 2.28V10.44H28.7963C30.0603 10.44 31.0363 10.112 31.7243 9.456C32.4123 8.784 32.7563 7.752 32.7563 6.36C32.7563 4.968 32.4123 3.944 31.7243 3.288C31.0363 2.616 30.0603 2.28 28.7963 2.28H23.6363ZM42.8316 17.28H39.3516V0.479998H42.8316V17.28ZM54.3553 15.24H54.5953L60.6193 0.479998H64.1953L57.3553 17.28H51.5953L44.7553 0.479998H48.3313L54.3553 15.24ZM69.5972 2.28V7.8H78.3572V9.6H69.5972V15.48H80.7572V17.28H66.1172V0.479998H80.7572V2.28H69.5972Z" fill="#111111"></path><path d="M91.5497 1.68C90.7337 1.68 89.9657 1.824 89.2457 2.112C88.5417 2.4 87.9257 2.84 87.3977 3.432C86.8697 4.024 86.4457 4.776 86.1257 5.688C85.8217 6.584 85.6697 7.648 85.6697 8.88C85.6697 10.112 85.8217 11.184 86.1257 12.096C86.4457 12.992 86.8697 13.736 87.3977 14.328C87.9257 14.92 88.5417 15.36 89.2457 15.648C89.9657 15.936 90.7337 16.08 91.5497 16.08C92.3657 16.08 93.1257 15.936 93.8297 15.648C94.5497 15.36 95.1737 14.92 95.7017 14.328C96.2297 13.736 96.6457 12.992 96.9497 12.096C97.2697 11.184 97.4297 10.112 97.4297 8.88C97.4297 7.648 97.2697 6.584 96.9497 5.688C96.6457 4.776 96.2297 4.024 95.7017 3.432C95.1737 2.84 94.5497 2.4 93.8297 2.112C93.1257 1.824 92.3657 1.68 91.5497 1.68ZM91.5497 -1.90735e-06C92.9897 -1.90735e-06 94.2937 0.191998 95.4617 0.575998C96.6457 0.959998 97.6537 1.528 98.4857 2.28C99.3337 3.032 99.9897 3.96 100.454 5.064C100.918 6.168 101.15 7.44 101.15 8.88C101.15 10.32 100.918 11.592 100.454 12.696C99.9897 13.8 99.3337 14.728 98.4857 15.48C97.6537 16.232 96.6457 16.8 95.4617 17.184C94.2937 17.568 92.9897 17.76 91.5497 17.76C90.1097 17.76 88.7977 17.568 87.6137 17.184C86.4297 16.8 85.4137 16.232 84.5657 15.48C83.7337 14.728 83.0857 13.8 82.6217 12.696C82.1737 11.592 81.9497 10.32 81.9497 8.88C81.9497 7.44 82.1737 6.168 82.6217 5.064C83.0857 3.96 83.7337 3.032 84.5657 2.28C85.4137 1.528 86.4297 0.959998 87.6137 0.575998C88.7977 0.191998 90.1097 -1.90735e-06 91.5497 -1.90735e-06Z" fill="#FF0000"></path></svg></div>
          <button type="button" id="driveo-register-close" class="text-2xl leading-none text-neutral-400 hover:text-neutral-900">×</button>
        </div>
        <div class="mt-5 mb-4">
          <h3 class="text-xl font-extrabold text-[#0D0D0D]">DAFTAR AKUN</h3>
          <p class="text-xs text-neutral-500 mt-1">Buat akun untuk menggunakan DRIVEO.</p>
        </div>
        <div id="driveo-register-alert" class="hidden mb-4 p-3 rounded-lg text-xs"></div>
        <form id="driveo-register-form" class="space-y-3.5">
          <div><label class="block text-[11px] font-normal uppercase tracking-wider mb-1.5">Nama</label><input id="driveo-register-name" required class="w-full px-3.5 py-2.5 text-xs bg-neutral-50 border border-neutral-200 rounded-xl focus:outline-none focus:border-[#111111]" placeholder="Masukkan nama"></div>
          <div><label class="block text-[11px] font-normal uppercase tracking-wider mb-1.5">Email</label><input id="driveo-register-email" required type="email" class="w-full px-3.5 py-2.5 text-xs bg-neutral-50 border border-neutral-200 rounded-xl focus:outline-none focus:border-[#111111]" placeholder="Masukkan email"></div>
          <div><label class="block text-[11px] font-normal uppercase tracking-wider mb-1.5" for="driveo-register-password">Password</label><div class="relative"><input id="driveo-register-password" required minlength="6" type="password" class="w-full pr-10 px-3.5 py-2.5 text-xs bg-neutral-50 border border-neutral-200 rounded-xl focus:outline-none focus:border-[#111111]" placeholder="Minimal 6 karakter"><button type="button" class="driveo-register-password-toggle absolute inset-y-0 right-0 pr-3 flex items-center text-zinc-400 hover:text-zinc-600" data-password-target="driveo-register-password" aria-label="Lihat password" aria-pressed="false"><svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z" stroke-linecap="round" stroke-linejoin="round"></path><circle cx="12" cy="12" r="3" stroke-linecap="round" stroke-linejoin="round"></circle><path data-password-slash d="M5 19 19 5" stroke-linecap="round" stroke-linejoin="round" style="display:none"></path></svg></button></div></div>
          <div><label class="block text-[11px] font-normal uppercase tracking-wider mb-1.5" for="driveo-register-confirm">Konfirmasi Password</label><div class="relative"><input id="driveo-register-confirm" required minlength="6" type="password" class="w-full pr-10 px-3.5 py-2.5 text-xs bg-neutral-50 border border-neutral-200 rounded-xl focus:outline-none focus:border-[#111111]" placeholder="Ulangi password"><button type="button" class="driveo-register-password-toggle absolute inset-y-0 right-0 pr-3 flex items-center text-zinc-400 hover:text-zinc-600" data-password-target="driveo-register-confirm" aria-label="Lihat password" aria-pressed="false"><svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z" stroke-linecap="round" stroke-linejoin="round"></path><circle cx="12" cy="12" r="3" stroke-linecap="round" stroke-linejoin="round"></circle><path data-password-slash d="M5 19 19 5" stroke-linecap="round" stroke-linejoin="round" style="display:none"></path></svg></button></div></div>
          <button class="w-full py-3 px-4 bg-[#FF0000] hover:bg-[#D90000] text-white font-semibold text-xs uppercase tracking-wider rounded-xl" type="submit">DAFTAR →</button>
          <p class="text-center text-xs text-neutral-500 pt-1">Sudah punya akun? <button type="button" id="driveo-back-login" class="font-bold text-[#111111] hover:text-[#FF0000]">Login</button></p>
        </form>
      </div>`;
    document.body.appendChild(wrapper);

    const close = () => wrapper.classList.add('hidden');
    wrapper.addEventListener('click', e => { if (e.target === wrapper) close(); });
    wrapper.querySelectorAll('.driveo-register-password-toggle').forEach((button) => {
      button.addEventListener('click', () => {
        const input = document.getElementById(button.dataset.passwordTarget);
        if (!input) return;
        const willShow = input.type === 'password';
        input.type = willShow ? 'text' : 'password';
        const slash = button.querySelector('[data-password-slash]');
        if (slash) slash.style.display = willShow ? '' : 'none';
        button.setAttribute('aria-pressed', String(willShow));
        button.setAttribute('aria-label', willShow ? 'Sembunyikan password' : 'Lihat password');
      });
    });
    document.getElementById('driveo-register-close').onclick = close;
    document.getElementById('driveo-back-login').onclick = () => { close(); const m = modal(); if (m) { m.classList.remove('hidden'); m.classList.add('flex'); } };
    document.getElementById('driveo-register-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const alert = document.getElementById('driveo-register-alert');
      const name = document.getElementById('driveo-register-name').value.trim();
      const email = document.getElementById('driveo-register-email').value.trim();
      const password = document.getElementById('driveo-register-password').value;
      const confirm = document.getElementById('driveo-register-confirm').value;
      if (password !== confirm) { alert.textContent = 'Konfirmasi password tidak sama.'; alert.className = 'mb-4 p-3 rounded-lg text-xs bg-red-50 text-red-700 border border-red-100'; return; }
      const body = new URLSearchParams({ nama: name, email, password });
      try {
        const response = await fetch(REGISTER_URL, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8', Accept: 'application/json' }, credentials: 'include', body });
        const result = await response.json();
        if (!response.ok || !result.success) throw new Error(result.message || 'Registrasi gagal');
        alert.textContent = 'Akun berhasil dibuat. Silakan login.';
        alert.className = 'mb-4 p-3 rounded-lg text-xs bg-green-50 text-green-700 border border-green-100';
        setTimeout(() => { close(); const m = modal(); if (m) { m.classList.remove('hidden'); m.classList.add('flex'); } }, 600);
      } catch (error) {
        alert.textContent = error.message;
        alert.className = 'mb-4 p-3 rounded-lg text-xs bg-red-50 text-red-700 border border-red-100';
      }
    });
  }

  function openRegister() {
    addRegisterModal();
    closeModal();
    const r = document.getElementById('driveo-register-modal');
    if (r) { r.classList.remove('hidden'); r.classList.add('flex'); }
  }

  function installAuthModalStyles() {
    if (document.getElementById('driveo-auth-modal-style')) return;
    const style = document.createElement('style');
    style.id = 'driveo-auth-modal-style';
    style.textContent = `
      /* Shared login sizing: Katalog is the reference for every page and role. */
      #login-modal > div,
      #loginModal > div.bg-white {
        width: min(100%, 340px) !important;
        max-width: 340px !important;
        max-height: calc(100dvh - 32px) !important;
        padding: 24px !important;
        margin: auto !important;
        overflow-y: auto !important;
        box-sizing: border-box !important;
        border-radius: 16px !important;
        font-family: Poppins, sans-serif !important;
      }
      #login-modal:not(.hidden), #loginModal:not(.hidden) {
        box-sizing: border-box !important;
        overflow-y: auto !important;
      }
      #login-modal > div svg[viewBox="0 0 102 18"],
      #loginModal > div.bg-white svg[viewBox="0 0 102 18"] {
        width: 90px !important;
        height: 16px !important;
        flex-shrink: 0 !important;
      }
      #login-modal > div h3, #loginModal > div.bg-white h3 {
        font-family: Poppins, sans-serif !important;
        font-size: 20px !important;
        line-height: 1.25 !important;
        font-weight: 800 !important;
      }
      #login-modal > div p, #loginModal > div.bg-white p {
        font-family: Poppins, sans-serif !important;
        font-size: 12px !important;
        line-height: 1.5 !important;
      }
      #login-modal > div label, #loginModal > div.bg-white label {
        font-family: Poppins, sans-serif !important;
        font-size: 11px !important;
        line-height: 1.4 !important;
      }
      #login-modal > div input:not([type="checkbox"]):not([type="radio"]),
      #loginModal > div.bg-white input:not([type="checkbox"]):not([type="radio"]) {
        min-height: 40px !important;
        box-sizing: border-box !important;
        padding-top: 9px !important;
        padding-bottom: 9px !important;
        border-radius: 10px !important;
        font-family: Poppins, sans-serif !important;
        font-size: 12px !important;
      }
      #login-modal > div form button[type="submit"],
      #loginModal > div.bg-white form button[type="submit"] {
        min-height: 40px !important;
        padding-top: 10px !important;
        padding-bottom: 10px !important;
        border-radius: 10px !important;
        font-family: Poppins, sans-serif !important;
        font-size: 12px !important;
      }
      #login-modal a.driveo-register-link, #loginModal a.driveo-register-link,
      #login-modal #userFooterRegister a, #loginModal #userFooterRegister a {
        color: #FF0000 !important;
        font-family: Poppins, sans-serif !important;
        font-size: 12px !important;
        font-weight: 700 !important;
        text-decoration: none;
      }
      #login-modal a.driveo-register-link:hover, #loginModal a.driveo-register-link:hover { text-decoration: underline !important; }

      /* Footer account prompt is identical on every page; Katalog is the typography reference. */
      #login-modal #userFooterRegister,
      #login-modal #loginFooterNotice,
      #login-modal #adminFooterNote,
      #loginModal #userFooterRegister,
      #loginModal #loginFooterNotice,
      #loginModal #adminFooterNote,
      #login-modal form > p.text-center,
      #loginModal form > p.text-center {
        font-family: Poppins, sans-serif !important;
        font-size: 12px !important;
        line-height: 1.4 !important;
        font-weight: 400 !important;
        text-align: center !important;
      }
      #login-modal #userFooterRegister p,
      #login-modal #loginFooterNotice p,
      #login-modal #adminFooterNote p,
      #loginModal #userFooterRegister p,
      #loginModal #loginFooterNotice p,
      #loginModal #adminFooterNote p,
      #login-modal form > p.text-center,
      #loginModal form > p.text-center {
        margin: 0 !important;
        padding-top: 12px !important;
        font-family: Poppins, sans-serif !important;
        font-size: 12px !important;
        line-height: 1.4 !important;
        font-weight: 400 !important;
      }
      #login-modal #userFooterRegister a,
      #login-modal #loginFooterNotice a,
      #login-modal #adminFooterNote a,
      #loginModal #userFooterRegister a,
      #loginModal #loginFooterNotice a,
      #loginModal #adminFooterNote a,
      #login-modal form > p.text-center a,
      #loginModal form > p.text-center a {
        color: #FF0000 !important;
        font-family: Poppins, sans-serif !important;
        font-size: 12px !important;
        line-height: 1.4 !important;
        font-weight: 700 !important;
      }

      /* Registration stays compact and balanced with the reference login card. */
      #driveo-register-modal {
        position: fixed !important;
        inset: 0 !important;
        z-index: 2147483001 !important;
        overflow-y: auto !important;
        box-sizing: border-box !important;
        padding: 16px !important;
      }
      #driveo-register-modal > div {
        width: min(100%, 400px) !important;
        max-width: 400px !important;
        max-height: calc(100dvh - 32px) !important;
        overflow-y: auto !important;
        margin: auto !important;
        padding: 24px !important;
        box-sizing: border-box !important;
        border-radius: 16px !important;
        font-family: Poppins, sans-serif !important;
      }
      #driveo-register-modal > div svg[viewBox="0 0 102 18"] { width: 90px !important; height: 16px !important; }
      #driveo-register-modal h3 { font-size: 20px !important; line-height: 1.25 !important; }
      #driveo-register-modal p { font-family: Poppins, sans-serif !important; font-size: 12px !important; line-height: 1.5 !important; }
      #driveo-register-modal label { font-family: Poppins, sans-serif !important; font-size: 11px !important; line-height: 1.4 !important; }
      #driveo-register-modal input:not([type="checkbox"]):not([type="radio"]) {
        min-height: 40px !important;
        box-sizing: border-box !important;
        padding-top: 9px !important;
        padding-bottom: 9px !important;
        border-radius: 10px !important;
        font-family: Poppins, sans-serif !important;
        font-size: 12px !important;
      }
      #driveo-register-modal form button[type="submit"] {
        min-height: 42px !important;
        padding-top: 10px !important;
        padding-bottom: 10px !important;
        border-radius: 10px !important;
        font-family: Poppins, sans-serif !important;
        font-size: 12px !important;
      }
      #driveo-register-modal .text-center,
      #driveo-register-modal .text-center a,
      #driveo-register-modal form > p {
        font-family: Poppins, sans-serif !important;
        font-size: 12px !important;
        line-height: 1.4 !important;
      }
      #driveo-register-modal .text-center a {
        font-weight: 700 !important;
        color: #FF0000 !important;
      }
      @media (max-width: 380px) {
        #login-modal > div, #loginModal > div.bg-white { padding: 20px !important; }
        #driveo-register-modal { padding: 10px !important; }
        #driveo-register-modal > div { padding: 20px !important; max-height: calc(100dvh - 20px) !important; }
      }
      @media (max-height: 680px) {
        #login-modal:not(.hidden), #loginModal:not(.hidden), #driveo-register-modal:not(.hidden) { align-items: flex-start !important; }
      }
    `;
    document.head.appendChild(style);
  }

  function hookModal() {
    const m = modal();
    if (!m || m.dataset.driveoAuthHooked === '1') return;
    m.dataset.driveoAuthHooked = '1';
    m.querySelectorAll('a,button').forEach((link) => { if (/^daftar$/i.test((link.textContent || '').trim())) link.classList.add('driveo-register-link'); });

    const userBtn = document.getElementById('tab-user-btn') || document.getElementById('tabUserBtn') || document.getElementById('loginTabUser');
    const adminBtn = document.getElementById('tab-admin-btn') || document.getElementById('tabAdminBtn') || document.getElementById('loginTabAdmin');
    const ensureRegisterLink = () => {
      const candidates = [document.getElementById('adminFooterNote'), document.getElementById('loginFooterNotice'), document.getElementById('userFooterRegister')].filter(Boolean);
      const note = candidates.find((el) => /belum punya akun/i.test(el.textContent || ''));
      if (note) note.innerHTML = 'Belum punya akun? <a href="#" class="driveo-register-link font-bold hover:underline">Daftar</a>';
    };
    const syncRememberMe = (role = getRole()) => {
      ['userExtraOptions', 'userUtilitiesRow', 'user-options-row'].forEach((id) => {
        const row = document.getElementById(id);
        if (!row) return;
        if (role === 'user') { row.classList.remove('hidden'); row.classList.add('flex'); row.style.justifyContent = 'flex-start'; }
        else { row.classList.add('hidden'); row.classList.remove('flex'); }
      });
    };
    userBtn?.addEventListener('click', () => setTimeout(() => { setRole('user'); syncRememberMe('user'); ensureRegisterLink(); }, 0));
    adminBtn?.addEventListener('click', () => setTimeout(() => { setRole('admin'); syncRememberMe('admin'); }, 0));
    ensureRegisterLink();
    setTimeout(() => syncRememberMe(getRole()), 0);

    m.addEventListener('click', (event) => {
      const link = event.target.closest?.('a,button');
      if (!link) return;
      if (/daftar/i.test(link.textContent || '')) {
        event.preventDefault();
        event.stopPropagation();
        openRegister();
      }
    }, true);

    m.addEventListener('submit', (event) => {
      event.preventDefault();
      event.stopImmediatePropagation();
      login(event);
    }, true);
  }

  async function logout() {
    try {
      await fetch(LOGOUT_URL, { method: 'POST', headers: { Accept: 'application/json' } });
    } catch (error) {
      console.error('DRIVEO logout error:', error);
    }
    sessionStorage.removeItem('driveo_user');
    sessionStorage.removeItem('driveo_admin_authenticated');
    sessionStorage.removeItem('driveo_token');
    if (window.parent && window.parent !== window) {
      const stored = JSON.parse(sessionStorage.getItem('driveo_user') || '{}');
      window.parent.postMessage({ type: 'DRIVEO_LOGOUT_SUCCESS', wasAdmin: stored?.role === 'admin' }, window.location.origin);
    }
  }
  window.confirmLogout = logout;
  window.driveoLogout = logout;

  async function checkSession() {
    try {
      const token = sessionStorage.getItem('driveo_token') || '';
      const response = await fetch(SESSION_URL, { credentials: 'include', headers: { Accept: 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) } });
      return await response.json();
    } catch (_) {
      return { success: false, authenticated: false, user: null };
    }
  }
  window.driveoCheckSession = checkSession;

  document.addEventListener('DOMContentLoaded', () => {
    installAuthModalStyles();
    hookModal();
    addRegisterModal();
  });
  setTimeout(() => { installAuthModalStyles(); hookModal(); addRegisterModal(); }, 0);
})();
