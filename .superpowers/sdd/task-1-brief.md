### Task 1: Backend — `arriendo_anual` per project, terrain-wide sum instead of arbitrary pick

**Files:**
- Modify: `backend/app/services/terrain_service.py`
- Modify: `backend/tests/test_terrain_service.py`

**Interfaces:**
- Produces (used by Task 2): `proyectos[]` entries gain `arriendo_anual: float | None`. Top-level `TerrainData.arriendo_anual` changes from "one arbitrary active project's rent" to "sum of all active projects' rent" — same field name and type (`float | None`), only the underlying query changes.

- [ ] **Step 1: Write the failing tests**

Add to `backend/tests/test_terrain_service.py`, replacing the existing `test_get_proyectos_activos_devuelve_datos_por_proyecto` test (it needs `arriendo_anual` added to both the mock rows and the expected output — every other assertion in it stays the same):

Find:

```python
def test_get_proyectos_activos_devuelve_datos_por_proyecto():
    # COLSANT5: P1 en visita con 2 árboles, P2 exonerado con 0 árboles — cada uno con su
    # propio dato, sin funnel a un valor compartido del terreno.
    rows = [
        {
            'nombre': 'COLSANT5P1_GIRON_SUR',
            'distancia_via': 10.0, 'distancia_red': 30.0,
            'tipo_raw': '1P TRACKER', 'numero_arboles_raw': '2',
            'aprov_value': 'Visita', 'aprov_status': 'pending',
        },
        {
            'nombre': 'COLSANT5P2_GIRON_SUR',
            'distancia_via': 12.0, 'distancia_red': 28.0,
            'tipo_raw': 'MESA FIJA', 'numero_arboles_raw': '0',
            'aprov_value': None, 'aprov_status': 'exonerated',
        },
    ]
    with patch.object(terrain_service, '_connect', return_value=_mock_conn(rows)):
        proyectos = terrain_service._get_proyectos_activos(287)

    assert proyectos == [
        {
            'nombre': 'COLSANT5P1_GIRON_SUR', 'distancia_via': 10.0, 'distancia_red': 30.0,
            'tipo_estructura': 'tracker', 'numero_arboles': 2, 'aprovechamiento_forestal': 'visita',
        },
        {
            'nombre': 'COLSANT5P2_GIRON_SUR', 'distancia_via': 12.0, 'distancia_red': 28.0,
            'tipo_estructura': 'mesa_fija', 'numero_arboles': 0, 'aprovechamiento_forestal': None,
        },
    ]
```

Replace with:

```python
def test_get_proyectos_activos_devuelve_datos_por_proyecto():
    # COLSANT5: P1 en visita con 2 árboles, P2 exonerado con 0 árboles — cada uno con su
    # propio dato, sin funnel a un valor compartido del terreno. Cada uno también trae su
    # propio arriendo_anual (independiente, no se divide ni se comparte entre proyectos).
    rows = [
        {
            'nombre': 'COLSANT5P1_GIRON_SUR',
            'distancia_via': 10.0, 'distancia_red': 30.0,
            'tipo_raw': '1P TRACKER', 'numero_arboles_raw': '2',
            'aprov_value': 'Visita', 'aprov_status': 'pending',
            'arriendo_anual': 12_000_000.0,
        },
        {
            'nombre': 'COLSANT5P2_GIRON_SUR',
            'distancia_via': 12.0, 'distancia_red': 28.0,
            'tipo_raw': 'MESA FIJA', 'numero_arboles_raw': '0',
            'aprov_value': None, 'aprov_status': 'exonerated',
            'arriendo_anual': 8_000_000.0,
        },
    ]
    with patch.object(terrain_service, '_connect', return_value=_mock_conn(rows)):
        proyectos = terrain_service._get_proyectos_activos(287)

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

The other existing test in this file, `test_get_proyectos_activos_arboles_cero_cuando_forestal_resuelto_sin_dato`, does NOT need `arriendo_anual` added to its mock rows or assertions — it only asserts specific keys (`numero_arboles`, `aprovechamiento_forestal`), not full-dict equality, so it is unaffected by the new field and needs no change.

- [ ] **Step 2: Run tests to verify they fail**

Run (from `backend/`): `./venv/Scripts/python.exe -m pytest tests/test_terrain_service.py -v -k devuelve_datos_por_proyecto`

Expected: FAIL with `KeyError: 'arriendo_anual'` (the mock row doesn't have that key yet read by the real function — actually it will fail because `_get_proyectos_activos` doesn't return `arriendo_anual` in its dict yet, so the assertion `proyectos == [...]` fails on a dict-shape mismatch, not a KeyError from the mock's own dict access. Either way, it must fail before Step 3).

- [ ] **Step 3: Add `arriendo_anual` to `_get_proyectos_activos`**

Find (in `backend/app/services/terrain_service.py`, inside `_get_proyectos_activos`'s SQL query):

```python
                       (
                           SELECT vf.status FROM validation_field vf
                           WHERE vf.project_id = p.id
                             AND vf.name = 'Licencia de aprovechamiento forestal'
                           ORDER BY vf.id DESC LIMIT 1
                       )                                           AS aprov_status
                   FROM minifarm_project p
```

Replace with:

```python
                       (
                           SELECT vf.status FROM validation_field vf
                           WHERE vf.project_id = p.id
                             AND vf.name = 'Licencia de aprovechamiento forestal'
                           ORDER BY vf.id DESC LIMIT 1
                       )                                           AS aprov_status,
                       (
                           SELECT ts.rent_annual_cost_cop FROM termsheet_termsheet ts
                           WHERE ts.id = p.termsheet_id
                       )                                           AS arriendo_anual
                   FROM minifarm_project p
```

Find (the dict construction at the end of the function's loop):

```python
        proyectos.append({
            'nombre': r['nombre'],
            'distancia_via': r['distancia_via'],
            'distancia_red': r['distancia_red'],
            'tipo_estructura': tipo_estructura,
            'numero_arboles': numero_arboles,
            'aprovechamiento_forestal': _resolve_aprovechamiento_nivel(aprov_raw),
        })
```

Replace with:

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

- [ ] **Step 4: Run tests to verify they pass**

Run (from `backend/`): `./venv/Scripts/python.exe -m pytest tests/test_terrain_service.py -v`

Expected: PASS — all tests in this file.

- [ ] **Step 5: Change the terrain-wide `arriendo_anual` from "one arbitrary project" to "sum of active projects"**

This has no dedicated unit test (the function it lives in, `get_terrain_data`, is only covered by `test_terrain.py`'s route-level tests, which mock `get_terrain_data` entirely and don't exercise the real SQL) — the correctness of this SQL change is verified in Step 7 (full suite regression check) and Step 8 (live smoke test against the real database), consistent with how `cluster`'s existing aggregation subquery is handled in this same file.

Find (in `get_terrain_data`'s main SELECT):

```python
                    (
                        SELECT ts.rent_annual_cost_cop
                        FROM termsheet_termsheet ts
                        WHERE ts.id = p.termsheet_id
                    )                                           AS arriendo_anual
```

Replace with:

```python
                    (
                        SELECT SUM(ts.rent_annual_cost_cop)
                        FROM minifarm_project mp3
                        JOIN termsheet_termsheet ts ON ts.id = mp3.termsheet_id
                        WHERE mp3.terrain_id = t.id
                          AND mp3.stage NOT IN ('dead', 'paused', 'uci')
                    )                                           AS arriendo_anual
```

- [ ] **Step 6: Update `backend/tests/test_terrain.py`'s route-level mock (no code change needed, verify only)**

`test_terrain.py`'s `test_terrain_returns_data` mocks `get_terrain_data` entirely (it never calls the real SQL), so its `mock_data['proyectos'][0]` dict is unaffected by the backend changes above and does not need `arriendo_anual` added — but re-read the test now to confirm it still passes unchanged (it should; this step is a verification checkpoint, not a code change).

Run (from `backend/`): `./venv/Scripts/python.exe -m pytest tests/test_terrain.py -v`

Expected: PASS (except `test_terrain_requires_auth`, the pre-existing local-env artifact).

- [ ] **Step 7: Run the full backend suite**

Run (from `backend/`): `./venv/Scripts/python.exe -m pytest tests/ -v`

Expected: all pass except `test_terrain_requires_auth` (pre-existing local-env artifact, see Global Constraints).

- [ ] **Step 8: Smoke-test against the live dev backend**

If the backend dev server is running (`http://127.0.0.1:5000`), restart it (Flask debug mode auto-reloads on file save) and run:

```bash
curl -s http://127.0.0.1:5000/api/terrain/COLBOYT147
```

Expected: JSON response where each entry in `proyectos[]` now has an `arriendo_anual` key, and the top-level `arriendo_anual` equals the sum of both projects' individual `arriendo_anual` values (allowing for `null` if a project has no termsheet rent — `NULL` values are skipped by SQL `SUM`, only affecting the total if ALL active projects have no rent, in which case the top-level value is `null`).

- [ ] **Step 9: Commit**

```bash
git add backend/app/services/terrain_service.py backend/tests/test_terrain_service.py
git commit -m "fix: sum arriendo_anual across active projects instead of picking one arbitrary project"
```

---

