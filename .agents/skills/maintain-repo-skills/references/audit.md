# Instruction audit

Read before auditing placement/duplication or deciding where existing instructions belong. This is read-only; a proposed move is not permission to implement it.

1. Bound the requested instruction sources, their direct consumers and current Git baseline.
2. Classify each actionable rule as in place, belongs elsewhere, duplicate, unsupported tooling, structural defect or provenance unknown. Use the parent skill's ownership table; name the proposed owner and concrete consequence.
3. Verify factual questions with rg, Git and existing validators. Use judgment for placement/meaning. Do not read unrelated programs or infer why a historical decision was made.
4. Report file:line, classification, owner, evidence and the smallest correction. State unread sources and runtime/semantic limits. Change nothing without implementation authority.
