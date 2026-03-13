/* ═══════════════════════════════════════════════════════════
   shared.js — Chunks AI shared utilities
   Included by: index.html, exam.html, research.html
   Provides: Supabase auth, logout confirm modal, toast, user UI
═══════════════════════════════════════════════════════════ */

(async function () {
  /* ── Config ─────────────────────────────────────────────── */
  const SUPABASE_URL  = 'https://wiwbfspsrgayvquzfryl.supabase.co';
  const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indpd2Jmc3BzcmdheXZxdXpmcnlsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE5MjgyNzUsImV4cCI6MjA4NzUwNDI3NX0.8ct39elZ_Xgivs5zgL2T98GyIG9W8N05XAZWkFRn07I';

  /* ── Wait for Supabase SDK ──────────────────────────────── */
  await new Promise(resolve => {
    if (window.supabase) return resolve();
    const t = setInterval(() => { if (window.supabase) { clearInterval(t); resolve(); } }, 50);
  });

  const _sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON);
  window._sharedSupabase = _sb;
  let _authToken = null;

  /* ── Session check ──────────────────────────────────────── */
  async function _checkSession() {
    if (sessionStorage.getItem('chunks_guest_mode')) return;
    const { data: { session } } = await _sb.auth.getSession();
    if (!session) { window.location.replace('login.html'); return; }
    _authToken = session.access_token;
    _applyUserToUI(session.user);
    _sb.auth.onAuthStateChange((event, newSession) => {
      if (event === 'SIGNED_OUT') {
        window.location.replace('login.html');
      } else if (newSession?.access_token) {
        _authToken = newSession.access_token;
        _applyUserToUI(newSession.user);
      }
    });
  }

  /* ── Apply user info to UI ──────────────────────────────── */
  function _applyUserToUI(user) {
    if (!user) return;
    const name     = user.user_metadata?.full_name || user.email?.split('@')[0] || 'User';
    const email    = user.email || '';
    const avatar   = user.user_metadata?.avatar_url || '';
    const initials = name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
    const avatarHTML = avatar
      ? `<img src="${avatar}" style="width:100%;height:100%;border-radius:50%;object-fit:cover;" onerror="this.parentElement.textContent='${initials}'">`
      : initials;
    document.querySelectorAll('.profile-name').forEach(el => el.textContent = name);
    document.querySelectorAll('.avatar').forEach(el => el.innerHTML = avatarHTML);
    const pdName   = document.querySelector('.pd-name');
    const pdHandle = document.querySelector('.pd-handle');
    const pdAvatar = document.querySelector('.pd-avatar');
    if (pdName)   pdName.textContent   = name;
    if (pdHandle) pdHandle.textContent = email;
    if (pdAvatar) pdAvatar.innerHTML   = avatarHTML;
  }

  /* ── Inject auth token into API calls ───────────────────── */
  const _origFetch = window.fetch.bind(window);
  window.fetch = function(input, opts) {
    try {
      const url = typeof input === 'string' ? input : input?.url || '';
      const isBackend = url.includes('chunks-ai-main-production') || url.includes('chemistry-app-production');
      if (_authToken && isBackend) {
        opts = opts ? { ...opts } : {};
        opts.headers = { ...(opts.headers || {}), 'Authorization': `Bearer ${_authToken}` };
      }
    } catch(e) {}
    return _origFetch(input, opts);
  };

  /* ── Sign out ───────────────────────────────────────────── */
  window._authSignOut = async function() {
    sessionStorage.removeItem('chunks_guest_mode');
    const btn = document.getElementById('confirm-ok-btn');
    if (btn) { btn.textContent = 'Logging out…'; btn.disabled = true; }
    try {
      await Promise.race([
        _sb.auth.signOut(),
        new Promise(r => setTimeout(r, 2000))
      ]);
    } catch(e) {}
    window.location.replace('login.html');
  };

  /* ── Inject confirm modal HTML + CSS if not already there ── */
  if (!document.getElementById('shared-confirm-modal')) {
    const style = document.createElement('style');
    style.textContent = `
      .shared-confirm-modal {
        display: none; position: fixed; inset: 0; z-index: 10010;
        align-items: center; justify-content: center; padding: 24px;
        background: rgba(0,0,0,0.72); backdrop-filter: blur(8px);
      }
      .shared-confirm-modal.active { display: flex; }
      .shared-confirm-box {
        background: #2a2a2a; border: none; border-radius: 24px;
        padding: 40px 32px 28px; width: 100%; max-width: 400px;
        box-shadow: 0 40px 100px rgba(0,0,0,0.85); text-align: center;
      }
      .shared-confirm-title {
        font-size: 22px; font-weight: 800; color: #fff;
        margin-bottom: 12px; line-height: 1.25; letter-spacing: -0.3px;
      }
      .shared-confirm-desc {
        font-size: 14px; color: #999; line-height: 1.6; margin-bottom: 32px;
      }
      .shared-confirm-actions { display: flex; flex-direction: column; gap: 10px; }
      .shared-confirm-ok {
        width: 100%; padding: 16px 20px; border-radius: 999px; border: none;
        background: #f4f4f4; color: #0d0d0d; font-size: 15px; font-weight: 600;
        cursor: pointer; box-shadow: 0 2px 12px rgba(0,0,0,0.3);
        transition: background 0.15s, transform 0.1s;
      }
      .shared-confirm-ok:hover { background: #fff; transform: translateY(-1px); }
      .shared-confirm-ok:active { transform: translateY(0); }
      .shared-confirm-ok:disabled { opacity: 0.6; cursor: not-allowed; transform: none; }
      .shared-confirm-cancel {
        width: 100%; padding: 16px 20px; border-radius: 999px; border: none;
        background: #3a3a3a; color: #eee; font-size: 15px; font-weight: 500;
        cursor: pointer; transition: background 0.15s, transform 0.1s;
      }
      .shared-confirm-cancel:hover { background: #454545; transform: translateY(-1px); }
      .shared-confirm-cancel:active { transform: translateY(0); }
    `;
    document.head.appendChild(style);

    const modal = document.createElement('div');
    modal.id = 'shared-confirm-modal';
    modal.className = 'shared-confirm-modal';
    modal.innerHTML = `
      <div class="shared-confirm-box" onclick="event.stopPropagation()">
        <div class="shared-confirm-title" id="shared-confirm-title">Are you sure?</div>
        <div class="shared-confirm-desc" id="shared-confirm-desc"></div>
        <div class="shared-confirm-actions">
          <button class="shared-confirm-ok" id="confirm-ok-btn">Confirm</button>
          <button class="shared-confirm-cancel" onclick="window._closeSharedConfirm()">Cancel</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
    modal.addEventListener('click', e => { if (e.target === modal) window._closeSharedConfirm(); });
  }

  let _sharedConfirmCb = null;

  window._showSharedConfirm = function({ title, desc, confirmLabel, onConfirm }) {
    document.getElementById('shared-confirm-title').textContent = title || 'Are you sure?';
    document.getElementById('shared-confirm-desc').textContent  = desc  || '';
    const btn = document.getElementById('confirm-ok-btn');
    btn.textContent = confirmLabel || 'Confirm';
    btn.disabled = false;
    _sharedConfirmCb = onConfirm;
    document.getElementById('shared-confirm-modal').classList.add('active');
  };

  window._closeSharedConfirm = function() {
    document.getElementById('shared-confirm-modal').classList.remove('active');
    _sharedConfirmCb = null;
  };

  document.getElementById('confirm-ok-btn').addEventListener('click', async e => {
    e.stopPropagation();
    const cb = _sharedConfirmCb;
    window._closeSharedConfirm();
    if (cb) await cb();
  });

  /* ── Override pdAction logout on pages that have it ─────── */
  const _origPdAction = window.pdAction;
  window.pdAction = async function(action) {
    if (action === 'logout') {
      const email = document.querySelector('.pd-handle')?.textContent?.trim() || '';
      window._showSharedConfirm({
        title: 'Are you sure you want to log out?',
        desc: email ? `Log out of Chunks AI as ${email}?` : 'Log out of Chunks AI?',
        confirmLabel: 'Log out',
        onConfirm: window._authSignOut
      });
      return;
    }
    if (_origPdAction) return _origPdAction(action);
  };

  /* ── Run session check ──────────────────────────────────── */
  await _checkSession();

})();
