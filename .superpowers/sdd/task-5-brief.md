# Task 5 Brief: Vue Router + LoginView

## Context
Task 5 of 10. Tasks 1-4 complete. `useAuthStore` exists in `src/stores/authStore.ts`. Your job: replace the placeholder router with a real one that has an auth guard, build LoginView.vue with Solé brand styling, and create a placeholder EvaluadorView.vue.

## Global Constraints
- Work in `C:\Users\EQUIPO\Documents\Claude\evaluador-advance\frontend\`
- No tests required for this task (UI task — test in browser manually)
- Colors: Navy `#152644`, Navy-light `#1e3459`, Lemony `#E2FF65`, Nashville `#8EC3E1`
- Font: Montserrat (already imported via main.css)
- Use PowerShell for commands

## Files to Modify/Create
- **Modify**: `src/router/index.ts` (currently a placeholder with empty routes)
- **Create**: `src/views/LoginView.vue`
- **Create**: `src/views/EvaluadorView.vue` (placeholder only)

## Implementation

### src/router/index.ts (replace existing placeholder)
```typescript
import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/authStore'
import LoginView from '@/views/LoginView.vue'
import EvaluadorView from '@/views/EvaluadorView.vue'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/login', name: 'login', component: LoginView },
    { path: '/', name: 'evaluador', component: EvaluadorView, meta: { requiresAuth: true } },
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
})

router.beforeEach((to) => {
  const auth = useAuthStore()
  if (to.meta.requiresAuth && !auth.isAuthenticated) {
    return { name: 'login' }
  }
  if (to.name === 'login' && auth.isAuthenticated) {
    return { name: 'evaluador' }
  }
})

export default router
```

### src/views/LoginView.vue
```vue
<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/authStore'

const username = ref('')
const password = ref('')
const error = ref('')
const loading = ref(false)

const router = useRouter()
const auth = useAuthStore()

async function handleLogin() {
  error.value = ''
  loading.value = true
  try {
    await auth.login(username.value, password.value)
    await router.push({ name: 'evaluador' })
  } catch {
    error.value = 'Credenciales incorrectas. Intenta de nuevo.'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="login-container">
    <div class="login-card">
      <div class="login-logo">
        <span class="login-logo-text">Solé</span>
      </div>
      <h1 class="login-title">Evaluador Advance</h1>
      <form @submit.prevent="handleLogin" class="login-form">
        <div class="login-field">
          <label for="username">Usuario</label>
          <input
            id="username"
            v-model="username"
            type="text"
            placeholder="usuario"
            autocomplete="username"
            required
          />
        </div>
        <div class="login-field">
          <label for="password">Contraseña</label>
          <input
            id="password"
            v-model="password"
            type="password"
            placeholder="••••••••"
            autocomplete="current-password"
            required
          />
        </div>
        <p v-if="error" class="login-error">{{ error }}</p>
        <button type="submit" :disabled="loading" class="login-btn">
          {{ loading ? 'Ingresando...' : 'Ingresar' }}
        </button>
      </form>
    </div>
  </div>
</template>

<style scoped>
.login-container {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: var(--color-navy);
}
.login-card {
  background-color: var(--color-navy-light);
  border: 1px solid rgba(226, 255, 101, 0.2);
  border-radius: 12px;
  padding: 2.5rem;
  width: 100%;
  max-width: 380px;
}
.login-logo {
  text-align: center;
  margin-bottom: 0.5rem;
}
.login-logo-text {
  font-size: 2rem;
  font-weight: 700;
  color: var(--color-lemony);
  letter-spacing: -0.02em;
}
.login-title {
  text-align: center;
  font-size: 1rem;
  font-weight: 500;
  color: var(--color-nashville);
  margin-bottom: 2rem;
}
.login-form { display: flex; flex-direction: column; gap: 1rem; }
.login-field { display: flex; flex-direction: column; gap: 0.4rem; }
.login-field label { font-size: 0.85rem; font-weight: 500; color: var(--color-nashville); }
.login-field input {
  background: rgba(255,255,255,0.05);
  border: 1px solid rgba(255,255,255,0.15);
  border-radius: 6px;
  padding: 0.6rem 0.8rem;
  color: var(--color-white);
  font-family: 'Montserrat', sans-serif;
  font-size: 0.9rem;
  outline: none;
  transition: border-color 0.2s;
}
.login-field input:focus { border-color: var(--color-lemony); }
.login-error { color: #f87171; font-size: 0.82rem; text-align: center; }
.login-btn {
  margin-top: 0.5rem;
  background-color: var(--color-lemony);
  color: var(--color-navy);
  border: none;
  border-radius: 6px;
  padding: 0.7rem;
  font-family: 'Montserrat', sans-serif;
  font-weight: 700;
  font-size: 0.9rem;
  cursor: pointer;
  transition: opacity 0.2s;
}
.login-btn:disabled { opacity: 0.6; cursor: not-allowed; }
</style>
```

### src/views/EvaluadorView.vue (placeholder)
```vue
<script setup lang="ts">
</script>

<template>
  <div style="padding: 2rem; color: white;">
    <p>Evaluador (placeholder — Task 8)</p>
  </div>
</template>
```

## Steps
1. Replace `src/router/index.ts` with the real router (exact code above)
2. Create `src/views/LoginView.vue` (exact code above)
3. Create `src/views/EvaluadorView.vue` (placeholder)
4. Run TypeScript check: `cd "C:\Users\EQUIPO\Documents\Claude\evaluador-advance\frontend" && npx tsc --noEmit`
5. Fix any TS errors
6. Commit: `cd "C:\Users\EQUIPO\Documents\Claude\evaluador-advance" && git add frontend/src/router/ frontend/src/views/ && git commit -m "feat: add Vue Router with auth guard and LoginView"`

## Report Contract
Write report to: `C:\Users\EQUIPO\Documents\Claude\evaluador-advance\.superpowers\sdd\task-5-report.md`

Return ONLY: status, commit hash(es), one-line summary, concerns.
