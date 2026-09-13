# Kế hoạch shared self-review contract

## Trạng thái và quyền hạn

- Trạng thái: `ready_for_implementation`.
- Mode: `NORMAL`.
- Base: `9034f772e2d419d399a45bbb2cd84968a383b9d0` trên branch `feat/shared-self-review-contract`.
- Owner đã cho phép: viết và self-review plan này, tạo một local plan commit; sau khi plan pass, implement đúng plan, self-review implementation và tạo một local implementation commit.
- Không được phép: push, PR, merge, history rewrite, remote mutation, managed-role dispatch hoặc live model evaluation.

## Mục tiêu

Tạo một shared SSOT cho generic author self-review sao cho mọi contract material của Owner và owning repository source được trace tới candidate thực tế cùng current evidence, nhưng không biến Universal Lightweight Preflight hoặc small `NORMAL` work thành review ceremony.

## Governing sources

- Exact Owner direction trong workstream hiện tại: SR-1–SR-10, disposition H1–H12, conditional routing `AGENTS.md → agent-loops.md → shared self-review doc`, ownership boundary, read-once/reapply semantics, no-duplication rule và hai local commit checkpoint.
- `AGENTS.md`: simplicity, deterministic evidence, current governing-source inspection, one semantic owner, truthful verification và separate Git/remote authority.
- `docs/agent-loops.md`: universal preflight, mode/review-depth routing và Loop 1 checkpoint placement.
- Planning, repo-skill governance, code-review, testing, Git checkpoint và native workflow skills cùng các routed references đã được kích hoạt bởi scope này.

## Phạm vi

### Trong phạm vi

- Thêm `docs/agent-self-review.md` làm canonical generic methodology.
- Route tới shared document chỉ khi một applicable self-review boundary thực sự được reached.
- Reconcile planning, NORMAL/formal review và managed-author consumers mà không copy generic methodology.
- Giữ artifact/domain/Git/formal-review/native extensions tại current canonical owner.
- Cập nhật deterministic native contract coverage và bounded semantic eval definitions bị ảnh hưởng.

### Ngoài phạm vi

- Không tạo `.agents/skills/self-review/` hoặc bundled reference dưới `code-review-and-quality`.
- Không thay root preflight route trong `AGENTS.md`.
- Không thay formal review taxonomy/verdict, Specialist/fresh-reader/manual-QA trigger, Git procedure hoặc native Reviewer/round/artifact/session state machine.
- Không rewrite historical plans, progress, Owner briefs, review artifacts hoặc prior eval evidence.
- Không chạy model/fresh-reader/native smoke; deterministic eval preparation cũng không được gọi là semantic pass.

## Contract ledger

Mỗi contract dưới đây phải được implementation checkpoint disposition thành `implemented`, `already_satisfied` hoặc `not_applicable`, kèm exact source và evidence. Không tạo diff giả cho contract đã được canonical owner thỏa mãn.

| ID | Contract | Owning target | Acceptance / evidence |
| --- | --- | --- | --- |
| `SRC-01` | `AGENTS.md` luôn route tới `docs/agent-loops.md`; shared methodology không bị preload chỉ vì task có thể tạo candidate | `AGENTS.md` giữ nguyên; `docs/agent-loops.md` route có điều kiện | Root route vẫn nguyên; lifecycle wording chỉ load shared doc tại applicable self-review boundary |
| `SRC-02` | `docs/agent-loops.md` sở hữu activation, review depth và lifecycle placement; shared doc chỉ sở hữu generic author methodology | `docs/agent-loops.md`, `docs/agent-self-review.md` | Hai source có explicit non-overlapping ownership boundary |
| `SRC-03` | Đọc shared doc đầy đủ một lần cho mỗi relevant boundary; nhiều local extensions không tạo thêm read; candidate revision mới phải reapply affected method/evidence; chỉ reread khi contract/current context có thể stale | Shared doc, lifecycle route | Wording phân biệt `read`, `reapply`, `reread` và plan/implementation boundaries |
| `SRC-04` | Self-review bắt đầu bằng exact current governing source, scope, exclusions, acceptance và authority | Shared doc | Không cho phép review dựa trên memory, author summary hoặc intended design |
| `SRC-05` | Review actual current candidate/state/evidence, không review planned steps hoặc stale earlier candidate | Shared doc | Actual-candidate/currentness invariant hiện diện; exact Git/native identity ở local owner |
| `SRC-06` | Ordering là: anchor/currentness precheck → adversarial semantic review → affected deterministic verification + final reconciliation | Shared doc; lifecycle consumer placement | Không yêu cầu chạy toàn bộ expensive checks trước semantic review; không cho narrative override deterministic failure |
| `SRC-07` | Semantic review cố falsify candidate bằng bounded plausible material failure modes dựa trên governing contract, risk và affected boundaries | Shared doc | Không magic phrase, fixed count, durable registry hoặc invented defect |
| `SRC-08` | Deterministic question dùng deterministic evidence; valid unchanged evidence được reuse; rerun chỉ khi affected/currentness có thể invalidated | Shared doc; exact checks giữ tại test/Git/native owner | Shared doc sở hữu discipline, không copy exact command/check lists |
| `SRC-09` | Material/non-obvious readiness claim cần concrete current evidence; thiếu evidence giữ partial/unverified/blocked | Shared doc | Không citation ceremony cho trivial claims; deterministic fact được reference thay vì model re-argue |
| `SRC-10` | Trước conclusion, verify plausible remaining material rejection reason mạnh nhất nếu có | Shared doc | Final challenge bounded, proportional và không invent defect |
| `SRC-11` | Self-review không tạo independence/freshness và không thay mandatory Reviewer, Specialist, fresh-reader hoặc manual QA | Shared doc; exact enforcement giữ tại local owners | Generic boundary ngắn; local lifecycle evidence classes không bị xóa |
| `SRC-12` | Self-review PASS không cấp implementation, Git, remote hoặc lifecycle authority | Shared doc; lifecycle/Git/native owners | Không có transition/action permission mới từ self-review result |
| `SRC-13` | Depth tỷ lệ với semantic risk, affected boundaries, verification complexity và uncertainty | Shared doc; `docs/agent-loops.md` review depth | Không extra role/session/artifact/long report, unchanged rerun hoặc formal review chỉ vì file count |
| `SRC-14` | Consumer skills reference shared methodology và chỉ giữ artifact-specific extensions; không copy lại generic semantics | Planning, code-review và native consumers | Targeted duplication audit; shared generic semantics có một owner |
| `SRC-15` | Planning giữ completeness, dependency, acceptance, assumptions và verification-plan semantics | Planning durable-plan reference | Plan self-review route dùng shared method cùng planning extension; không xóa local safety/completeness checks |
| `SRC-16` | Native giữ Consumer→owner, Acceptance→evidence, prompt leakage, exact admission/currentness/artifact/session/round và failure consequences | Native core, reconciliation và scenario matrix | Failed pre-review vẫn return author, không dispatch Reviewer/mở round/consume correction round; generic method không cạnh tranh state owner |
| `SRC-17` | NORMAL small work consume shared method tại Loop 1 mà không đọc full formal-review skill; non-small/formal route vẫn dùng review owner khi applicable | Lifecycle and code-review consumer wording | Small scenario không activate unnecessary formal material; formal review vẫn giữ taxonomy/verdict owner |
| `SRC-18` | Verification bảo vệ routing, ownership split, ordering, native consequences, proportionality và no-independence claims | Native static test và existing planning/review eval suites | Deterministic tests/schema checks pass; live semantic execution được ghi `not_run` nếu không được phép |

## Expected implementation files

- `docs/agent-loops.md`
- `docs/agent-self-review.md`
- `.agents/skills/implementation-planning-and-pr-breakdown/references/tracked-program-and-durable-plan.md`
- `.agents/skills/code-review-and-quality/SKILL.md`
- `.agents/skills/native-multi-agent-workflow/SKILL.md`
- `.agents/skills/native-multi-agent-workflow/references/review-artifact-and-reconciliation.md`
- `.agents/skills/native-multi-agent-workflow/references/verification-scenarios.md`
- `.agents/scripts/native-multi-agent-workflow.test.mjs`
- `.agents/evals/implementation-planning-and-pr-breakdown/fresh-reader.json`
- `.agents/evals/code-review-and-quality/regression.json`

Không mở rộng file set nếu không có contract ID và concrete failure mode yêu cầu. Nếu repository reality buộc thay đổi material contract hoặc file owner, dừng với plan-contract mismatch thay vì tự sửa plan sau commit.

## Thứ tự implementation

1. Tạo shared methodology và lifecycle conditional route/ownership boundary.
2. Reconcile planning và code-review consumer wording, giữ local extensions.
3. Reconcile native author closure, review-opening consequence và scenario matrix.
4. Cập nhật native static contract test để load shared source và khóa ownership/routing/consequence.
5. Thêm bounded planning và self-authored implementation eval cases; không thay runner hoặc schema.
6. Lập implementation trace `contract ID → exact changed source → evidence/disposition`, rồi self-review cumulative diff.

## Verification

- `node --test .agents/scripts/native-multi-agent-workflow.test.mjs`
- `node .agents/scripts/validate-skill.mjs`
- `node --test .agents/scripts/validate-skill.test.mjs`
- `node .agents/scripts/run-skill-evals.mjs validate --skill implementation-planning-and-pr-breakdown`
- `node .agents/scripts/run-skill-evals.mjs validate --skill code-review-and-quality`
- Không gọi `prepare` hoặc `execute-prepared`; suite validation không phải model execution hoặc semantic pass.
- Audit Markdown links/headings, UTF-8/BOM, EOL, final newline, trailing whitespace, conflict markers và suspicious secrets theo existing repository patterns.
- `git diff --check`, exact changed-path audit, unstaged/staged/untracked audit và final staged diff trước mỗi commit.

## Plan self-review và completion gates

Trước plan commit:

1. Trace mọi Owner direction material tới ít nhất một contract ID.
2. Trace mọi contract ID ngược về Owner direction hoặc current repository necessity.
3. Đối chiếu actual plan với current repository owners, exclusions, authority và available verification.
4. Challenge missed contract, wrong owner/path, preflight preload, duplicate semantics, native consequence loss, excessive ceremony và unsupported evidence claims.
5. Chỉ chuyển status sang `ready_for_implementation` khi không còn material omission/conflict hoặc unsupported assumption.

Trước implementation commit:

1. Disposition đủ `SRC-01`–`SRC-18` với exact source/evidence.
2. Review actual cumulative diff và current checks, không dựa vào author summary.
3. Không còn Critical/Required finding trong main self-review/formal review depth áp dụng.
4. Live fresh-reader/model evidence chưa được phép phải giữ `not_run`; self-review không thay thế nó.
5. Chỉ commit intended implementation files; không push.
