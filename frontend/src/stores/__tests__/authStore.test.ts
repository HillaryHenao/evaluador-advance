import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useAuthStore } from '../authStore'
import * as authService from '@/services/authService'

const mockTokens = {
  access: 'access-token',
  refresh: 'refresh-token',
  user: {
    pk: 1,
    username: 'hillary',
    email: 'hillary@unergy.io',
    first_name: 'Hillary',
    last_name: 'Henao',
    groups: [],
  },
}

beforeEach(() => {
  setActivePinia(createPinia())
  localStorage.clear()
})

describe('useAuthStore', () => {
  it('inicia sin usuario autenticado', () => {
    const store = useAuthStore()
    expect(store.isAuthenticated).toBe(false)
    expect(store.user).toBeNull()
  })

  it('login exitoso guarda usuario y token', async () => {
    vi.spyOn(authService, 'loginRequest').mockResolvedValue(mockTokens)
    const store = useAuthStore()
    await store.login('hillary', 'pass')
    expect(store.isAuthenticated).toBe(true)
    expect(store.user?.username).toBe('hillary')
    expect(localStorage.getItem('access_token')).toBe('access-token')
  })

  it('logout limpia el store y localStorage', async () => {
    vi.spyOn(authService, 'loginRequest').mockResolvedValue(mockTokens)
    const store = useAuthStore()
    await store.login('hillary', 'pass')
    store.logout()
    expect(store.isAuthenticated).toBe(false)
    expect(store.user).toBeNull()
    expect(localStorage.getItem('access_token')).toBeNull()
  })
})
