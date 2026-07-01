# Task 9 Report: Backend Flask

## Status: DONE

## Commit
2ea760d — feat: add Flask backend with terrain endpoint and JWT auth middleware

## Test Summary
4/4 passing

```
tests/test_terrain.py::test_health PASSED
tests/test_terrain.py::test_terrain_requires_auth PASSED
tests/test_terrain.py::test_terrain_not_found PASSED
tests/test_terrain.py::test_terrain_returns_data PASSED
```

## Concerns
One deviation from the brief: `require_auth` was moved from `jwt_validator.py` into `terrain.py` itself. The brief's version defined `require_auth` in `jwt_validator.py`, but because that decorator closes over the `validate_token` name in *its own* module scope, patching `app.routes.terrain.validate_token` had no effect and 2 tests failed with 401. Moving the decorator into `terrain.py` (where it calls the local `validate_token` import) makes the patch target work correctly. The `jwt_validator.py` file retains `validate_token` as the core decode function. A `pytest.ini` with `pythonpath = .` was added to resolve the `app` module import from the `tests/` directory.
