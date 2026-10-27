# Investigation copilot and SAR/STR drafting

Proof of concept for two items in the Tazama product backlog (draft v0.1, 2026-07-06):

- **P4-2 AI investigation assistant (CIMS copilot):** case summary, red flags and next steps, written for the investigator and cited to the case evidence.
- **P3-2 Regulatory reporting export templates (SAR/STR/CTR + goAML):** an STR narrative and a goAML report built from the copilot's work on the case.

Both are advisory. Nothing here changes a case, a task or its status.

## Flow

```
CMS case ──► facts (code) ──► embed ──► investigation record (copilot_records, kind INVESTIGATION)
                                         │  facts + vectors + summary, red flags, next steps
                                         ├─► ask: question vector → nearest facts → answer → ASK record
                                         └─► SAR agent: for each STR section, nearest facts → narrative
                                              → checks → goAML XML → SAR_DRAFT record (parent_id = investigation)
```

1. **Facts.** `CaseFactsService` reads the case, its Tazama alert (typology score, rules fired), the alert transaction and the subject account's pacs.008 history from `transaction_data`, plus comments and investigation notes. It is tenant-scoped. `facts.ts` turns this into numbered facts. Code computes every amount, count, ratio and date: activity in the 30-day window against the 90 days before, pass-through within 24 hours, cash deposits under the CTR threshold, new counterparties, distance from the usual location, night-time activity and the Benford leading-digit share.
2. **Embeddings.** Each fact is embedded and stored with the record. By default this uses the built-in hashing embedder, which needs no model. With `COPILOT_EMBEDDINGS=provider` it uses the endpoint's `/embeddings`.
3. **Writing.** The model sees only the facts. Every sentence must end with the ids of the facts it relies on, such as `[F7]`.
4. **Checks.** `verifier.ts` removes any sentence that:
   - cites a fact that does not exist
   - contains a number missing from the facts it cites
   - names someone who appears nowhere in the case
   - states guilt
   - could tip off the customer
   - prints an account or ID number
   - is a fragment

   Summaries, red flags and SAR text must cite on every sentence. If most of the model's text fails, the code-written text is used instead, and the model's sentences are listed as removed, with the reasons.

5. **SAR agent.** It reads the stored record, not the live case, so the draft can be traced to what the investigator saw. For each STR section (subject, activity, grounds, investigation, action) it ranks the stored fact vectors against the section's query and drafts from the top matches. `sar.ts` builds the goAML XML in the UNODC base structure and runs the filing checks: totals match the source transactions, the alert transaction is included, the case is closed confirmed, and the reporting entity id is set.

## Audit and governance

Every use of the model is recorded twice, and nothing is updated or deleted. How it is overseen (controls, roles, changes, incidents, risks) is in [GOVERNANCE.md](GOVERNANCE.md).

- **`copilot_records`** holds what the model did. Each row records who asked and when, and the provider and model. Kinds:
  - **INVESTIGATION**: the facts, the findings kept, and every removed sentence with the reason.
  - **ASK**: each chat question with its answer.
  - **SAR_DRAFT**: the draft, with its checks.
  - **SAR_REVIEW**: each maker-checker step, with its comment.
  - **FEEDBACK**: a user's rating of an output.

  What the rows also hold:
  - **Provenance:** the prompt version, strategy, settings, and the model served (file, quantisation and build from llama.cpp).
  - **The raw model reply.**
  - **With the agent strategy,** every tool call.

  The other kinds point at the record they belong to.

- **Hash chain.** Each record's hash covers the record as stored together with the previous hash, per tenant, so a changed or removed record breaks the chain at that point. `RecordStore.verifyChain` walks it. Each new hash is also written to the audit log, which shows the removal of the newest records too.
- **The CMS audit log** (OpenSearch, `@Audit()`) holds each request that runs the model, rates an output, changes a review or reads the governance report. Each event records the user, role, tenant, case, endpoint, outcome and time, with a SHA-256 hash of the event. The resource types are `copilot-investigation`, `copilot-sar`, `copilot-feedback`, `copilot-governance` and `copilot-record`.

## API

| Method     | Path                                                                    | Feature                          |
| ---------- | ----------------------------------------------------------------------- | -------------------------------- |
| GET        | `/api/v1/features`                                                      | always (tells the UI what is on) |
| GET        | `/api/v1/copilot/status`                                                | either feature                   |
| GET / POST | `/api/v1/copilot/cases/:caseId/investigation`                           | investigation                    |
| POST       | `/api/v1/copilot/cases/:caseId/ask` `{question}`                        | investigation                    |
| GET / POST | `/api/v1/copilot/cases/:caseId/sar-draft` `{refresh?}`                  | SAR                              |
| GET / POST | `/api/v1/copilot/cases/:caseId/sar-review`                              | SAR                              |
| POST       | `/api/v1/copilot/cases/:caseId/feedback` `{recordId, rating, comment?}` | either feature                   |
| GET        | `/api/v1/copilot/governance?days=30` (supervisors, compliance officers) | either feature                   |

Investigators, supervisors and compliance officers may call them, and every `:caseId` route also follows the case access rules (`CaseReadAccessGuard`): no access, or a revoked access, answers 404.

The UI has a **Copilot** tab in the task workspace (`CopilotTab.tsx`) and a **Draft SAR/STR** panel in the SAR/STR Filing modal (`SarDraftPanel.tsx`). Each appears only when its own feature is on.

## Two features, each with its own switch

| Variable                        | On when        | What it adds                                                                   |
| ------------------------------- | -------------- | ------------------------------------------------------------------------------ |
| `COPILOT_INVESTIGATION_ENABLED` | exactly `true` | Copilot tab: summary, red flags, next steps, case chat                         |
| `COPILOT_SAR_ENABLED`           | exactly `true` | SAR/STR drafting and its maker-checker review; works without the other feature |

Both default to off. A feature that is off has no controller, so its routes return 404. The SAR agent drafts from the investigation record, so with only SAR on it runs the investigation internally and stores the record; the draft carries its own copy of the facts it cites.

## Code layout

| File                                                   | Role                                                                      |
| ------------------------------------------------------ | ------------------------------------------------------------------------- |
| `copilot.module.ts`, `copilot.config.ts`               | Dynamic module: registers only what is switched on; reads the flags       |
| `investigation.service.ts`, `sar.service.ts`           | The two features. SAR depends on investigation, never the reverse         |
| `investigation.strategy.ts`                            | Strategy pattern: how the model gets at the facts (`pipeline` or `agent`) |
| `agent/`                                               | Tool registry, fact tools and the agent loop                              |
| `record-store.service.ts`                              | The only reader and writer of `copilot_records` (append-only)             |
| `facts.ts`, `history.ts`, `case-facts.service.ts`      | Facts computed by code from CMS data                                      |
| `verifier.ts`, `findings.ts`, `prompts.ts`             | Checks on every sentence, the code-written fallback, the prompts          |
| `sar.ts`, `sar-review.ts`                              | STR sections and goAML XML; the review state machine                      |
| `case-read-access.guard.ts`, `request-context.ts`      | Case access check and who is asking                                       |
| `meaning-check.ts`, `provenance.ts`, `record-chain.ts` | Optional meaning check, what produced a record, the hash chain            |
| `governance.service.ts`, `governance.controller.ts`    | Ratings, the governance report and the chain check                        |

## Strategy: pipeline or agent

`COPILOT_STRATEGY` chooses how the model reads the facts. Everything around it is the same: the facts are computed by code, every sentence is checked, and code writes the text when the model fails.

| Strategy             | How the model works                                                                                  | Calls                         |
| -------------------- | ---------------------------------------------------------------------------------------------------- | ----------------------------- |
| `pipeline` (default) | Sees all the facts in one prompt and writes                                                          | one                           |
| `agent`              | Chooses which facts to read with read-only tools, then writes. It may cite only what a tool returned | several, within a hard budget |

The agent is built to be auditable and safe:

- **Read-only tools over code-computed facts.** `get_alert_and_rules`, `get_subject_profile`, `get_transaction_activity`, `get_counterparties`, `get_notes_and_comments`, `search_facts`. No tool writes anything, and the case is fixed by the server, never chosen by the model.
- **Validated arguments.** Unknown arguments, wrong types and out-of-range values are refused before a tool runs, and the model is told why.
- **Citations come from a ledger.** The facts a tool returned in this run are the only ones a sentence may cite; anything else is removed by the verifier.
- **Hard limits.** `COPILOT_AGENT_MAX_STEPS` (6), `COPILOT_AGENT_MAX_TOOL_CALLS` (8) and `COPILOT_AGENT_TIMEOUT_MS` (240000). At a limit the model is asked once more with tools off. At most 4 calls run per turn and the budget holds inside a turn; a call that is not run is still answered ("Not run: ...") and shows in the trace, because OpenAI-compatible providers reject an unanswered call. A repeated identical call is answered from memory.
- **Case text is data.** Notes written by people may contain instructions, so tool output is wrapped as untrusted data and the prompt says never to follow it.
- **A trace in the record.** Every tool call, the facts it returned and why the run stopped are stored with the investigation record and shown in the Copilot tab ("How this was produced").
- **A fallback.** If the model does not use the tools or fails, the pipeline writes the findings, and the trace says so.

The agent needs a model that supports tool calling: llama.cpp with `--jinja` (set in `docker-compose-cms.yml`), or any provider through bring-your-own-key. A 4B model is not guaranteed to call tools reliably; it should be measured before the agent becomes a default.

## Model: bundled, bring your own key, or off

| `COPILOT_MODE`      | What runs                                                                                                                          | Case data                |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | ------------------------ |
| `bundled` (default) | The open-weight model shipped with the CMS: `copilot-llm` in `docker-compose-cms.yml`, llama.cpp (MIT) serving an Apache-2.0 model | stays in the deployment  |
| `byok`              | Any OpenAI-compatible endpoint the deployer contracts: `COPILOT_BYOK_URL`, `COPILOT_BYOK_API_KEY`, `COPILOT_BYOK_MODEL`            | is sent to that provider |
| `off`               | No model; every answer is written by code from the facts                                                                           | stays in the deployment  |

The status endpoint and the UI always show the mode, the model, its licence, and whether case data leaves the deployment.

Other settings:

| Variable                    | Default                    | Purpose                                                                     |
| --------------------------- | -------------------------- | --------------------------------------------------------------------------- |
| `COPILOT_BUNDLED_URL`       | `http://localhost:8091/v1` | bundled model endpoint                                                      |
| `COPILOT_BUNDLED_MODEL`     | `qwen3-4b-instruct-2507`   | bundled model name                                                          |
| `COPILOT_BUNDLED_LICENSE`   | `Apache-2.0`               | must match the shipped weights                                              |
| `COPILOT_EMBEDDINGS`        | `builtin`                  | or `provider` with `COPILOT_EMBEDDING_MODEL`                                |
| `COPILOT_STRATEGY`          | `pipeline`                 | or `agent`                                                                  |
| `COPILOT_MEANING_CHECK`     | `false`                    | `true`: a second model reading removes sentences their facts do not support |
| `COPILOT_REPORTING_FSP`     | `fsp001`                   | the deployment's own FSP, used to tell the customer from the counterparty   |
| `COPILOT_CTR_THRESHOLD`     | `2000000`                  | cash threshold, local currency                                              |
| `COPILOT_TZ_OFFSET_MINUTES` | `300`                      | local time for dates in facts                                               |
| `COPILOT_PROMPT_NOTE_CHARS` | `500`                      | long notes are shortened in prompts for small models                        |
| `GOAML_RENTITY_ID`          | unset                      | reporting entity id issued by the FIU                                       |

## Limits of this POC

- **Account history.** History comes from `transaction_data`. In a real deployment it should come from the BIAR gold lakehouse (`gold-lakehouse` module); `CaseFactsService.history()` is the one place to change.
- **KYC and screening.** These are read from comments and notes ("KYC extract", "Screening results"). Encrypted evidence documents are not read.
- **The checks are mechanical.** They catch wrong figures, invented names, guilt and tipping-off language. They do not catch a sentence that pairs a true number with the wrong meaning. Investigators must read the text before using it.
- **goAML codes.** Transmode and funds codes are placeholders. Each FIU publishes its own XSD and code lists.
- **No MCP server yet.** Backlog P2-13 would expose the same tools to other AI clients. The tool registry in `agent/` is the layer to put it on, keeping the case access check and the call log.
