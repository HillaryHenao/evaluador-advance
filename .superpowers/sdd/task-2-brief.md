# Task 2 Brief: Módulos de criterios (19)

## Context
Task 2 of 10. Task 1 scaffolded the frontend at `C:\Users\EQUIPO\Documents\Claude\evaluador-advance\frontend\` with all TypeScript types already defined in `src/types/index.ts`. Your job is to create 19 criterion module files in `src/criteria/` — 5 with cost formulas defined, 14 with `formulaDefined: false` — plus unit tests for the 5 with formulas.

## Global Constraints
- All files go in: `C:\Users\EQUIPO\Documents\Claude\evaluador-advance\frontend\src\criteria\`
- Use `import type { CriterionModule, CriterionValue, EvalContext } from '@/types'` (the `@` alias is configured)
- Each file exports `default` as a `CriterionModule` object — no named exports
- Tests go in `src/criteria/__tests__/criteria.test.ts`
- Run tests with: `cd frontend && npx vitest run src/criteria/__tests__/criteria.test.ts`
- All tests must PASS before committing
- Use PowerShell for terminal commands

## Files to Create
- `src/criteria/corte.ts` — formulaDefined: true
- `src/criteria/lleno.ts` — formulaDefined: true
- `src/criteria/pilotes.ts` — formulaDefined: true
- `src/criteria/distancia_red.ts` — formulaDefined: true
- `src/criteria/distancia_via.ts` — formulaDefined: true
- `src/criteria/nivel_tension.ts` — formulaDefined: false
- `src/criteria/cluster.ts` — formulaDefined: false
- `src/criteria/obras_hidraulicas.ts` — formulaDefined: false
- `src/criteria/disposicion_movimiento.ts` — formulaDefined: false
- `src/criteria/amenazas.ts` — formulaDefined: false
- `src/criteria/or.ts` — formulaDefined: false
- `src/criteria/propietario.ts` — formulaDefined: false
- `src/criteria/tipo_estructura.ts` — formulaDefined: false
- `src/criteria/ocupacion_cauce.ts` — formulaDefined: false
- `src/criteria/servidumbre.ts` — formulaDefined: false
- `src/criteria/aprovechamiento_forestal.ts` — formulaDefined: false
- `src/criteria/coexistencias.ts` — formulaDefined: false
- `src/criteria/numero_arboles.ts` — formulaDefined: false
- `src/criteria/comunidad.ts` — formulaDefined: false
- `src/criteria/__tests__/criteria.test.ts` — tests for the 5 defined criteria

## Cost Formulas (exact values)

### corte.ts
- id: 'corte', label: 'Corte', inputType: 'number', unit: 'm³', dataSource: 'manual'
- computeCost: `if (value === null || typeof value !== 'number') return 0; return value * 50_000`

### lleno.ts
- id: 'lleno', label: 'Lleno', inputType: 'number', unit: 'm³', dataSource: 'manual'
- computeCost: `if (value === null || typeof value !== 'number') return 0; return value * 250_000`

### pilotes.ts
- id: 'pilotes', label: 'Pilotes', inputType: 'toggle', dataSource: 'manual'
- computeCost: `if (value !== true) return 0; return 156_000_000`

### distancia_red.ts
- id: 'distancia_red', label: 'Distancia a la red', inputType: 'number', unit: 'm', dataSource: 'db', dbField: 'distancia_red'
- Tiered pricing: meters <= 99 → $509,000/m · <= 299 → $420,000/m · <= 499 → $380,000/m · <= 799 → $350,000/m · >= 800 → $312,500/m
- computeCost: `if (value === null || typeof value !== 'number' || value <= 0) return 0; return value * tieredCostPerMeter(value)`

### distancia_via.ts
- id: 'distancia_via', label: 'Distancia a la vía', inputType: 'number', unit: 'm', dataSource: 'db', dbField: 'distancia_via'
- computeCost: `if (value === null || typeof value !== 'number' || value <= 0) return 0; return value * 457_292`

## Pending Criteria (formulaDefined: false, computeCost returns 0)

### nivel_tension.ts
- id: 'nivel_tension', label: 'Nivel de tensión', inputType: 'select', dataSource: 'db', dbField: 'nivel_tension'
- options: [{value:'13.8kV',label:'13.8 kV'},{value:'34.5kV',label:'34.5 kV'},{value:'115kV',label:'115 kV'}]

### cluster.ts
- id: 'cluster', label: 'Cluster', inputType: 'number', unit: '# proyectos', dataSource: 'db', dbField: 'cluster'

### obras_hidraulicas.ts
- id: 'obras_hidraulicas', label: 'Obras hidráulicas', inputType: 'select', dataSource: 'manual'
- options: [{value:'ninguna',label:'Ninguna'},{value:'baja',label:'Baja'},{value:'media',label:'Media'},{value:'alta',label:'Alta'}]

### disposicion_movimiento.ts
- id: 'disposicion_movimiento', label: 'Disposición del movimiento', inputType: 'select', dataSource: 'manual'
- options: [{value:'en_sitio',label:'En sitio'},{value:'externo',label:'Externo'}]

### amenazas.ts
- id: 'amenazas', label: 'Amenazas', inputType: 'select', dataSource: 'manual'
- options: [{value:'baja',label:'Baja'},{value:'media',label:'Media'},{value:'alta',label:'Alta'}]

### or.ts
- id: 'or', label: 'Operador de Red', inputType: 'select', dataSource: 'db', dbField: 'or'
- options: AFINIA, ESSA, EPM, ENEL, EMCALI, ENERCA, CENS, CEDENAR

### propietario.ts
- id: 'propietario', label: 'Propietario', inputType: 'select', dataSource: 'manual'
- options: 5 stars to 1 star using ★ symbols

### tipo_estructura.ts
- id: 'tipo_estructura', label: 'Tipo de estructura', inputType: 'select', dataSource: 'db', dbField: 'tipo_estructura'
- options: [{value:'mesa_fija',label:'Mesa fija'},{value:'tracker',label:'Tracker'}]

### ocupacion_cauce.ts
- id: 'ocupacion_cauce', label: 'Ocupación de cauce', inputType: 'toggle', dataSource: 'db', dbField: 'ocupacion_cauce'

### servidumbre.ts
- id: 'servidumbre', label: 'Servidumbre', inputType: 'select', dataSource: 'db', dbField: 'servidumbre'
- options: own→Propia, public→Pública, foreign→Ajena, public_and_foreign→Pública y Ajena

### aprovechamiento_forestal.ts
- id: 'aprovechamiento_forestal', label: 'Aprovechamiento forestal', inputType: 'select', dataSource: 'db', dbField: 'aprovechamiento_forestal'
- options: Exonerado, CAR nivel 0.9/0.8/0.6/0.1

### coexistencias.ts
- id: 'coexistencias', label: 'Coexistencias', inputType: 'toggle', dataSource: 'db', dbField: 'coexistencias'

### numero_arboles.ts
- id: 'numero_arboles', label: 'Número de árboles', inputType: 'number', unit: 'árboles', dataSource: 'manual'

### comunidad.ts
- id: 'comunidad', label: 'Comunidad', inputType: 'select', dataSource: 'manual'
- options: sin_restriccion→Sin restricción, consulta_previa→Consulta previa, conflicto→Conflicto activo

## Test File Content

Create `src/criteria/__tests__/criteria.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import corte from '../corte'
import lleno from '../lleno'
import pilotes from '../pilotes'
import distanciaRed from '../distancia_red'
import distanciaVia from '../distancia_via'

const ctx = { baseCapex: 4_000_000_000, kWp: 1320 }

describe('corte', () => {
  it('calcula 50.000 COP por m³', () => {
    expect(corte.computeCost(100, ctx)).toBe(5_000_000)
  })
  it('retorna 0 para valor nulo', () => {
    expect(corte.computeCost(null, ctx)).toBe(0)
  })
  it('tiene formulaDefined true', () => {
    expect(corte.formulaDefined).toBe(true)
  })
})

describe('lleno', () => {
  it('calcula 250.000 COP por m³', () => {
    expect(lleno.computeCost(10, ctx)).toBe(2_500_000)
  })
  it('retorna 0 para valor nulo', () => {
    expect(lleno.computeCost(null, ctx)).toBe(0)
  })
})

describe('pilotes', () => {
  it('retorna 156.000.000 cuando es true', () => {
    expect(pilotes.computeCost(true, ctx)).toBe(156_000_000)
  })
  it('retorna 0 cuando es false', () => {
    expect(pilotes.computeCost(false, ctx)).toBe(0)
  })
})

describe('distancia_red', () => {
  it('aplica tarifa de 509.000/m para ≤99m', () => {
    expect(distanciaRed.computeCost(65, ctx)).toBe(65 * 509_000)
  })
  it('aplica tarifa de 420.000/m para tramo 100-299m', () => {
    expect(distanciaRed.computeCost(130, ctx)).toBe(130 * 420_000)
  })
  it('aplica tarifa de 380.000/m para tramo 300-499m', () => {
    expect(distanciaRed.computeCost(400, ctx)).toBe(400 * 380_000)
  })
  it('aplica tarifa de 350.000/m para tramo 500-799m', () => {
    expect(distanciaRed.computeCost(600, ctx)).toBe(600 * 350_000)
  })
  it('aplica tarifa de 312.500/m para ≥800m', () => {
    expect(distanciaRed.computeCost(1000, ctx)).toBe(1000 * 312_500)
  })
  it('retorna 0 para valor nulo', () => {
    expect(distanciaRed.computeCost(null, ctx)).toBe(0)
  })
})

describe('distancia_via', () => {
  it('calcula 457.292 COP por metro', () => {
    expect(distanciaVia.computeCost(100, ctx)).toBe(100 * 457_292)
  })
  it('retorna 0 para valor nulo', () => {
    expect(distanciaVia.computeCost(null, ctx)).toBe(0)
  })
})
```

## Steps
1. Create `src/criteria/` directory
2. Write all 19 criterion files (use the exact ids, labels, formulas above)
3. Write the test file
4. Run: `cd "C:\Users\EQUIPO\Documents\Claude\evaluador-advance\frontend" && npx vitest run src/criteria/__tests__/criteria.test.ts`
5. Fix any failures
6. Commit from repo root: `cd "C:\Users\EQUIPO\Documents\Claude\evaluador-advance" && git add frontend/src/criteria/ && git commit -m "feat: add 19 criterion modules (5 with formulas, 14 pending)"`

## Report Contract
Write full report to: `C:\Users\EQUIPO\Documents\Claude\evaluador-advance\.superpowers\sdd\task-2-report.md`

Include: status, files created, test output (command + result), commit hash(es), deviations.

Return ONLY: status, commit hash(es), test summary (X/Y passing), concerns.
