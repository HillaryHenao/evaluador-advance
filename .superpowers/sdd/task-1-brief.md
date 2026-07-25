### Task 1: Backend — `aprovechamiento_forestal_detalle` per project

**Files:**
- Modify: `backend/app/services/terrain_service.py`
- Modify: `backend/tests/test_terrain_service.py`

**Interfaces:**
- Produces (used by Task 2): `proyectos[]` entries gain `aprovechamiento_forestal_detalle: str | None` — the raw forestal-license status text (e.g. `"Exonerado"`, `"Visita"`, `"Solicitud radicada"`), `None` only when there's truly no data.

- [ ] **Step 1: Write the failing tests**

Update `test_get_proyectos_activos_devuelve_datos_por_proyecto` in `backend/tests/test_terrain_service.py`:

Find:
```python
    assert proyectos == [
        {
            'nombre': 'COLSANT5P1_GIRON_SUR', 'distancia_via': 10.0, 'distancia_red': 30.0,
            'tipo_estructura': 'tracker', 'numero_arboles': 2, 'aprovechamiento_forestal': 'visita',
            'arriendo_anual': 12_000_000.0,
        },
        {
            'nombre': 'COLSANT5P2_GIRON_SUR', 'distancia_via': 12.0, 'distancia_red': 28.0,
            'tipo_estructura': 'mesa_fija', 'numero_arboles': 0, 'aprovechamiento_forestal': None,
            'arriendo_anual': 8_000_000.0,
        },
    ]
```

Replace:
```python
    assert proyectos == [
        {
            'nombre': 'COLSANT5P1_GIRON_SUR', 'distancia_via': 10.0, 'distancia_red': 30.0,
            'tipo_estructura': 'tracker', 'numero_arboles': 2, 'aprovechamiento_forestal': 'visita',
            'aprovechamiento_forestal_detalle': 'Visita',
            'arriendo_anual': 12_000_000.0,
        },
        {
            'nombre': 'COLSANT5P2_GIRON_SUR', 'distancia_via': 12.0, 'distancia_red': 28.0,
            'tipo_estructura': 'mesa_fija', 'numero_arboles': 0, 'aprovechamiento_forestal': None,
            'aprovechamiento_forestal_detalle': 'Exonerado',
            'arriendo_anual': 8_000_000.0,
        },
    ]
```

(P2's mock row has `'aprov_value': None, 'aprov_status': 'exonerated'` — the existing fallback in `_get_proyectos_activos` already turns that into the raw string `'Exonerado'` before resolving the nivel; this test just also asserts that raw string now surfaces in the new field instead of being discarded.)

Update `test_get_proyectos_activos_arboles_cero_cuando_forestal_resuelto_sin_dato` in the same file:

Find:
```python
    assert proyectos[0]['numero_arboles'] == 0
    assert proyectos[0]['aprovechamiento_forestal'] is None
    assert proyectos[1]['numero_arboles'] is None
    assert proyectos[1]['aprovechamiento_forestal'] == 'visita'
```

Replace:
```python
    assert proyectos[0]['numero_arboles'] == 0
    assert proyectos[0]['aprovechamiento_forestal'] is None
    assert proyectos[0]['aprovechamiento_forestal_detalle'] == 'Exonerado'
    assert proyectos[1]['numero_arboles'] is None
    assert proyectos[1]['aprovechamiento_forestal'] == 'visita'
    assert proyectos[1]['aprovechamiento_forestal_detalle'] == 'Visita'
```

- [ ] **Step 2: Run tests to verify they fail**

Run (from `backend/`): `./venv/Scripts/python.exe -m pytest tests/test_terrain_service.py -v`

Expected: FAIL on both updated tests — `aprovechamiento_forestal_detalle` isn't a key in the dicts `_get_proyectos_activos` returns yet.

- [ ] **Step 3: Add `aprovechamiento_forestal_detalle` to `_get_proyectos_activos`**

Find (in `backend/app/services/terrain_service.py`, the dict construction at the end of the function's loop):

```python
        proyectos.append({
            'nombre': r['nombre'],
            'distancia_via': r['distancia_via'],
            'distancia_red': r['distancia_red'],
            'tipo_estructura': tipo_estructura,
            'numero_arboles': numero_arboles,
            'aprovechamiento_forestal': _resolve_aprovechamiento_nivel(aprov_raw),
            'arriendo_anual': r['arriendo_anual'],
        })
```

Replace:

```python
        proyectos.append({
            'nombre': r['nombre'],
            'distancia_via': r['distancia_via'],
            'distancia_red': r['distancia_red'],
            'tipo_estructura': tipo_estructura,
            'numero_arboles': numero_arboles,
            'aprovechamiento_forestal': _resolve_aprovechamiento_nivel(aprov_raw),
            'aprovechamiento_forestal_detalle': aprov_raw or None,
            'arriendo_anual': r['arriendo_anual'],
        })
```

- [ ] **Step 4: Run tests to verify they pass**

Run (from `backend/`): `./venv/Scripts/python.exe -m pytest tests/test_terrain_service.py -v`

Expected: PASS — all tests in this file.

- [ ] **Step 5: Run the full backend suite**

Run (from `backend/`): `./venv/Scripts/python.exe -m pytest tests/ -v`

Expected: all pass except `test_terrain_requires_auth` (pre-existing local-env artifact).

- [ ] **Step 6: Smoke-test against the live dev backend**

If the backend dev server is running (`http://127.0.0.1:5000`), restart it and run:

```bash
curl -s http://127.0.0.1:5000/api/terrain/COLBOYT147
```

Expected: both entries in `proyectos[]` now show `"aprovechamiento_forestal_detalle": "Exonerado"`.

- [ ] **Step 7: Commit**

```bash
git add backend/app/services/terrain_service.py backend/tests/test_terrain_service.py
git commit -m "feat: add aprovechamiento_forestal_detalle to expose resolved forestal license status"
```

---

