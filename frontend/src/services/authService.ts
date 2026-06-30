import axios from 'axios'
import type { AuthTokens } from '@/types'

export async function loginRequest(username: string, password: string): Promise<AuthTokens> {
  const response = await axios.post<AuthTokens>('https://auth.unergy.io/auth/login/', {
    username,
    password,
  })
  return response.data
}
