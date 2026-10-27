# Copilot governance

How the investigation copilot (backlog P4-2) and the SAR/STR drafting agent (P3-2) are controlled, recorded and overseen. This is for the people who deploy, operate, review or audit them. How the code works is in [README.md](README.md).

## 1. Intended use

**What it is for.** It helps a human investigator and compliance officer in three ways:

- it summarises a case from facts that code computed from CMS data;
- it answers questions about the case;
- it drafts the SAR/STR narrative and the goAML file.

**What it must not be used for:**

- deciding a case or its outcome;
- filing a report without the maker-checker approval;
- anything a customer sees;
- training or fine-tuning a model on case data.

The copilot changes no case, task or status. Every output is advisory and marked with who wrote it: the model, or code.

## 2. Model card

|                        |                                                                                                                                                                                                                                                                                                                                                          |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Bundled model**      | Qwen3-4B-Instruct-2507, GGUF Q4_K_M, Apache-2.0. Served by llama.cpp in the `copilot-llm` container inside the deployment, so case data does not leave it.                                                                                                                                                                                               |
| **Bring your own key** | Any OpenAI-compatible endpoint the deployer contracts with (`COPILOT_MODE=byok`). Case facts are then sent to that provider, and the UI says so on every output.                                                                                                                                                                                         |
| **No model**           | `COPILOT_MODE=off`. Every text is written by code from the facts, and is still cited and checked.                                                                                                                                                                                                                                                        |
| **Input**              | Only numbered facts that code computed from the case: alert, rules, transactions, KYC, screening, notes. The model never queries the database.                                                                                                                                                                                                           |
| **Output**             | Sentences that must each cite the facts they rely on.                                                                                                                                                                                                                                                                                                    |
| **Language**           | English.                                                                                                                                                                                                                                                                                                                                                 |
| **Measured**           | On 19 demo cases, 87% of the bundled model's sentences passed the checks. In 76 of 82 parts, the model's text was used rather than code's (`tools/eval-models.js`).                                                                                                                                                                                      |
| **Known limits**       | The checks catch wrong numbers, invented names, guilt, tipping-off and identifiers, but not wrong meaning. The real model has written "a 1.0 times increase" where the fact said no change; the optional meaning check (section 3) targets this. A 4B model chooses tools less reliably than a large one. On CPU an investigation takes several minutes. |

## 3. Controls in place

| Control                      | How                                                                                                                                                                                                                                                                                                              | Where                                                        |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| **Human decides**            | Advisory output only. A SAR/STR draft needs a supervisor's approval before the goAML file unlocks. The person who submitted a draft cannot approve it.                                                                                                                                                           | `sar-review.ts`, `SarDraftPanel`                             |
| **Grounded in facts**        | Code computes every amount, count, ratio and date. The model only writes sentences, and every sentence cites facts.                                                                                                                                                                                              | `facts.ts`, `prompts.ts`                                     |
| **Output checks**            | A sentence is removed if it contains a number missing from its cited facts (counts written as words included), cites a fact that does not exist, names someone who is not in the case, states guilt, could tip off the customer, or prints an account or ID number. Removed sentences are shown with the reason. | `verifier.ts`                                                |
| **Meaning check** (optional) | `COPILOT_MEANING_CHECK=true` adds a second model reading of each cited sentence against its facts, and removes those the facts do not support. It adds to the code checks and never replaces them. Off by default: it costs one model call per text.                                                             | `meaning-check.ts`                                           |
| **Prompt-injection defence** | Case text reaches the model as data marked untrusted. With the agent strategy, the model only has read-only tools over the computed facts, and may cite only what a tool returned.                                                                                                                               | `agent/`                                                     |
| **Bounded agent**            | Hard limits on steps, tool calls and time. Every tool call is answered and recorded. If the model fails, the standard pipeline writes instead.                                                                                                                                                                   | `agent/agent-loop.ts`                                        |
| **Access**                   | Login on every endpoint, the CMS case access rules on every case route, and tenant scoping on every read. The governance report is limited to supervisors and compliance officers.                                                                                                                               | `case-read-access.guard.ts`, controllers                     |
| **Transparency to users**    | Each output shows the model, its licence and whether data leaves the deployment. It also shows who wrote each part, what was removed and why, the agent's tool calls, and a "Produced by" line with the model build and prompt version.                                                                          | `CopilotTab`, `SarDraftPanel`                                |
| **Disclosure in exports**    | The narrative (.txt) and the goAML XML (as an XML comment) say the narrative was drafted with AI assistance, from which record, and that it was reviewed and approved before filing.                                                                                                                             | `sar.service.ts`, `copilotService.ts`                        |
| **Switches**                 | `COPILOT_INVESTIGATION_ENABLED` and `COPILOT_SAR_ENABLED` each remove their feature entirely (routes answer 404). `COPILOT_MODE=off` keeps the features with no model.                                                                                                                                           | `copilot.config.ts`                                          |
| **Records of every use**     | `copilot_records` keeps every investigation run, chat question and answer, SAR draft, review step and rating, with who and when. Records are append-only.                                                                                                                                                        | `record-store.service.ts`                                    |
| **Provenance**               | Each record stores the prompt version, the strategy, the temperature and token limit, whether the meaning check ran, and the model served (weights file, quantisation and llama.cpp build, or the provider's resolved model id).                                                                                 | `provenance.ts`                                              |
| **Raw output**               | Each record keeps the model's reply exactly as it came back, before the checks.                                                                                                                                                                                                                                  | `raw` in each record                                         |
| **Tamper evidence**          | Each record's hash covers its content and the previous record's hash, per tenant. Verification walks the chain and names the first changed or missing record. Each new hash is also written to the CMS audit log (OpenSearch), so removing the newest records shows too.                                         | `record-chain.ts`, `RecordStore.verifyChain`                 |
| **Request audit**            | Every copilot request that runs the model, rates an output or reads the report is in the CMS audit log, with user, role, tenant, case, outcome and time.                                                                                                                                                         | `@Audit()`, resource types `copilot-*`                       |
| **User feedback**            | 👍/👎 with an optional comment on findings, each chat answer and each SAR draft, stored as records.                                                                                                                                                                                                              | `FeedbackButtons`, `POST .../feedback`                       |
| **Oversight report**         | For a period, the report shows the models and prompt versions in use, model text kept versus removed, the main removal reasons, agent fallbacks, ratings with comments, review outcomes, and the chain check.                                                                                                    | `GET /api/v1/copilot/governance`, "Governance report" button |

## 4. Operating it

**Roles.** Each deployment names three:

- a **model owner**, who approves the model, the prompts and the settings;
- an **overseer**, a supervisor or compliance officer who reviews the governance report;
- **users**: investigators and compliance officers.

Tazama, through its TSC working group, owns the bundled model choice and the default prompts.

**Review the governance report** weekly, and after any change. Act on any of these:

- the chain is not intact;
- the share of model sentences kept falls well below what was measured (87%);
- a new removal reason dominates;
- agent fallbacks rise;
- 👎 ratings rise, or their comments repeat a pattern.

**Changing the model, the prompts or the strategy:**

1. Run `tools/eval-models.js` on the demo cases with the candidate, and compare it with the current setup.
2. Read a sample of sentences against their facts, because the checks do not judge meaning.
3. Record the decision and deploy. The prompt version changes on its own when any prompt changes, and every record carries the model build, so outputs before and after the change can be told apart.

**When something goes wrong:**

1. Switch the model off (`COPILOT_MODE=off`), or switch the feature off with its flag. Nothing is lost, and the records stay.
2. Find the affected outputs through the governance report, then the records: each one holds the raw reply, the provenance and the checks.
3. Check the chain.
4. Tell the case owners whose outputs are affected.

**Retention.** Copilot records are part of the case's AML record. Keep them at least as long as the case records: FATF Recommendation 11 asks for at least five years, and local law may ask for more. Do not delete individual records. Deleting one breaks the chain, by design.

**Checking the chain by hand.** The report shows the newest hash. It should match the latest `COPILOT_RECORD_WRITTEN` event for the tenant in the audit log (OpenSearch, `audit-logs-*`). If they differ, records were removed from the end.

## 5. Risk register

| Risk                                             | Mitigation                                                                                           | What remains                                                                                                                       |
| ------------------------------------------------ | ---------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| A sentence states something the facts do not say | Citations, code checks, optional meaning check, removed sentences shown, human review, maker-checker | The code checks do not judge meaning, and the meaning check uses a small model. Reviewers must read sentences against their facts. |
| Invented numbers, names or facts                 | Code computes the facts, and the number and name checks remove what is not in them                   | Low                                                                                                                                |
| Tipping off the customer                         | Prompt rule, tipping-off check, no customer-facing output                                            | Low                                                                                                                                |
| Case data leaving the deployment                 | Bundled model by default. BYOK only by explicit configuration, and the UI shows it                   | BYOK needs a data processing agreement, which is the deployer's to arrange                                                         |
| Instructions hidden in case notes                | Text marked as untrusted data, read-only tools, citation ledger                                      | Low                                                                                                                                |
| Over-reliance on the copilot                     | Advisory labels, "who wrote it" on every part, maker-checker                                         | Training and supervision                                                                                                           |
| Model or prompt changes going unnoticed          | Provenance on every record, prompt version, governance report                                        | Low                                                                                                                                |
| Records altered or removed                       | Append-only store, hash chain, hashes written to the audit log as well                               | A database administrator could rewrite both stores. Export the head hash to a separate system if that matters.                     |
| Model unavailable                                | Code-written text with a notice; the features keep working                                           | Low                                                                                                                                |
| Unfair treatment of some customers               | Facts are computed the same way for everyone, and the model does not score or decide                 | No bias evaluation on real cases yet (section 7)                                                                                   |

## 6. Mapping to frameworks

This is a guide, not legal advice.

- **NIST AI RMF:**
  - **Govern:** sections 1 and 4.
  - **Map:** the intended use and limits (sections 1 and 2).
  - **Measure:** `eval-models.js`, the checks and their removal reasons, the ratings and the governance report.
  - **Manage:** the switches, the change procedure, incident steps and the risk register.
- **ISO/IEC 42001**, which covers AI management systems: this document gives the inputs for the AI policy, roles, impact assessment, operational controls, monitoring and records. The deployer's management system has to adopt them.
- **Transparency to the FIU and regulators:** the AI-assistance note in the exports. Whether the FIU wants it in the report body (for example, the goAML `reason` field) is for the reporting entity to agree with its FIU.

## 7. Not done yet

- **Evaluation on real cases:** so far only demo data has been measured. The same applies to the meaning check: run it on real cases, and on a GPU, before relying on it.
- **Bias review on real data:** for example, whether facts or wording differ by name, region or customer type.
- **Agent strategy:** measure its tool use with the bundled model on more cases before making it the default.
- **Retention and ownership:** to be agreed with Tazama's TSC working group and each deployer.
