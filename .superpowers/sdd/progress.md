# SDD Progress Ledger

Project: evaluador-advance — desglose-por-proyecto
Plan: docs/superpowers/plans/2026-07-11-desglose-por-proyecto.md
Branch: feature/desglose-por-proyecto
Started: 2026-07-11
Baseline commit: 5e0aa5f

Task 1: complete (commit 5e0aa5f..28cb3e3, backend proyectos[] + worst-case fixes; tests 11/12 pass — 1 pre-existing local-env auth failure per Global Constraints; smoke-tested against live dev backend on COLSANT5, confirmed proyectos[] with per-project numero_arboles)
Task 2: complete (commit 28cb3e3..a2ddd9d, CriterionScope/ProyectoData types + scope on all 18 criteria; review clean, all 18 scope values verified correct, vue-tsc shows only expected deferred errors in CriterionCard.vue/evaluatorStore.test.ts)
Task 3: complete (commit a2ddd9d..a4effb3, evaluateScoped + aggregateCosts null-filter fix; review clean, all 4 scope behaviors verified against brief; Minor: removed a stray unused @ts-expect-error comment, benign)

Decision (2026-07-14, Hillary): per-project VPN (perProjectFinancials) is ~35% below vpn_general/N because financialEngine.ts has 3 whole-terrain fixed costs (servicios públicos $18M/año, mantenimiento tracker $35-66M cada 5 años, reemplazo inversores $250M año 16) that don't scale with capex/kWp/kVA — dividing inputs by N and calling calcularFinanzas per project double-counts these. Decision: leave as-is, documented as known behavior (not a bug) — each project's VPN reflects paying its own full share of these fixed operational costs. Do NOT add a projectCount/scale param to financialEngine.ts under this plan.

Task 4: complete (commit a4effb3..43bab8c, perProjectValues/perProjectResults/perProjectFinancials/setPilotesForProyecto in evaluatorStore + SummaryPanel.vue filter fix; review clean; also fixed a stale pre-Task-1/2 mockTerrain fixture and loosened the VPN test tolerance per the human-approved financial-model decision above; Minor: PROYECTO_SCOPE_DB_FIELDS hand-maintained per brief, no test pins the zero-projects guard — both noted, not blockers)
Task 5: complete (commit 43bab8c..e88f2b1, CriterionCard.vue per-project rows/checkboxes for scope-proyecto criteria; review clean — reviewer independently traced the v-if/v-else-if chain and confirmed a real bug in the brief's literal Step 4 ordering: without the implementer's added `!isProyectoScope` guards on the number/toggle/select branches, the new per-project branches would have been unreachable dead code. Fix verified correct and minimal, other 12 criteria unaffected. No automated .vue tests in this repo — verified via vue-tsc + code trace against live backend; browser visual check still needs a human)
Task 6: complete (commit e88f2b1..f164d16, ProjectBreakdownPanel.vue + EvaluadorView.vue switched to store.aggregated.breakdown; review clean, all field shapes cross-checked against actual definitions, TIR/Payback shown once not per-project, no stale evaluateCriteria refs left; browser visual check still needs a human)

All 6 plan tasks complete.

Final whole-branch review (5e0aa5f..f164d16): READY TO MERGE WITH FIXES. No Critical. Important #1 (VITE_SKIP_AUTH not gated to DEV, broke authStore tests locally) — FIXED (commit 37fe8c6: DEV guard + vi.stubEnv in tests, 85/85 frontend tests green). Important #2 (nivel_tension worst-case-then-×N can overcharge a terrain with mixed-tension projects — plan-mandated, not an implementation bug) — human decision (Hillary, 2026-07-14): accept as documented known limitation, no code change. Minor items (per-project VPN identical across projects since capex is a terrain-average not truly per-project; select-type proyecto criteria show raw codes not labels; dbField now vestigial on proyecto-scope criteria) — logged as follow-ups, not blockers.

Branch: feature/desglose-por-proyecto — READY TO MERGE.
