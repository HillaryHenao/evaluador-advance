# Task 1 Brief: Scaffold del proyecto + tipos TypeScript

## Context
This is Task 1 of 10 for the **Evaluador Advance** — a new standalone Vue 3 app that calculates terrain cost overruns (sobrecostos) for solar minifarm projects. The git repo at `C:\Users\EQUIPO\Documents\Claude\evaluador-advance\` already exists with an empty commit. Your job is to scaffold the frontend, install all dependencies, create the central TypeScript types, set up CSS variables with Solé brand colors, and configure Vitest.

## Global Constraints
- Project root: `C:\Users\EQUIPO\Documents\Claude\evaluador-advance\`
- Frontend in `frontend/` subdirectory (NOT at root)
- TypeScript strict mode: `strict: true`
- Colors: Navy `#152644`, Navy-light `#1e3459`, Lemony `#E2FF65`, Nashville `#8EC3E1`, White `#ffffff`, Gray `#6b7280`, Orange `#f97316`
- Font: Montserrat via Google Fonts
- Tests: Vitest with happy-dom
- Use PowerShell for all commands (Windows environment)

## Files to Create/Modify
- `frontend/` — scaffold via `npm create vite@latest frontend -- --template vue-ts`
- `frontend/src/types/index.ts` — all TypeScript interfaces
- `frontend/src/assets/main.css` — CSS reset + CSS variables + Montserrat import
- `frontend/src/main.ts` — entry point wiring Vue + Pinia + Router
- `frontend/vite.config.ts` — add Vitest config + path alias `@` → `src`

## Steps

### Step 1: Scaffold frontend with Vite
```powershell
cd "C:\Users\EQUIPO\Documents\Claude\evaluador-advance"
npm create vite@latest frontend -- --template vue-ts
cd frontend
npm install
```

### Step 2: Install runtime dependencies
```powershell
npm install pinia vue-router axios
```

### Step 3: Install dev dependencies
```powershell
npm install -D vitest @vitest/ui @vue/test-utils happy-dom
```

### Step 4: Install shadcn-vue
```powershell
npx shadcn-vue@latest init
```
Select when prompted: TypeScript → Yes, base color → neutral, CSS variables → Yes. If it asks for framework, choose Vite.

### Step 5: Create `src/types/index.ts` with this exact content:
```typescript
export type CriterionValue = number | boolean | string | null

export interface EvalContext {
  baseCapex: number
  kWp: number
}

export interface CriterionResult {
  id: string
  label: string
  value: CriterionValue
  sobrecosto: number
  formulaDefined: boolean
  fromDb: boolean
}

export interface AggregatedResult {
  totalSobrecosto: number
  capexTotal: number
  breakdown: CriterionResult[]
}

export interface SelectOption {
  value: string
  label: string
}

export interface CriterionModule {
  id: string
  label: string
  inputType: 'number' | 'toggle' | 'select'
  unit?: string
  dataSource: 'manual' | 'db' | 'db_or_manual'
  dbField?: string
  options?: SelectOption[]
  formulaDefined: boolean
  computeCost: (value: CriterionValue, context: EvalContext) => number
}

export interface TerrainData {
  code: string
  name: string
  municipality: string
  distancia_via: number | null
  distancia_red: number | null
  or: string | null
  nivel_tension: string | null
  cluster: number | null
  tipo_estructura: string | null
  ocupacion_cauce: boolean | null
  servidumbre: string | null
  aprovechamiento_forestal: string | null
  coexistencias: boolean | null
}

export interface AuthUser {
  pk: number
  username: string
  email: string
  first_name: string
  last_name: string
  groups: string[]
}

export interface AuthTokens {
  access: string
  refresh: string
  user: AuthUser
}
```

### Step 6: Create `src/assets/main.css` with this exact content:
```css
@import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@300;400;500;700&display=swap');

:root {
  --color-navy: #152644;
  --color-navy-light: #1e3459;
  --color-lemony: #E2FF65;
  --color-nashville: #8EC3E1;
  --color-white: #ffffff;
  --color-gray: #6b7280;
  --color-orange: #f97316;
}

* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

body {
  font-family: 'Montserrat', sans-serif;
  background-color: var(--color-navy);
  color: var(--color-white);
  min-height: 100vh;
}
```

### Step 7: Replace `src/main.ts` with:
```typescript
import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import './assets/main.css'

const app = createApp(App)
app.use(createPinia())
app.use(router)
app.mount('#app')
```

Note: `router` doesn't exist yet (Task 5). Create a placeholder at `src/router/index.ts`:
```typescript
import { createRouter, createWebHistory } from 'vue-router'

const router = createRouter({
  history: createWebHistory(),
  routes: [],
})

export default router
```

### Step 8: Replace `vite.config.ts` with:
```typescript
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: { '@': resolve(__dirname, 'src') },
  },
  test: {
    environment: 'happy-dom',
    globals: true,
  },
})
```

Also add to `tsconfig.app.json` (or `tsconfig.json`) under `compilerOptions`:
```json
{
  "compilerOptions": {
    "strict": true,
    "paths": {
      "@/*": ["./src/*"]
    }
  }
}
```

### Step 9: Replace `src/App.vue` with minimal shell:
```vue
<script setup lang="ts">
</script>

<template>
  <RouterView />
</template>
```

### Step 10: Verify TypeScript compiles
```powershell
npx tsc --noEmit
```
Fix any type errors before committing.

### Step 11: Commit
```powershell
cd "C:\Users\EQUIPO\Documents\Claude\evaluador-advance"
git add frontend/
git commit -m "chore: scaffold Vue 3 + TS + Vite frontend with Sole brand tokens and central types"
```

## Report Contract
Write your full report to: `C:\Users\EQUIPO\Documents\Claude\evaluador-advance\.superpowers\sdd\task-1-report.md`

Include:
- Status: DONE | DONE_WITH_CONCERNS | NEEDS_CONTEXT | BLOCKED
- Files created/modified
- Any deviations from the brief and why
- `npx tsc --noEmit` output (must be clean)
- Final commit hash(es)

Return ONLY: status word, commit hash(es), one-line test summary, and any concerns.
