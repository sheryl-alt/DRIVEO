<script setup>
import { computed, ref, watch, nextTick, onMounted, onBeforeUnmount } from 'vue'
import { useRoute, useRouter } from 'vue-router'

const route = useRoute()
const router = useRouter()
const frame = ref(null)
const activeFrameUrl = ref(null)
const cachedFrames = ref([])
// Keep the iframe hidden until its existing page setup is complete. This prevents
// the pre-adjustment document from flashing briefly during a hard refresh.
const readyFrameUrls = ref(new Set())
const frameElements = new Map()
const loadedFrameUrls = new Set()
let observer = null
const cleanupFrames = new Map()
const initializedFrameDocs = new WeakSet()

const SESSION_URL = 'http://localhost:5000/api/auth/session'

const pageMap = {
  '/': '/stitch-pages/beranda.html',
  '/beranda': '/stitch-pages/beranda.html',
  '/tentang-kami': '/stitch-pages/tentang-kami.html',
  '/katalog': '/stitch-pages/katalog.html',
  '/detail-mobil': '/stitch-pages/detail-mobil.html',
  '/kontak': '/stitch-pages/kontak.html',
  '/admin': '/stitch-pages/admin.html',
  '/admin-login': '/stitch-pages/admin-login.html',
}

const pageUrl = computed(() => pageMap[route.path] ?? pageMap['/'])

function ensureCachedFrame(url) {
  if (!cachedFrames.value.some((entry) => entry.url === url)) cachedFrames.value.push({ url })
}

function setFrameElement(url, element) {
  if (element) frameElements.set(url, element)
  else frameElements.delete(url)
  if (url === pageUrl.value && element) frame.value = element
}

async function activatePageFrame(url) {
  ensureCachedFrame(url)
  await nextTick()
  const element = frameElements.get(url)
  if (!element || !loadedFrameUrls.has(url)) return

  const doc = element.contentDocument
  if (!doc || !initializedFrameDocs.has(doc)) return

  frame.value = element
  activeFrameUrl.value = url
  readyFrameUrls.value = new Set([...readyFrameUrls.value, url])
  setActiveNav(doc)
  syncFrameScrollLock(doc)
}

watch(pageUrl, (url) => {
  // Keep the currently visible page until the destination iframe is fully
  // loaded and its one-time setup has completed.
  activatePageFrame(url)
}, { flush: 'post' })

watch(() => route.fullPath, async () => {
  if (route.path !== '/detail-mobil' || !route.query.id) return
  await nextTick()
  const detailFrame = frameElements.get('/stitch-pages/detail-mobil.html')
  const loadDetail = detailFrame?.contentWindow?.loadDriveoDetailFromAPI
  if (typeof loadDetail === 'function') loadDetail(String(route.query.id))
})

const navRoutes = {
  'BERANDA': '/beranda',
  'TENTANG KAMI': '/tentang-kami',
  'KATALOG': '/katalog',
  'KATALOG MOBIL': '/katalog',
  'HUBUNGI KAMI': '/kontak',
}

async function fetchDriveoSession() {
  try {
    const token = sessionStorage.getItem('driveo_token') || ''
    const response = await fetch(SESSION_URL, {
      headers: {
        Accept: 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      }
    })
    return await response.json()
  } catch (error) {
    return { success: false, authenticated: false, user: null }
  }
}

function getFirstName(name) {
  const value = String(name || '').trim()
  return value ? value.split(/\s+/)[0] : 'User'
}

function installAuthUI(doc, _sessionData) {
  const header = doc.querySelector('header')
  if (!header) return

  // Remove all legacy public LOGIN triggers. Admin authentication now lives
  // on the dedicated /admin-login route; do not inject replacement controls.
  const loginButtons = [...header.querySelectorAll('button, a')].filter((element) => {
    const text = (element.textContent || '').trim().replace(/\\s+/g, ' ').toUpperCase()
    const onclick = element.getAttribute('onclick') || ''
    return /^(LOGIN|LOGIN ADMIN)$/.test(text) ||
      /openLoginModal/i.test(onclick) ||
      element.id === 'openLoginModal'
  })
  loginButtons.forEach((element) => element.remove())
  header.querySelector('.driveo-auth-action-wrap')?.remove()
}

function syncFrameScrollLock(doc = frame.value?.contentDocument) {
  if (!doc) return
  const html = doc.documentElement
  const body = doc.body
  const modal = doc.getElementById('login-modal')
  const modalOpen = modal && !modal.classList.contains('hidden')

  // The outer Vue app owns the viewport. The Stitch document owns scrolling.
  html.style.overflowX = 'hidden'
  html.style.overflowY = 'auto'
  body.style.overflowX = 'hidden'
  body.style.overflowY = modalOpen ? 'hidden' : 'auto'
  body.style.minHeight = '100%'
}

function setActiveNav(doc) {
  const current = route.path === '/' ? '/beranda' : (route.path === '/detail-mobil' ? '/katalog' : route.path)
  const links = [...doc.querySelectorAll('nav a')]

  links.forEach((link) => {
    const text = (link.textContent || '').trim().replace(/\s+/g, ' ').toUpperCase()
    const target = navRoutes[text]
    const active = target && target.replace('/?login=admin', '') === current

    link.classList.toggle('driveo-vue-nav-active', !!active)
    link.classList.toggle('driveo-vue-nav-inactive', !!target && !active)

    // Preserve Stitch's underline element where it exists.
    const underline = link.querySelector('span.absolute')
    if (underline) underline.style.display = active ? '' : 'none'
  })
}

function navigateFromFrame(target) {
  if (!target) return
  if (target === '/?login=admin') {
    router.push('/admin-login')
    return
  }
  router.push(target)
}

function installFrameNavigation(url, doc) {
  if (!doc || initializedFrameDocs.has(doc)) return
  initializedFrameDocs.add(doc)

  // Normalize every Stitch navbar link first. Some exported Stitch pages
  // contain onclick handlers (including WhatsApp navigation) on the navbar.
  // The navbar must always navigate to the corresponding Vue route.
  const normalizedNavLinks = []
  doc.querySelectorAll('nav a').forEach((link) => {
    const text = (link.textContent || '').trim().replace(/\s+/g, ' ').toUpperCase()
    const target = navRoutes[text]
    if (!target) return

    // Remove Stitch handlers so they can never redirect the navbar to WA or
    // to a placeholder screen before Vue Router handles the click.
    link.removeAttribute('onclick')
    link.setAttribute('href', target)
    link.setAttribute('data-driveo-vue-nav', target)
    normalizedNavLinks.push(link)
  })

  const onClick = (event) => {
    const clickable = event.target?.closest?.('a, button')
    if (!clickable) return

    // Admin hamburger behavior is owned by the admin.html document itself.
    // Do not intercept it here: the legacy Vue bridge used to open the sidebar
    // and add a dimming overlay on every tap.
    const navLink = clickable.closest('nav a')
    if (navLink) {
      const customerHeader = doc.querySelector('header')
      customerHeader?.classList.remove('driveo-mobile-open')
      customerHeader?.querySelector('.driveo-mobile-menu-button')?.setAttribute('aria-expanded', 'false')
      const target = navLink.getAttribute('data-driveo-vue-nav') || navRoutes[
        (navLink.textContent || '').trim().replace(/\s+/g, ' ').toUpperCase()
      ]
      if (target) {
        event.preventDefault()
        event.stopPropagation()
        navigateFromFrame(target)
        return
      }
    }

    const text = (clickable.innerText || clickable.textContent || '')
      .trim()
      .replace(/\s+/g, ' ')
      .toUpperCase()
    const href = clickable.getAttribute('href') || ''

    // Fix Stitch placeholders and non-navigation controls.
    if (/^\{\{DATA:SCREEN:/.test(href) || href === 'javascript:void(0)' || href === '#') {
      let target = null
      if (text.includes('LIHAT KATALOG') || text.includes('CARI MOBIL') || text.includes('LIHAT SEMUA MOBIL') || text.includes('JELAJAHI MOBIL')) {
        target = '/katalog'
      } else if (text.includes('TENTANG KAMI') || text.includes('KENALI DRIVEO')) {
        target = '/tentang-kami'
      } else if (text.includes('HUBUNGI KAMI')) {
        target = '/kontak'
      } else if (text.includes('BERANDA')) {
        target = '/beranda'
      }

      if (target) {
        event.preventDefault()
        event.stopPropagation()
        navigateFromFrame(target)
      }
      return
    }

    // Detail page and other Stitch screens sometimes use normal internal URLs.
    if (href.startsWith('/') && !href.startsWith('//')) {
      const clean = href.split('?')[0].split('#')[0]
      const allowed = ['/', '/beranda', '/tentang-kami', '/katalog', '/detail-mobil', '/kontak', '/admin']
      if (allowed.includes(clean)) {
        event.preventDefault()
        event.stopPropagation()
        navigateFromFrame(href)
      }
    }
  }

  // Capture phase wins over Stitch's own event handlers.
  doc.addEventListener('click', onClick, true)

  const style = doc.createElement('style')
  style.id = 'driveo-vue-navigation-style'
  style.textContent = `
    /* Global layout stability: reserve scrollbar space so every page keeps the same viewport width. */
    html { scrollbar-gutter: stable !important; }
    html, body { width: 100% !important; max-width: 100% !important; min-width: 0 !important; box-sizing: border-box !important; }
    *, *::before, *::after { box-sizing: border-box; }
    body { overflow-x: hidden !important; }
    header { width: 100% !important; box-sizing: border-box !important; }
    /* DRIVEO customer navbar — lock the same geometry on every public page.
       A three-column grid keeps the logo, centered navigation and right action
       anchored independently, so active links cannot push the whole navbar. */
    @media (min-width: 768px) {
      header > div:first-child {
        display: grid !important;
        grid-template-columns: minmax(0, 1fr) max-content minmax(0, 1fr) !important;
        align-items: center !important;
        width: min(100%, 1440px) !important;
        max-width: 1440px !important;
        min-width: 0 !important;
        height: 80px !important;
        margin-left: auto !important;
        margin-right: auto !important;
        padding-left: 48px !important;
        padding-right: 48px !important;
        box-sizing: border-box !important;
      }
      header > div:first-child > a:first-child { justify-self: start !important; }
      header > div:first-child > nav {
        justify-self: center !important;
        width: max-content !important;
        min-width: max-content !important;
      }
      header > div:first-child > div:last-child {
        justify-self: end !important;
        width: max-content !important;
        min-width: 0 !important;
        display: flex !important;
        align-items: center !important;
        justify-content: flex-end !important;
        margin: 0 !important;
      }
      header .driveo-auth-action-wrap {
        justify-self: end !important;
        margin-left: 0 !important;
      }
      /* Tempatkan LOGIN di sisi kanan navbar tanpa menggeser menu lain. */
      header > div:first-child {
        position: relative !important;
      }
      header .driveo-login-position-fix,
      header .driveo-auth-action-wrap {
        position: absolute !important;
        right: 48px !important;
        top: 50% !important;
        transform: translateY(-50%) !important;
        left: auto !important;
        margin: 0 !important;
      }
    }
    /* DRIVEO customer navbar — one shared visual system on every page */
    header nav { display: flex !important; align-items: center !important; gap: 2.15rem !important; }
    header nav a {
      position: relative !important;
      display: inline-flex !important;
      align-items: center !important;
      height: 80px !important;
      padding: 0 !important;
      margin: 0 !important;
      color: #111111 !important;
      font-family: Poppins, sans-serif !important;
      font-size: 12px !important;
      line-height: 1 !important;
      font-weight: 600 !important;
      letter-spacing: 0.08em !important;
      text-transform: uppercase !important;
      text-decoration: none !important;
      transition: color .2s ease !important;
    }
    header nav a,
    header nav a:hover,
    header nav a:focus,
    header nav a:active {
      background: transparent !important;
      box-shadow: none !important;
      outline-offset: 3px !important;
    }
    header nav a::before { content: none !important; display: none !important; }
    header nav a:hover { color: #FF0000 !important; }
    header nav a.driveo-vue-nav-active { color: #FF0000 !important; background: transparent !important; }
    header nav a.driveo-vue-nav-inactive { color: #111111 !important; }
    header nav a.driveo-vue-nav-active::after {
      content: '' !important;
      position: absolute !important;
      left: 0 !important;
      right: 0 !important;
      bottom: 0 !important;
      width: 100% !important;
      height: 2px !important;
      background: #FF0000 !important;
      display: block !important;
    }
    header nav a.driveo-vue-nav-inactive::after { display: none !important; }
    header nav a span.absolute { display: none !important; }
    header nav a.driveo-vue-nav-active span.absolute { display: none !important; }

    /* Keep the right-side action visually identical across customer pages. */
    header button[onclick*="openLoginModal"],
    header button#openLoginModal {
      min-height: 36px !important;
      padding: 0 20px !important;
      border: 1px solid #111111 !important;
      border-radius: 4px !important;
      color: #111111 !important;
      background: transparent !important;
      font-family: Poppins, sans-serif !important;
      font-size: 12px !important;
      line-height: 1 !important;
      font-weight: 600 !important;
      letter-spacing: 0.08em !important;
      text-transform: uppercase !important;
      box-shadow: none !important;
    }
    header button[onclick*="openLoginModal"]:hover,
    header button#openLoginModal:hover {
      color: #ffffff !important;
      background: #111111 !important;
      border-color: #111111 !important;
    }
    /* Shared auth state: no redesign of the existing navbar, only its right action. */
    .driveo-auth-action-wrap {
      display: inline-flex !important;
      align-items: center !important;
      justify-content: flex-end !important;
      width: max-content !important;
      box-sizing: border-box !important;
    }
    .driveo-auth-user-button {
      display: inline-flex !important; align-items: center !important; justify-content: center !important;
      gap: 8px !important; min-height: 38px !important; padding: 0 2px 0 4px !important;
      border: 0 !important; background: transparent !important; color: #111 !important;
      font-family: Poppins, sans-serif !important; font-size: 12px !important; font-weight: 600 !important;
      letter-spacing: .01em !important; cursor: pointer !important; white-space: nowrap !important;
    }
    .driveo-user-icon { width: 30px !important; height: 30px !important; display: inline-flex !important; align-items: center !important; justify-content: center !important; border: 1px solid #D8D8D8 !important; border-radius: 50% !important; flex: 0 0 30px !important; }
    .driveo-user-icon svg { width: 17px !important; height: 17px !important; }
    .driveo-user-greeting { overflow: hidden !important; text-overflow: ellipsis !important; max-width: 150px !important; }
    .driveo-user-chevron { width: 13px !important; height: 13px !important; flex: 0 0 13px !important; }
    .driveo-auth-dropdown { display: none; position: absolute; top: calc(100% + 10px); right: 0; width: 220px; padding: 15px; background: #fff; border: 1px solid #E8E8E8; border-radius: 10px; box-shadow: 0 16px 35px rgba(0,0,0,.10); z-index: 100; font-family: Poppins,sans-serif; }
    .driveo-auth-dropdown.driveo-auth-dropdown-open { display: block !important; }
    .driveo-auth-dropdown-name { font-size: 13px; font-weight: 700; color: #111; }
    .driveo-auth-dropdown-email { margin-top: 3px; font-size: 10px; color: #888; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .driveo-auth-dropdown-divider { height: 1px; background: #EEE; margin: 12px 0 9px; }
    .driveo-auth-logout { width: 100%; text-align: left; border: 0; background: transparent; padding: 8px 0; color: #111; font: 600 11px Poppins,sans-serif; cursor: pointer; }
    .driveo-auth-logout:hover, .driveo-auth-dashboard:hover { color: #FF0000; }
    .driveo-auth-dashboard { display:block; width:100%; padding:9px 0; text-align:left; border:0; background:transparent; color:#111; font:600 11px Poppins,sans-serif; cursor:pointer; }
    .driveo-mobile-menu-button { display: none; }
    .driveo-admin-mobile-menu { display: none; }
    @media (max-width: 767px) {
      /* Admin uses its own compact white popover; never reveal the legacy drawer
         or create a page-dimming pseudo-element from the outer Vue shell. */
      html.driveo-admin-menu-open aside,
      html.driveo-admin-menu-open::after {
        transform: translateX(-110%) !important;
        display: none !important;
        content: none !important;
        box-shadow: none !important;
      }
      body { overflow-x: hidden !important; }
      .driveo-admin-mobile-menu {
        display: inline-flex !important;
        align-items: center !important;
        justify-content: center !important;
        width: 38px !important;
        height: 38px !important;
        flex: 0 0 38px !important;
        margin-left: 8px !important;
        margin-right: 0 !important;
        border: 1px solid #EAEAEA !important;
        border-radius: 6px !important;
        background: #fff !important;
        color: #111 !important;
        font-size: 19px !important;
        cursor: pointer !important;
      }
      .driveo-admin-mobile-menu .driveo-menu-close { display: none; }
      html.driveo-admin-menu-open .driveo-admin-mobile-menu .driveo-menu-open { display: none; }
      html.driveo-admin-menu-open .driveo-admin-mobile-menu .driveo-menu-close { display: inline; }
      aside { transform: translateX(-100%) !important; transition: transform .25s ease !important; width: 250px !important; }
      body > div.flex-1 { margin-left: 0 !important; width: 100% !important; }
      header { padding-left: 12px !important; padding-right: 12px !important; position:relative !important; }
      header > div:first-child { display:flex !important; flex-wrap:nowrap !important; align-items:center !important; justify-content:space-between !important; gap:8px !important; }
      header > div:first-child { min-width: 0 !important; }
    }
    @media (max-width: 767px) {
      header > div { padding-left: 16px !important; padding-right: 16px !important; height: 64px !important; display:flex !important; flex-wrap:nowrap !important; align-items:center !important; justify-content:space-between !important; gap:8px !important; }
      header > div > a:first-child, header > div > div:first-child { flex:0 1 auto !important; min-width:0 !important; }
      header > div > nav { display:none !important; }
      header nav a { -webkit-tap-highlight-color: transparent; }
      header .driveo-mobile-menu-button {
        display: inline-flex !important;
        align-items: center !important;
        justify-content: center !important;
        width: 40px !important;
        height: 40px !important;
        padding: 0 !important;
        margin-left: 10px !important;
        border: 1px solid #E5E7EB !important;
        border-radius: 6px !important;
        background: #fff !important;
        color: #111 !important;
        font-size: 20px !important;
        line-height: 1 !important;
        cursor: pointer !important;
      }
      header .driveo-mobile-menu-button .driveo-menu-close { display: none; }
      header.driveo-mobile-open .driveo-mobile-menu-button .driveo-menu-open { display: none; }
      header.driveo-mobile-open .driveo-mobile-menu-button .driveo-menu-close { display: inline; }
      header nav.driveo-mobile-nav {
        display: none !important;
        position: absolute !important;
        top: 64px !important;
        left: 0 !important;
        right: 0 !important;
        width: 100% !important;
        height: auto !important;
        padding: 8px 16px 14px !important;
        margin: 0 !important;
        flex-direction: column !important;
        align-items: stretch !important;
        gap: 0 !important;
        background: #fff !important;
        border-bottom: 1px solid #E5E7EB !important;
        box-shadow: 0 8px 20px rgba(0,0,0,.06) !important;
        z-index: 60 !important;
      }
      header.driveo-mobile-open nav.driveo-mobile-nav { display: flex !important; }
      header nav.driveo-mobile-nav a {
        width: 100% !important;
        height: 44px !important;
        padding: 0 4px !important;
        justify-content: flex-start !important;
        border-bottom: 0 !important;
      }
      header nav.driveo-mobile-nav a.driveo-vue-nav-active::after { display: none !important; }
      header nav.driveo-mobile-nav a.driveo-vue-nav-active { color: #FF0000 !important; }
      header nav.driveo-mobile-nav a::after { display: none !important; }
      header .driveo-mobile-menu-button { display: inline-flex !important; flex:0 0 40px !important; margin-left:0 !important; margin-right:0 !important; order:3 !important; }
      header .driveo-auth-action-wrap { order:2 !important; flex:0 1 auto !important; margin-left:auto !important; }
      header .driveo-mobile-menu-button { margin-left:0 !important; }
      header .driveo-auth-action-wrap { margin-left: auto !important; max-width: 180px !important; }
      header .driveo-user-greeting { max-width: 92px !important; }
      header .driveo-auth-user-button { font-size: 11px !important; gap: 6px !important; }
      header .driveo-auth-dropdown { position: fixed !important; top: 72px !important; right: 12px !important; width: min(220px, calc(100vw - 24px)) !important; }
      header > div { gap: 8px !important; }
      main, section, footer { max-width: 100% !important; box-sizing: border-box !important; }
      img, video, svg { max-width: 100%; }
      table { display: block !important; width: 100% !important; max-width: 100% !important; overflow-x: auto !important; }
      input, select, textarea, button { max-width: 100%; }
      h1 { font-size: clamp(1.85rem, 8vw, 3rem) !important; line-height: 1.08 !important; }
      h2 { font-size: clamp(1.45rem, 6vw, 2.2rem) !important; line-height: 1.12 !important; }
      p { line-height: 1.6 !important; }
      .fixed.inset-0 { overflow-y: auto !important; -webkit-overflow-scrolling: touch !important; align-items: center !important; justify-content: center !important; padding: 12px !important; }
    }

    /* Footer fix shared by every customer page: no literal gap after the footer. */
    html, body { height: auto !important; min-height: 100% !important; margin: 0 !important; padding-bottom: 0 !important; }
    body { display: flex !important; flex-direction: column !important; min-height: 100vh !important; height: auto !important; overflow-x: hidden !important; }
    body > footer { margin-top: auto !important; flex: 0 0 auto !important; width: 100% !important; }
    .driveo-register-link { color: #FF0000 !important; }

    /* Shared login overlay: always above the navbar and centered on mobile. */
    #loginModal, #login-modal, #loginModalOverlay, #login-modal-overlay {
      position: fixed !important;
      inset: 0 !important;
      z-index: 2147483000 !important;
      align-items: center !important;
      justify-content: center !important;
      overflow-x: hidden !important;
      overflow-y: auto !important;
      box-sizing: border-box !important;
      padding: 12px !important;
      isolation: isolate !important;
    }
    #loginModal > div, #login-modal > div, #loginModalOverlay > div, #login-modal-overlay > div {
      width: 100% !important;
      max-width: 340px !important;
      max-height: calc(100dvh - 24px) !important;
      overflow-x: hidden !important;
      overflow-y: auto !important;
      overscroll-behavior: contain !important;
      box-sizing: border-box !important;
      flex-shrink: 0 !important;
    }
    header { z-index: 40 !important; }
    header nav.driveo-mobile-nav { z-index: 41 !important; }
    @media (max-width: 767px) {
      #loginModal, #login-modal, #loginModalOverlay, #login-modal-overlay {
        align-items: center !important;
        padding: 12px !important;
      }
      #loginModal > div, #login-modal > div, #loginModalOverlay > div, #login-modal-overlay > div {
        max-height: calc(100dvh - 24px) !important;
        border-radius: 16px !important;
      }
    }
  `
  if (route.path === '/beranda' || route.path === '/') {
    style.textContent += `\n@media (min-width: 768px) { #login-modal > div { max-width: 395px !important; } }\n@media (max-width: 767px) { #login-modal > div { max-width: 340px !important; } }`;
  }
  doc.head.appendChild(style)

  doc.querySelectorAll('#loginModal a, #login-modal a').forEach((link) => {
    if (/^daftar$/i.test((link.textContent || '').trim())) link.classList.add('driveo-register-link')
  })

  // Remove the unused password-recovery link consistently on every page.
  doc.querySelectorAll('a').forEach((link) => {
    if (/lupa\s+password/i.test((link.textContent || '').replace(/\s+/g, ' ').trim())) link.remove()
  })

  // Standardize the customer header shell and login label across every page.
  const header = doc.querySelector('header')
  const headerInner = header?.querySelector(':scope > div')
  if (headerInner) {
    headerInner.style.maxWidth = '1440px'
    headerInner.style.width = '100%'
    headerInner.style.height = '80px'
    headerInner.style.marginLeft = 'auto'
    headerInner.style.marginRight = 'auto'
    headerInner.style.paddingLeft = '48px'
    headerInner.style.paddingRight = '48px'
    headerInner.style.boxSizing = 'border-box'
  }
  // Admin navbar and hamburger are authored in stitch-pages/admin.html.
  // Keep the original control and its own popover event handlers intact.
  // Responsive mobile navigation for customer pages only.
  if (route.path !== '/admin' && header && headerInner) {
    const nav = header.querySelector('nav')
    if (nav) {
      nav.classList.add('driveo-mobile-nav')
      // Remove legacy/duplicate hamburger controls so the shared navbar owns exactly one.
      header.querySelectorAll('button').forEach((candidate) => {
        if (candidate.classList.contains('driveo-mobile-menu-button')) return
        const label = `${candidate.getAttribute('aria-label') || ''} ${candidate.getAttribute('title') || ''} ${candidate.textContent || ''}`.toLowerCase()
        const looksLikeMenu = /☰|≡|hamburger|mobile menu|buka menu|menu navigasi/.test(label)
        const svg = candidate.querySelector('svg')
        const hasThreeBars = svg && [...svg.querySelectorAll('path,line')].filter((shape) => {
          const d = shape.getAttribute('d') || ''
          return /M[0-9., -]+H[0-9., -]+/.test(d) || /M[0-9., -]+L[0-9., -]+/.test(d)
        }).length >= 3
        if (looksLikeMenu || hasThreeBars) candidate.remove()
      })
      let mobileButton = header.querySelector('.driveo-mobile-menu-button')
      if (!mobileButton) {
        mobileButton = doc.createElement('button')
        mobileButton.type = 'button'
        mobileButton.className = 'driveo-mobile-menu-button'
        mobileButton.setAttribute('aria-label', 'Buka menu')
        mobileButton.setAttribute('aria-expanded', 'false')
        mobileButton.innerHTML = '<span class="driveo-menu-open">☰</span><span class="driveo-menu-close">×</span>'
        headerInner.appendChild(mobileButton)
        mobileButton.addEventListener('click', (event) => {
          event.preventDefault()
          event.stopPropagation()
          const open = header.classList.toggle('driveo-mobile-open')
          mobileButton.setAttribute('aria-expanded', String(open))
        })
      }
    }
  }

  setActiveNav(doc)
  syncFrameScrollLock(doc)

  cleanupFrames.set(url, () => {
    doc.removeEventListener('click', onClick, true)
    style.remove()
  })

  // Remove legacy LOGIN controls synchronously before revealing each public
  // iframe, so they cannot flash while the session endpoint is loading.
  if (url !== '/stitch-pages/admin.html' && url !== '/stitch-pages/admin-login.html') {
    installAuthUI(doc, { authenticated: false, user: null })
  }

  // Authentication is deliberately non-blocking: it must never hold the
  // destination page hidden while the session endpoint responds.
  if (url !== '/stitch-pages/admin.html' && url !== '/stitch-pages/admin-login.html') {
    fetchDriveoSession()
      .then((sessionData) => {
        if (frameElements.get(url)?.contentDocument === doc) {
          installAuthUI(doc, sessionData)
        }
      })
      .catch(() => {})
  }
}

function onFrameLoad(url = pageUrl.value) {
  const activeElement = frameElements.get(url)
  loadedFrameUrls.add(url)
  if (!activeElement) return

  const doc = activeElement.contentDocument
  if (!doc) return

  installFrameNavigation(url, doc)

  if (url !== pageUrl.value) return
  frame.value = activeElement
  activeFrameUrl.value = url
  const docForActiveFrame = doc
  if (url === '/stitch-pages/detail-mobil.html' && route.query.id) {
    const loadDetail = frame.value?.contentWindow?.loadDriveoDetailFromAPI
    if (typeof loadDetail === 'function') loadDetail(String(route.query.id))
  }
  if (observer) observer.disconnect()
  const modal = docForActiveFrame?.getElementById('login-modal')
  if (modal) {
    observer = new MutationObserver(() => {
      syncFrameScrollLock()
    })
    observer.observe(modal, { attributes: true, attributeFilter: ['class'] })
  }

  // Reveal the page only after navigation/auth setup has finished. The page's
  // HTML, CSS, layout, and all feature code remain unchanged.
  readyFrameUrls.value = new Set([...readyFrameUrls.value, url])
}

function forwardWheel(event) {
  const win = frame.value?.contentWindow
  const doc = frame.value?.contentDocument
  if (!win || !doc) return
  const modal = doc.getElementById('login-modal')
  if (modal && !modal.classList.contains('hidden')) return
  if (doc.documentElement.scrollHeight <= doc.documentElement.clientHeight) return
  win.scrollBy({ top: event.deltaY, left: event.deltaX, behavior: 'auto' })
  event.preventDefault()
}

function handleFrameMessage(event) {
  if (event.origin !== window.location.origin) return
  if (event.data?.type === 'DRIVEO_NAVIGATE_ADMIN') {
    router.push('/admin')
    return
  }
  if (event.data?.type === 'DRIVEO_ADMIN_LOGIN_SUCCESS') {
    sessionStorage.setItem('driveo_admin_authenticated', 'true')
    router.push('/admin')
    return
  }
  if (event.data?.type === 'DRIVEO_LOGIN_SUCCESS') {
    sessionStorage.setItem('driveo_user', JSON.stringify(event.data.user || {}))
    const doc = frame.value?.contentDocument
    if (doc) installAuthUI(doc, { authenticated: true, user: event.data.user || {} })
    return
  }
  if (event.data?.type === 'DRIVEO_LOGOUT_SUCCESS') {
    sessionStorage.removeItem('driveo_user')
    sessionStorage.removeItem('driveo_admin_authenticated')
    sessionStorage.removeItem('driveo_token')
    if (route.path === '/admin' || event.data?.wasAdmin) {
      router.push('/')
    } else {
      const doc = frame.value?.contentDocument
      if (doc) installAuthUI(doc, { authenticated: false, user: null })
    }
    return
  }
  if (event.data?.type === 'DRIVEO_ADMIN_LOGOUT') {
    sessionStorage.removeItem('driveo_admin_authenticated')
    sessionStorage.removeItem('driveo_user')
    sessionStorage.removeItem('driveo_token')
    router.push('/admin-login')
  }
  if (event.data?.type === 'NAVIGATE_TO_SCREEN') {
    const text = String(event.data.target || '')
    if (text.includes('SCREEN_6')) router.push('/katalog')
    else if (text.includes('SCREEN_7')) router.push('/kontak')
    else if (text.includes('SCREEN_15')) router.push('/tentang-kami')
    else if (text.includes('SCREEN_16')) router.push('/beranda')
  }
}

onMounted(() => {
  // Start all page documents early. Each iframe gets its own one-time setup
  // on load, so navigation does not rebuild styles/listeners or wait for auth.
  ensureCachedFrame(pageUrl.value)
  ;[
    '/stitch-pages/beranda.html',
    '/stitch-pages/tentang-kami.html',
    '/stitch-pages/katalog.html',
    '/stitch-pages/detail-mobil.html',
    '/stitch-pages/kontak.html',
  ].forEach((url) => ensureCachedFrame(url))
  window.addEventListener('wheel', forwardWheel, { passive: false })
  window.addEventListener('message', handleFrameMessage)
})

onBeforeUnmount(() => {
  window.removeEventListener('wheel', forwardWheel)
  window.removeEventListener('message', handleFrameMessage)
  if (observer) observer.disconnect()
  cleanupFrames.forEach((cleanup) => cleanup())
  cleanupFrames.clear()
})
</script>

<template>
  <iframe
    v-for="entry in cachedFrames"
    :key="entry.url"
    :ref="(el) => setFrameElement(entry.url, el)"
    :src="entry.url"
    :class="{ 'stitch-frame-active': entry.url === activeFrameUrl && readyFrameUrls.has(entry.url) }"
    class="stitch-frame"
    :title="`DRIVEO ${entry.url.split('/').pop()}`"
    scrolling="yes"
    @load="onFrameLoad(entry.url)"
  />
</template>
