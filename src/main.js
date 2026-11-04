import { createApp } from 'vue'
import 'bootstrap/dist/css/bootstrap.min.css'
import './style.css'
import './assets/main.css'
import './assets/anatomy.css'
import './assets/about.css'
import './assets/compare.css'
import App from './App.vue'
import router from './router/index.js'
import { loadRemoteCatalog } from './data/remoteCatalog.js'

// Load the parts from Supabase before the first render, so every page sees the same catalogue.
// If the load fails, the local catalog.js copy is used. The app is mounted either way.
loadRemoteCatalog()
  .catch(() => {})
  .finally(() => {
    createApp(App).use(router).mount('#app')
  })
