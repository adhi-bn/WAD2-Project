import { createRouter, createWebHistory } from 'vue-router'
import HomeView from '../views/HomeView.vue'
import BuilderView from '../views/BuilderView.vue'
import AboutView from '../views/AboutView.vue'

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', name: 'home', component: HomeView },
    { path: '/builder', name: 'builder', component: BuilderView },
    { path: '/about', name: 'about', component: AboutView },
  ],
})
