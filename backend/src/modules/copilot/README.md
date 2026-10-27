# Investigation copilot and SAR/STR drafting

Proof of concept for two items in the Tazama product backlog (draft v0.1, 2026-07-06):

- **P4-2 AI investigation assistant (CIMS copilot):** case summary, red flags and next steps, written for the investigator and cited to the case evidence.
- **P3-2 Regulatory reporting export templates (SAR/STR/CTR + goAML):** an STR narrative and a goAML report built from the copilot's work on the case.

Both are advisory. Nothing here changes a case, a task or its status.

## Flow

```
CMS case ──► facts (code) ──► embed ──► investigation record (copilot_records, kind INVESTIGATION)
                                         │  facts + vectors + summary, red flags, next steps
                                         ├─► ask: question vector → nearest facts → answer
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

## API

| Method     | Path                                                   | Roles                                |
| ---------- | ------------------------------------------------------ | ------------------------------------ |
| GET        | `/api/v1/copilot/status`                               | investigator, supervisor, compliance |
| GET / POST | `/api/v1/copilot/cases/:caseId/investigation`          | investigator, supervisor, compliance |
| POST       | `/api/v1/copilot/cases/:caseId/ask` `{question}`       | investigator, supervisor, compliance |
| GET / POST | `/api/v1/copilot/cases/:caseId/sar-draft` `{refresh?}` | compliance officer, supervisor       |

The UI has a **Copilot** tab in the task workspace (`frontend/src/features/copilot/CopilotTab.tsx`) and a **Draft SAR/STR** panel in the SAR/STR Filing modal (`SarDraftPanel.tsx`).

## Model: bundled, bring your own key, or off

| `COPILOT_MODE`      | What runs                                                                                                                          | Case data                |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | ------------------------ |
| `bundled` (default) | The open-weight model shipped with the CMS: `copilot-llm` in `docker-compose-cms.yml`, llama.cpp (MIT) serving an Apache-2.0 model | stays in the deployment  |
| `byok`              | Any OpenAI-compatible endpoint the deployer contracts: `COPILOT_BYOK_URL`, `COPILOT_BYOK_API_KEY`, `COPILOT_BYOK_MODEL`            | is sent to that provider |
| `off`               | No model; every answer is written by code from the facts                                                                           | stays in the deployment  |

The status endpoint and the UI always show the mode, the model, its licence, and whether case data leaves the deployment.

Other settings:

| Variable                    | Default                    | Purpose                                                                   |
| --------------------------- | -------------------------- | ------------------------------------------------------------------------- |
| `COPILOT_BUNDLED_URL`       | `http://localhost:8091/v1` | bundled model endpoint                                                    |
| `COPILOT_BUNDLED_MODEL`     | `qwen3-4b-instruct-2507`   | bundled model name                                                        |
| `COPILOT_BUNDLED_LICENSE`   | `Apache-2.0`               | must match the shipped weights                                            |
| `COPILOT_EMBEDDINGS`        | `builtin`                  | or `provider` with `COPILOT_EMBEDDING_MODEL`                              |
| `COPILOT_REPORTING_FSP`     | `fsp001`                   | the deployment's own FSP, used to tell the customer from the counterparty |
| `COPILOT_CTR_THRESHOLD`     | `2000000`                  | cash threshold, local currency                                            |
| `COPILOT_TZ_OFFSET_MINUTES` | `300`                      | local time for dates in facts                                             |
| `COPILOT_PROMPT_NOTE_CHARS` | `500`                      | long notes are shortened in prompts for small models                      |
| `GOAML_RENTITY_ID`          | unset                      | reporting entity id issued by the FIU                                     |

## Limits of this POC

- **Account history.** History comes from `transaction_data`. In a real deployment it should come from the BIAR gold lakehouse (`gold-lakehouse` module); `CaseFactsService.history()` is the one place to change.
- **KYC and screening.** These are read from comments and notes ("KYC extract", "Screening results"). Encrypted evidence documents are not read.
- **The checks are mechanical.** They catch wrong figures, invented names, guilt and tipping-off language. They do not catch a sentence that pairs a true number with the wrong meaning. Investigators must read the text before using it.
- **goAML codes.** Transmode and funds codes are placeholders. Each FIU publishes its own XSD and code lists.
- **No MCP server.** Backlog P2-13 would expose the same case tools to other AI clients, with tenant scoping and audit.
