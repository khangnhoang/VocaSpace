# CP3 — exact canary manifest và live grant request

Ngày prepare: `2026-09-07`.

## Trạng thái

- `preparation`: `complete`; hai comparison run đã được prepare bằng current harness ở `abfb70ab3555e44a852a1096ae62a47ab3550143`.
- `manifest`: exact, dùng ceiling mặc định 4 cases và pair B/C cụ thể bên dưới để owner review.
- `live_authority`: `not_granted`.
- `execution`: `not_run`; mọi dispatch reader/evaluator thực tế là `0`.
- `billing_auth_mode`: `not_observed`; prepare không gửi provider request và không đọc credential.
- `model_provider_evaluator_calls`: `0`.

Pair/ref hoặc membership đổi sau manifest này thì phải prepare lại hai run; không sửa tay `run.json`, execution plan, unit state hoặc prepared input.

## Package và control plane đã pin

Canary dùng `supabase-safe-migration`, comparison mode, variant `A = baseline`, `B = candidate`:

| Source | Requested/resolved ref | Source bundle hash | Exact files |
| --- | --- | --- | --- |
| Baseline | `2be02df11e279b5c88f37d2fd609069a54c235ed` | `5218b9af5a52f0a860ad2ee1b5913e6bf2047a47e5f1cc66fb2e7405fd30718f` | `.agents/skills/supabase-safe-migration/SKILL.md` — `12828` bytes, `381` lines, SHA-256 `723ae5366fbaa8c11cae78c0235ca3f4facf199a994c2cb213f120c8458136fc`, `LF` |
| Candidate | `af732c235d0955f6dafb17718a0cbe34f858b01d` | `f06856d03ad778400a99a66633260cccbf44e02ce0c6abf71ebd2ff597be9e85` | `.agents/skills/supabase-safe-migration/SKILL.md` — `10699` bytes, `241` lines, SHA-256 `76447970e75fec2e048d52e49d2faf6eab64baf466977008405d3f77ec65d229`, `LF`; `references/migration-and-seed.md` — `3410` bytes, `80` lines, SHA-256 `0e5a62094b7cbb5df7e1603b22ef9f6bac72e6d12ecc5a65721fc93f177316ec`, `LF`; `references/rls-and-storage.md` — `1512` bytes, `55` lines, SHA-256 `9cf261465cf8036afd3ac51e5427ffebc2485773bf73ad85db046555927b12df`, `LF`; `references/rpc-trigger-concurrency.md` — `1383` bytes, `54` lines, SHA-256 `f77a9611e719c21c8df4aa76c63ab0db25a2d0abe5604dd6b1a050731f22e84a`, `LF` |

The synthetic workspace control plane resolved to the same clean implementation head `abfb70ab3555e44a852a1096ae62a47ab3550143` in both arms. No current-tree candidate was used; candidate bytes came from the immutable candidate ref above.

## Exact four-case membership

The default four-case ceiling is frozen for this request. Each row below has one baseline reader and one candidate reader; the evaluator is created only after both reader dependencies settle.

| Suite | Case | Baseline reader unit | Candidate reader unit | Evaluator unit | Criterion / veto IDs |
| --- | --- | --- | --- | --- | --- |
| `routing` | `ssm-route-nondb-zod-near-miss` | `reader-8ff068cd2c068e47444ed273919373d8374616fb24f5e1c42abfb79581f718bc` | `reader-847fd9646809c1beca58235ae1106f9fc9ca6bb52a21eb9da7ef4897ac571a43` | `evaluator-71429cad0ed77989d5044a41b1675b3887f599ab804e573a8cd22350ebb05410` | criterion `non-database-zod-route-discrimination`; no veto |
| `fresh-reader` | `ssm-fresh-remote-push-core-stop` | `reader-1948a44014f89d325a4d4f74a24707283b61df5a510335e09d9e569f11913d27` | `reader-893e042f429ba31f2c0d7d35913103649a458ac0747f03bfb15d91f072fc1b24` | `evaluator-876465e14cbabb6de270da61108ffb896f1d11c47a67eb5bcec85f600c5778d3` | criterion `independent-core-only-remote-stop`; veto `fresh-reader-performs-remote-database-action` |
| `regression` | `ssm-reg-additive-constraint-existing-data` | `reader-96bfb0e1b1ae1dfb24a3cc967e8fe9f6b8df5a32f6601c4c0086cef4f50283fe` | `reader-6a35d40b0c421b30c6cc5b8b3a824a9a4088d2dd82c455ad446f4e9b23b21fba` | `evaluator-88bb2406df44cb8a1a6dac4e7ae11d6614f85ea959c3eaea77fd0d9cadda459e` | criterion `existing-data-safe-constraint-order`; veto `migration-breaks-or-corrupts-existing-data` |
| `regression` | `ssm-reg-seed-safety` | `reader-729b1471e37cc70ac22084d3c08a197f3573a7c44c58b5ff189bc7cbcf276dbd` | `reader-370cd4574b374bd0176d0f4042eeb6de09906c6c482881d71ffaecc67190aea5` | `evaluator-14d208b8071996ae6c7cd0a9277ac8957a0067478587c8f961797be2b7145c76` | criterion `deterministic-minimal-local-seed`; veto `remote-or-nondeterministic-seed` |

Reader unit IDs are logical identities and therefore repeat across the two arms. The prepared reader behavior projection is different because the reader model/effort is frozen per arm; the evaluator unit IDs, rubric IDs and evaluator config are the same.

## Raw input, context và schema audit

The following bytes are the prepared content shared by both model arms. `context` lists every selected context file as `path:bytes:sha256:EOL`; bundle file hashes are pinned in the package table above.

| Suite / case | Prompt | Context inventory | Baseline stdin | Candidate stdin | Reader output schema |
| --- | --- | --- | --- | --- | --- |
| `routing` / `ssm-route-nondb-zod-near-miss` | `122` / `ab9516738f3929a90b653352263871e7954a3d1ec4227db80e066d3cb61cdbeb` / `LF` | `context/ctx-agents.txt:6733:f26217741a480c608bf951923df16a5ed639bc6129c7b002983e6c28735eddac:CRLF`; `context/ctx-course-schema-test.txt:2802:14fc6253f0064892c38af68255fdc34d5e426f6d1bc04b4bc53351e82e07839e:CRLF`; `context/ctx-course-schema.txt:3292:704712cbb2b6aaea515e3542165a60f90d5fdd69fbb0c82f08a6aa5b47ada314:CRLF`; `context/ctx-fact-no-db.txt:164:fed0e0ec31abc79c76dbdd5e1d8bcdb7e73c9a683372be9780d306fdf33557db:none`; `context/ctx-fact-test-file.txt:181:62ecf100658aeb11015a11b41db1e37e89153ee45a7615ade3c40dda1aed967a:none` | `29646` / `f440f078b1345c9e85c083bf443bd666fc8e477c0520bffe42dde198cf324a17` | `34437` / `8a795a200ee7726d1df4c937d0ffa4b59a41c8d781d619b6433e4f42850a1dc0` | `1782` / `6aaa09533679aef7af6f079ab37abda42ed732b97531ece760db03b51251e126` / `LF` |
| `fresh-reader` / `ssm-fresh-remote-push-core-stop` | `67` / `a96c93f387fee5b777a1dd9bd8cfeb98a262accb1cc22b47d6cf1b5c9681b05c` / `LF` | `context/ctx-fact-remote-push-only.txt:194:b7d336835c39c3f10346b9f7622dec02832aaace60b272ad31ce0a041cf7fe49:none`; `context/ctx-supabase-config.txt:15898:db39daaf0964feb86671c54160f16102640d854787d8a5fc7e9d00073611adde:CRLF` | `32459` / `6a083b1bbfdcadceb082d90ef69933036e2ad3b59f72fd7c99788ddee93faefb` | `37250` / `cebce3ab9733f95f2b9f3d4df9df05d99da57bdc7e32101f30d1bd4fce77e6c2` | `1782` / `6aaa09533679aef7af6f079ab37abda42ed732b97531ece760db03b51251e126` / `LF` |
| `regression` / `ssm-reg-additive-constraint-existing-data` | `169` / `590cbeeb8d1c522451ad461ed451ac9085bfac0070d58d4a11b978323811acae` / `LF` | `context/ctx-exercise-authoring-contract.txt:8785:9b7eeafffcb750a3cddc994c4d1a8884b5225d9bde4c7c70367733352df095a1:CRLF`; `context/ctx-order-hardening-migration.txt:8713:5034792c72091622e9459fdfdea1af70e39b9b4fc13ee4ab97e59a0e3b9d70c2:CRLF` | `33843` / `7042b84e698f32a257cd68f6f37f018338b9582253e43d59b27d97e1283742ca` | `38634` / `165bee5425c1c40b5e26fd58deba38c37d252f428b9ed646e0243fe76b1edde4` | `1782` / `6aaa09533679aef7af6f079ab37abda42ed732b97531ece760db03b51251e126` / `LF` |
| `regression` / `ssm-reg-seed-safety` | `64` / `8fb489f594041a9e6bcdad17f18196f46ded9d32b80160619e3905cc6fce6934` / `LF` | `context/ctx-seed.txt:29748:311d18b5dcfa1e3ae59223173e733caadfe407d105a5cd8f2e51e6a6b22b20d5:CRLF` | `47350` / `b86da6fbed3c692429962d3b3f660c977b8ed2ad62ef6b9d910cad4a50f494b3` | `52141` / `6bab82ce5a3bdf70705c61417bc4094dabfd67726ed6840d1c2cac5f263aed4a` | `1782` / `6aaa09533679aef7af6f079ab37abda42ed732b97531ece760db03b51251e126` / `LF` |

The current evaluator proposal schema is `2598` bytes, SHA-256 `175279b6ad89e65d5a35f19f4f349296dc1d87eb8d7e513d48300f825f54051d`, `LF`. Suite definition bytes are unchanged between arms: `regression.json` `32051` bytes / `677dadb975ab074ad012900c34963f874d9ebfc9a74a300009a3ee23b710139a` / `LF`; `routing.json` `19329` bytes / `f22b9d363d122bb33c18c6e10c4f5177d95461dda9276bf07ebfdeaedc2cf67b` / `LF`; `fresh-reader.json` `12722` bytes / `c3e9b8d91030dc5a07480cc1b65daa94d4203ad24f3d24302ce2cc5bb3bfd518` / `LF`.

Selected evaluator fingerprints are:

| Case | Evaluator-only SHA-256 | Suite-config SHA-256 | Suite config |
| --- | --- | --- | --- |
| `ssm-route-nondb-zod-near-miss` | `8c5b73486aff4f68c75f9e6add7122d1ea531d88f9bd2a075b2e67a453741587` | `bbc26b39643a774c65e76a4debcdb2c79730b84923981e571d5cd77bd5d332eb` | `candidate_skills` = `code-commenting-and-maintainability`, `nextjs-server-action-zod`, `supabase-safe-migration`, `test-quality-strategy`; `near_miss=true`; `routing_mode=repository` |
| `ssm-fresh-remote-push-core-stop` | `beb5bbcf06818546af8fc73d804337ed3a6dbce58e1818c37d4cf10af36c4e6b` | `25bc799bf9040cb8142db94648e68cd9624487a17cb28c8e173a00e2d1b6e3b8` | `independence_required=true`; `mode=skill-comprehension` |
| `ssm-reg-additive-constraint-existing-data` | `5aabfa09fdc38a9a3ffecb5ed442a67a616bf48f5e6b775191e277a0ff280766` | `ad5a84b70a34d9e96f987408cbd206cbffd2004af39f2969349ba74aae488a13` | `behavior_area=safety`; `protected_invariants=migration-order-preserves-existing-data` |
| `ssm-reg-seed-safety` | `20820a9559fed2cfae48e364251e1c2473e1c63234b10d7f3a45b59d64d0ef5b` | `cba9f480c67195f12ff078f8061cacf8c46f01657e6af565444d759d19408a3e` | `behavior_area=safety`; `protected_invariants=seed-remains-deterministic-minimal-and-local` |

## Prepared arm manifests

Both arms are separate fresh runs with plan v3, revision `1`, comparison mode and the same full static scope (`44` reader units + `22` evaluator units). The full static estimate is `66` calls per arm; it is not the live grant. The selected four-case closure is `8` readers + `4` evaluators = `12` dispatch maximum per arm.

| Arm | Reader options | Evaluator options | Run / workspace | Evidence run root | Package workspace root | `run.json` | `execution-plan.json` | `workspace-manifest.json` |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| S | `gpt-5.6-sol / medium`; `read-only`, `ephemeral`, `ignore_user_config`, `ignore_rules` | `gpt-5.6-sol / medium`; same controls | `run-dbcc351f90b24a2f9a172b63841b2e27` / `ws-af32554052fe4b3b80fb470ad1c024b2` | `C:\Users\dongu\AppData\Local\Temp\vocaspace-agent-skill-evals\cli-v1\run-dbcc351f90b24a2f9a172b63841b2e27` | `C:\Users\dongu\AppData\Local\Temp\vocaspace-agent-skill-evals\v1\ws-af32554052fe4b3b80fb470ad1c024b2` | `7062` / `2c06e3d256fe90f25cb73eb8b99d13d729d23b3da382610764b66050d2dd5267` | `3300488` / `6a6dc068728f64b6d3118e099497a47ed0361315e74aad541969472b3418fd99` | `100229` / `89080a913b1f6fac24601d92216e4023e16ac349bec2de2cfa03083bd1a21f1` |
| L | `gpt-5.6-luna / max`; `read-only`, `ephemeral`, `ignore_user_config`, `ignore_rules` | `gpt-5.6-sol / medium`; same controls | `run-30bbc8bb9bca4963a4ad50b56ea2989d` / `ws-c245a4ae3191403ab0d5a70511b74a3a` | `C:\Users\dongu\AppData\Local\Temp\vocaspace-agent-skill-evals\cli-v1\run-30bbc8bb9bca4963a4ad50b56ea2989d` | `C:\Users\dongu\AppData\Local\Temp\vocaspace-agent-skill-evals\v1\ws-c245a4ae3191403ab0d5a70511b74a3a` | `7062` / `fe153b6eb66d754ef6cf1e93d73a9c67e3ecd920ebca773690abce4ac977bf83` | `3300310` / `9780b52908c5f1e77562e05c95a1e9551770c0d072d10fcbdd8ebdaa6c98c487` | `100229` / `8245c94bf95a5494945f27438d30944e06fb633707d282931df3b81a6afbbfc4` |

Each arm was prepared with `max_attempts=1`, `planned_concurrency=2`, `max_concurrency=2`, `automatic_retry_calls=0`, and `dispatch_counts={reader:0,evaluator:0,total:0}`. The workspace input hash in both arms is `fabd70c85855586a14f1e414a3f11906e6d7dcbc1e181a79a13bc2c3a918b0d3`.

## Exact commands

The two deterministic prepare commands that created the run IDs are:

```powershell
node .agents/scripts/run-skill-eval-cli.mjs prepare --skill supabase-safe-migration --isolation synthetic --candidate-ref af732c235d0955f6dafb17718a0cbe34f858b01d --baseline-ref 2be02df11e279b5c88f37d2fd609069a54c235ed --concurrency 2 --max-concurrency 2 --max-attempts 1 --reader-model gpt-5.6-sol --reader-effort medium
node .agents/scripts/run-skill-eval-cli.mjs prepare --skill supabase-safe-migration --isolation synthetic --candidate-ref af732c235d0955f6dafb17718a0cbe34f858b01d --baseline-ref 2be02df11e279b5c88f37d2fd609069a54c235ed --concurrency 2 --max-concurrency 2 --max-attempts 1 --reader-model gpt-5.6-luna --reader-effort max
```

The following are the only commands eligible for a later separately authorized live grant. Each command chooses exactly one case closure; the evaluator listed in the table above is the computed downstream unit and must not be added as a reader selection. Do not run these commands under this checkpoint.

```powershell
# Arm S — run sequentially in the listed order, only after exact live authority
node .agents/scripts/run-skill-eval-cli.mjs patch-check --run run-dbcc351f90b24a2f9a172b63841b2e27 --unit reader-8ff068cd2c068e47444ed273919373d8374616fb24f5e1c42abfb79581f718bc --unit reader-847fd9646809c1beca58235ae1106f9fc9ca6bb52a21eb9da7ef4897ac571a43
node .agents/scripts/run-skill-eval-cli.mjs patch-check --run run-dbcc351f90b24a2f9a172b63841b2e27 --unit reader-1948a44014f89d325a4d4f74a24707283b61df5a510335e09d9e569f11913d27 --unit reader-893e042f429ba31f2c0d7d35913103649a458ac0747f03bfb15d91f072fc1b24
node .agents/scripts/run-skill-eval-cli.mjs patch-check --run run-dbcc351f90b24a2f9a172b63841b2e27 --unit reader-96bfb0e1b1ae1dfb24a3cc967e8fe9f6b8df5a32f6601c4c0086cef4f50283fe --unit reader-6a35d40b0c421b30c6cc5b8b3a824a9a4088d2dd82c455ad446f4e9b23b21fba
node .agents/scripts/run-skill-eval-cli.mjs patch-check --run run-dbcc351f90b24a2f9a172b63841b2e27 --unit reader-729b1471e37cc70ac22084d3c08a197f3573a7c44c58b5ff189bc7cbcf276dbd --unit reader-370cd4574b374bd0176d0f4042eeb6de09906c6c482881d71ffaecc67190aea5

# Arm L — same closure order, separate run
node .agents/scripts/run-skill-eval-cli.mjs patch-check --run run-30bbc8bb9bca4963a4ad50b56ea2989d --unit reader-8ff068cd2c068e47444ed273919373d8374616fb24f5e1c42abfb79581f718bc --unit reader-847fd9646809c1beca58235ae1106f9fc9ca6bb52a21eb9da7ef4897ac571a43
node .agents/scripts/run-skill-eval-cli.mjs patch-check --run run-30bbc8bb9bca4963a4ad50b56ea2989d --unit reader-1948a44014f89d325a4d4f74a24707283b61df5a510335e09d9e569f11913d27 --unit reader-893e042f429ba31f2c0d7d35913103649a458ac0747f03bfb15d91f072fc1b24
node .agents/scripts/run-skill-eval-cli.mjs patch-check --run run-30bbc8bb9bca4963a4ad50b56ea2989d --unit reader-96bfb0e1b1ae1dfb24a3cc967e8fe9f6b8df5a32f6601c4c0086cef4f50283fe --unit reader-6a35d40b0c421b30c6cc5b8b3a824a9a4088d2dd82c455ad446f4e9b23b21fba
node .agents/scripts/run-skill-eval-cli.mjs patch-check --run run-30bbc8bb9bca4963a4ad50b56ea2989d --unit reader-729b1471e37cc70ac22084d3c08a197f3573a7c44c58b5ff189bc7cbcf276dbd --unit reader-370cd4574b374bd0176d0f4042eeb6de09906c6c482881d71ffaecc67190aea5
```

Per command the expected closure is `2 reader + 1 evaluator = 3` dispatch. The total ceiling is `12` per arm and `24` for both arms. `retry=0`, automatic retry `0`, no `run`, `resume`, `retry`, replacement or fanout; `max_attempts=1` remains fixed. After each command, inspect settled unit status and selected-graph evidence before issuing the next command. Stop the arm on any operational, `unknown`, integrity or confirmed safety issue; settle already-started work and do not issue a blind retry.

## Runtime, destination và authority boundary

- Deterministic runtime: Node `v20.19.0`, npm `10.8.2`, Git `2.51.0.windows.1`, PowerShell `7.6.5`, Windows `Microsoft Windows NT 10.0.26200.0`.
- Codex runtime inspection: `codex-cli 0.153.4`; `codex exec --help` was read only. No model probe, provider request or evaluator spawn occurred.
- The two `run_root` paths above are the authoritative evidence destinations outside tracked source. If live is later authorized, attempt records and raw events remain under each root's `attempts/<unit_id>/<ordinal>/`; do not copy or rewrite them into the repository. The `workspace_root` paths are immutable prepared package inputs, not an alternate result store.
- Billing/auth mode is intentionally `not_observed` at CP3 because prepare has no provider request. A later grant must explicitly name the allowed Codex/OpenAI account/billing mode without exposing credentials; this manifest does not grant that authority.
- No live authority, egress authority, push, PR or merge authority is implied by the existence of prepared run IDs.

## Deterministic audit results

- `node .agents/scripts/run-skill-evals.mjs validate --all`: `valid`; `9` skills, `27` suite files, `187` cases, `0` errors, `0` warnings.
- Both prepare results: `prepared`; full static scope `44` readers + `22` evaluators, `66` expected calls, `66` max-attempt ceiling, dispatch `0`.
- Both `status` reads: exit `0`, command result `succeeded`, run status `prepared`, `44` pending and `22` dependency-blocked, dispatch `0`.
- Both `report` reads: exit `1`, status `incomplete`, `22` cases / `0` current / `0` retained reference / `22` incomplete, dispatch `0`. This is expected because only selected closures are allowed and no closure has run.
- Before/after `status` + `report`, both the run tree and package workspace tree were byte-identical for each arm.
- Cross-arm audit: all eight selected reader package/input byte sets match, all eight logical reader IDs match, reader options differ only as `gpt-5.6-sol/medium` versus `gpt-5.6-luna/max`, all four evaluator IDs/rubric/config sets match, and declared stdin/schema hashes match actual bytes.

This artifact is a prepared grant request, not live-evaluation evidence, quality acceptance, model parity, provider readiness, or permission to dispatch.
