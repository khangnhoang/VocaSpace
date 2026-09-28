# Planning Spec/State Model — Bản tóm tắt để Owner duyệt

Brief này tóm tắt material decisions trong [`plan.md`](./plan.md). Nó không thay plan và không cấp implementation hoặc Git/remote permission.

## Quyết định cần Owner đưa ra

1. **Model:** dùng `Spec + State`, trong đó exact wiring/files chưa được repository evidence khóa là implementation hypotheses, không phải binding contract.
2. **Pre-Spec discovery/interview/advisory gate:** repository-discoverable fact và reversible implementation uncertainty không đi lên Owner. Fuzzy/conflicting framing được làm rõ bằng từng material question và Owner xác nhận outcome trước binding Spec. Advisory consultation là optional second opinion cho pressure-test hoặc hard/high-impact judgment; nó không phải Stage, không implement/approve, và không quyết định thay Owner.
3. **Guardrails:** không tạo artifact thứ ba; allowed writer domain, authority, hard dependency, semantic owner và required evidence nằm trong Spec chỉ khi có failure mode cụ thể.
4. **Hierarchy:** workstream này dùng ba CP tuần tự, không Stage; Stage chỉ tồn tại khi có intermediate integrated outcome cần accept/publish trước downstream work.
5. **Correction:** chỉ material Spec/guardrail change mới reopen plan review; bounded wiring deviation chỉ cần evidence + State update.
6. **Review:** mỗi CP có review/resume boundary; có một final cumulative review vì planning skill, managed consumer và eval evidence phải compose nhất quán.
7. **Artifacts:** tạo một conditional reference dự kiến là `references/spec-state-and-hierarchy.md`; không tạo `state.md`, stage file hoặc native eval suite mặc định.

Owner instruction ngày `2026-09-28` đã approve plan để implementation và cấp quyền local commit trong suốt task. Phải dừng trước live model/evaluator/TypeSafe call. Push, PR, CI watch/fix, merge và deploy vẫn chưa được cấp.

## Vì sao không dùng Stage cho chính plan này

CP1 tạo planning semantics, CP2 đồng bộ managed consumer, CP3 chứng minh behavior. Chúng có dependency và review boundary riêng, nhưng không có subset nào trở thành một intermediate product cần Owner acceptance/publication trước phần sau. Một Stage bao trùm cả ba chỉ là wrapper cho toàn workstream.

## Exact outcome

- Plan đủ rõ để bảo vệ product meaning, scope, authority, ownership, dependency và evidence.
- Plan không giả định sớm exact wiring rồi buộc implementation quay lại correction chỉ vì repository reality khác dự đoán.
- State đủ ngắn để resume sau context compaction/handoff mà không duplicate Spec hoặc managed ledger.
- Steps/CP/Stage/final review được chọn theo semantic boundary, không theo độ dài hoặc vẻ ngoài của tài liệu.

## Scope dự kiến

- Planning skill core và references.
- Managed multi-agent consumer wording tối thiểu cần đồng bộ.
- Planning eval suites hiện có và deterministic native workflow tests.
- Durable plan/brief/progress reconciliation khi có evidence thật.

Không gồm product code, DB/UI/runtime, CI infrastructure, historical artifact rewrite, commit/push/PR/merge/deploy, hay redesign managed orchestration.

## Evidence gate trước khi coi implementation hoàn tất

- Deterministic validators/tests pass hoặc failure được report đúng.
- Semantic cases phân biệt được: Steps only; CP/no Stage; valid Stage; harmless wiring deviation; writer-domain mismatch; Product Spec change; State-only update; final cumulative review required/not required.
- Pre-Spec/advisory matrix phân biệt được repository discovery, bounded hypothesis, material Owner interview, optional evidence-packed advice, unavailable advice, unresolved Owner decision và adviser-versus-Owner authority.
- Fresh-reader evidence kiểm tra behavior, không chỉ keyword/source presence.
- Final cumulative review xác nhận planning owner, managed consumer và evidence không mâu thuẫn.

## State hiện tại

- Status: `approved-1 / implementation in progress`.
- Implementation: CP1 implemented and deterministically validated; CP2 is next. Local edit/stage/commit được phép trong task này.
- Branch: `feat/planning-hierarchy` từ synced `main` tại `bfbe52f405e5d03577af634b650ff91c1cc3f1ab`.
- Next action: CP1 implementation.
- Không có quyền live model/evaluator/TypeSafe call, push/PR/CI/merge.
