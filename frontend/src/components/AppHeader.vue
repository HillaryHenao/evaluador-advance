<script setup lang="ts">
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/authStore'

const auth = useAuthStore()
const router = useRouter()

function handleLogout() {
  auth.logout()
  router.push({ name: 'login' })
}
</script>

<template>
  <header class="app-header">
    <div class="header-brand">
      <span class="header-logo">Solé</span>
      <span class="header-sep">·</span>
      <span class="header-title">Evaluador Advance</span>
    </div>
    <div class="header-user" v-if="auth.user">
      <span class="header-username">{{ auth.user.first_name }} {{ auth.user.last_name }}</span>
      <button class="header-logout" @click="handleLogout">Salir</button>
    </div>
  </header>
</template>

<style scoped>
.app-header {
  background: #13294B;
  border-bottom: 3px solid #D6E965;
  padding: 0 2rem;
  height: 60px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  position: sticky;
  top: 0;
  z-index: 100;
  box-shadow: 0 4px 24px rgba(19, 41, 75, 0.4);
}
.header-brand { display: flex; align-items: center; gap: 0.6rem; }
.header-logo {
  font-size: 1.3rem;
  font-weight: 800;
  color: #D6E965;
  letter-spacing: -0.3px;
}
.header-sep { color: #8EC8E9; opacity: 0.5; }
.header-title {
  font-size: 0.95rem;
  font-weight: 500;
  color: #8EC8E9;
}
.header-user { display: flex; align-items: center; gap: 1rem; }
.header-username { font-size: 0.85rem; color: rgba(255,255,255,0.7); }
.header-logout {
  background: transparent;
  border: 1px solid rgba(142, 200, 233, 0.35);
  color: #8EC8E9;
  border-radius: 6px;
  padding: 0.3rem 0.75rem;
  font-family: 'Montserrat', sans-serif;
  font-size: 0.8rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}
.header-logout:hover {
  background: #D6E965;
  border-color: #D6E965;
  color: #13294B;
}
</style>
