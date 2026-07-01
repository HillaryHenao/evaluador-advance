# Task 4 Brief: Auth service + store Pinia

## Context
Task 4 of 10. Tasks 1-3 complete. The TypeScript types exist in `src/types/index.ts` (AuthUser, AuthTokens are already defined). Your job: build `authService.ts` (makes the HTTP call to auth.unergy.io) and `authStore.ts` (Pinia store that wraps it and persists JWT to localStorage).

## Global Constraints
- Work in `C:\Users\EQUIPO\Documents\Claude\evaluador-advance\frontend\`
- `@` alias = `src/`
- Tests use Vitest + happy-dom; run with `npx vitest run src/stores/__tests__/authStore.test.ts`
- All tests must pass before committing
- Use PowerShell for commands

## Files to Create
- `src/services/authService.ts`
- `src/stores/authStore.ts`
- `src/stores/__tests__/authStore.test.ts`

## Implementation

### src/services/authService.ts
```typescript
import axios from 'axios'
import type { AuthTokens } from '@/types'

export async function loginRequest(username: string, password: string): Promise<AuthTokens> {
  const response = await axios.post<AuthTokens>('https://auth.unergy.io/auth/login/', {
    username,
    password,
  })
  return response.data
}
```

### src/stores/authStore.ts
```typescript
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { loginRequest } from '@/services/authService'
import type { AuthUser } from '@/types'

export const useAuthStore = defineStore('auth', () => {
  const user = ref<AuthUser | null>(null)
  const accessToken = ref<string | null>(localStorage.getItem('access_token'))

  const isAuthenticated = computed(() => accessToken.value !== null && user.value !== null)

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
```

### src/stores/__tests__/authStore.test.ts
```typescript
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
```

## Steps
1. Create `src/services/` directory
2. Create `src/stores/__tests__/` directory
3. Write `authService.ts` and `authStore.ts`
4. Write the test file
5. Run tests: `cd "C:\Users\EQUIPO\Documents\Claude\evaluador-advance\frontend" && npx vitest run src/stores/__tests__/authStore.test.ts`
6. Fix any failures
7. Commit: `cd "C:\Users\EQUIPO\Documents\Claude\evaluador-advance" && git add frontend/src/services/authService.ts frontend/src/stores/authStore.ts frontend/src/stores/__tests__/ && git commit -m "feat: add auth service and Pinia store with JWT localStorage persistence"`

## Report Contract
Write full report to: `C:\Users\EQUIPO\Documents\Claude\evaluador-advance\.superpowers\sdd\task-4-report.md`

Return ONLY: status, commit hash(es), test summary (X/Y passing), concerns.
