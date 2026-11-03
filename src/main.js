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
// loadRemoteCatalog() never throws; if it fails, the local catalog.js copy is used.
loadRemoteCatalog().then(() => {
  createApp(App).use(router).mount('#app')
})
