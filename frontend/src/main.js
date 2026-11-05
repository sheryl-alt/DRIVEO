import { createApp } from 'vue'
import { createRouter, createWebHistory } from 'vue-router'
import App from './App.vue'
import './style.css'

const routes = [
  { path: '/', component: App },
  { path: '/beranda', component: App },
  { path: '/tentang-kami', component: App },
  { path: '/katalog', component: App },
  { path: '/detail-mobil', component: App },
  { path: '/kontak', component: App },
  { path: '/admin', component: App },
  { path: '/admin-login', component: App },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

const SESSION_URL = 'http://localhost:5000/api/auth/session'

router.beforeEach(async (to) => {
  if (to.path === '/admin-login') return true
  if (to.path !== '/admin') return true

  try {
    const token = sessionStorage.getItem('driveo_token') || ''
    const response = await fetch(SESSION_URL, {
      headers: {
        Accept: 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      }
    })
    const result = await response.json()
    if (result?.authenticated && result?.user?.role === 'admin') {
      sessionStorage.setItem('driveo_admin_authenticated', 'true')
      return true
    }
  } catch (error) {
    console.error('Pengecekan session admin gagal:', error)
  }

  sessionStorage.removeItem('driveo_admin_authenticated')
  return { path: '/admin-login' }
})

createApp(App).use(router).mount('#app')
