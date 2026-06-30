import axios from 'axios'
import type { TerrainData } from '@/types'

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:5000'

export async function fetchTerrainData(code: string, token: string): Promise<TerrainData> {
  const response = await axios.get<TerrainData>(`${API_BASE}/api/terrain/${code}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  return response.data
}
