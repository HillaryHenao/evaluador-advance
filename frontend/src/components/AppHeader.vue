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
  background-color: var(--color-navy);
  border-bottom: 1px solid rgba(226, 255, 101, 0.15);
  padding: 0 1.5rem;
  height: 56px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  position: sticky;
  top: 0;
  z-index: 100;
}
.header-brand { display: flex; align-items: center; gap: 0.75rem; }
.header-logo { font-size: 1.4rem; font-weight: 700; color: var(--color-lemony); }
.header-title { font-size: 0.9rem; font-weight: 500; color: var(--color-nashville); }
.header-user { display: flex; align-items: center; gap: 1rem; }
.header-username { font-size: 0.85rem; color: var(--color-white); }
.header-logout {
  background: transparent;
  border: 1px solid rgba(255,255,255,0.2);
  color: var(--color-white);
  border-radius: 4px;
  padding: 0.25rem 0.6rem;
  font-family: 'Montserrat', sans-serif;
  font-size: 0.8rem;
  cursor: pointer;
  transition: border-color 0.2s;
}
.header-logout:hover { border-color: var(--color-lemony); color: var(--color-lemony); }
</style>
