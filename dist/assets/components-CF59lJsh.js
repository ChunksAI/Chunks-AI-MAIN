import{d as ie,s as se,l as oe}from"./state-DPlFcyCg.js";let O=null;function F(e,t,i){const s=document.getElementById("ws-toast");s&&(s.innerHTML=`<span style="font-size:14px;">${e}</span><span>${t}</span>`,s.style.borderColor=i||"",s.classList.add("show"),clearTimeout(O),O=setTimeout(()=>{s.classList.remove("show"),s.style.borderColor=""},2500))}window._showToast=F;window.wsShowToast=F;const ne=e=>`
  <ellipse cx="50" cy="50" rx="36" ry="12" fill="none" stroke="#e8ac2e" stroke-width="6" opacity="0.95"/>
  <ellipse cx="50" cy="50" rx="36" ry="12" fill="none" stroke="#8b7cf8" stroke-width="6" transform="rotate(60 50 50)" opacity="0.88"/>
  <ellipse cx="50" cy="50" rx="36" ry="12" fill="none" stroke="#e8ac2e" stroke-width="6" transform="rotate(120 50 50)" opacity="0.80"/>
  <circle cx="50" cy="50" r="6" fill="#e8ac2e"/>`,R=`<svg width="16" height="16" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect x="1.5" y="1.5" width="17" height="17" rx="3.5" stroke="currentColor" stroke-width="1.6"/>
  <path d="M7 1.5V18.5" stroke="currentColor" stroke-width="1.6"/>
</svg>`,ae='<svg class="profile-dots" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color:var(--text-3);margin-left:auto;flex-shrink:0;"><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/></svg>',le=[{id:"home",label:"Home",action:"goHome",svg:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>',extra:""},{id:"workspace",label:"Workspace",action:"showScreen",screen:"workspace",svg:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/></svg>'},{id:"library",label:"Library",action:"showScreen",screen:"library",svg:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/></svg>'},{id:"flash",label:"Flashcards",action:"showScreen",screen:"flash",svg:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8m-4-4v4"/></svg>'},{id:"studyplan",label:"Study Plan",action:"showScreen",screen:"studyplan",svg:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>'},{id:"visual",label:"Visual Tutor",action:"showScreen",screen:"visual",svg:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><rect x="2" y="3" width="20" height="14" rx="2"/><circle cx="12" cy="10" r="3"/><path d="M8 21h8m-4-4v4"/></svg>'},{id:"research",label:"Research",action:"showScreen",screen:"research",svg:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 12h6m-3-3v6"/><path d="M3 7V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v2"/><path d="M21 7H3l1.5 11A2 2 0 0 0 6.48 20h11.04a2 2 0 0 0 1.98-2L21 7z"/></svg>'},{id:"exam",label:"Exam",action:"showScreen",screen:"exam",svg:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>'}],U={home:{general:"recent-list-general",workspace:"recent-list-home",visual:"recent-list-vt-home",exam:"recent-list-exam-home"},workspace:{general:"recent-list-general-ws",workspace:"recent-list-workspace",visual:"recent-list-vt-ws",exam:"recent-list-exam-ws"},library:{general:"recent-list-general-lib",workspace:"recent-list-ws-lib",visual:"recent-list-vt-lib",exam:"recent-list-exam-lib"},flash:{general:"recent-list-general-flash",workspace:"recent-list-flash",visual:"recent-list-vt-flash",exam:"recent-list-exam-flash"},research:{general:"recent-list-general-research",workspace:"recent-list-ws-research",visual:"recent-list-vt-research",exam:"recent-list-exam-research"},exam:{general:"recent-list-general-exam",workspace:"recent-list-ws-exam",visual:"recent-list-vt-exam",exam:"recent-list-exam-exam"},studyplan:{general:"recent-list-general-studyplan",workspace:"recent-list-ws-studyplan",visual:"recent-list-vt-studyplan",exam:"recent-list-exam-studyplan"},visual:{general:"recent-list-general-visual",workspace:"recent-list-ws-visual",visual:"recent-list-vt-visual",exam:"recent-list-exam-visual"}};function G(e){const t=U[e]||U.home,i=le.map(o=>{const d=o.id===e||o.id==="home"&&e==="home",r=d?" active":"",l=d?' aria-current="page"':"",c=o.action==="goHome"?'data-action="goHome"':o.action==="openLibraryModal"?'data-action="openLibraryModal"':`data-action="showScreen" data-screen="${o.screen}"`,g=o.onclick||"",p=o.action==="goHome"?`onkeydown="if(event.key==='Enter'||event.key===' ')goHome()"`:o.action==="openLibraryModal"?`onkeydown="if(event.key==='Enter'||event.key===' ')openLibraryModal()"`:`onkeydown="if(event.key==='Enter'||event.key===' ')showScreen('${o.screen}')"`,u=o.id==="home"&&e==="home"?' id="sidebar-home-btn"':"";return`      <div class="sidebar-item${r}"${u} role="button" tabindex="0" aria-label="${o.label}"${l} ${c} ${g} ${p} style="cursor:pointer;">
        ${o.svg}
        <span>${o.label}</span>
      </div>`}).join(`
`),s=`sp-recent-plans-section-${e}`,a=`sp-recent-plans-list-${e}`,n=`
      <div class="sidebar-section sidebar-history-section sp-recent-plans-outer" id="${s}" style="display:none;">
        <div class="sidebar-section-label sidebar-section-toggle" data-action="toggleRecentPlans-self" data-section="${s}">
          Recent Plans
          <svg class="hist-chevron" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="m9 18 6-6-6-6"/></svg>
        </div>
        <div id="${a}" class="sp-recent-plans-list hist-list"></div>
      </div>`;return`
    <div class="sidebar-header">
      <div class="logo-link" data-action="handleLogoClick-self" title="Go to home / expand">
        <svg class="logo-mark" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">${ne()}
        </svg>
        <span class="logo-text">Chunks</span>
        <div class="sidebar-expand-btn" title="Expand sidebar">${R}</div>
      </div>
      <button class="sidebar-collapse-btn" data-action="toggleSidebar-self" title="Collapse sidebar">
        ${R}
      </button>
    </div>

    <button class="sidebar-new-btn" data-action="newChat" aria-label="New Chat">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" aria-hidden="true"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
      <span>New Chat</span>
    </button>

    <nav aria-label="Main navigation">
    <div class="sidebar-section">
      <div class="sidebar-section-label">Study</div>
${i}
    </div>
    </nav>

    <div class="sidebar-divider"></div>

    <div class="sidebar-history-header">
      <span class="sidebar-history-label">Recents</span>
      <button class="sidebar-search-btn" data-action="openChatSearch-self" title="Search chats" aria-label="Search chats">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
      </button>
    </div>

    <div class="sidebar-history-scroll" id="sidebar-history-scroll">
      <div class="sidebar-section sidebar-history-section" id="hist-section-general">
        <div class="sidebar-section-label sidebar-section-toggle" data-action="toggleHistorySection-self" data-section="hist-section-general">
          General AI
          <svg class="hist-chevron" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="m9 18 6-6-6-6"/></svg>
        </div>
        <div id="${t.general}" class="recent-list hist-list"></div>
      </div>
      <div class="sidebar-section sidebar-history-section" id="hist-section-workspace">
        <div class="sidebar-section-label sidebar-section-toggle" data-action="toggleHistorySection-self" data-section="hist-section-workspace">
          Workspace
          <svg class="hist-chevron" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="m9 18 6-6-6-6"/></svg>
        </div>
        <div id="${t.workspace}" class="recent-list hist-list"></div>
      </div>
      <div class="sidebar-section sidebar-history-section" id="hist-section-visual">
        <div class="sidebar-section-label sidebar-section-toggle" data-action="toggleHistorySection-self" data-section="hist-section-visual">
          Visual Tutor Chats
          <svg class="hist-chevron" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="m9 18 6-6-6-6"/></svg>
        </div>
        <div id="${t.visual}" class="recent-list hist-list"></div>
      </div>
      <div class="sidebar-section sidebar-history-section" id="hist-section-exam">
        <div class="sidebar-section-label sidebar-section-toggle" data-action="toggleHistorySection-self" data-section="hist-section-exam">
          Exam Chats
          <svg class="hist-chevron" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="m9 18 6-6-6-6"/></svg>
        </div>
        <div id="${t.exam}" class="recent-list hist-list"></div>
      </div>
      ${n}
    </div>

    <div class="sidebar-footer">

      <!-- Guest upsell card (visible for guests, hidden for logged-in users) -->
      <div class="guest-upsell-card" id="guest-upsell-card">
        <!-- Compact mode: icon-only button -->
        <button class="guest-icon-btn" onclick="window.openAuthModal?.()" title="Sign in to your account" aria-label="Sign in">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <circle cx="12" cy="8" r="4"/>
            <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>
          </svg>
        </button>
        <!-- Expanded mode: full upsell card -->
        <div class="guest-upsell-title">Get responses tailored to you</div>
        <div class="guest-upsell-desc">Log in to get answers based on saved chats, plus create images and upload files.</div>
        <div class="guest-auth-btns">
          <button class="guest-login-btn" onclick="window.openAuthModal?.()">Log in</button>
          <button class="guest-signup-btn" onclick="window.openAuthModal?.()">Sign up for free</button>
        </div>
      </div>

      <!-- Logged-in profile row (shown for authenticated users) -->
      <div class="profile-row" role="button" tabindex="0" aria-label="Open profile menu" aria-haspopup="true" onclick="toggleProfileDropdown(event)" onkeydown="if(event.key==='Enter'||event.key===' ')toggleProfileDropdown(event)">
        <div class="avatar" aria-hidden="true"></div>
        <div class="profile-text">
          <div class="profile-name"></div>
          <div class="profile-plan"></div>
        </div>
        ${ae}
      </div>
    </div>`}let w=function(){try{return localStorage.getItem("sp_active_plan_id")||null}catch{return null}}();function de(e){w=e||null;try{w?localStorage.setItem("sp_active_plan_id",w):localStorage.removeItem("sp_active_plan_id")}catch{}document.querySelectorAll(".sp-plan-sidebar-item").forEach(t=>{t.classList.toggle("active",!!w&&t.dataset.planId===w)})}window.setActivePlan=de;function M(){if(document.querySelectorAll("aside.sidebar[data-sidebar-screen]").forEach(t=>{const i=t.dataset.sidebarScreen||"home";t.innerHTML=G(i)}),!(()=>{try{return sessionStorage.getItem("chunks_hist_initialized")==="1"}catch{return!1}})()){["hist-section-general","hist-section-workspace","hist-section-visual","hist-section-exam"].forEach(t=>{try{sessionStorage.removeItem("hist_collapsed_"+t)}catch{}});try{sessionStorage.setItem("chunks_hist_initialized","1")}catch{}}["hist-section-general","hist-section-workspace","hist-section-visual","hist-section-exam"].forEach(t=>{try{sessionStorage.getItem("hist_collapsed_"+t)==="1"&&document.querySelectorAll("#"+t).forEach(s=>s.classList.add("collapsed"))}catch{}}),document.querySelectorAll(".sp-recent-plans-outer").forEach(t=>{try{const i="sp_plans_collapsed_"+t.id;sessionStorage.getItem(i)==="1"&&t.classList.add("collapsed")}catch{}}),S()}function S(){let e=[];try{e=JSON.parse(localStorage.getItem("sp_recent_plans")||"[]")}catch{}let t={};try{t=JSON.parse(localStorage.getItem("sp_all_plans")||"{}")}catch{}document.querySelectorAll(".sp-recent-plans-outer").forEach(i=>{const s=i.querySelector(".sp-recent-plans-list");if(!s)return;if(i.style.display="",!e||e.length===0){s.innerHTML='<div class="recent-empty" style="padding:4px 16px 6px;font-size:11px;color:var(--text-4);">No plans yet</div>';return}const n=(()=>{try{return localStorage.getItem("sp_active_plan_id")||null}catch{return null}})()||w;s.innerHTML=e.map(o=>{const d=Object.entries(t).find(([,g])=>g.topic===o),r=d?d[0]:"",l=o.replace(/"/g,"&quot;").replace(/'/g,"&#39;");return`
        <div class="sidebar-item sp-plan-sidebar-item${n&&r&&r===n?" active":""}" role="button" tabindex="0"
             aria-label="${l}"
             data-action="spNavigateToPlan-self"
             data-plan-id="${r}"
             data-plan-topic="${l}"
             title="${l}">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" style="flex-shrink:0;opacity:0.55;"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
          <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1;font-size:12px;">${o}</span>
          <span class="sp-plan-menu-btn recent-menu-btn"
                data-action="spPlanCtxMenu-self"
                data-plan-id="${r}"
                data-plan-topic="${l}"
                title="More options">···</span>
        </div>`}).join("")})}document.readyState==="loading"?document.addEventListener("DOMContentLoaded",()=>{M(),window._renderAllRecent?.(),S(),T()}):(M(),window._renderAllRecent?.(),S(),T());function T(){const e=document.documentElement.getAttribute("data-theme")==="study";document.querySelectorAll("#theme-toggle-btn").forEach(t=>{typeof window._updateThemeBtn=="function"?window._updateThemeBtn(t,e):t.innerHTML=e?'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="4"/><line x1="12" y1="2" x2="12" y2="4"/><line x1="12" y1="20" x2="12" y2="22"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="2" y1="12" x2="4" y2="12"/><line x1="20" y1="12" x2="22" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg> Switch to Dark':'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg> Study Mode'})}window._syncThemeToggleBtns=T;setTimeout(()=>{document.querySelectorAll("aside.sidebar[data-sidebar-screen]:empty").length&&(M(),window._renderAllRecent?.(),S())},0);window.buildSidebar=G;window.mountSidebars=M;window._renderRecentPlansAllSidebars=S;function W(){if(document.getElementById("confirm-modal"))return;const e=document.createElement("div");if(e.id="confirm-modal",e.setAttribute("role","dialog"),e.setAttribute("aria-modal","true"),e.innerHTML=`
    <div class="confirm-box">
      <p class="confirm-title" id="confirm-title"></p>
      <p class="confirm-desc"  id="confirm-desc"></p>
      <div class="confirm-actions">
        <button class="confirm-cancel-btn" id="confirm-cancel-btn">Cancel</button>
        <button class="confirm-ok-btn"     id="confirm-ok-btn">Confirm</button>
      </div>
    </div>
  `,document.body.appendChild(e),e.addEventListener("click",t=>{t.target===e&&f()}),!document.getElementById("simple-notif")){const t=document.createElement("div");t.id="simple-notif",document.body.appendChild(t)}}let H=null;function J(e={}){W();const t=document.getElementById("confirm-modal"),i=document.getElementById("confirm-title"),s=document.getElementById("confirm-desc"),a=document.getElementById("confirm-ok-btn"),n=document.getElementById("confirm-cancel-btn");if(!t)return;i.textContent=e.title||"Are you sure?",s.textContent=e.desc||"",a.textContent=e.confirmLabel||"Confirm",H=typeof e.onConfirm=="function"?e.onConfirm:null;const o=a.cloneNode(!0),d=n.cloneNode(!0);a.replaceWith(o),n.replaceWith(d),o.textContent=e.confirmLabel||"Confirm",o.addEventListener("click",()=>{const l=H;f(),typeof l=="function"&&l()}),d.addEventListener("click",f),t.classList.add("active"),d.focus();const r=l=>{t.classList.contains("active")&&(l.key==="ArrowRight"||l.key==="ArrowDown"?(l.preventDefault(),o.focus()):l.key==="ArrowLeft"||l.key==="ArrowUp"?(l.preventDefault(),d.focus()):l.key)};t.addEventListener("keydown",r),o._arrowCleanup=d._arrowCleanup=()=>t.removeEventListener("keydown",r)}function f(){const e=document.getElementById("confirm-modal");if(e){e.classList.remove("active");const t=document.getElementById("confirm-ok-btn");t?._arrowCleanup&&(t._arrowCleanup(),t._arrowCleanup=null)}H=null}let V=null;function re(e){W();const t=document.getElementById("simple-notif");t&&(t.textContent=e,t.classList.add("show"),clearTimeout(V),V=setTimeout(()=>t.classList.remove("show"),3e3))}document.addEventListener("keydown",e=>{e.key==="Escape"&&document.getElementById("confirm-modal")?.classList.contains("active")&&f()});window._showSharedConfirm=J;window._closeSharedConfirm=f;window.showConfirmModal=J;window.closeConfirmModal=f;window.showSimpleNotif=re;const ce=`
<div class="pd-submenu" id="pd-help-submenu">
  <div class="pd-menu">
    <div class="pd-item" onclick="pdAction('help-center')">
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><path d="M12 17h.01"/></svg>
      Help center
    </div>
    <div class="pd-item" onclick="pdAction('bug')">
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m8 2 1.88 1.88"/><path d="M14.12 3.88 16 2"/><path d="M9 7.13v-1a3.003 3.003 0 1 1 6 0v1"/><path d="M12 20c-3.3 0-6-2.7-6-6v-3a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v3c0 3.3-2.7 6-6 6"/><path d="M12 20v-9"/><path d="M6.53 9C4.6 8.8 3 7.1 3 5"/><path d="M6 13H2"/><path d="M3 21c0-2.1 1.7-3.9 4-4"/><path d="M20.97 5c0 2.1-1.6 3.8-3.5 4"/><path d="M22 13h-4"/><path d="M17 17c2.3.1 4 1.9 4 4"/></svg>
      Report a bug
    </div>
    <div class="pd-item" onclick="pdAction('shortcuts')">
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="6" width="20" height="12" rx="2"/><path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M8 14h8"/></svg>
      Keyboard shortcuts
    </div>
    <div class="pd-item" id="pd-terms-item">
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
      Terms &amp; policies
      <svg class="pd-arrow" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" style="margin-left:auto;" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg>
    </div>
  </div>
</div>`,ge=`
<div class="pd-submenu" id="pd-terms-submenu">
  <div class="pd-menu">
    <div class="pd-item" onclick="pdAction('terms')">
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
      Terms of Service
    </div>
    <div class="pd-item" onclick="pdAction('privacy')">
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
      Privacy Policy
    </div>
  </div>
</div>`,ve=`
<div class="profile-dropdown" id="profile-dropdown" role="menu" aria-label="Profile menu">
  <div class="pd-header" role="presentation">
    <div class="pd-avatar" aria-hidden="true"></div>
    <div>
      <div class="pd-name"></div>
      <div class="pd-handle"></div>
    </div>
  </div>
  <div class="pd-menu">
    <div class="pd-item upgrade" role="menuitem" tabindex="0" onclick="pdAction('upgrade')" onkeydown="if(event.key==='Enter'||event.key===' ')pdAction('upgrade')">
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
      Upgrade plan
    </div>
    <div class="pd-item" id="pd-admin-btn" role="menuitem" tabindex="0" onclick="pdAction('admin')" style="display:none;color:#ff6b6b;">
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
      Admin Panel
    </div>
    <div class="pd-divider" role="separator"></div>
    <div class="pd-item" role="menuitem" tabindex="0" onclick="pdAction('personalization')" onkeydown="if(event.key==='Enter'||event.key===' ')pdAction('personalization')">
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>
      Personalization
    </div>
    <div class="pd-item" role="menuitem" tabindex="0" onclick="pdAction('settings')" onkeydown="if(event.key==='Enter'||event.key===' ')pdAction('settings')">
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>
      Settings
    </div>
    <div class="pd-item" role="menuitem" tabindex="0" onclick="pdAction('incognito')" onkeydown="if(event.key==='Enter'||event.key===' ')pdAction('incognito')" id="pd-incognito-item">
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
      Incognito Chat
      <span class="pd-incognito-badge">Private</span>
    </div>
    <div class="pd-divider" role="separator"></div>
    <div class="pd-item" id="pd-help-item" role="menuitem" tabindex="0" aria-haspopup="true" onkeydown="if(event.key==='Enter'||event.key===' ')pdOpenHelp(event)">
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><path d="M12 17h.01"/></svg>
      Help
      <svg class="pd-arrow" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg>
    </div>
    <div class="pd-item danger" role="menuitem" tabindex="0" onclick="pdAction('logout')" onkeydown="if(event.key==='Enter'||event.key===' ')pdAction('logout')">
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
      Log out
    </div>
  </div>
</div>`;function pe(){if(document.getElementById("profile-dropdown"))return;const e=document.createElement("div");e.innerHTML=ce,document.body.appendChild(e.firstElementChild),e.innerHTML=ge,document.body.appendChild(e.firstElementChild),e.innerHTML=ve,document.body.appendChild(e.firstElementChild),ye()}document.addEventListener("DOMContentLoaded",pe);let h=!1,C=!1,E=!1,P=null,x=null;function ue(e){e&&e.stopPropagation();const t=document.getElementById("profile-dropdown");if(t){if(h=!h,h||(y(),b()),t.classList.toggle("open",h),h){const i=sessionStorage.getItem("chunks_guest_mode")==="1"||!window._currentUser?.id,s=t.querySelector('[onclick*="logout"]');s&&(i?(s.innerHTML='<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/></svg>Sign in',s.classList.remove("danger"),s.setAttribute("onclick","pdAction('signin')"),s.setAttribute("onkeydown","if(event.key==='Enter'||event.key===' ')pdAction('signin')")):(s.innerHTML='<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>Log out',s.classList.add("danger"),s.setAttribute("onclick","pdAction('logout')"),s.setAttribute("onkeydown","if(event.key==='Enter'||event.key===' ')pdAction('logout')")))}if(h){const i=e?.currentTarget,a=i?.closest(".sidebar")?.classList.contains("compact");if(i){const n=i.getBoundingClientRect(),o=320,d=n.top,r=window.innerHeight-n.bottom;d>o||d>r?(t.style.bottom=window.innerHeight-n.top+6+"px",t.style.top="auto"):(t.style.top=n.bottom+6+"px",t.style.bottom="auto"),t.style.left=a?"58px":Math.max(8,n.left)+"px",n.left+230>window.innerWidth-8?(t.style.left="auto",t.style.right=window.innerWidth-n.right+"px"):t.style.right="auto"}else t.style.left=a?"58px":"10px",t.style.bottom="60px",t.style.top="auto"}}}function y(){C=!1,document.getElementById("pd-help-submenu")?.classList.remove("open"),document.getElementById("pd-help-item")?.classList.remove("active")}function Y(){C=!0;const e=document.getElementById("pd-help-submenu"),t=document.getElementById("pd-help-item");if(!e||!t)return;e.classList.add("open"),t.classList.add("active");const i=document.getElementById("profile-dropdown").getBoundingClientRect(),s=t.getBoundingClientRect();e.style.position="fixed",e.style.left=i.right+2+"px",e.style.paddingLeft="",e.style.bottom=window.innerHeight-s.bottom+"px",e.style.top="auto",e.style.right="auto"}function K(e){e&&e.stopPropagation(),clearTimeout(P),b(),Y()}function he(e){e&&e.stopPropagation(),C?y():Y()}function b(){E=!1,clearTimeout(x),document.getElementById("pd-terms-submenu")?.classList.remove("open"),document.getElementById("pd-terms-item")?.classList.remove("active")}function Z(){E=!0;const e=document.getElementById("pd-terms-item"),t=document.getElementById("pd-terms-submenu");if(!e||!t)return;const i=e.getBoundingClientRect();t.style.bottom=window.innerHeight-i.bottom+"px",t.style.top="auto",t.style.left=i.right+2+"px",t.style.paddingLeft="",t.classList.add("open"),e.classList.add("active")}function me(e){e&&e.stopPropagation(),clearTimeout(x),Z()}document.addEventListener("click",function(e){const t=document.getElementById("profile-dropdown"),i=document.getElementById("pd-help-submenu"),s=document.getElementById("pd-terms-submenu");t&&(C&&!i?.contains(e.target)&&!t.contains(e.target)&&!s?.contains(e.target)&&y(),E&&!s?.contains(e.target)&&!i?.contains(e.target)&&!t.contains(e.target)&&b(),h&&!t.contains(e.target)&&!i?.contains(e.target)&&!s?.contains(e.target)&&(h=!1,y(),b(),t.classList.remove("open")))});document.addEventListener("keydown",function(e){if(e.key==="Escape"){if(document.getElementById("confirm-modal")?.classList.contains("active"))return;if(C){y();return}if(E){b();return}h&&(h=!1,document.getElementById("profile-dropdown")?.classList.remove("open"))}});async function be(e){switch(h=!1,y(),b(),document.getElementById("profile-dropdown")?.classList.remove("open"),e){case"upgrade":window._currentUser?window.openUpgradeModal?.():window.openAuthModal?.();break;case"admin":window.open("/admin","_blank");break;case"personalization":window.openSettings?.("personalization");break;case"settings":window.openSettings?.("general");break;case"incognito":window.openIncognitoChat?.();break;case"help-center":window.openHelpCenter?.();break;case"terms":window.open("terms.html","_blank");break;case"privacy":window.open("privacy.html","_blank");break;case"bug":window.openBugReport?.();break;case"shortcuts":window.openShortcuts?.();break;case"logout":{const t=document.querySelector(".pd-handle")?.textContent?.trim()||"";window.showConfirmModal?.({title:"Are you sure you want to log out?",desc:t?`Log out of Chunks AI as ${t}?`:"Log out of Chunks AI?",confirmLabel:"Log out",onConfirm:()=>window.chunksSignOut?.()});break}case"signin":sessionStorage.removeItem("chunks_guest_mode"),window.location.replace("/login");break;default:console.warn("[pdAction] Unknown action:",e)}}function ye(){const e=document.getElementById("pd-help-item"),t=document.getElementById("pd-terms-item"),i=document.getElementById("pd-help-submenu"),s=document.getElementById("pd-terms-submenu"),a=document.getElementById("profile-dropdown");e&&e.addEventListener("mouseenter",n=>K(n)),t&&t.addEventListener("mouseenter",n=>{clearTimeout(x),Z()}),a&&a.querySelectorAll(".pd-item").forEach(n=>{n.id!=="pd-help-item"&&n.addEventListener("mouseenter",()=>{y(),b()})}),i&&i.querySelectorAll(".pd-item").forEach(n=>{n.id!=="pd-terms-item"&&n.addEventListener("mouseenter",()=>{b()})}),i&&(i.addEventListener("mouseleave",()=>{P=setTimeout(()=>{E||y()},120)}),i.addEventListener("mouseenter",()=>{clearTimeout(P)})),s&&(s.addEventListener("mouseleave",()=>{x=setTimeout(b,120)}),s.addEventListener("mouseenter",()=>{clearTimeout(x)}))}window.toggleProfileDropdown=ue;window.pdAction=be;window.pdOpenHelp=K;window.pdToggleHelp=he;window.pdOpenTerms=me;window._closeHelp=y;window._closeTerms=b;window.openUpgradeModal=function(){document.getElementById("upgrade-modal")?.classList.add("active"),window.innerWidth<=600&&requestAnimationFrame(()=>{document.querySelector(".upgrade-plan.featured")?.scrollIntoView({behavior:"smooth",block:"nearest",inline:"center"})})};window.closeUpgradeModal=function(){document.getElementById("upgrade-modal")?.classList.remove("active")};window.handleUpgradeClick=function(t){window.closeUpgradeModal(),console.log("[upgrade] plan selected:",t),typeof wsShowToast=="function"&&wsShowToast("⭐",`${t==="ultra"?"Ultra":"Pro"} — payment coming soon!`,"var(--gold-border)")};const we=`
<div class="library-modal" id="library-modal" role="dialog" aria-modal="true" aria-labelledby="library-modal-title">
  <div class="library-modal-content">

    <!-- Header -->
    <div class="library-modal-header">
      <div class="lib-top-row">
        <div class="lib-title-group">
          <div class="lib-title-icon">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                 stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/>
            </svg>
          </div>
          <div>
            <span class="lib-title-text" id="library-modal-title">Textbook Library</span>
            <span class="lib-title-count" id="lib-total-count">· 20 books</span>
          </div>
        </div>
        <button class="library-modal-close" data-action="closeLibraryModal" aria-label="Close library">✕</button>
      </div>

      <!-- Search -->
      <div class="lib-search-row">
        <div class="lib-search-wrap">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
               stroke-width="2" stroke-linecap="round">
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>
          </svg>
          <input class="lib-search-input" type="text"
                 placeholder="Search textbooks, authors…"
                 oninput="filterLibrary(this.value)">
        </div>
      </div>

      <!-- Category pills -->
      <div class="lib-pills">
        <button class="lib-pill active" onclick="filterLibSection('all',this)">
          <span class="lib-pill-dot" style="background:#8b7cf8"></span>All Courses
        </button>
        <button class="lib-pill" onclick="filterLibSection('chemistry',this)">
          <span class="lib-pill-dot" style="background:#22d3ee"></span>Chemistry
        </button>
        <button class="lib-pill" onclick="filterLibSection('biology',this)">
          <span class="lib-pill-dot" style="background:#4ade80"></span>Biology
        </button>
        <button class="lib-pill" onclick="filterLibSection('nursing',this)">
          <span class="lib-pill-dot" style="background:#f472b6"></span>Nursing
        </button>
        <button class="lib-pill" onclick="filterLibSection('physics',this)">
          <span class="lib-pill-dot" style="background:#fb923c"></span>Physics
        </button>
        <button class="lib-pill" onclick="filterLibSection('psychology',this)">
          <span class="lib-pill-dot" style="background:#8b5cf6"></span>Psychology
        </button>
      </div>
    </div><!-- /header -->

    <!-- Body -->
    <div class="library-modal-body">

      <!-- ── MY DOCUMENTS ──────────────────────────────────── -->
      <div class="lib-section lib-section--my-docs" data-section="my-docs" id="lib-modal-my-docs-section"
           ondragover="libModalDragOver(event)" ondrop="libModalDrop(event)" ondragleave="libModalDragLeave(event)">

        <div class="lib-section-header">
          <div class="lib-section-icon" style="background:rgba(139,124,248,.1);color:#8b7cf8">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                 stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
            </svg>
          </div>
          <span class="lib-section-name">My Documents</span>
          <span class="lib-section-count" id="lib-modal-my-docs-count">0 files</span>
          <div class="lib-section-line"></div>
          <button class="lib-upload-btn" id="lib-modal-upload-btn" onclick="libModalTriggerUpload()">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                 stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="17 8 12 3 7 8"/>
              <line x1="12" y1="3" x2="12" y2="15"/>
            </svg>
            <span id="lib-modal-upload-btn-label">Upload</span>
          </button>
        </div>

        <!-- Progress bar -->
        <div class="lib-upload-progress" id="lib-modal-upload-progress" style="margin-bottom:0;border-radius:var(--r-pill);overflow:hidden;height:3px;background:var(--surface-4);display:none;">
          <div class="lib-upload-progress-bar" id="lib-modal-upload-progress-bar"></div>
        </div>

        <!-- Drop zone -->
        <div class="lib-drop-zone" id="lib-modal-drop-zone">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
          Drop PDF or PowerPoint here
        </div>

        <!-- Row list -->
        <div class="lib-docs-list" id="lib-modal-my-docs-list"></div>

        <!-- Empty state -->
        <div class="lib-docs-empty" id="lib-modal-docs-empty">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor"
               stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round" style="opacity:0.25;color:var(--violet)">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <polyline points="14 2 14 8 20 8"/>
          </svg>
          <span>Upload a PDF or PowerPoint to study it with AI</span>
        </div>

      </div><!-- /my-docs -->

      <!-- ── CHEMISTRY ─────────────────────────────────────── -->
      <div class="lib-section" data-section="chemistry">
        <div class="lib-section-header">
          <div class="lib-section-icon" style="background:rgba(34,211,238,.1);color:#22d3ee">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 3h6l1 9H8z"/><path d="M8 12a5 5 0 0 0 8 0"/><path d="M6.7 19.8A2 2 0 0 0 8 21h8a2 2 0 0 0 1.3-3.5L14 12H10z"/></svg>
          </div>
          <span class="lib-section-name">Chemistry</span>
          <span class="lib-section-count">4 books</span>
          <div class="lib-section-line"></div>
        </div>
        <div class="library-grid">

          <div class="library-book-card" onclick="selectBook('zumdahl')">
            <div class="library-book-icon"><img src="/covers/zumdahl.jpg" alt="General Chemistry cover" onerror="this.parentElement.innerHTML='📗'"></div>
            <div class="lib-book-info">
              <div class="library-book-title">General Chemistry</div>
              <div class="library-book-author">Zumdahl &amp; Zumdahl</div>
              <div class="library-book-edition">9th Edition</div>
              <div class="library-book-meta"><span class="library-book-badge lib-badge-avail">✓ Available</span><span class="library-book-badge">Chemistry</span></div>
            </div>
          </div>

          <div class="library-book-card" onclick="selectBook('atkins')">
            <div class="library-book-icon"><img src="/covers/atkins.jpg" alt="Physical Chemistry cover" onerror="this.parentElement.innerHTML='📘'"></div>
            <div class="lib-book-info">
              <div class="library-book-title">Physical Chemistry</div>
              <div class="library-book-author">Atkins &amp; de Paula</div>
              <div class="library-book-edition">8th Edition</div>
              <div class="library-book-meta"><span class="library-book-badge lib-badge-avail">✓ Available</span><span class="library-book-badge">Physical Chem</span></div>
            </div>
          </div>

          <div class="library-book-card" onclick="selectBook('klein')">
            <div class="library-book-icon"><img src="/covers/klein.jpg" alt="Organic Chemistry cover" onerror="this.parentElement.innerHTML='📙'"></div>
            <div class="lib-book-info">
              <div class="library-book-title">Organic Chemistry</div>
              <div class="library-book-author">David Klein</div>
              <div class="library-book-edition">4th Edition</div>
              <div class="library-book-meta"><span class="library-book-badge lib-badge-avail">✓ Available</span><span class="library-book-badge">Organic</span></div>
            </div>
          </div>

          <div class="library-book-card" onclick="selectBook('harris')">
            <div class="library-book-icon"><img src="/covers/harris.jpg" alt="Quantitative Chemical Analysis cover" onerror="this.parentElement.innerHTML='📒'"></div>
            <div class="lib-book-info">
              <div class="library-book-title">Quantitative Chemical Analysis</div>
              <div class="library-book-author">Daniel C. Harris</div>
              <div class="library-book-edition">10th Edition</div>
              <div class="library-book-meta"><span class="library-book-badge lib-badge-avail">✓ Available</span><span class="library-book-badge">Analytical</span></div>
            </div>
          </div>

        </div>
      </div>

      <!-- ── BIOLOGY ────────────────────────────────────────── -->
      <div class="lib-section" data-section="biology">
        <div class="lib-section-header">
          <div class="lib-section-icon" style="background:rgba(74,222,128,.1);color:#4ade80">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 15c6.667-6 13.333 0 20-6"/><path d="M9 22c1.798-1.998 2.518-3.995 2.807-5.993"/><path d="M15 2c-1.798 1.998-2.518 3.995-2.807 5.993"/><path d="m17 6-2.5-2.5"/><path d="m14 8-1-1"/><path d="m7 18 2.5 2.5"/><path d="m10 16 1 1"/><path d="M2 9c6.667 6 13.333 0 20 6"/></svg>
          </div>
          <span class="lib-section-name">Biology</span>
          <span class="lib-section-count">3 books</span>
          <div class="lib-section-line"></div>
        </div>
        <div class="library-grid">

          <div class="library-book-card" onclick="selectBook('anaphy2e')">
            <div class="library-book-icon"><img src="/covers/anaphy2e.jpg" alt="Anatomy &amp; Physiology cover" onerror="this.parentElement.innerHTML='🧬'"></div>
            <div class="lib-book-info">
              <div class="library-book-title">Anatomy &amp; Physiology</div>
              <div class="library-book-author">Patton &amp; Thibodeau</div>
              <div class="library-book-edition">2nd Edition</div>
              <div class="library-book-meta"><span class="library-book-badge lib-badge-avail">✓ Available</span><span class="library-book-badge">Biology</span></div>
            </div>
          </div>

          <div class="library-book-card" onclick="selectBook('biology2e')">
            <div class="library-book-icon"><img src="/covers/biology2e.jpg" alt="Biology cover" onerror="this.parentElement.innerHTML='🌿'"></div>
            <div class="lib-book-info">
              <div class="library-book-title">Biology</div>
              <div class="library-book-author">OpenStax</div>
              <div class="library-book-edition">2nd Edition</div>
              <div class="library-book-meta"><span class="library-book-badge lib-badge-avail">✓ Available</span><span class="library-book-badge">Biology</span></div>
            </div>
          </div>

          <div class="library-book-card" onclick="selectBook('biochem')">
            <div class="library-book-icon"><img src="/covers/Biochem.jpg" alt="Biochemistry cover" onerror="this.parentElement.innerHTML='🔬'"></div>
            <div class="lib-book-info">
              <div class="library-book-title">Biochemistry</div>
              <div class="library-book-author">Berg, Tymoczko &amp; Stryer</div>
              <div class="library-book-edition">9th Edition</div>
              <div class="library-book-meta"><span class="library-book-badge lib-badge-avail">✓ Available</span><span class="library-book-badge">Biochem</span></div>
            </div>
          </div>

        </div>
      </div>

      <!-- ── NURSING ────────────────────────────────────────── -->
      <div class="lib-section" data-section="nursing">
        <div class="lib-section-header">
          <div class="lib-section-icon" style="background:rgba(244,114,182,.1);color:#f472b6">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 2a2 2 0 0 0-2 2v5H4a2 2 0 0 0-2 2v2a2 2 0 0 0 2 2h5v5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2v-5h5a2 2 0 0 0 2-2v-2a2 2 0 0 0-2-2h-5V4a2 2 0 0 0-2-2z"/></svg>
          </div>
          <span class="lib-section-name">Nursing</span>
          <span class="lib-section-count">2 books</span>
          <div class="lib-section-line"></div>
        </div>
        <div class="library-grid">

          <div class="library-book-card" onclick="selectBook('netter')">
            <div class="library-book-icon"><img src="/covers/netter.jpg" alt="Atlas of Human Anatomy cover" onerror="this.parentElement.innerHTML='🫀'"></div>
            <div class="lib-book-info">
              <div class="library-book-title">Atlas of Human Anatomy</div>
              <div class="library-book-author">Frank H. Netter</div>
              <div class="library-book-edition">7th Edition</div>
              <div class="library-book-meta"><span class="library-book-badge lib-badge-avail">✓ Available</span><span class="library-book-badge">Anatomy</span></div>
            </div>
          </div>

          <div class="library-book-card" onclick="selectBook('nursing-skills-2e')">
            <div class="library-book-icon"><img src="/covers/nursing-skills-2e.jpg" alt="Nursing Skills cover" onerror="this.parentElement.innerHTML='🩺'"></div>
            <div class="lib-book-info">
              <div class="library-book-title">Nursing Skills</div>
              <div class="library-book-author">OpenStax</div>
              <div class="library-book-edition">2nd Edition</div>
              <div class="library-book-meta"><span class="library-book-badge lib-badge-avail">✓ Available</span><span class="library-book-badge">Nursing</span></div>
            </div>
          </div>

        </div>
      </div>

      <!-- ── PHYSICS ────────────────────────────────────────── -->
      <div class="lib-section" data-section="physics">
        <div class="lib-section-header">
          <div class="lib-section-icon" style="background:rgba(251,146,60,.1);color:#fb923c">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="1"/><path d="M20.2 20.2c2.04-2.03.02-7.36-4.5-11.9-4.54-4.52-9.87-6.54-11.9-4.5-2.04 2.03-.02 7.36 4.5 11.9 4.54 4.52 9.87 6.54 11.9 4.5Z"/><path d="M15.7 15.7c4.52-4.54 6.54-9.87 4.5-11.9-2.03-2.04-7.36-.02-11.9 4.5-4.52 4.54-6.54 9.87-4.5 11.9 2.03 2.04 7.36.02 11.9-4.5Z"/></svg>
          </div>
          <span class="lib-section-name">Physics</span>
          <span class="lib-section-count">1 book</span>
          <div class="lib-section-line"></div>
        </div>
        <div class="library-grid">

          <div class="library-book-card" onclick="selectBook('physics2e')">
            <div class="library-book-icon"><img src="/covers/physics2e.jpg" alt="College Physics cover" onerror="this.parentElement.innerHTML='⚛️'"></div>
            <div class="lib-book-info">
              <div class="library-book-title">College Physics</div>
              <div class="library-book-author">OpenStax</div>
              <div class="library-book-edition">2nd Edition</div>
              <div class="library-book-meta"><span class="library-book-badge lib-badge-avail">✓ Available</span><span class="library-book-badge">Physics</span></div>
            </div>
          </div>

        </div>
      </div>

      <!-- ── PSYCHOLOGY ─────────────────────────────────────── -->
      <div class="lib-section" data-section="psychology">
        <div class="lib-section-header">
          <div class="lib-section-icon" style="background:rgba(139,92,246,.1);color:#8b5cf6">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a8 8 0 0 1 8 8c0 4.4-3.6 8-8 8a8 8 0 0 1 0-16z"/><path d="M12 18v4"/><path d="M8 22h8"/><path d="M9 10h.01"/><path d="M15 10h.01"/><path d="M9.5 14a3.5 3.5 0 0 0 5 0"/></svg>
          </div>
          <span class="lib-section-name">Psychology</span>
          <span class="lib-section-count">1 book</span>
          <div class="lib-section-line"></div>
        </div>
        <div class="library-grid">

          <div class="library-book-card" onclick="selectBook('psychology2e')">
            <div class="library-book-icon"><img src="/covers/psychology2e.jpg" alt="Psychology cover" onerror="this.parentElement.innerHTML='🧠'"></div>
            <div class="lib-book-info">
              <div class="library-book-title">Psychology</div>
              <div class="library-book-author">OpenStax</div>
              <div class="library-book-edition">2nd Edition</div>
              <div class="library-book-meta"><span class="library-book-badge lib-badge-avail">✓ Available</span><span class="library-book-badge">Psychology</span></div>
            </div>
          </div>

        </div>
      </div>

      <!-- Empty state (shown via JS when search yields nothing) -->
      <!-- Empty state (shown via JS when search yields nothing) -->
      <div class="lib-empty-state" id="lib-empty-state">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>
        </svg>
        <div class="lib-empty-title">No results found</div>
        <div class="lib-empty-desc">Try a different search term or category</div>
      </div>

    </div><!-- /modal-body -->
  </div><!-- /modal-content -->
</div><!-- /library-modal -->`;document.addEventListener("DOMContentLoaded",()=>{if(document.getElementById("library-modal"))return;const e=document.createElement("div");e.innerHTML=we,document.body.appendChild(e.firstElementChild)});let A=null;function fe(){const e=document.getElementById("library-modal");if(e){e.classList.add("active"),sessionStorage.setItem("chunks_library_open","1"),A=window.trapFocus?.(e)??null,D().catch(()=>{});try{const t=e.querySelectorAll(".library-book-card:not(.lib-coming-soon)").length,i=document.getElementById("lib-total-count");i&&(i.textContent=`· ${t} book${t!==1?"s":""}`),e.querySelectorAll(".lib-section[data-section]").forEach(s=>{if(s.dataset.section==="my-docs")return;const a=s.querySelector(".lib-section-count");if(!a)return;const n=s.querySelectorAll(".library-book-card:not(.lib-coming-soon)").length;a.textContent=`${n} book${n!==1?"s":""}`})}catch{}}}function $(){document.getElementById("library-modal")?.classList.remove("active"),sessionStorage.removeItem("chunks_library_open"),A&&(A(),A=null)}let m=null;function ke(){return m||(m=document.createElement("input"),m.type="file",m.accept=".pdf,.ppt,.pptx",m.style.display="none",m.addEventListener("change",e=>{const t=e.target.files?.[0];t&&Q(t),m.value=""}),document.body.appendChild(m),m)}window.libModalTriggerUpload=function(){ke().click()};window.libModalDragOver=function(e){e.preventDefault(),document.getElementById("lib-modal-my-docs-section")?.classList.add("lib-upload-drag");const t=document.getElementById("lib-modal-drop-zone");t&&(t.style.display="flex")};window.libModalDragLeave=function(e){const t=document.getElementById("lib-modal-my-docs-section");if(t&&!t.contains(e.relatedTarget)){t.classList.remove("lib-upload-drag");const i=document.getElementById("lib-modal-drop-zone");i&&(i.style.display="none")}};window.libModalDrop=function(e){e.preventDefault(),document.getElementById("lib-modal-my-docs-section")?.classList.remove("lib-upload-drag");const t=document.getElementById("lib-modal-drop-zone");t&&(t.style.display="none");const i=e.dataTransfer?.files?.[0];i&&Q(i)};window.libModalDeleteDoc=async function(e,t){e.stopPropagation(),confirm("Remove this document from your library?")&&(await ie(t),await D(),window.wsShowToast?.("✦","Document removed","var(--text-3)"))};async function Q(e){if(!/\.(pdf|pptx?|ppt)$/i.test(e.name)){window.wsShowToast?.("⚠","Only PDF and PowerPoint files are supported","var(--red)");return}const i=80*1024*1024;if(e.size>i){window.wsShowToast?.("⚠","File too large (max 80 MB)","var(--red)");return}const s=document.getElementById("lib-modal-upload-btn"),a=document.getElementById("lib-modal-upload-btn-label"),n=document.getElementById("lib-modal-upload-progress"),o=document.getElementById("lib-modal-upload-progress-bar");a&&(a.textContent="Reading…"),s&&(s.disabled=!0),n&&(n.style.display="block"),o&&(o.style.width="15%");try{let d="",r=0;if(/\.(pptx?|ppt)$/i.test(e.name)){o&&(o.style.width="35%");const p=new FormData;p.append("file",e);const v=await(await fetch(`${window._API_BASE||"https://api.chunks.online"}/upload-document`,{method:"POST",body:p})).json();if(!v.success)throw new Error(v.error||"Server extraction failed");d=JSON.stringify(v.slides||[]),r=v.total_slides||0,o&&(o.style.width="75%")}else{o&&(o.style.width="25%");const p=await e.arrayBuffer();o&&(o.style.width="40%");const v=await(await(window._loadPdfJs?.()||Promise.reject("PDF.js not loaded"))).getDocument({data:p}).promise;r=v.numPages;const _=[],N=Math.min(r,300);for(let k=1;k<=N;k++){o&&(o.style.width=40+Math.round(k/N*45)+"%");const q=(await(await v.getPage(k)).getTextContent()).items.map(te=>te.str).join(" ").trim();q&&_.push(`[Page ${k}]
${q}`)}d=_.join(`

`)}o&&(o.style.width="90%");const{data:c,error:g}=await se(e,d,r);if(g||!c)throw new Error(g||"Save failed");o&&(o.style.width="100%"),setTimeout(()=>{n&&(n.style.display="none"),o&&(o.style.width="0%"),a&&(a.textContent="Upload"),s&&(s.disabled=!1)},600),await D(),window.wsShowToast?.("✦",`"${e.name}" added to your library`,"var(--violet-border)"),typeof window.selectUserDoc=="function"&&(window.selectUserDoc(c.id),$())}catch(d){console.error("[libModalHandleFile] error:",d),window.wsShowToast?.("⚠","Upload failed: "+d.message,"var(--red)"),n&&(n.style.display="none"),o&&(o.style.width="0%"),a&&(a.textContent="Upload"),s&&(s.disabled=!1)}}async function D(){const e=document.getElementById("lib-modal-my-docs-list"),t=document.getElementById("lib-modal-my-docs-count"),i=document.getElementById("lib-modal-docs-empty");if(!e)return;const{data:s}=await oe();t&&(t.textContent=`${s.length} file${s.length!==1?"s":""}`),i&&(i.style.display=s.length===0?"flex":"none"),e.innerHTML="",s.forEach(a=>{const n=/\.(pptx?|ppt)$/i.test(a.name),o=a.name.split(".").pop().toUpperCase(),d=(a.size/1048576).toFixed(1),r=new Date(a.uploadedAt).toLocaleDateString(void 0,{month:"short",day:"numeric"}),l=n?"#fb923c":"#8b7cf8",c=n?"rgba(251,146,60,0.25)":"var(--violet-border)",g=n?"rgba(251,146,60,0.08)":"rgba(139,124,248,0.08)",p=a.name.replace(/\.[^.]+$/,""),u=document.createElement("div");u.className="lib-doc-row",u.onclick=()=>{typeof window.selectUserDoc=="function"&&(window.selectUserDoc(a.id),$())},u.innerHTML=`
      <div class="lib-doc-row-icon" style="background:${g};border-color:${c};">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="${l}"
             stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
          <polyline points="14 2 14 8 20 8"/>
        </svg>
      </div>
      <div class="lib-doc-row-info">
        <div class="lib-doc-row-name">${p}</div>
        <div class="lib-doc-row-meta">
          <span class="lib-doc-row-badge" style="color:${l};border-color:${c};background:${g};">${o}</span>
          <span>${a.pageCount} ${n?"slides":"pages"}</span>
          <span>·</span>
          <span>${d} MB</span>
          <span>·</span>
          <span>${r}</span>
        </div>
      </div>
      <button class="lib-doc-row-delete" onclick="libModalDeleteDoc(event,'${a.id}')" title="Remove document">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"
             stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>`,e.appendChild(u)})}window.openLibraryModal=fe;window.closeLibraryModal=$;const xe=`
<div class="settings-modal" id="settings-modal" role="dialog" aria-modal="true" aria-labelledby="settings-modal-title">
  <div class="settings-content">

    <!-- Left Nav -->
    <div class="settings-nav">
      <button class="settings-close" onclick="closeSettings()" aria-label="Close settings">✕</button>
      <span id="settings-modal-title" class="sr-only">Settings</span>
      <div style="height:38px;"></div>

      <nav aria-label="Settings sections">
      <div class="settings-nav-item active" role="button" tabindex="0" aria-current="page" onclick="settingsNav('general', this)" onkeydown="if(event.key==='Enter'||event.key===' ')settingsNav('general',this)">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>
        General
      </div>
      <div class="settings-nav-item" role="button" tabindex="0" onclick="settingsNav('notifications', this)" onkeydown="if(event.key==='Enter'||event.key===' ')settingsNav('notifications',this)">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg>
        Notifications
      </div>
      <div class="settings-nav-item" role="button" tabindex="0" onclick="settingsNav('personalization', this)" onkeydown="if(event.key==='Enter'||event.key===' ')settingsNav('personalization',this)">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>
        Personalization
      </div>
      <div class="settings-nav-item" role="button" tabindex="0" onclick="settingsNav('apps', this)" onkeydown="if(event.key==='Enter'||event.key===' ')settingsNav('apps',this)">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2" y="2" width="9" height="9" rx="1"/><rect x="13" y="2" width="9" height="9" rx="1"/><rect x="2" y="13" width="9" height="9" rx="1"/><rect x="13" y="13" width="9" height="9" rx="1"/></svg>
        Apps
      </div>
      <div class="settings-nav-item" role="button" tabindex="0" onclick="settingsNav('data', this)" onkeydown="if(event.key==='Enter'||event.key===' ')settingsNav('data',this)">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5v14a9 3 0 0 0 18 0V5"/><path d="M3 12a9 3 0 0 0 18 0"/></svg>
        Data controls
      </div>
      <div class="settings-nav-item" role="button" tabindex="0" onclick="settingsNav('security', this)" onkeydown="if(event.key==='Enter'||event.key===' ')settingsNav('security',this)">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
        Security
      </div>
      <div class="settings-nav-item" role="button" tabindex="0" onclick="settingsNav('parental', this)" onkeydown="if(event.key==='Enter'||event.key===' ')settingsNav('parental',this)">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
        Parental controls
      </div>
      <div class="settings-nav-item" role="button" tabindex="0" onclick="settingsNav('account', this)" onkeydown="if(event.key==='Enter'||event.key===' ')settingsNav('account',this)">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>
        Account
      </div>
      </nav>
    </div>

    <!-- Right Panel -->
    <div class="settings-panel" role="region" aria-label="Settings content">

      <!-- General -->
      <div class="settings-page active" id="settings-page-general">
        <div class="settings-page-title">General</div>
        <div class="settings-row">
          <div class="settings-row-left"><div class="settings-row-label">Appearance</div></div>
          <div class="settings-select-wrap">
            <div class="settings-select-btn" role="combobox" aria-haspopup="listbox" aria-expanded="false" aria-label="Appearance" tabindex="0" data-action="settingsDropdown-self" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();settingsDropdown(this)}">
              <span>System</span>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>
            </div>
            <div class="settings-select-menu" role="listbox" data-setting-key="appearance">
              <div class="settings-select-option selected" data-action="settingsSelect-self" data-appearance="dark" onclick="applyAppearance('dark')">Dark</div>
              <div class="settings-select-option" data-action="settingsSelect-self" data-appearance="system" onclick="applyAppearance('system')">System</div>
              <div class="settings-select-option" data-action="settingsSelect-self" data-appearance="study" onclick="applyAppearance('study')">📖 Study Mode</div>
            </div>
          </div>
        </div>
        <div class="settings-row">
          <div class="settings-row-left">
            <div class="settings-row-label">Chat font size</div>
            <div class="settings-row-desc">Adjust text size for chat messages.</div>
          </div>
          <div class="font-size-picker" id="font-size-picker">
            <button class="font-size-btn" onclick="settingsFontSize('small',this)">S</button>
            <button class="font-size-btn active" onclick="settingsFontSize('medium',this)">M</button>
            <button class="font-size-btn" onclick="settingsFontSize('large',this)">L</button>
          </div>
        </div>
        <div class="settings-row">
          <div class="settings-row-left"><div class="settings-row-label">Accent color</div></div>
          <div class="settings-select-wrap">
            <div class="settings-select-btn" data-action="settingsDropdown-self">
              <span style="display:flex;align-items:center;gap:7px;"><span id="accent-dot" style="display:inline-block;width:9px;height:9px;border-radius:50%;background:var(--text-3);flex-shrink:0;"></span>Default</span>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="m6 9 6 6 6-6"/></svg>
            </div>
            <div class="settings-select-menu" data-setting-key="accent">
              <div class="settings-select-option selected" onclick="settingsSelectAccent(this,'#888','Default')">Default</div>
              <div class="settings-select-option" onclick="settingsSelectAccent(this,'#e8ac2e','Gold')">Gold</div>
              <div class="settings-select-option" onclick="settingsSelectAccent(this,'#8b7cf8','Violet')">Violet</div>
              <div class="settings-select-option" onclick="settingsSelectAccent(this,'#2dd4bf','Teal')">Teal</div>
            </div>
          </div>
        </div>
        <div class="settings-row">
          <div class="settings-row-left"><div class="settings-row-label">Language</div></div>
          <div class="settings-select-wrap">
            <div class="settings-select-btn" data-action="settingsDropdown-self">
              <span>Auto-detect</span>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="m6 9 6 6 6-6"/></svg>
            </div>
            <div class="settings-select-menu" data-setting-key="language">
              <div class="settings-select-option selected" data-action="settingsSelect-self">Auto-detect</div>
              <div class="settings-select-option" data-action="settingsSelect-self">English</div>
              <div class="settings-select-option" data-action="settingsSelect-self">Filipino</div>
              <div class="settings-select-option" data-action="settingsSelect-self">Spanish</div>
              <div class="settings-select-option" data-action="settingsSelect-self">French</div>
              <div class="settings-select-option" data-action="settingsSelect-self">Japanese</div>
            </div>
          </div>
        </div>
        <div class="settings-row">
          <div class="settings-row-left">
            <div class="settings-row-label">Spoken language</div>
            <div class="settings-row-desc">For best results, select the language you mainly speak. If it's not listed, it may still be supported via auto-detection.</div>
          </div>
          <div class="settings-select-wrap">
            <div class="settings-select-btn" data-action="settingsDropdown-self">
              <span>Auto-detect</span>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="m6 9 6 6 6-6"/></svg>
            </div>
            <div class="settings-select-menu" data-setting-key="spoken-language">
              <div class="settings-select-option selected" data-action="settingsSelect-self">Auto-detect</div>
              <div class="settings-select-option" data-action="settingsSelect-self">English</div>
              <div class="settings-select-option" data-action="settingsSelect-self">Filipino</div>
              <div class="settings-select-option" data-action="settingsSelect-self">Spanish</div>
              <div class="settings-select-option" data-action="settingsSelect-self">French</div>
            </div>
          </div>
        </div>
        <div class="settings-row">
          <div class="settings-row-left"><div class="settings-row-label">Voice</div></div>
          <div style="display:flex;align-items:center;gap:8px;">
            <button class="settings-play-btn" id="voice-play-btn" data-action="settingsPlayVoice">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg> Play
            </button>
            <div class="settings-select-wrap">
              <div class="settings-select-btn" data-action="settingsDropdown-self" style="min-width:90px;">
                <span id="voice-label">Maple</span>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="m6 9 6 6 6-6"/></svg>
              </div>
              <div class="settings-select-menu" data-setting-key="voice">
                <div class="settings-select-option" data-action="settingsSelectVoice-self">Echo</div>
                <div class="settings-select-option" data-action="settingsSelectVoice-self">Nova</div>
                <div class="settings-select-option" data-action="settingsSelectVoice-self">Shimmer</div>
              </div>
            </div>
          </div>
        </div>
        <div class="settings-row">
          <div class="settings-row-left">
            <div class="settings-row-label">Separate Voice</div>
            <div class="settings-row-desc">Keep Chunks AI Voice in a separate full screen, without real time transcripts and visuals.</div>
          </div>
          <label class="settings-toggle">
            <input type="checkbox" checked onchange="settingsToggleChanged(this,'separate-voice')">
            <div class="settings-toggle-track"></div>
            <div class="settings-toggle-thumb"></div>
          </label>
        </div>
      </div>

      <!-- Notifications -->
      <div class="settings-page" id="settings-page-notifications">
        <div class="settings-page-title">Notifications</div>
        <div class="settings-row">
          <div class="settings-row-left"><div class="settings-row-label">Study reminders</div><div class="settings-row-desc">Get reminded to study at your scheduled times.</div></div>
          <label class="settings-toggle"><input type="checkbox" id="toggle-notif-study" checked onchange="settingsToggleChanged(this,'notif-study')"><div class="settings-toggle-track"></div><div class="settings-toggle-thumb"></div></label>
        </div>
        <div class="settings-row">
          <div class="settings-row-left"><div class="settings-row-label">Flashcard review alerts</div><div class="settings-row-desc">Be notified when cards are due for review.</div></div>
          <label class="settings-toggle"><input type="checkbox" id="toggle-notif-flashcard" checked onchange="settingsToggleChanged(this,'notif-flashcard')"><div class="settings-toggle-track"></div><div class="settings-toggle-thumb"></div></label>
        </div>
        <div class="settings-row">
          <div class="settings-row-left"><div class="settings-row-label">New library books</div><div class="settings-row-desc">Get notified when new textbooks are added.</div></div>
          <label class="settings-toggle"><input type="checkbox" id="toggle-notif-library" onchange="settingsToggleChanged(this,'notif-library')"><div class="settings-toggle-track"></div><div class="settings-toggle-thumb"></div></label>
        </div>
        <div class="settings-row">
          <div class="settings-row-left"><div class="settings-row-label">Product updates</div><div class="settings-row-desc">Feature announcements and improvements.</div></div>
          <label class="settings-toggle"><input type="checkbox" id="toggle-notif-updates" onchange="settingsToggleChanged(this,'notif-updates')"><div class="settings-toggle-track"></div><div class="settings-toggle-thumb"></div></label>
        </div>
      </div>

      <!-- Personalization -->
      <div class="settings-page" id="settings-page-personalization">
        <div class="settings-page-title">Personalization</div>
        <div class="settings-row">
          <div class="settings-row-left"><div class="settings-row-label">Study mode</div><div class="settings-row-desc">Adjust AI response depth and detail level.</div></div>
          <div class="settings-select-wrap">
            <div class="settings-select-btn" data-action="settingsDropdown-self">
              <span>Balanced</span>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="m6 9 6 6 6-6"/></svg>
            </div>
            <div class="settings-select-menu" id="study-mode-menu">
              <div class="settings-select-option" data-mode="concise" data-action="settingsSelectStudyMode-self">Concise</div>
              <div class="settings-select-option selected" data-mode="balanced" data-action="settingsSelectStudyMode-self">Balanced</div>
              <div class="settings-select-option" data-mode="detailed" data-action="settingsSelectStudyMode-self">Detailed</div>
            </div>
          </div>
        </div>
        <div class="settings-row">
          <div class="settings-row-left"><div class="settings-row-label">Show follow-up questions</div><div class="settings-row-desc">Display suggested follow-ups after AI responses.</div></div>
          <label class="settings-toggle"><input type="checkbox" id="toggle-followups" checked onchange="settingsToggleChanged(this,'followups')"><div class="settings-toggle-track"></div><div class="settings-toggle-thumb"></div></label>
        </div>
        <div class="settings-row">
          <div class="settings-row-left"><div class="settings-row-label">Auto-generate flashcards</div><div class="settings-row-desc">Suggest flashcard creation after key answers.</div></div>
          <label class="settings-toggle"><input type="checkbox" id="toggle-auto-flash" onchange="settingsToggleChanged(this,'auto-flash')"><div class="settings-toggle-track"></div><div class="settings-toggle-thumb"></div></label>
        </div>
      </div>

      <!-- Apps -->
      <div class="settings-page" id="settings-page-apps">
        <div class="settings-page-title">Apps</div>
        <div class="settings-row">
          <div class="settings-row-left"><div class="settings-row-label">Connected apps</div><div class="settings-row-desc">No apps connected yet.</div></div>
        </div>
        <div class="settings-row">
          <div class="settings-row-left"><div class="settings-row-label">API access</div><div class="settings-row-desc">Manage your API keys and integrations.</div></div>
          <div class="settings-select" style="color:var(--text-3);cursor:default;">Coming soon</div>
        </div>
      </div>

      <!-- Data controls -->
      <div class="settings-page" id="settings-page-data">
        <div class="settings-page-title">Data controls</div>
        <div class="settings-row">
          <div class="settings-row-left"><div class="settings-row-label">Save chat history</div><div class="settings-row-desc">Store your conversations for future reference.</div></div>
          <label class="settings-toggle"><input type="checkbox" id="toggle-save-history" checked onchange="dataToggleSaveHistory(this)"><div class="settings-toggle-track"></div><div class="settings-toggle-thumb"></div></label>
        </div>
        <div class="settings-row">
          <div class="settings-row-left"><div class="settings-row-label">Use data to improve Chunks AI</div><div class="settings-row-desc">Help improve the product by sharing anonymised usage data.</div></div>
          <label class="settings-toggle"><input type="checkbox" id="toggle-improve-data" checked onchange="dataToggleImprove(this)"><div class="settings-toggle-track"></div><div class="settings-toggle-thumb"></div></label>
        </div>
        <div class="settings-row">
          <div class="settings-row-left"><div class="settings-row-label">Delete all chat history</div><div class="settings-row-desc">Permanently remove all saved conversations.</div></div>
          <button id="delete-all-btn" data-action="clearAllHistory" style="padding:6px 14px;border-radius:var(--r-sm);background:rgba(248,113,113,0.1);border:1px solid rgba(248,113,113,0.3);color:var(--red);font-size:12px;font-family:var(--font-body);cursor:pointer;transition:background 120ms;">Delete all</button>
        </div>
        <div class="settings-row">
          <div class="settings-row-left"><div class="settings-row-label">Cached textbooks</div><div class="settings-row-desc" id="cache-size-label">Textbooks are cached locally so they load instantly after the first download.</div></div>
          <button id="clear-cache-btn" data-action="clearPdfCache" style="padding:6px 14px;border-radius:var(--r-sm);background:rgba(248,113,113,0.1);border:1px solid rgba(248,113,113,0.3);color:var(--red);font-size:12px;font-family:var(--font-body);cursor:pointer;transition:background 120ms;">Clear cache</button>
        </div>
      </div>

      <!-- Security -->
      <div class="settings-page" id="settings-page-security">
        <div class="settings-page-title">Security</div>
        <div class="settings-row">
          <div class="settings-row-left"><div class="settings-row-label">Two-factor authentication</div><div class="settings-row-desc">Add an extra layer of security to your account.</div></div>
          <div style="font-size:11px;color:var(--text-4);padding:6px 12px;background:var(--surface-3);border-radius:var(--r-pill);border:1px solid var(--border-xs);">Coming soon</div>
        </div>
        <div class="settings-row">
          <div class="settings-row-left"><div class="settings-row-label">Active sessions</div><div class="settings-row-desc">View and manage devices logged into your account.</div></div>
          <div style="font-size:13px;color:var(--text-3);">1 device</div>
        </div>
        <div class="settings-row">
          <div class="settings-row-left"><div class="settings-row-label">Change password</div><div class="settings-row-desc">Send a password reset link to your email.</div></div>
          <button id="settings-change-password-btn" onclick="settingsChangePassword()" style="padding:6px 14px;border-radius:var(--r-sm);background:var(--surface-3);border:1px solid var(--border-sm);color:var(--text-1);font-size:12px;font-family:var(--font-body);cursor:pointer;transition:background 120ms;">Send reset link</button>
        </div>
      </div>

      <!-- Parental controls -->
      <div class="settings-page" id="settings-page-parental">
        <div class="settings-page-title">Parental controls</div>
        <div class="settings-row">
          <div class="settings-row-left"><div class="settings-row-label">Safe content mode</div><div class="settings-row-desc">Restrict AI responses to age-appropriate study material only.</div></div>
          <label class="settings-toggle"><input type="checkbox" id="toggle-safe-content" onchange="settingsToggleChanged(this,'safe-content')"><div class="settings-toggle-track"></div><div class="settings-toggle-thumb"></div></label>
        </div>
        <div class="settings-row">
          <div class="settings-row-left"><div class="settings-row-label">Set a PIN</div><div class="settings-row-desc">Protect settings with a PIN code.</div></div>
          <div style="font-size:11px;color:var(--text-4);padding:6px 12px;background:var(--surface-3);border-radius:var(--r-pill);border:1px solid var(--border-xs);">Coming soon</div>
        </div>
      </div>

      <!-- Account -->
      <div class="settings-page" id="settings-page-account">
        <div class="settings-page-title">Account</div>
        <div class="settings-row">
          <div class="settings-row-left"><div class="settings-row-label">Name</div></div>
          <div id="settings-account-name" style="font-size:13px;color:var(--text-2);">—</div>
        </div>
        <div class="settings-row">
          <div class="settings-row-left"><div class="settings-row-label">Email</div></div>
          <div id="settings-account-email" style="font-size:13px;color:var(--text-2);font-family:var(--font-mono);">—</div>
        </div>
        <div class="settings-row">
          <div class="settings-row-left"><div class="settings-row-label">Plan</div><div class="settings-row-desc">Upgrade to unlock unlimited messages and all textbooks.</div></div>
          <div style="display:flex;align-items:center;gap:8px;">
            <span id="settings-account-plan" style="font-size:12px;color:var(--text-3);">Free</span>
            <button id="settings-upgrade-btn" onclick="window._currentUser ? (closeSettings(),openUpgradeModal()) : (closeSettings(),window.openAuthModal?.())" style="padding:5px 12px;border-radius:var(--r-pill);background:var(--gold);border:none;color:#090900;font-size:12px;font-weight:600;cursor:pointer;font-family:var(--font-body);">Upgrade</button>
          </div>
        </div>
        <div class="settings-row">
          <div class="settings-row-left"><div class="settings-row-label" style="color:var(--red);">Delete account</div><div class="settings-row-desc">Permanently delete your account and all data. This cannot be undone.</div></div>
          <button id="settings-delete-account-btn" onclick="settingsDeleteAccount()" style="padding:6px 14px;border-radius:var(--r-sm);background:rgba(248,113,113,0.1);border:1px solid rgba(248,113,113,0.3);color:var(--red);font-size:12px;font-family:var(--font-body);cursor:pointer;transition:background 120ms;">Delete</button>
        </div>
      </div>

    </div><!-- /settings-panel -->
  </div><!-- /settings-content -->
</div>`;document.addEventListener("DOMContentLoaded",()=>{if(document.getElementById("settings-modal"))return;const e=document.createElement("div");e.innerHTML=xe,document.body.appendChild(e.firstElementChild),document.getElementById("settings-modal")?.addEventListener("click",function(t){t.target===this&&!document.getElementById("confirm-modal")?.classList.contains("active")&&L()}),Re(),qe(),I(),Oe()});let B=null;function Se(e){const t=document.getElementById("settings-modal");if(!t)return;t.classList.add("active");const i=window._currentUser,s=!i,a=document.getElementById("settings-account-name"),n=document.getElementById("settings-account-email"),o=document.getElementById("settings-account-plan");if(a&&(a.textContent=i?.name||i?.email?.split("@")[0]||(s?"Guest":"—")),n&&(n.textContent=i?.email||(s?"Not signed in":"—")),o){const c=i?.plan||"free";o.textContent=s?"Guest":c.charAt(0).toUpperCase()+c.slice(1),o.style.color=!s&&c!=="free"?"var(--gold)":"var(--text-3)"}const d=document.getElementById("settings-change-password-btn"),r=document.getElementById("settings-delete-account-btn"),l=document.getElementById("delete-all-btn");if(s?(d&&(d.disabled=!0,d.title="Sign in to use this feature",d.style.opacity="0.4",d.style.cursor="not-allowed"),r&&(r.disabled=!0,r.title="Sign in to use this feature",r.style.opacity="0.4",r.style.cursor="not-allowed"),l&&(l.disabled=!1)):(d&&(d.disabled=!1,d.title="",d.style.opacity="",d.style.cursor=""),r&&(r.disabled=!1,r.title="",r.style.opacity="",r.style.cursor="")),e){const c=t.querySelectorAll(".settings-nav-item"),g=t.querySelectorAll(".settings-page");c.forEach(v=>{v.classList.remove("active"),v.removeAttribute("aria-current")}),g.forEach(v=>v.classList.remove("active"));const u={general:0,notifications:1,personalization:2,apps:3,data:4,security:5,parental:6,account:7}[e]??0;if(c[u]?.classList.add("active"),c[u]?.setAttribute("aria-current","page"),t.querySelector("#settings-page-"+e)?.classList.add("active"),e==="data"&&I(),window.innerWidth<=600){const v=t.querySelector("#settings-modal-title");if(v){const _=t.querySelector("#settings-page-"+e+" .settings-page-title");v.textContent=_?.textContent||e.charAt(0).toUpperCase()+e.slice(1)}c[u]?.scrollIntoView({behavior:"smooth",block:"nearest",inline:"center"})}}B=window.trapFocus?.(t)??null}function L(){document.getElementById("settings-modal")?.classList.remove("active"),B&&(B(),B=null)}function Ce(e,t){document.querySelectorAll(".settings-nav-item").forEach(i=>{i.classList.remove("active"),i.removeAttribute("aria-current")}),document.querySelectorAll(".settings-page").forEach(i=>i.classList.remove("active")),t.classList.add("active"),t.setAttribute("aria-current","page"),document.getElementById("settings-page-"+e)?.classList.add("active"),e==="data"&&I()}function Ee(e,t){const i={small:"11px",medium:"13px",large:"15px"};if(i[e]){document.documentElement.style.setProperty("--chat-font-size",i[e]),document.querySelectorAll(".font-size-btn").forEach(s=>s.classList.remove("active")),t.classList.add("active");try{localStorage.setItem("chunks-chat-font-size",e)}catch{}window.ChunksDB?.settings?.patch?.({chat_font_size:e})}}(function(){try{const e=localStorage.getItem("chunks-chat-font-size"),t={small:"11px",medium:"13px",large:"15px"};e&&t[e]&&document.documentElement.style.setProperty("--chat-font-size",t[e])}catch{}})();function X(e){const t=e.nextElementSibling,i=t.classList.contains("open");document.querySelectorAll(".settings-select-menu.open").forEach(s=>{s.classList.remove("open"),s.previousElementSibling?.setAttribute("aria-expanded","false")}),document.querySelectorAll(".settings-select-btn.open").forEach(s=>s.classList.remove("open")),i?e.setAttribute("aria-expanded","false"):(t.classList.add("open"),e.classList.add("open"),e.setAttribute("aria-expanded","true"))}document.addEventListener("click",function(e){e.target.closest(".settings-select-wrap")||(document.querySelectorAll(".settings-select-menu.open").forEach(t=>t.classList.remove("open")),document.querySelectorAll(".settings-select-btn.open").forEach(t=>t.classList.remove("open")))});function z(e){const t=e.closest(".settings-select-menu"),i=t.previousElementSibling,s=i.querySelector("span");t.querySelectorAll(".settings-select-option").forEach(d=>{d.classList.remove("selected"),d.setAttribute("aria-selected","false")}),e.classList.add("selected"),e.setAttribute("aria-selected","true");const a=e.textContent.replace("✓","").trim();s.textContent=a;const n=t.dataset.settingKey;if(n)try{localStorage.setItem("chunks_setting_"+n,a)}catch{}const o={language:"language","spoken-language":"spoken_language"};n&&o[n]&&window.ChunksDB?.settings?.patch?.({[o[n]]:a}),t.classList.remove("open"),i.classList.remove("open"),i.setAttribute("aria-expanded","false")}function ee(e){const t=document.documentElement;if(e==="study")t.setAttribute("data-theme","study");else if(e==="system"){const s=window.matchMedia("(prefers-color-scheme: dark)").matches;t.setAttribute("data-theme",s?"dark":"study")}else t.setAttribute("data-theme","dark");try{localStorage.setItem("chunks_setting_appearance",e)}catch{}window.ChunksDB?.settings?.patch?.({appearance:e});const i=document.getElementById("theme-toggle-btn");i&&_e(i,e==="study")}function _e(e,t){e.innerHTML=t?'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="4"/><line x1="12" y1="2" x2="12" y2="4"/><line x1="12" y1="20" x2="12" y2="22"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="2" y1="12" x2="4" y2="12"/><line x1="20" y1="12" x2="22" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg> Switch to Dark':'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg> Study Mode'}(function(){try{const t=(localStorage.getItem("chunks_setting_appearance")||"dark")==="study"?"study":"dark";document.documentElement.setAttribute("data-theme",t)}catch{}})();function Ae(e){const t=e.replace("#",""),i=parseInt(t.length===3?t.split("").map(s=>s+s).join(""):t,16);return[i>>16&255,i>>8&255,i&255]}function j(e){const t=document.documentElement;if(!e||e==="#888")["--gold","--gold-bright","--gold-muted","--gold-glow","--gold-border","--accent","--accent-dim","--accent-glow","--fc-accent"].forEach(i=>t.style.removeProperty(i));else{const[i,s,a]=Ae(e);t.style.setProperty("--gold",e),t.style.setProperty("--gold-bright",e),t.style.setProperty("--gold-muted",`rgba(${i},${s},${a},0.10)`),t.style.setProperty("--gold-glow",`rgba(${i},${s},${a},0.20)`),t.style.setProperty("--gold-border",`rgba(${i},${s},${a},0.22)`),t.style.setProperty("--accent",e),t.style.setProperty("--accent-dim",`rgba(${i},${s},${a},0.12)`),t.style.setProperty("--accent-glow",`rgba(${i},${s},${a},0.25)`),t.style.setProperty("--fc-accent",e)}}function Be(e,t,i){const s=e.closest(".settings-select-menu"),a=s.previousElementSibling;s.querySelectorAll(".settings-select-option").forEach(d=>d.classList.remove("selected")),e.classList.add("selected"),j(t);const n=document.getElementById("accent-dot");n&&(n.style.background=t==="#888"?"var(--text-3)":t);const o=t==="#888"?"var(--text-3)":t;a.querySelector("span").innerHTML=`<span style="display:inline-flex;align-items:center;gap:7px;"><span style="display:inline-block;width:9px;height:9px;border-radius:50%;background:${o};flex-shrink:0;"></span>${i}</span>`;try{localStorage.setItem("chunks_setting_accent",i),localStorage.setItem("chunks_setting_accent_color",t)}catch{}window.ChunksDB?.settings?.patch?.({accent:i}),s.classList.remove("open"),a.classList.remove("open")}function Me(e){z(e);const t=e.textContent.trim(),i=document.getElementById("voice-label");i&&(i.textContent=t);try{localStorage.setItem("chunks_setting_voice",t)}catch{}window.ChunksDB?.settings?.patch?.({voice:t})}function Le(){const e=document.getElementById("voice-play-btn"),t=document.getElementById("voice-label")?.textContent||"Maple";if("speechSynthesis"in window){window.speechSynthesis.cancel();const i=new SpeechSynthesisUtterance(`Hi, I'm ${t}, your Chunks AI study assistant.`);i.rate=.95,window.speechSynthesis.speak(i),e.innerHTML='<svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg> Playing',i.onend=()=>{e.innerHTML='<svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg> Play'}}else window.wsShowToast?.("🔊","Voice preview not supported in this browser","")}function Ie(e,t){const i=e.checked;localStorage.setItem("chunks_setting_"+t,i?"1":"0");const s={"separate-voice":"separate_voice","safe-content":"safe_content"};s[t]&&window.ChunksDB?.settings?.patch?.({[s[t]]:i}),t==="followups"&&document.querySelectorAll(".followups").forEach(n=>{n.style.display=i?"":"none"});const a=t.replace(/-/g," ").replace(/^./,n=>n.toUpperCase());window.wsShowToast?.(i?"✓":"✕",`${a} ${i?"enabled":"disabled"}`,"")}function Te(e){z(e);const t=e.dataset.mode;t&&(localStorage.setItem("chunks_study_mode",t),window.wsShowToast?.("✓",`Study mode: ${e.textContent.trim()}`,""))}function He(){return localStorage.getItem("chunks_study_mode")||"balanced"}function Pe(){return localStorage.getItem("chunks_setting_followups")!=="0"}function $e(){return localStorage.getItem("chunks_setting_auto-flash")==="1"}function De(e){e&&(e.checked=!0),localStorage.removeItem("chunks_save_history"),window.wsShowToast?.("✓","Chat history is always saved","")}function ze(e){const t=e.checked;localStorage.setItem("chunks_improve_data",t?"1":"0"),window.wsShowToast?.(t?"✓":"✕",`Usage data sharing ${t?"enabled":"disabled"}`,"")}function je(){window.showConfirmModal?.({title:"Clear your chat history — are you sure?",desc:"This will permanently delete all saved conversations and cannot be undone.",confirmLabel:"Confirm deletion",onConfirm:()=>{Object.keys(localStorage).filter(r=>r.startsWith("chunks_session_")||r.startsWith("chunks_ws_session_")||r.startsWith("chunks_vt_session_")||r.startsWith("exam_snap_")||r.startsWith("sp_")||r==="chunks_recent"||r==="chunks_active_home_session"||r==="chunks_active_ws_book"||r==="chunks_active_recent_id"||r==="chunks_home_session"||r==="chunks_active_vt_session"||r==="exam_recent").forEach(r=>localStorage.removeItem(r)),Array.isArray(window._recentItems)&&(window._recentItems.length=0),window._activeRecentId!==void 0&&(window._activeRecentId=null),window.homeHistory!==void 0&&(window.homeHistory=[]),window._homeSessionId!==void 0&&(window._homeSessionId=null),window._wsChatHistory!==void 0&&(window._wsChatHistory=[]),window._activeExamRecentId!==void 0&&(window._activeExamRecentId=null),window._renderAllRecent?.(),typeof window.spShowEmpty=="function"&&window.spShowEmpty(),typeof window.setActivePlan=="function"&&window.setActivePlan(null),typeof window._renderRecentPlansAllSidebars=="function"&&window._renderRecentPlansAllSidebars();const e=document.getElementById("home-chat-history"),t=document.getElementById("home-landing"),i=document.querySelector(".home-hero"),s=document.getElementById("home-input-bar"),a=document.getElementById("home-scroll-area");e&&(e.innerHTML=""),t&&(t.style.display=""),i&&(i.style.display=""),s&&(s.style.display="none"),a&&(a.style.justifyContent="center");const n=document.getElementById("ws-messages");n&&(n.innerHTML=`
        <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;gap:10px;color:var(--text-4);text-align:center;padding:24px;">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" opacity="0.25"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
          <div style="font-size:12px;color:var(--text-4);">Ask a question to start the conversation</div>
        </div>`),typeof window._vtClear=="function"&&window._vtClear(),typeof window._examShow=="function"&&window._examShow("exam-setup");const o=document.getElementById("exam-topic-input");o&&(o.value="");const d=document.getElementById("exam-recent-list");d&&(d.innerHTML='<div style="padding:8px 12px;font-size:11px;color:var(--text-4);">No exams yet</div>'),L(),setTimeout(()=>window.showSimpleNotif?.("Chat history cleared"),200)}})}async function Ne(){if(!("caches"in window)){window.wsShowToast?.("⚠","Cache API not supported in this browser","");return}window.showConfirmModal?.({title:"Clear cached textbooks — are you sure?",desc:"Textbooks will be re-downloaded the next time you open them in Workspace.",confirmLabel:"Confirm deletion",onConfirm:async()=>{await caches.delete("chunks-pdf-v1"),I(),L(),setTimeout(()=>window.showSimpleNotif?.("PDF cache cleared"),200)}})}async function I(){const e=document.getElementById("cache-size-label");if(!(!e||!("caches"in window)))try{const t=await caches.open("chunks-pdf-v1"),i=await t.keys();if(i.length===0)e.textContent="No textbooks cached yet.";else{let s=0;for(const n of i){const d=await(await t.match(n)).clone().arrayBuffer();s+=d.byteLength}const a=(s/1048576).toFixed(1);e.textContent=`${i.length} textbook${i.length>1?"s":""} cached — ${a} MB`}}catch{e.textContent="Textbooks cached locally for fast loading."}}function qe(){const e=localStorage.getItem("chunks-chat-font-size")||"medium";document.querySelectorAll(".font-size-btn").forEach(l=>{l.classList.remove("active");const g=(l.getAttribute("onclick")||"").match(/settingsFontSize\(['"]([^'"]+)['"]/);g&&g[1]===e&&l.classList.add("active")});function t(l,c){const g=document.querySelector(`.settings-select-menu[data-setting-key="${l}"]`);if(!g||!c)return;const p=g.previousElementSibling,u=Array.from(g.querySelectorAll(".settings-select-option")).find(v=>v.textContent.replace("✓","").trim()===c);u&&(g.querySelectorAll(".settings-select-option").forEach(v=>v.classList.remove("selected")),u.classList.add("selected"),p.querySelector("span").textContent=c)}const i=localStorage.getItem("chunks_setting_accent"),s=localStorage.getItem("chunks_setting_accent_color");if(i&&s){j(s);const l=document.querySelector('.settings-select-menu[data-setting-key="accent"]');if(l){const c=l.previousElementSibling,g=Array.from(l.querySelectorAll(".settings-select-option")).find(p=>p.textContent.trim()===i);if(g){l.querySelectorAll(".settings-select-option").forEach(v=>v.classList.remove("selected")),g.classList.add("selected");const p=document.getElementById("accent-dot"),u=s==="#888"?"var(--text-3)":s;p&&(p.style.background=u),c.querySelector("span").innerHTML=`<span style="display:inline-flex;align-items:center;gap:7px;"><span style="display:inline-block;width:9px;height:9px;border-radius:50%;background:${u};flex-shrink:0;"></span>${i}</span>`}}}const a=localStorage.getItem("chunks_setting_voice");if(a){t("voice",a);const l=document.getElementById("voice-label");l&&(l.textContent=a)}t("appearance",localStorage.getItem("chunks_setting_appearance"));const n=localStorage.getItem("chunks_setting_appearance")||"dark";ee(n),t("language",localStorage.getItem("chunks_setting_language")),t("spoken-language",localStorage.getItem("chunks_setting_spoken-language"));const o=localStorage.getItem("chunks_study_mode");if(o){const l=document.getElementById("study-mode-menu");if(l){const c=l.querySelector(`[data-mode="${o}"]`);if(c){l.querySelectorAll(".settings-select-option").forEach(p=>p.classList.remove("selected")),c.classList.add("selected");const g=l.previousElementSibling;g&&(g.querySelector("span").textContent=c.textContent.trim())}}}const d=localStorage.getItem("chunks_setting_followups");if(d!==null){const l=document.getElementById("toggle-followups");l&&(l.checked=d!=="0")}const r=localStorage.getItem("chunks_setting_auto-flash");if(r!==null){const l=document.getElementById("toggle-auto-flash");l&&(l.checked=r==="1")}}function Oe(){const e=document.getElementById("toggle-save-history");e&&(e.checked=!0),localStorage.removeItem("chunks_save_history"),Object.entries({"toggle-improve-data":{key:"chunks_improve_data",default:"1"},"toggle-followups":{key:"chunks_setting_followups",default:"1"},"toggle-auto-flash":{key:"chunks_setting_auto-flash",default:"0"},"toggle-notif-study":{key:"chunks_setting_notif-study",default:"1"},"toggle-notif-flashcard":{key:"chunks_setting_notif-flashcard",default:"1"},"toggle-notif-library":{key:"chunks_setting_notif-library",default:"0"},"toggle-notif-updates":{key:"chunks_setting_notif-updates",default:"0"},"toggle-safe-content":{key:"chunks_setting_safe-content",default:"0"}}).forEach(([i,{key:s,default:a}])=>{const n=document.getElementById(i);if(!n)return;const o=localStorage.getItem(s);n.checked=o!==null?o==="1":a==="1"})}function Re(){document.querySelectorAll(".settings-select-menu").forEach(e=>{e.getAttribute("role")||e.setAttribute("role","listbox"),e.querySelectorAll(".settings-select-option").forEach(i=>{i.setAttribute("role","option"),i.setAttribute("aria-selected",i.classList.contains("selected")?"true":"false"),i.hasAttribute("tabindex")||i.setAttribute("tabindex","0")});const t=e.previousElementSibling;t&&t.classList.contains("settings-select-btn")&&!t.getAttribute("role")&&(t.setAttribute("role","combobox"),t.setAttribute("aria-haspopup","listbox"),t.setAttribute("aria-expanded","false"),t.setAttribute("tabindex","0"),t.addEventListener("keydown",function(i){(i.key==="Enter"||i.key===" ")&&(i.preventDefault(),X(this))}))})}async function Ue(){const e=document.getElementById("settings-change-password-btn"),t=window._currentUser?.email;if(!t){window.wsShowToast?.("⚠","No account email found","");return}e&&(e.textContent="Sending…",e.disabled=!0);try{const i=window._getChunksSb?.();if(i){const{error:s}=await i.auth.resetPasswordForEmail(t,{redirectTo:window.location.origin+"/login.html"});if(s)throw s}window.wsShowToast?.("📧",`Reset link sent to ${t}`,"")}catch(i){window.wsShowToast?.("⚠",i.message||"Failed to send reset link","")}finally{e&&(e.textContent="Send reset link",e.disabled=!1)}}function Ve(){window.showConfirmModal?.({title:"Delete your account?",desc:"This will permanently delete your account and all data. This cannot be undone.",confirmLabel:"Delete account",onConfirm:async()=>{try{const e=window._getChunksSb?.();e&&await e.auth.signOut(),localStorage.clear(),sessionStorage.clear(),window.location.replace("login.html")}catch{window.wsShowToast?.("⚠","Could not delete account — contact support","")}}})}window.openSettings=Se;window.closeSettings=L;window.settingsNav=Ce;window.settingsFontSize=Ee;window.settingsDropdown=X;window.settingsSelect=z;window.applyAccentColor=j;window.applyAppearance=ee;window.settingsSelectAccent=Be;window.settingsSelectVoice=Me;window.settingsPlayVoice=Le;window.settingsToggleChanged=Ie;window.settingsSelectStudyMode=Te;window._getStudyMode=He;window._isFollowupsEnabled=Pe;window._isAutoFlashEnabled=$e;window.dataToggleSaveHistory=De;window.dataToggleImprove=ze;window.clearAllHistory=je;window.clearPdfCache=Ne;window.settingsChangePassword=Ue;window.settingsDeleteAccount=Ve;export{M as m,F as s};
