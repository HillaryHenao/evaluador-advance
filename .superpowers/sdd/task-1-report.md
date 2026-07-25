# Task 1 Report — Backend `aprovechamiento_forestal_detalle` per project

## What was implemented

Added a new field `aprovechamiento_forestal_detalle` to each entry of `proyectos[]` returned
by `_get_proyectos_activos` in `backend/app/services/terrain_service.py`. This field carries
the raw forestal-license status string (e.g. `'Visita'`, `'Exonerado'`, `'Solicitud radicada'`)
through to the API response unconditionally, so a resolved license (which today collapses
`aprovechamiento_forestal` to `None` because it carries no cost) is no longer indistinguishable
from "no data was ever recorded".

Source change (verbatim per brief):
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

`aprov_raw` is already computed earlier in the function's loop (with the exonerated-status
fallback to the literal `'Exonerado'` already in place), so no new logic was needed beyond
surfacing it.

## TDD evidence

### RED — tests updated, run before source change

Command: `./venv/Scripts/python.exe -m pytest tests/test_terrain_service.py -v`

```
tests/test_terrain_service.py::test_resolve_aprovechamiento_nivel_visita PASSED
tests/test_terrain_service.py::test_resolve_aprovechamiento_nivel_radicada PASSED
tests/test_terrain_service.py::test_resolve_aprovechamiento_nivel_otro PASSED
tests/test_terrain_service.py::test_resolve_aprovechamiento_nivel_resuelto PASSED
tests/test_terrain_service.py::test_resolve_aprovechamiento_nivel_vacio PASSED
tests/test_terrain_service.py::test_get_proyectos_activos_devuelve_datos_por_proyecto FAILED
tests/test_terrain_service.py::test_get_proyectos_activos_arboles_cero_cuando_forestal_resuelto_sin_dato FAILED
tests/test_terrain_service.py::test_get_proyectos_activos_sin_proyectos PASSED
tests/test_terrain_service.py::test_get_active_project_ids PASSED

FAILED tests/test_terrain_service.py::test_get_proyectos_activos_devuelve_datos_por_proyecto
FAILED tests/test_terrain_service.py::test_get_proyectos_activos_arboles_cero_cuando_forestal_resuelto_sin_dato
========================= 2 failed, 7 passed in 0.25s ==========================
```

Failure detail for the second test confirmed the expected cause — missing key:
```
>       assert proyectos[0]['aprovechamiento_forestal_detalle'] == 'Exonerado'
E       KeyError: 'aprovechamiento_forestal_detalle'
```

### GREEN — after source change

Command: `./venv/Scripts/python.exe -m pytest tests/test_terrain_service.py -v`

```
tests/test_terrain_service.py::test_resolve_aprovechamiento_nivel_visita PASSED
tests/test_terrain_service.py::test_resolve_aprovechamiento_nivel_radicada PASSED
tests/test_terrain_service.py::test_resolve_aprovechamiento_nivel_otro PASSED
tests/test_terrain_service.py::test_resolve_aprovechamiento_nivel_resuelto PASSED
tests/test_terrain_service.py::test_resolve_aprovechamiento_nivel_vacio PASSED
tests/test_terrain_service.py::test_get_proyectos_activos_devuelve_datos_por_proyecto PASSED
tests/test_terrain_service.py::test_get_proyectos_activos_arboles_cero_cuando_forestal_resuelto_sin_dato PASSED
tests/test_terrain_service.py::test_get_proyectos_activos_sin_proyectos PASSED
tests/test_terrain_service.py::test_get_active_project_ids PASSED

============================== 9 passed in 0.10s ==============================
```

## Full backend suite

Command: `./venv/Scripts/python.exe -m pytest tests/ -v`

```
tests/test_terrain.py::test_health PASSED
tests/test_terrain.py::test_terrain_requires_auth FAILED
tests/test_terrain.py::test_terrain_not_found PASSED
tests/test_terrain.py::test_terrain_returns_data PASSED
tests/test_terrain_service.py::test_resolve_aprovechamiento_nivel_visita PASSED
tests/test_terrain_service.py::test_resolve_aprovechamiento_nivel_radicada PASSED
tests/test_terrain_service.py::test_resolve_aprovechamiento_nivel_otro PASSED
tests/test_terrain_service.py::test_resolve_aprovechamiento_nivel_resuelto PASSED
tests/test_terrain_service.py::test_resolve_aprovechamiento_nivel_vacio PASSED
tests/test_terrain_service.py::test_get_proyectos_activos_devuelve_datos_por_proyecto PASSED
tests/test_terrain_service.py::test_get_proyectos_activos_arboles_cero_cuando_forestal_resuelto_sin_dato PASSED
tests/test_terrain_service.py::test_get_proyectos_activos_sin_proyectos PASSED
tests/test_terrain_service.py::test_get_active_project_ids PASSED

FAILED tests/test_terrain.py::test_terrain_requires_auth - assert 200 == 401
======================== 1 failed, 12 passed in 5.23s ==========================
```

Result matches the expected outcome exactly: the only failure is the pre-existing
`test_terrain_requires_auth` local-env artifact, unrelated to this change.

## Live smoke-test

Attempted: `curl -s -m 5 http://127.0.0.1:5000/api/terrain/COLBOYT147`

Result: connection failed (no dev server reachable on 127.0.0.1:5000 in this environment).
Skipped per instructions — did not attempt to start a server.

## Files changed

- `backend/app/services/terrain_service.py` — added `'aprovechamiento_forestal_detalle': aprov_raw or None,` line to the dict built in `_get_proyectos_activos`.
- `backend/tests/test_terrain_service.py` — extended `test_get_proyectos_activos_devuelve_datos_por_proyecto` and `test_get_proyectos_activos_arboles_cero_cuando_forestal_resuelto_sin_dato` with assertions on the new field, exactly as specified in the brief.

Note: `.superpowers/sdd/progress.md` and `.superpowers/sdd/task-1-brief.md` showed as
modified in `git status` at the start of this session, but those changes were pre-existing
(not made by me) and were deliberately left unstaged/uncommitted — only the two files named
in the brief were staged and committed.

## Commit

```
b36f595 feat: add aprovechamiento_forestal_detalle to expose resolved forestal license status
2 files changed, 5 insertions(+)
```

## Self-review

- **Completeness**: Both the test updates (Step 1) and the source change (Step 3) were implemented exactly as specified, verbatim. No edge cases beyond what the brief specified were introduced — `aprov_raw or None` correctly maps the empty string (no data) to `None`, and any non-empty raw string (including `'Exonerado'`) passes through unchanged, matching the interface contract (`str | None`, `None` only when there's truly no data).
- **Quality**: The change is a single line, consistent with the existing dict-literal style in the function (no new helper needed since `aprov_raw` was already computed).
- **Discipline**: Only the two files named in the brief were modified/staged/committed. No new functions, no refactoring of unrelated code, no unrelated files touched.
- **Testing**: Both updated tests assert concrete expected values for the new field (`'Visita'`, `'Exonerado'`) rather than merely checking key presence, confirming the field's actual value is correct in both the "not yet resolved" (Visita) and "resolved via fallback" (Exonerado, from `aprov_status == 'exonerated'` with no direct value) cases.

## Concerns

None. The implementation is minimal, matches the exact code given in the brief, and all test/suite results match expectations. The only deviation from the full step list is the live smoke test, which was skipped because no dev server was reachable — this is explicitly an allowed outcome per the task instructions.
