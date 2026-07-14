import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { loginRequest } from '@/services/authService'
import type { AuthUser } from '@/types'

export const useAuthStore = defineStore('auth', () => {
  const user = ref<AuthUser | null>(null)
  const accessToken = ref<string | null>(localStorage.getItem('access_token'))

  const skipAuth = import.meta.env.VITE_SKIP_AUTH === 'true'
  const isAuthenticated = computed(() => skipAuth || (accessToken.value !== null && user.value !== null))

  async function login(username: string, password: string): Promise<void> {
    const tokens = await loginRequest(username, password)
    accessToken.value = tokens.access
    user.value = tokens.user
    localStorage.setItem('access_token', tokens.access)
    localStorage.setItem('refresh_token', tokens.refresh)
  }

  function logout(): void {
    accessToken.value = null
    user.value = null
    localStorage.removeItem('access_token')
    localStorage.removeItem('refresh_token')
  }

  return { user, accessToken, isAuthenticated, login, logout }
})
