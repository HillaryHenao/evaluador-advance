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
      <div class="login-brand">
        <span class="login-logo">Solé</span>
        <span class="login-subtitle">Evaluador Advance</span>
      </div>
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
  background: var(--bg);
}

.login-card {
  background: var(--card);
  border: 1.5px solid var(--border);
  border-radius: 18px;
  padding: 2.5rem;
  width: 100%;
  max-width: 380px;
  box-shadow: 0 8px 40px rgba(145, 91, 216, 0.12);
}

.login-brand {
  text-align: center;
  margin-bottom: 2rem;
}
.login-logo {
  display: block;
  font-size: 2.2rem;
  font-weight: 800;
  color: var(--purple);
  letter-spacing: -0.02em;
}
.login-subtitle {
  font-size: 0.85rem;
  font-weight: 500;
  color: var(--muted);
  margin-top: 0.2rem;
  display: block;
}

.login-form { display: flex; flex-direction: column; gap: 1rem; }
.login-field { display: flex; flex-direction: column; gap: 0.4rem; }
.login-field label {
  font-size: 0.78rem;
  font-weight: 700;
  color: var(--text-mid);
  text-transform: uppercase;
  letter-spacing: 0.8px;
}
.login-field input {
  background: #faf8fe;
  border: 1.5px solid var(--border);
  border-radius: 9px;
  padding: 0.65rem 0.9rem;
  color: var(--text);
  font-family: 'Montserrat', sans-serif;
  font-size: 0.9rem;
  outline: none;
  transition: border-color 0.2s, box-shadow 0.2s;
}
.login-field input:focus {
  border-color: var(--purple);
  box-shadow: 0 0 0 3px rgba(145, 91, 216, 0.15);
  background: #fff;
}

.login-error {
  color: var(--red);
  font-size: 0.82rem;
  text-align: center;
  background: rgba(220, 38, 38, 0.07);
  padding: 0.4rem;
  border-radius: 7px;
}

.login-btn {
  margin-top: 0.5rem;
  background: var(--purple);
  color: #fff;
  border: none;
  border-radius: 9px;
  padding: 0.75rem;
  font-family: 'Montserrat', sans-serif;
  font-weight: 700;
  font-size: 0.9rem;
  cursor: pointer;
  transition: all 0.2s;
}
.login-btn:hover { background: var(--purple-deep); }
.login-btn:disabled { opacity: 0.5; cursor: not-allowed; }
</style>
