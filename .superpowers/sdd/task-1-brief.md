## Task 1: Backend — producción específica y arriendo desde BD

**Files:**
- Modify: `backend/app/services/terrain_service.py`
- Modify: `backend/tests/test_terrain.py`

**Interfaces:**
- Produces: `get_terrain_data()` ahora incluye en el dict retornado las claves `produccion_especifica: float | None` y `arriendo_anual: float | None`, consumidas por Task 2 (tipo `TerrainData`).

- [ ] **Step 1: Agregar las columnas al SELECT principal**

En `backend/app/services/terrain_service.py`, dentro de la función `get_terrain_data`, en el bloque `SELECT` (busca la línea `t.name AS code,`), agrega justo después de `t.name AS code,`:

```sql
                    t.radiation                                 AS produccion_especifica,
```

Y agrega, junto a las demás subconsultas del SELECT (por ejemplo después del bloque de `numero_arboles_raw`), una nueva subconsulta:

```sql
                    (
                        SELECT ts.rent_annual_cost_cop
                        FROM termsheet_termsheet ts
                        WHERE ts.id = p.termsheet_id
                    )                                           AS arriendo_anual
```

(Recuerda agregar la coma que falte entre subconsultas al insertar esta — revisa que la penúltima subconsulta del SELECT termine en `,` y la última no.)

- [ ] **Step 2: Verificar manualmente contra la BD real**

```bash
cd "C:\Users\EQUIPO\Documents\Claude\evaluador-advance\backend"
./venv/Scripts/python.exe -c "
from app.services.terrain_service import get_terrain_data
import os
os.environ.setdefault('DATABASE_URL', 'postgresql://hillary:unergy2026*hillary@34.74.198.101:5432/originabotdb')
os.environ.setdefault('DATABASE_URL2', 'postgresql://hillary:unergy2026*hillary@34.74.198.101:5432/requestsdb')
d = get_terrain_data('COLCEST11')
print('produccion_especifica:', d.get('produccion_especifica'))
print('arriendo_anual:', d.get('arriendo_anual'))
"
```

Expected: `produccion_especifica: 4.569` y `arriendo_anual: 45000000.0` (valores conocidos de COLCEST11, verificados durante el diseño).

- [ ] **Step 3: Actualizar el mock de test existente**

En `backend/tests/test_terrain.py`, en `test_terrain_returns_data`, el diccionario `mock_data` debe incluir las 2 claves nuevas. Reemplaza:

```python
    mock_data = {
        'code': 'COLCEST5', 'name': 'Test', 'municipality': 'Aguachica',
        'distancia_via': 120, 'distancia_red': 350, 'or': 'AFINIA',
        'nivel_tension': '34.5 kV', 'cluster': 2, 'tipo_estructura': 'Tracker',
        'ocupacion_cauce': False, 'servidumbre': 'own',
        'aprovechamiento_forestal': 'Exonerado', 'coexistencias': False,
    }
```

con:

```python
    mock_data = {
        'code': 'COLCEST5', 'name': 'Test', 'municipality': 'Aguachica',
        'distancia_via': 120, 'distancia_red': 350, 'or': 'AFINIA',
        'nivel_tension': '34.5 kV', 'cluster': 2, 'tipo_estructura': 'Tracker',
        'ocupacion_cauce': False, 'servidumbre': 'own',
        'aprovechamiento_forestal': 'Exonerado', 'coexistencias': False,
        'produccion_especifica': 4.5287, 'arriendo_anual': 26275000.0,
    }
```

- [ ] **Step 4: Correr los tests del backend**

```bash
cd "C:\Users\EQUIPO\Documents\Claude\evaluador-advance\backend"
./venv/Scripts/python.exe -m pytest -q
```

Expected: `3 passed, 1 failed` (la falla es `test_terrain_requires_auth`, preexistente por `FLASK_ENV=development` sin `JWT_SECRET` en `.env` — no relacionada con este cambio).

- [ ] **Step 5: Commit**

```bash
cd "C:\Users\EQUIPO\Documents\Claude\evaluador-advance"
git add backend/app/services/terrain_service.py backend/tests/test_terrain.py
git commit -m "feat: expose produccion_especifica and arriendo_anual from platform data"
```

---

