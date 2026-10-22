import { createApp } from 'vue'
import 'bootstrap/dist/css/bootstrap.min.css'
import './assets/main.css'
import './assets/anatomy.css'
import App from './App.vue'
import router from './router.js'

createApp(App).use(router).mount('#app')
