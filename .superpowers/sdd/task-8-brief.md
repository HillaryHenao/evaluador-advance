## Task 8: Integrar el panel en `EvaluadorView.vue` y verificar en el navegador

**Files:**
- Modify: `frontend/src/views/EvaluadorView.vue`

**Interfaces:**
- Consumes: `<FinancialResultsPanel />` (Task 7).

- [ ] **Step 1: Agregar el import**

En `frontend/src/views/EvaluadorView.vue`, junto a los demás imports de componentes:

```ts
import FinancialResultsPanel from '@/components/FinancialResultsPanel.vue'
```

- [ ] **Step 2: Ubicar el componente en el template**

El layout actual es:

```vue
    <div class="evaluador-body">
      <main class="evaluador-main">
        ...
      </main>
      <SummaryPanel />
    </div>
```

`.evaluador-body` ya es `display: flex`, `.evaluador-main` ya tiene `flex: 1`, y `SummaryPanel` ya trae su propio `width: 280px; min-width: 280px` — por lo que agregar una tercera columna de ancho fijo no requiere tocar ningún CSS, `FinancialResultsPanel` ya trae el mismo patrón de ancho fijo. Reemplaza ese bloque por:

```vue
    <div class="evaluador-body">
      <main class="evaluador-main">
        ...
      </main>
      <SummaryPanel />
      <FinancialResultsPanel />
    </div>
```

(el `...` representa el contenido existente de `<main>`, que no cambia).

- [ ] **Step 3: Reiniciar el servidor de desarrollo**

El watcher de archivos de Vite en este entorno no siempre detecta cambios hechos por herramientas de edición — reinicia el proceso para asegurar que recoja el cambio:

```bash
# Detener el proceso que esté escuchando en el puerto 5173 y luego:
cd "C:\Users\EQUIPO\Documents\Claude\evaluador-advance\frontend"
npm run dev
```

- [ ] **Step 4: Verificar manualmente en el navegador**

Abre `http://localhost:5173/`, busca el terreno **COLCEST11** (tiene arriendo y producción específica reales conocidos: 45,000,000 y 4.569 respectivamente). Confirma:
- El panel "Resultados financieros" aparece junto al resumen de costos.
- Muestra TIR, VPN y Payback (con y sin beneficios) con valores numéricos razonables (TIR entre 0% y 30% es un rango sano para este tipo de proyecto).
- Cambiar cualquier criterio (por ejemplo activar Pilotes) mueve el CAPEX y el panel financiero se recalcula solo, sin recargar la página.

- [ ] **Step 5: Commit**

```bash
cd "C:\Users\EQUIPO\Documents\Claude\evaluador-advance"
git add frontend/src/views/EvaluadorView.vue
git commit -m "feat: integrate FinancialResultsPanel into EvaluadorView"
```

---

## Resumen de dependencias entre tasks

```
Task 1 (backend) ─┐
Task 2 (tipos)  ───┼──> Task 6 (store) ──> Task 7 (panel) ──> Task 8 (integración)
Task 3 (math/data) ─> Task 4 (flujos) ─> Task 5 (resultados) ──┘
```

Tasks 1, 2 y 3 pueden hacerse en paralelo (no dependen entre sí). Task 4 depende de Task 3. Task 5 depende de Task 4. Task 6 depende de Tasks 2 y 5. Task 7 depende de Task 6. Task 8 depende de Task 7.
