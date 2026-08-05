# ASM-PR3 — Bản tóm tắt để owner duyệt

Status: `planning artifact merged; explicit local implementation decision pending`.

Detailed specification: [plan.md](./plan.md).

Brief này là decision surface, không thay thế detailed plan. Planning commit `684b821` đã merge qua PR #69 tại `9a44f50`; current `feat/agent-skills-asm-pr3` được tạo từ synchronized main chỉ để setup và stale-doc correction. Chưa có skill/reference implementation permission hoặc implementation change. Program-level bounded advisory read-only fresh-reader permission đã tồn tại nhưng `not_run` trong planning hiện tại.

## Mục tiêu

Thực hiện controlled pilot cho `frontend-design`:

- giữ mandatory cross-cutting rules trong core;
- move nguyên nghĩa năm screen-type section sang năm reference;
- core chọn tất cả và chỉ reference khớp task;
- chứng minh behavior không regression bằng frozen 18-case suite, formal comparison và mandatory fresh reader;
- dừng ở owner `continue / revise / stop` gate trước ASM-PR4.

## Dependency và baseline

- Historical discovery branch/base: `docs/agent-skills-asm-pr3-planning` từ `06d8d5bae3c9e857767c2d988fd45c57449b1d4f`.
- Planning delivery: commit `684b821150c9e20a067a2e83dd8ad8514008dbfa`; PR #69 merge `9a44f5082242a982e487eb7d0c4e03068cf5af93`.
- Current implementation branch/base: `feat/agent-skills-asm-pr3` từ synchronized `main == origin/main == 9a44f50`.
- Behavioral baseline: ASM-PR2C merge `81f6c32e45e41fb8cc4bd84d67806fa70f8f2cdb`.
- PR #68 merge `06d8d5b` và planning PR #69 merge `9a44f50` không đổi `frontend-design` core hoặc suite trio; bốn Git blobs giống hệt tại `81f6c32`, `06d8d5b` và `9a44f50`.
- Focused suites: `3 files / 18 cases / 0 diagnostics`.
- Cumulative suites: `9 skills / 27 files / 177 cases / 0 diagnostics`.

## Proposed target bundle

```text
.agents/skills/frontend-design/
├── SKILL.md
└── references/
    ├── client-marketing.md
    ├── learning-experience.md
    ├── teacher-authoring.md
    ├── admin-business-operations.md
    └── shared-design-system-components.md
```

Core vẫn giữ activation, five-type classifier, overlap rule, related skills, guardrails, subject grounding, two-pass process, toàn bộ cross-cutting visual/layout/dialog/form/copy/state/motion/responsive/accessibility behavior, implementation boundary, final critique và output contract.

## Exact write boundary sau khi được duyệt

Implementation chỉ được chạm:

```text
.agents/skills/frontend-design/SKILL.md
.agents/skills/frontend-design/references/client-marketing.md
.agents/skills/frontend-design/references/learning-experience.md
.agents/skills/frontend-design/references/teacher-authoring.md
.agents/skills/frontend-design/references/admin-business-operations.md
.agents/skills/frontend-design/references/shared-design-system-components.md
docs/agent-skills/implementation-plans/asm-pr3/plan.md
docs/agent-skills/implementation-plans/asm-pr3/owner-review-brief.md
docs/agent-skills/progress.md
```

Eval suites, runner/tooling, tests, `AGENTS.md`, CI/package, other skills, product code/UI/test và database đều ngoài scope.

## Ordered gates

1. Re-establish clean synchronized implementation branch và frozen suite.
2. Capture pre-migration monolith observation tại `81f6c32`.
3. Move five existing sections + add exact core routing, không behavior rewrite.
4. Run validator/runner tests, structural validator, focused/all suite validation và hygiene audits.
5. Prepare formal current-tree-versus-`81f6c32` comparison; execute all 18 cases under equivalent conditions.
6. Run mandatory four-case fresh-reader gate: Learning-only, Admin+Shared overlap, non-UI near miss, Teacher-local Shared skip.
7. Record exact `available`/`supplied`/`read`/`unknown` resource evidence with honest access limits.
8. Main review + in-scope correction; require `0 Critical / 0 Required`.
9. Owner decides `continue / revise / stop`; ASM-PR4 stays blocked without explicit continue + merged ASM-PR3.

## Blocking rules

- Không sửa/weaken suite trong migration diff.
- Suite gap trước baseline → separate coverage correction rồi restart.
- Material regression, safety veto hoặc material `inconclusive` → stop.
- Synthetic package không được gọi là isolation.
- Self-report không được gọi là runtime enforcement.
- Không claim token saving hoặc native auto-trigger.
- Raw workspace, observations, bundle copies, report/transcript và absolute temp paths không commit.
- Plan approval không tự cấp implementation/Git/remote permission.

## Verification bắt buộc

```text
node --test .agents/scripts/validate-skill.test.mjs
node --test .agents/scripts/run-skill-evals.test.mjs
node .agents/scripts/validate-skill.mjs
node .agents/scripts/run-skill-evals.mjs validate --skill frontend-design
node .agents/scripts/run-skill-evals.mjs validate --all
git diff --check
```

Ngoài ra phải có complete comparative report, four mandatory fresh-reader passes, exact link/path/content/scope audits và empty suite/tooling/CI/product/DB diff.

## Quyết định owner cần ghi rõ

Chọn một:

- `Approve plan only` — duyệt material plan, chưa implement.
- `Approve plan and local implementation` — duyệt plan và cho phép exact CP2–CP8 local implementation/evaluation scope; Git/remote actions vẫn riêng trừ khi instruction nói rõ.
- `Revise` — nêu material decision cần đổi.
- `Stop` — không tiếp tục pilot.

Current decision: `local implementation CP2–CP8 pending explicit owner instruction`; planning merge và branch setup không tự cấp permission đó.
