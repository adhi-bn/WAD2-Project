import { createRouter, createWebHistory } from 'vue-router'
import { state, finishQuiz } from '../store.js'
import HomeView from '../views/HomeView.vue'
import KnowView from '../views/KnowView.vue'
import QuizView from '../views/QuizView.vue'
import PartsView from '../views/PartsView.vue'
import SummaryView from '../views/SummaryView.vue'
import CartView from '../views/CartView.vue'
import CheckoutView from '../views/CheckoutView.vue'
import ConfirmView from '../views/ConfirmView.vue'
import AccountView from '../views/AccountView.vue'
import AboutView from '../views/AboutView.vue'
import PrivacyView from '../views/PrivacyView.vue'
import TermsView from '../views/TermsView.vue'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', name: 'home', component: HomeView },
    { path: '/know', name: 'know', component: KnowView },
    { path: '/swipe', name: 'swipe', component: QuizView },
    { path: '/parts', name: 'parts', component: PartsView, meta: { needsBuild: true } },
    { path: '/build', name: 'build', component: SummaryView, meta: { needsBuild: true } },
    { path: '/cart', name: 'buy', component: CartView },
    { path: '/checkout', name: 'checkout', component: CheckoutView, meta: { needsCart: true } },
    { path: '/order/:id', name: 'order', component: ConfirmView },
    { path: '/account', name: 'account', component: AccountView },
    // Builder picks live in PartsView; keep the old URL working.
    { path: '/builder', redirect: '/parts' },
    { path: '/about', name: 'about', component: AboutView },
    { path: '/privacy', name: 'privacy', component: PrivacyView },
    { path: '/terms', name: 'terms', component: TermsView },
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
  scrollBehavior() {
    return { top: 0 }
  },
})

// Parts and Build need a recommended build first, so send people to the swipe cards.
// Checkout needs something in the cart.
router.beforeEach((to) => {
  if (to.name === 'parts' && !state.build) finishQuiz()
  if (to.meta.needsBuild && !state.build) return '/swipe'
  if (to.meta.needsCart && state.cart.length === 0) return '/cart'
  return true
})
router.afterEach((to) => { state.reached[to.name] = true })

export default router
