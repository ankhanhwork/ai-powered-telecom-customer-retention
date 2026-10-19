# AI-Powered Telecom Customer Retention — Slide Content and Speaker Notes

Content version: 19 October 2026. Language: English. Format: 24 main slides, in the user-approved order. This is the content master for the next presentation-authoring task, not an exported presentation or a completed executive summary.

**PPTX export, 19 October 2026:** `../deliverables/AI_Powered_Telecom_Customer_Retention.pptx` now contains the 24-slide deck, speaker notes, editable tables and three editable charts with embedded workbook snapshots. All slides were rendered and the final file was re-imported for checks. Native PowerPoint rendering and team rehearsal remain pending. The content below remains the source for revisions; the exported deck uses a signed horizontal SHAP chart in place of the suggested waterfall, with chart values rounded to three decimals and full-precision source attribution preserved in notes.

## Editorial decisions

- Preserve all 24 slide numbers and titles below. Problem, Data, Method, Tools, and Business Value & Strategy are section labels, not additional divider slides. The prototype demonstration intentionally precedes the detailed model slides.
- The approved outline contained historical v4 examples. The current technical content uses **rolling-month v5, 127 features, LightGBM tuned**, and the latest **11 October batch: 2,705 customers and 207 alerts/cases**. Do not restore the old CatBoost winner, month-end-only split, 3,202-customer batch, or 260-case total.
- Keep the September business case separate from the October synthetic prototype. Predictions issue on days **1, 11, and 21**, using the preceding month-end/day-10/day-20 snapshot. These are day-of-month schedules, not dates written as 1 November 2021.
- Use four evidence labels consistently: **Internal case information**, **Synthetic model result**, **Historical prototype evidence**, and **Illustrative financial assumption**. Planned tests and future work must be labelled as planned.
- The proposal is an academic prototype using FPT Telecom as a company case. It does not establish company endorsement, access to the production model, production readiness, or measured retention uplift.
- All slide copy, charts, captions, speaker notes, and demo narration are English. Existing source documents may remain Vietnamese.

## Presentation design specification

### White consulting-style theme

- Canvas: 16:9, white `#FFFFFF` on every slide. Use generous margins and a consistent title position.
- Palette sampled from the supplied logo image, **not an independently verified official brand manual**: blue `#0D69B3`, orange `#F27323`, green `#1FB34A`. Minor anti-aliasing variants exist in the PNG.
- Use blue for analytical series and headings, orange for the focal decision or selected result, and green sparingly for favourable outcomes or approved steps. Use dark navy `#142C48` for body text and grey `#61738A` for supporting labels. Orange and green are accents, not small body-text colours on white.
- Use Aptos or Arial throughout. Suggested sizes: cover 42–46 pt, slide titles 30–34 pt, body 20–24 pt, table text 17–20 pt, source notes 11–12 pt. Cut visible text before reducing size. Preserve a readable source note even when the explanation is in speaker notes.
- Prefer one clear chart, table, diagram, or product crop per slide. Use flat compositions, fine rules and whitespace. Avoid decorative card grids, heavy shadows, gradients, dashboard-like layouts, and repeated stock images.
- Keep charts and tables editable when the deck is authored. Existing SVG/PNG figures provide verified values and visual references; chart_data.json and comparison.csv are the numerical sources. Never stretch chart images.
- Use a subtle section label and slide number, without a logo, in the footer. Source notes should identify dates and evidence scope.
- Treat the “On-slide copy” below as the visible content budget. Speaker notes are narration and background; do not paste them into slide bodies.

### Logo placement: exactly one slide

Use `../website/mockups/fpt-telecom-logo.png` **only on slide 3**, next to the company case label. Preserve its aspect ratio and original colours, use transparent surroundings on white, and give it clear space. Do not repeat it on the cover, master, footer, ending, or other slides.

Product screenshots may contain a header logo. For every slide other than slide 3, crop the product header out or use a detail crop that excludes the logo. Caption a crop accurately; do not modify operational values to make a screenshot look current. Tool architecture uses text labels instead of vendor logos.

### Evidence and demo readiness as of this version

- V5 model, SHAP and the Supabase latest batch are verified in local artifacts/cloud SQL evidence.
- UI source was updated and built locally. No fresh Vercel deployment or browser end-to-end acceptance is established for v5.
- Five workflows were migrated to a new n8n instance, unpublished, with timers disabled. Historical live AI/delivery evidence is from the previous instance and v4 context on 18 October.
- The v5 cutover evidence contains **zero messages, zero outcomes, zero queued jobs and zero outbox entries**. Do not present a historical conversation as a v5 run.
- Default to a narrated walkthrough for slide 13 unless a separately authorised rehearsal establishes a working current live path. Do not trigger n8n merely to prepare this content. Any future live test needs a stated execution cap; preserve the 1,000-execution budget.

## Locked slide map

| Slides | Section | Narrative purpose |
|---|---|---|
| 1–2 | Opening | Introduce the proposal and PDMT logic |
| 3–6 | Problem | Establish the company case, decisions and boundaries |
| 7–9 | Data | Explain the information needed and the prototype data contract |
| 10–17 | Method | Review evidence, justify choices, show the experience, then explain model and assistance |
| 18–20 | Tools | Explain implementation and distinguish evidence from limitations |
| 21–24 | Business Value & Strategy | Show economics, a causal evaluation plan and a gated recommendation |

---

## Slide 1 — AI-Powered Telecom Customer Retention

**Section:** Opening. **Purpose:** Explain the proposed product in one sentence.

### On-slide copy

**AI-Powered Telecom Customer Retention**

A staff-approved workflow that turns churn alerts into coordinated customer care.

Advanced Business Analytics · Project Team

Academic prototype · October 2026

### Speaker notes

Our project addresses the operational work that follows a churn alert. A risk score can identify a customer who may leave, but a service team still needs to understand the situation, decide what to do, communicate appropriately and follow up. We propose a shared retention workflow with clear case ownership and human approval. The prototype combines risk predictions, model explanations, AI-assisted communication and outcome tracking. The business case concerns Internet services, with a local pilot proposed before any wider rollout. The demonstration uses synthetic data and simulated external channels.

### Visual and source instructions

Place the title on the left and a tightly cropped English case-detail view on the right. Exclude any embedded logo. Use `../website/mockups/02-customer-details-en.png` only as a **design reference** if a current v5 screenshot is unavailable; do not expose outdated model or cohort values. Replace “Project Team” with the formal group name and member names once supplied; do not infer them from technical account names.

Sources: [SYSTEM](SYSTEM.md), [IMPLEMENTATION](IMPLEMENTATION.md).

---

## Slide 2 — PDMT Framework

**Section:** Opening. **Purpose:** Connect business decisions to the analytical initiative.

### On-slide copy

| Problem / decision | Data | Method | Tools |
|---|---|---|---|
| Who should receive attention first? | Risk scores, waiting time, contact eligibility | Risk ranking and capacity-aware queue design | Python, Supabase, CS web app |
| What should the agent discuss? | Service, billing, support and conversation facts | SHAP interpretation and grounded drafting | LightGBM SHAP, LLM, knowledge source |
| When should another team help? | Customer reply and unresolved service requests | Staff-directed escalation and follow-up rules | CS web app, n8n, support handoff |
| Does the workflow create value? | Period outcomes, intervention logs and costs | Operational measurement and controlled pilot | Supabase, reporting and experiment analysis |

**Decision quality connects the four PDMT elements.**

### Speaker notes

We use PDMT to structure a decision system. Each row starts with a business decision, identifies the information needed, selects a method and names the tools that deliver it. Some capabilities are implemented in the prototype, while others remain evaluation or design work. For example, the current queue supports risk ordering, but capacity-aware and due-date prioritisation require further validation. Likewise, storing outcomes enables future evaluation, but does not by itself establish economic impact. This distinction guides the presentation: we will explain both what the prototype demonstrates and what a business pilot must still prove.

### Visual and source instructions

One full-width four-column matrix. Use short cells and blue column headings. Add a footnote: “Implemented features and planned evaluation are distinguished in subsequent slides.” Avoid implying all proposed queue policies are already live.

Sources: [REPORT](REPORT.md), [SYSTEM](SYSTEM.md), [IMPLEMENTATION](IMPLEMENTATION.md), especially current gaps.

---

## Slide 3 — Business Context and Retention Opportunity

**Section:** Problem. **Purpose:** Establish FPT Telecom as the specific company case and quantify the pilot context.

### On-slide copy

**Company case: FPT Telecom Internet services**

**National context:** reported year-to-date churn count increased **20%** versus the comparable 2025 period.

**Proposed pilot: Binh Duong**

| Indicator | Case information |
|---|---:|
| August 2026 churn | 1,300 customers |
| September 2026 churn | 2,500 customers |
| Customers at the start of September | Approximately 210,000 |
| September churn rate | Approximately 1.19% |

**VND 512.5 million** in monthly subscription revenue associated with 2,500 customers at a reference fee of VND 205,000.

*Internal case information. Revenue illustration, not measured savings or profit.*

### Speaker notes

The project uses FPT Telecom as its company case. Information supplied by the project participant indicates that national year-to-date Internet churn count rose by 20% against the comparable prior-year period. This is an increase in customer count, not a 20% churn rate. Binh Duong provides the local pilot context: September churn reached 2,500, compared with 1,300 in August. Dividing September churn by approximately 210,000 customers gives a rate of about 1.19%. At a reference monthly fee of VND 205,000, those subscriptions represent VND 512.5 million per month. This calculation indicates scale; it does not establish recognised revenue loss or the amount our solution could recover. The internal figures have not been independently audited.

### Visual and source instructions

**This is the only slide containing the FPT Telecom logo.** Place it beside the company case label. Use two bars for August and September churn, with a zero baseline and explicit customer units. Put 1.19% and the revenue illustration in a concise annotation. Keep the national +20% separate from the local monthly comparison. If showing +92.3%, label it “September versus August churn count”; do not compare it directly with national year-to-date growth.

Source: [PROBLEM, sections 1–2](PROBLEM.md). Calculation: 2,500 / 210,000 = 1.1905%; 2,500 × 205,000 = 512,500,000 VND. No company endorsement is implied.

---

## Slide 4 — Current Process and Operational Gaps

**Section:** Problem. **Purpose:** Explain why alerts still require operational support.

### On-slide copy

**Reported current process**

Monthly model output → score >500 list → Customer Service review → customer contact

| Reported gap | Decision requiring support |
|---|---|
| Agents know the customer is at risk but are unsure how to approach | What should we verify and discuss? |
| Some customers leave before contact | Who should be contacted earlier? |
| Contact does not always resolve the problem | What action or escalation is appropriate? |

**September handover: approximately 8,000 flagged customers.**

*Current tracking tools, contact success and retention effectiveness require further verification.*

### Speaker notes

The case information describes a model that already sends a list of scores above 500 to Customer Service at the beginning of the month. Staff feedback identifies uncertainty about the right approach, late contact and unresolved problems despite contact. These reports motivate decision support, case ownership and coordination. They do not prove that the existing model is inaccurate, that no tracking system exists, or that staff perform poorly. We also cannot divide total local churn by the flagged list to calculate precision: those customer sets and interventions have not been matched. The prototype's three-times-monthly refresh is our proposed design, rather than a claim about the company's current process.

### Visual and source instructions

Show the known current process in one horizontal row. Place three short gap annotations beneath it. Use process arrows graphically, with ordinary text labels. Keep the approximately 8,000-person September list distinct from the 207-case synthetic batch used later.

Source: [PROBLEM, sections 1, 3–4](PROBLEM.md).

---

## Slide 5 — Stakeholders and Decisions

**Section:** Problem. **Purpose:** Establish cross-functional value without expanding the application scope.

### On-slide copy

| Stakeholder | Decision | Required information | Expected value |
|---|---|---|---|
| CS Agent | How to handle an assigned case | Facts, risk drivers, conversation, eligible actions | Better-informed customer care |
| CS Supervisor | How to allocate attention and handle exceptions | Queue, ownership, case progress | Clear accountability |
| Data Analytics | Whether predictions remain useful | Versioned scores, features and outcomes | Traceable model feedback |
| Technical Support | How to investigate a referred issue | Verified symptoms and support request | Relevant handoff context |
| Retention / Marketing | Which offers are appropriate | Policy, eligibility and usage | Controlled interventions |
| Finance / Management | Whether the pilot should continue | Costs, incremental outcomes and guardrails | Evidence for investment |

**App users: CS Agent and Supervisor. Other teams retain their own systems.**

### Speaker notes

The initiative crosses functions, but the operational application remains focused on Customer Service. Agents handle their assigned cases; supervisors coordinate the pilot and exceptions. Data Analytics provides a versioned prediction input, while Technical Support receives requests and works in its own system. Retention or Marketing defines permitted offers, and Finance contributes assumptions and cost validation. These teams do not require separate prototype dashboards. The value of collaboration is the consistency of the information and handoff, rather than the number of user interfaces. Expected benefits on this slide are hypotheses to evaluate during a pilot.

### Visual and source instructions

Use a full-width table with six rows and concise phrases. Give the first two stakeholder names blue emphasis; use a small line below the table to mark the app boundary. No department logos or staff personal details.

Sources: [SYSTEM, scope and roles](SYSTEM.md), [REPORT, stakeholder value](REPORT.md).

---

## Slide 6 — Project Objectives and Scope

**Section:** Problem. **Purpose:** Define what the prototype is intended to improve and what remains outside scope.

### On-slide copy

**Objectives**

- Help staff prioritise and understand risk alerts.
- Support relevant communication and service escalation.
- Record ownership, review, follow-up and period outcomes.

**Prototype boundary**

Included: CS queue and case details, model explanations, AI drafts, staff approval, simulated messaging and support handoff.

External or future: the production prediction model, technical-service execution, live messaging providers and causal uplift targeting.

**Every outbound message requires staff approval.**

### Speaker notes

The prototype builds the operational layer following a prediction. Its core objectives are to help staff understand a case, choose a reasonable action and preserve accountability throughout the interaction. The enterprise model is conceptually an upstream input. Because we cannot access it, an offline synthetic model supplies demonstration predictions. AI prepares content; it cannot approve an offer or autonomously conduct a negotiation. The portal simulates the customer channel. Technical requests cross a system boundary, so a handoff receipt does not prove the technical issue has been resolved. A closed care case and a customer active at the end of the observation window remain separate concepts.

### Visual and source instructions

One scope diagram: CS workspace in the centre; prediction adapter, customer portal and external support around it. Use a blue boundary around the workspace and orange review gates. Label mock transport explicitly. Avoid a long feature checklist.

Sources: [SYSTEM](SYSTEM.md), [PROBLEM, current product decision](PROBLEM.md).

---

## Slide 7 — Data Requirements and Sources

**Section:** Data. **Purpose:** Separate enterprise data requirements from what the academic prototype actually contains.

### On-slide copy

| Domain | Business use | Prototype source / status |
|---|---|---|
| Subscription and plan | Understand the customer relationship | Synthetic profiles; public identifiers and tenure seed the cohort |
| Service, billing and support | Verify context and identify suitable follow-up | Simulated timestamped histories |
| Prediction and explanations | Review risk and model attribution | V5 model outputs and native SHAP |
| Conversation and case actions | Coordinate the next interaction | App records; historical mock-flow evidence |
| Policy, offers and costs | Check eligibility and economic value | Demo knowledge; offer catalog and complete cost UI pending |
| Service outcome | Assess churn within the correct period | Synthetic completed labels offline; current batch Unknown |

Public starting file: **7,043 records × 38 columns; 5,517 Internet customers**.

*Fictional public source and synthetic histories, not FPT operational customer data. Source URL/license still require completion.*

### Speaker notes

A production solution needs reliable links between the subscriber, service history, bills, support requests, contact history and outcomes. The academic prototype uses a fictional public dataset as a starting point. The generator reads identifiers, tenure and Internet-service eligibility to construct a cohort; it does not reuse the public churn labels or post-churn reasons to build the current simulation. Service events and longitudinal labels are generated. This makes it possible to demonstrate a coherent pipeline, but synthetic relationships cannot establish market validity for FPT. The original dataset URL and redistribution licence still need confirmation before packaging raw data for submission.

### Visual and source instructions

Use one source-status table, with a narrow “Enterprise data needed” annotation. Do not imply that the original public file contains 127 features or real longitudinal records. Keep public, generated and application-generated sources visually distinct with text labels.

Sources: [DATA_ML](DATA_ML.md), [source data profile](evidence/source_data_profile.json), [ML README](../ml/README.md).

---

## Slide 8 — Data Preparation and Quality Controls

**Section:** Data. **Purpose:** Explain how the panel and features respect the prediction cutoff.

### On-slide copy

Public cohort → synthetic event histories → as-of snapshots → 127-feature matrix → purged partitions

**V5 panel: 5,517 customers and 113,937 snapshot rows.**

| Control | Rule |
|---|---|
| Time integrity | Use facts available at the snapshot cutoff |
| Feature whitelist | Exclude IDs, labels, future events and generation audit variables |
| Missingness | Prepaid payment fields are not applicable, not unpaid debt |
| Label consistency | One churn event per customer determines overlapping-window labels |
| Observation maturity | An incomplete target window remains Unknown |
| Reproducibility | Preserve generator code, frozen artifacts and hashes |

### Speaker notes

V5 issues predictions on the first, eleventh and twenty-first day of each month, using the previous month-end, tenth and twentieth day respectively. Each prediction covers one calendar month from issuance. A customer may therefore contribute several overlapping snapshots. Features must be computed as they were known at each cutoff; later bill payments or ticket resolutions cannot alter past features. The same event history determines every overlapping label. We also preserve meaningful missingness: postpaid payment metrics do not apply to prepaid subscribers. The 113,937 records are snapshot rows across the generated panel, not independent customers or the number of rows used for training.

### Visual and source instructions

A five-stage data pipeline above a compact control table. Show the schedule as “Days 1 / 11 / 21” to avoid date ambiguity. Footnote: “Synthetic rolling-month v5; repeated observations per customer.”

Sources: [DATA_ML, v5 scope](DATA_ML.md), [generation quality](evidence/ml/rolling_month_v5/generation_quality.json), [ML README](../ml/README.md).

---

## Slide 9 — Data Architecture and Example Records

**Section:** Data. **Purpose:** Show the entity relationships and the distinction between action and outcome.

### On-slide copy

Customer → Snapshot → Prediction → Retention Case

Case → Conversation / Approved Message / Support Request / Cost Record

Customer + Target Period → Service Outcome

**Illustrative schema record**

| Field | Example |
|---|---|
| Customer reference | DEMO-A — invented presentation identifier |
| Snapshot | 10 October 2026, end of day |
| Target period | 11 October to 11 November 2026, end exclusive |
| Case status | Care completed — illustrative |
| Service outcome | Unknown |

**Care completion does not establish retention.**

### Speaker notes

The customer is the shared reference, but a prediction also belongs to a snapshot and a specific target period. A case stores the care process and its history. Conversations, messages, support requests and costs record what happened during that process. Service outcomes require a separate observation and source for the matching target window. The example uses an invented presentation identifier and is not a query result. It illustrates why a case may be complete while the outcome remains Unknown. The latest operational batch contains one current snapshot per customer, while the offline panel contains repeated snapshots. Future refreshes need to preserve ownership and history without creating duplicate outreach.

### Visual and source instructions

Editable entity diagram with seven or eight business-level entities, not every physical database table. Put the short example beside it. Never show actual emails, phone numbers, Auth IDs or database credentials. Do not attach the invented case state to a real customer.

Sources: [SYSTEM, data and outcome contracts](SYSTEM.md), [v5 cutover](evidence/ml/rolling_month_v5/supabase_v5_cutover.json).

---

## Slide 10 — Literature Review: Approaches to Customer Retention

**Section:** Method. **Purpose:** Summarise relevant international research before selecting methods.

### On-slide copy

| Approach | Evidence / contribution | Limitation for our problem |
|---|---|---|
| Explainable churn prediction | SHAP provides feature contributions for individual predictions [R1]; telecom research combines classifiers with local/global explanations [R2] | Attribution does not identify the causal effect of a care action |
| Profit-driven retention | Telecom research incorporates campaign economics into model evaluation and customer selection [R3] | Requires defensible cost and value inputs |
| Intervention-sensitive targeting | Two field experiments show that the highest-risk customers need not be the best intervention targets [R4] | Requires treatment/control evidence to estimate responsiveness |
| AI assistance for service staff | A field study reports higher issues resolved per hour with AI assistance [R5] | Evidence comes from a different firm and service setting |

### Speaker notes

We selected literature by relevance to the decisions in our case, rather than by model accuracy alone. Explainability supports the question of why a model assigns risk. Profit-driven retention asks whether a campaign is economically worthwhile. Intervention-sensitive targeting distinguishes likely churn from likely response to treatment. Finally, field evidence on AI assistance motivates support for frontline staff. These sources address complementary pieces of the problem. They do not establish a single universally superior architecture, nor validate this particular prototype. The review is selective, based on the accessible primary publications and abstracts listed in the reference register. It is not a systematic review of all global deployments.

### Visual and source instructions

Use four rows, each with a method, evidence and boundary. Short references in the source line: Lundberg & Lee, 2017; Poudel et al., 2024; Verbeke et al., 2012; Ascarza, 2018; Brynjolfsson et al., 2025. Full links and citation details appear in the register below and in slide notes. Do not compare published accuracy with the synthetic AUC.

Sources: [R1–R5](#external-reference-register). The published R5 study reports an average 15% increase in resolved issues per hour, but omit the percentage from visible copy unless the setting and non-transferability are equally clear.

---

## Slide 11 — Literature-Informed Design Choices

**Section:** Method. **Purpose:** Translate evidence into justified choices and explicit deferrals.

### On-slide copy

| Literature insight | Project choice | Status |
|---|---|---|
| Explain individual predictions [R1–R2] | Native SHAP grouped into six business categories, accompanied by facts | Implemented on v5 |
| Support frontline staff [R5] | Separate explanation, chat and call-script assistance, with staff review | Historical live evidence; migrated runtime pending |
| Evaluate campaign economics [R3] | Log costs and assess margin-based scenarios | Partial implementation; pilot measurement planned |
| Risk and responsiveness differ [R4] | Retain risk scoring for the demo; propose randomised impact evaluation | Pilot planned; uplift modelling deferred |

**Project contribution: integration and adaptation to the CS workflow.**

### Speaker notes

The mapping distinguishes evidence from our engineering decisions. SHAP is implemented for the current model, while the six-category grouping is our operational presentation choice. Research on AI assistance supports testing staff augmentation, but the exact approval policy is a project control, not a result established by that paper. Economic analysis is included, although the cost interface and genuine financial inputs are unfinished. We have not implemented an uplift model or profit-maximising targeting engine. Both require data the prototype does not provide. Our contribution is to combine established methods in a traceable, staff-approved workflow, then specify how to evaluate it. We make no global novelty claim.

### Visual and source instructions

Four-row mapping table. Use plain text status labels, with green limited to verified v5 capabilities and orange for pending evaluation. Avoid labelling the whole system “implemented and validated.”

Sources: [R1–R5](#external-reference-register), [ML README](../ml/README.md), [SYSTEM](SYSTEM.md), [n8n migration](evidence/n8n_migration.json).

---

## Slide 12 — Analytical and Decision Workflow

**Section:** Method. **Purpose:** Explain how the methods fit into the operating decisions.

### On-slide copy

1. **Identify:** receive versioned scores and target windows.
2. **Understand:** review signed SHAP groups and timestamped customer facts.
3. **Prepare:** check contact eligibility and draft a relevant message or call script.
4. **Approve:** staff edit and approve the specific message revision.
5. **Coordinate:** exchange messages, request support and manage follow-up.
6. **Evaluate:** observe service outcomes and costs for the correct period.

**AI drafts content. Staff authorise communication. Outcome data determine retention status.**

### Speaker notes

The workflow connects analytical outputs to accountable decisions. A prediction arrives with a model version and a target window. The agent reviews attribution and the underlying facts before deciding whether to contact the customer or request more information. The LLM can assist with wording, but should not invent eligibility, debt, appointments or technical resolutions. The database checks authorisation and approved revisions before sending through the mock adapter. Replies and reminders support the next task. After the observation period, an outcome source establishes whether the customer churned or remained active. Due-date prioritisation and general refresh handling should be validated before claiming complete operational optimisation.

### Visual and source instructions

Six-step diagram with a conspicuous approval gate. Add a lower lane showing method responsibility: model / attribution / rules + LLM / staff / workflow / evaluation. Use text labels, not vendor logos. The sequence describes the intended end-to-end design; current runtime limitations remain on slides 19–20.

Sources: [SYSTEM](SYSTEM.md), [n8n README](../n8n/README.md), [IMPLEMENTATION](IMPLEMENTATION.md).

---

## Slide 13 — Prototype Demonstration

**Section:** Method. **Purpose:** Let the audience see the operating experience before the model details.

### On-slide copy

**Demonstration cohort**

- Snapshot: **10 October 2026**.
- Prediction window: **[11 October, 11 November 2026)**.
- Latest batch: **2,705 customers; 207 scores >500**.
- Service outcomes: **Unknown**.

**Walkthrough:** Queue → case context → AI assistance → staff review → mock reply → follow-up or support.

*Synthetic data. Simulated channels. Current live-runtime readiness must be confirmed before presenting.*

### Speaker notes

We now show how an agent would use the proposed workflow. The latest verified batch starts on 11 October and runs until 11 November, with the end date excluded. It contains 2,705 customers and 207 flagged cases. We follow one anonymised case from the queue through review and a proposed interaction. At this document version, the new workflow instance is unpublished and the updated UI has not been accepted in a fresh browser journey. The safe presentation format is therefore a narrated walkthrough. If a historical recording is used, label it as the 18 October v4 workflow recording. It demonstrates earlier behaviour and does not prove the current v5 integration is live.

### Demonstration script and fallback

| Step | Presenter narration | Operator / fallback instruction |
|---|---|---|
| Queue | “The batch turns risk alerts into cases with an accountable owner.” | Show a current v5 queue crop, if captured; otherwise show a labelled interface design reference |
| Context | “The agent checks the window, facts and model-identified drivers.” | Open one authorised anonymised case; keep the same case throughout an actual run |
| Draft | “AI prepares a draft for staff review.” | Use a verified output only if available; otherwise use slide 17's authored illustration, clearly labelled |
| Review | “Only the approved revision may enter the delivery process.” | Show the gate or an accurately labelled historical recording |
| Reply | “A customer reply updates the care conversation.” | Use a labelled mock/historical interaction; do not fabricate a v5 receipt |
| Outcome | “Care progress changes, but retention remains Unknown until evidence matures.” | Return to the target-window and outcome distinction |

No workflow executions are authorised by this content document. A future rehearsal must establish a concrete execution budget before a live run; keep timers disabled outside controlled demo operation.

### Visual and source instructions

Use a clean English product crop and a short sequence beneath it. No embedded logo. Preserve labels for design reference, historical recording or live demonstration as applicable. Do not include login credentials in screenshots or recordings.

Sources: [v5 cutover](evidence/ml/rolling_month_v5/supabase_v5_cutover.json), [n8n migration](evidence/n8n_migration.json), [historical workflows](evidence/n8n_workflows.json).

---

## Slide 14 — Model Development and Evaluation Design

**Section:** Method. **Purpose:** Explain how the current model comparison avoids temporal and customer leakage.

### On-slide copy

**Common input:** 127 frozen features for LightGBM and CatBoost, baseline and tuned.

| Partition / stage | V5 protocol |
|---|---|
| Training | Development customers; target windows ending by 1 July |
| Tuning | 30 trials per family, three purged chronological folds; mean ROC AUC |
| Validation | July-start windows; selection between the two tuned candidates |
| Calibration | Separate customers; five-fold customer-grouped OOF evaluation |
| Exploratory test | Audit customers; windows starting 1 and 11 September |
| Current inference | October-start windows; incomplete outcomes remain Unknown |

**Purge by target-window end. Lock selection before test scoring.**

### Speaker notes

Overlapping monthly labels make snapshot-date splitting alone insufficient. A training example is available only after its target window has ended, so the pipeline purges labels extending into a validation boundary. The three inner folds preserve chronology. Calibration customers and audit customers are excluded from model fitting and selection. Calibration cross-validation also keeps all observations for a customer together. We evaluate four candidates, but the prespecified selection pool contains only the two tuned models. Validation ROC AUC is primary, with log loss as a tie-breaker. September testing is reported as exploratory synthetic evidence, and is not used to change the winner or fit calibration. Repeated snapshot rows are not independent customer experiments.

### Visual and source instructions

Editable timeline with separated customer lanes for development, calibration and audit. Keep July-start windows visually distinct from September-start testing. Footnote counts if space permits: train 42,936 rows; validation 6,253; calibration 1,552; test 1,485 rows from 758 customers. Move hyperparameters into notes, not the visible slide.

Sources: [ML README](../ml/README.md), [DATA_ML](DATA_ML.md), [split summary](evidence/ml/rolling_month_v5/split_summary.csv), [verification](evidence/ml/rolling_month_v5/verification.json).

---

## Slide 15 — Model Results and Selection

**Section:** Method. **Purpose:** Present the selected model under the actual selection rule.

### On-slide copy

| Candidate | Validation ROC AUC | Exploratory test ROC AUC | Exploratory test AP |
|---|---:|---:|---:|
| LightGBM baseline | 0.9469 | 0.9473 | 0.7166 |
| **LightGBM tuned — selected** | **0.9483** | **0.9467** | **0.7138** |
| CatBoost baseline | 0.9365 | 0.9374 | 0.7183 |
| CatBoost tuned | 0.9356 | 0.9348 | 0.7253 |

**Selection:** highest validation ROC AUC among the two tuned candidates.

**Latest inference:** 207 alerts among 2,705 customers; outcome Unknown.

*Synthetic v5 results. AUC measures ranking, not percentage accuracy or retention impact.*

### Speaker notes

LightGBM tuned was selected using validation ROC AUC of 0.9483. Its exploratory test AUC is 0.9467 and AP is 0.7138. The baseline's slightly higher test AUC and CatBoost tuned's higher test AP do not alter the prespecified choice. These differences do not establish universal algorithm superiority. The selected model uses 114 boosting rounds, and its own Platt calibrator passed the customer-grouped adoption checks. A score above 500 means calibrated probability above 0.5 under this synthetic model; it does not mean the customer can be retained by an offer. The latest batch has 207 alerts. We do not combine all 409 alerts across two overlapping inference batches into unique cases.

### Visual and source instructions

Use the exact four-row comparison table and a single latest-batch annotation. Orange emphasis only on the selected row. Optional small distribution figure: `evidence/ml/rolling_month_v5/figures/slides/03_prediction_distribution.svg`. Keep ROC/PR and tuning-history figures as backup material rather than crowding the slide. Existing `01_model_comparison.svg` covers the tuned pair; it does not replace the requested four-candidate table.

Sources: [RESULTS](evidence/ml/rolling_month_v5/RESULTS.md), [comparison.csv](evidence/ml/rolling_month_v5/comparison.csv), [chart data](evidence/ml/rolling_month_v5/figures/slides/chart_data.json).

---

## Slide 16 — Risk Explanations

**Section:** Method. **Purpose:** Show a faithful model explanation and its action boundary.

### On-slide copy

**Six approved business groups**

Connection Quality · Support Experience · Payment & Overdue Bills · Usage & Engagement · Renewal & Promotion Status · Plan, Pricing & Relationship

**Selected synthetic example: predicted probability 96.96%**

| Positive group | Contribution, calibrated log-odds |
|---|---:|
| Plan, Pricing & Relationship | +7.061 |
| Payment & Overdue Bills | +0.706 |
| Connection Quality | +0.056 |

**Review the underlying facts before choosing an action.**

*Purposefully selected highest-scoring profile. SHAP explains the model; it does not confirm why the customer will leave.*

### Speaker notes

The example comes from the verified latest-batch figure data. It is the highest-scoring synthetic profile, so it is intentionally illustrative rather than representative. Feature contributions are summed with their signs into six approved groups; the interface surfaces up to three strictly positive groups. The full explanation also includes negative contributions and a baseline. For this example, the baseline is about −4.237 calibrated log-odds, with negative offsets from Support Experience, Usage & Engagement, and Renewal & Promotion Status. All six groups reconstruct the saved probability of approximately 0.9696. The figures are log-odds contributions, not percentage-point changes in probability. A positive payment-group attribution alone does not prove debt; staff must check billing mode, applicability and actual facts.

### Visual and source instructions

Use `evidence/ml/rolling_month_v5/figures/slides/07_shap_example_waterfall.svg`, retaining all six signed groups and baseline. The small positive-group table may be reduced to annotations if the full chart is large. Never normalise the top three into shares of churn probability. Do not use this highest-scoring example as a live portal identity without separately checking permissions/consent and matching the current record.

Sources: [chart data](evidence/ml/rolling_month_v5/figures/slides/chart_data.json), [SHAP verification](evidence/ml/rolling_month_v5/shap_summary.json), [active group mapping](../ml/shap_groups.json).

---

## Slide 17 — Action Support Chat & Call

**Section:** Method. **Purpose:** Show how explanations support useful communication without unsupported promises.

### On-slide copy

**Chat draft — authored illustration for staff review**

“Hello, I’m contacting you from customer care to check whether your current Internet plan still meets your needs. Have you experienced any recent service or billing concerns? I can review the relevant details with you and arrange the appropriate follow-up.”

**Call script — staff-led conversation**

1. Ask whether it is a convenient time to speak.
2. Confirm the customer's concern before proposing a solution.
3. Check facts and any permitted options.
4. Agree the next action and follow-up, then record the interaction.

**Staff review covers facts, tone, eligibility and contact permission.**

### Speaker notes

The product provides separate message and call-script outputs. These examples are authored presentation illustrations, not claimed to be fresh LLM outputs or completed conversations. For the risk profile on the previous slide, a neutral first contact is preferable to asserting a cause that has not been confirmed. The assistant should not disclose an internal risk score, invent unpaid debt, promise a discount, book an unconfirmed appointment or claim a technical repair is complete. Agents may request a rewrite while preserving the facts and policy. A call script assists a human caller; the prototype does not place autonomous calls. An approved outbound message still needs the correct revision and an eligible contact at send time.

### Visual and source instructions

One side-by-side composition: a short message excerpt and numbered call outline, with the staff review gate beneath. Label both examples “Authored illustration; not an executed conversation.” Avoid chat bubbles that could be mistaken for a genuine customer exchange. Any later screenshot of actual AI output must retain a dated evidence label and omit embedded logos.

Sources: [SYSTEM, AI request and approval contracts](SYSTEM.md), [historical AI evidence](evidence/n8n_agents.json), [n8n README](../n8n/README.md). Illustrative wording above is newly authored for this presentation.

---

## Slide 18 — Technology Architecture and Tool Choices

**Section:** Tools. **Purpose:** Explain how the architecture supports reproducibility, collaboration and usability.

### On-slide copy

| Tool | Responsibility | Reason for selection |
|---|---|---|
| Python + LightGBM / CatBoost | Offline features, model comparison, prediction and SHAP | Reproducible batch analytics |
| Supabase / PostgreSQL | Shared data, Auth, row-level access and transactional actions | Consistent state and scoped access |
| React / Vite | Agent, Supervisor and customer-demo interfaces | Task-focused experience for non-technical users |
| n8n | AI requests, mock delivery and care-operation orchestration | Inspectable workflows and team handoff |
| LLM + demo knowledge | Explanations and communication drafts | Context-based assistance with staff review |

**Shared case state connects analytics and customer care.**

### Speaker notes

Python runs offline; the prototype does not require an always-on prediction API. Supabase holds the shared case state and checks role and ownership at the database boundary. The web application presents tasks and facts to staff rather than exposing implementation details. n8n separates three AI output types from mock delivery and care operations, while the LLM draws on case context and an enabled FAQ knowledge source. This division supports collaboration and traceability. It does not prove scalability: concurrency, provider integration and operational monitoring still need testing. The migrated workflows remain unpublished, and high-frequency idle polling would waste the limited demo execution budget. Event-driven activation or tightly controlled demo operation is the intended next operating choice.

### Visual and source instructions

Prefer one labelled architecture diagram with these responsibilities as short annotations, rather than a dense table plus a second diagram. Use text-only tool names. Put the staff/browser boundary, database approval boundary and mock external channel clearly on the diagram. Keep server credentials outside the browser in the visual.

Sources: [SYSTEM](SYSTEM.md), [n8n README](../n8n/README.md), [n8n migration](evidence/n8n_migration.json).

---

## Slide 19 — Test Results

**Section:** Tools. **Purpose:** Report actual AI-agent evidence and its limits, rather than inventing a quality benchmark.

### On-slide copy

**Historical AI workflow checks — 18 October 2026, previous instance / v4 context**

| Check | Recorded observation |
|---|---|
| Requested output types | Message, call script and explanation completed with the knowledge tool |
| Approval separation | Message stayed unapproved/unsent; script and explanation created no outbound |
| Duplicate handling | Duplicate requests coalesced; wakeups claimed each job once |
| Approved delivery and reply | Separate workflow evidence records one mock delivery and a deduplicated reply |
| Factual grounding | One unsafe draft was rejected and superseded before sending |

**Current migration:** five workflows unpublished; timers disabled; no new runtime test.

*These checks demonstrate specific behaviours, not an AI accuracy rate or an SLA.*

### Speaker notes

The historical evidence records a real LLM connection and Google Sheets knowledge use, rather than template text presented as generated output. One recorded group of three artifact requests completed in about twelve seconds; that single observation is not a latency benchmark or service guarantee. Other checks record approval separation, mock delivery and reply deduplication. Importantly, an initial unsafe draft was rejected and superseded, so it would be misleading to present the results as proof that hallucination has been eliminated. We have no systematic scored dataset of grounding, tone or eligibility quality in this evidence. A structured rubric remains future work. After migration, graph and credential references were checked without executing workflows; current runtime acceptance is pending.

### Visual and source instructions

Use the dated evidence table as the primary visual. Add an excerpt of sanitised output only if it can be linked to a saved artifact. Do not create pass percentages, star ratings, invented test-set sizes or current-live status indicators. Optional notes-only future rubric: correctness against facts, unsupported promises, instruction adherence, English clarity and contact-policy compliance, with two human reviewers and a defined sample.

Sources: [historical AI agents](evidence/n8n_agents.json), [historical workflow checks](evidence/n8n_workflows.json), [migration checks](evidence/n8n_migration.json).

---

## Slide 20 — Validation, Controls and Current Limitations

**Section:** Tools. **Purpose:** Separate technical checks from deployment and business validation.

### On-slide copy

| Area | Evidence available | Remaining boundary |
|---|---|---|
| V5 ML and explanation | 43 ML tests; verified SHAP reconstruction | Synthetic data; no FPT production validation |
| Database behaviour | 38 existing + 7 rolling-window + 2 replacement/restore checks | Local checks do not establish cloud concurrency |
| Access scope | Cloud SQL: Agent 1 case, Supervisor 207, portal 0 internal cases | Fresh v5 browser journey pending |
| UI source | 10 tests and build passed | Updated Vercel deployment pending |
| Workflow controls | Historical approval, opt-out and deduplication evidence | Migrated n8n runtime not accepted |

**Technical feasibility is supported. Business impact remains unmeasured.**

### Speaker notes

Validation has several layers with different evidential strength. Current v5 artifacts include model and explanation checks, rolling-window database checks and local UI tests. Cloud SQL role checks show the intended visibility scopes, including no internal cases for the customer portal. These checks should not be treated as a completed multi-user browser acceptance test. They also do not establish high-load concurrency, production operations or actual channel delivery. The updated UI still requires deployment and rehearsal; n8n runtime migration is not complete. The offer catalog and cost interface are unfinished. Financial and retention benefits therefore remain hypotheses. The appropriate conclusion is that the core technical design is feasible within the synthetic/mock scope and needs a controlled next-stage evaluation.

### Visual and source instructions

One evidence–boundary table. Keep dates visible and do not sum different suites into a single “all tests” score. In notes, preserve additional security review items: SECURITY DEFINER RPCs require continued access checks, and stronger Auth protections remain a deployment consideration. Do not label the system production-ready or security-certified.

Sources: [v5 cutover evidence](evidence/ml/rolling_month_v5/supabase_v5_cutover.json), [SHAP verification](evidence/ml/rolling_month_v5/shap_summary.json), [IMPLEMENTATION](IMPLEMENTATION.md), [historical workflow evidence](evidence/n8n_workflows.json).

---

## Slide 21 — Expected Business Value and Cost Scenarios

**Section:** Business Value & Strategy. **Purpose:** Make the economic assumptions explicit and show the break-even requirement.

### On-slide copy

**Illustrative scenario assumptions — not an approved budget or measured result**

- 1,000 customers assigned to the new workflow.
- Three-month economic horizon; incremental retained customers contribute VND 300,000 each over that horizon.
- Intervention cost: VND 10,000 per assigned customer; allocated operating cost: VND 10 million.

| Scenario | Incremental retention | Additional retained customers | Net value, VND million | ROI |
|---|---:|---:|---:|---:|
| Low | 2 percentage points | 20 | −14 | −70% |
| Base | 5 percentage points | 50 | −5 | −25% |
| High | 8 percentage points | 80 | +4 | +20% |

**Break-even: 6.67 percentage points of incremental retention under these assumptions.**

### Speaker notes

These numbers are deliberately hypothetical and should be replaced with Finance-approved inputs. We use 1,000 treatment-assigned customers to illustrate the economics; this is neither the 207-case demo cohort nor a statistically powered pilot size. Total cost is 1,000 times VND 10,000 plus VND 10 million, or VND 20 million. At five percentage points of incremental retention, fifty additional retained customers contribute VND 15 million, so net value remains negative. The high case becomes positive, illustrating why effective intervention and cost discipline matter. The VND 300,000 input is contribution margin over three months, not the VND 205,000 reference monthly fee. It assumes the additional customers contribute for that horizon, which needs observation and sensitivity testing. We have not demonstrated these retention effects.

### Calculation specification

Let N = 1,000, H = three months, incremental retained fraction = d, margin per additionally retained customer over H = M = 300,000 VND, per-assigned-customer intervention cost = c = 10,000 VND, and allocated operating cost over H = F = 10,000,000 VND.

- Total cost C = N × c + F = 20,000,000 VND.
- Incremental contribution = N × d × M.
- Net value = N × d × M − C.
- ROI = net value / C.
- Break-even d = C / (N × M) = 0.0666667 = 6.67 percentage points.

The intervention cost envelope must include staff time, expected redeemed-offer expense and contact/channel costs exactly once. Allocate LLM, infrastructure and support overhead consistently within F or c; do not double-count. In a pilot, use incremental costs against the existing-process counterfactual, keep currency/horizon consistent, and account for uncertainty, margin differences and persistence of retention. Time saved is an operational benefit; do not monetise it twice if already reflected in the cost calculation.

### Visual and source instructions

Use a simple three-bar net-value chart with a zero line and a compact assumptions strip, or the three-row table if more legible. Orange marks break-even; blue represents scenarios. Label the chart “Illustrative assumptions, not measured ROI.” Do not connect this scenario to an approved FPT offer. No external source is claimed for the chosen numbers.

Sources: new author-created arithmetic illustration using the framework in [REPORT, business case](REPORT.md); profit-oriented motivation [R3](#external-reference-register). All numerical assumptions above are provisional.

---

## Slide 22 — Pilot Evaluation and Success Metrics

**Section:** Business Value & Strategy. **Purpose:** Define how genuine benefit could be measured.

### On-slide copy

**Proposed design:** randomly assign eligible customers to the new workflow or the documented current process.

| Layer | Metric | Measurement rule |
|---|---|---|
| Prediction | ROC AUC, AP, calibration, Recall@K | Evaluate mature labels, version and capacity K |
| Operations | Time to first contact; review minutes per case | Use assignment/contact timestamps and a defined task sample |
| AI assistance | Acceptance/edit rate; factual/policy error rate | Human review with a stated rubric and denominator |
| Business | Incremental retention; net contribution | Compare assigned groups over a complete, common horizon |
| Guardrails | Opt-out, complaints, incorrect offers and cost | Predefine thresholds and escalation rules |

**Randomise by customer. Analyse by original assignment.**

### Speaker notes

The pilot must distinguish service outcomes from care activity. A reply, an accepted offer or a completed case cannot substitute for retained service. Define eligibility before randomisation, document the control process and keep each customer in one arm across repeated scoring batches. Otherwise, overlapping predictions could expose one customer to both strategies. Analyse intention to treat and monitor spillovers between staff and customers. Define the primary outcome and complete follow-up horizon before collecting results. Sample size should follow baseline churn, the minimum detectable effect and expected attrition, rather than the illustrative 1,000-person financial example. The rolling prediction window and the pilot's common experimental follow-up must both be explicit; they need not be conflated.

### Visual and source instructions

Two-arm customer-level pilot diagram above a concise metric table. Notes-only definitions: incremental retention = retained proportion in treatment minus retained proportion in control; review time = minutes on a prespecified task; AI error rate = reviewed outputs with a defined error / reviewed outputs. For reply rates use delivered messages when real delivery receipts exist, otherwise explicitly use sent messages. Planned pilot thresholds remain to be agreed, not presented as achieved.

Sources: [REPORT, controlled pilot](REPORT.md), [SYSTEM, outcome rules](SYSTEM.md), [R4](#external-reference-register). No pilot has been run by this task.

---

## Slide 23 — Implementation Roadmap and Key Risks

**Section:** Business Value & Strategy. **Purpose:** Present stages with owners and acceptance gates rather than unsupported launch dates.

### On-slide copy

| Stage | Accountable role | Gate before progressing |
|---|---|---|
| Complete and rehearse prototype | Project lead + QA | Current UI/workflow path rehearsed; fallback ready; no critical access or send-control defects |
| Prepare enterprise pilot | Data + CS + policy owners | Data permission, definitions, catalog, integration and cost inputs agreed |
| Run Binh Duong pilot | CS sponsor + evaluation lead | Randomisation, complete outcomes and guardrail monitoring maintained |
| Review expansion | Management + Finance | Credible incremental benefit and acceptable risk/cost |

**Key risks:** data mismatch, unsupported AI content, duplicate outreach, staff adoption and unproven economics.

### Speaker notes

The roadmap uses stage gates because calendar dates, owners and enterprise access have not been formally committed. Immediate work concerns the actual current runtime: deploy the updated UI when authorised, finish the controlled n8n cutover, rehearse the browser journey and complete cost/catalog decisions. Enterprise preparation requires permissioned data, agreement on churn definitions and suitable integration boundaries. A pilot then provides operational and causal evidence before management considers expansion. Data mismatch calls for local validation; unsupported content calls for fact and policy review; overlapping windows call for stable customer assignment and outreach deduplication. Staff adoption requires task-based usability testing. Real channel integration introduces additional provider and consent requirements outside the current mock demo.

### Visual and source instructions

One four-stage roadmap with owner and gate annotations; a short risk-to-mitigation line beneath. Do not invent dates, an approved budget or nationwide rollout commitment. Additional risk: idle n8n schedules can consume quota even when they find no work; controlled activation is required.

Sources: [IMPLEMENTATION, current handover and steps 8–10](IMPLEMENTATION.md), [SYSTEM](SYSTEM.md), [n8n migration](evidence/n8n_migration.json).

---

## Slide 24 — Recommendation and Next Steps

**Section:** Business Value & Strategy. **Purpose:** End with an actionable and bounded decision request.

### On-slide copy

**Recommendation: prepare a controlled Binh Duong pilot after current-runtime acceptance.**

Before launch, confirm:

- Permissioned data, outcome definitions and privacy responsibilities.
- A CS sponsor, named owners and an approved contact/offer policy.
- A complete browser workflow and a controlled execution budget.
- A cost baseline, experiment design and continuation criteria.

**Expand only after credible incremental value and acceptable guardrails are demonstrated.**

### Speaker notes

We recommend progressing through controlled preparation rather than assuming a synthetic demonstration establishes enterprise value. The prototype provides a concrete way to connect predictions with staff decisions, accountable action and measurable outcomes. The next decision is whether to provide the data, sponsorship and operational support needed for a limited pilot once the current runtime has passed acceptance. Success requires both useful customer care and an economic benefit over the existing process. If outcomes do not improve, costs exceed the agreed envelope or guardrails deteriorate, the team should revise or stop the intervention. This recommendation keeps the investment decision tied to evidence while preserving the ability to learn from a small deployment.

### Visual and source instructions

Use one prominent recommendation with four short prerequisites below. White background, blue title and a restrained orange rule. No logo, decorative “thank you” page, unapproved commitments, or extra slide. Questions can follow orally.

Sources: [REPORT](REPORT.md), [IMPLEMENTATION](IMPLEMENTATION.md), slide 22's proposed evaluation design.

---

## External reference register

The summaries above are paraphrases. Review coverage is selective; some sources were accessible as publisher abstracts or section extracts rather than complete papers. These publications motivate design and evaluation, not a claim of global novelty or direct evidence of FPT performance.

| ID | Reference and primary link | Use and reading boundary |
|---|---|---|
| R1 | Lundberg, S. M., & Lee, S.-I. (2017). *A Unified Approach to Interpreting Model Predictions*. Advances in Neural Information Processing Systems 30. [Proceedings](https://proceedings.neurips.cc/paper_files/paper/2017/hash/8a20a8621978632d76c43dfd28b67767-Abstract.html) | SHAP as additive feature attribution. Proceedings abstract reviewed; not evidence of causal intervention effectiveness |
| R2 | Poudel, S. S., Pokharel, S., & Timilsina, M. (2024). *Explaining customer churn prediction in telecom industry using tabular machine learning models*. Machine Learning with Applications, 17, 100567. [Publisher](https://www.sciencedirect.com/science/article/pii/S2666827024000434), [DOI](https://doi.org/10.1016/j.mlwa.2024.100567) | Local/global explanation in telecom churn. Publisher abstract available through indexed retrieval; full text not reviewed for this document |
| R3 | Verbeke, W., Dejaeger, K., Martens, D., Hur, J., & Baesens, B. (2012). *New insights into churn prediction in the telecommunication sector: A profit driven data mining approach*. European Journal of Operational Research, 218(1), 211–229. [Publisher](https://www.sciencedirect.com/science/article/pii/S0377221711008599), [DOI](https://doi.org/10.1016/j.ejor.2011.09.031) | Profit-oriented evaluation and campaign selection. Publisher abstract/section extracts reviewed; no claim that its optimisation algorithm is implemented here |
| R4 | Ascarza, E. (2018). *Retention Futility: Targeting High-Risk Customers Might Be Ineffective*. Journal of Marketing Research, 55(1), 80–98. [Publisher](https://journals.sagepub.com/doi/10.1509/jmr.16.0163) | Distinguishes churn risk from treatment responsiveness. Publisher abstract reviewed; motivates a controlled pilot, not an implemented uplift model |
| R5 | Brynjolfsson, E., Li, D., & Raymond, L. R. (2025). *Generative AI at Work*. The Quarterly Journal of Economics, 140(2), 889–942. [Publisher / DOI](https://doi.org/10.1093/qje/qjae044) | Published article reviewed for abstract and service-assistance setting: 5,172 agents; average 15% increase in resolved issues/hour. Single-firm evidence; not a retention-uplift parameter for this project |

Do not transfer any external performance result into the financial assumptions or claim that every telecom operator uses these methods. The literature spans telecom-specific and adjacent service settings.

## Asset and evidence register for deck authoring

All paths below are relative to this document's `docs/` directory. Use original files; do not regenerate models, data, charts or live workflow executions without a new reason.

| Asset / source | Suggested use | Important boundary |
|---|---|---|
| `../website/mockups/fpt-telecom-logo.png` | Slide 3 only | Preserve original aspect ratio; palette is sampled, not a brand-manual certification |
| `../website/mockups/01-care-queue-en.png` | Design reference for slide 13 | Historical mockup; label and exclude old counts/dates/logo from crop |
| `../website/mockups/02-customer-details-en.png` | Design reference for cover or slide 13 | Not proof of current v5 runtime; crop header logo |
| `evidence/website-pipeline.png`, `evidence/website-live-ai.png` | Historical UI backup | Check visible content; historical v4 evidence must be dated and labelled |
| `evidence/ml/rolling_month_v5/figures/slides/01_model_comparison.svg` | Slide 15 backup / tuned-pair chart | Only two tuned candidates; preserve validation selection rule |
| `evidence/ml/rolling_month_v5/figures/slides/02_test_roc_pr.svg` | Model Q&A backup | Exploratory, 1,485 snapshot rows / 758 customers; overlapping windows |
| `evidence/ml/rolling_month_v5/figures/slides/03_prediction_distribution.svg` | Slide 15 or slide 13 cohort | Latest 2,705 customers / 207 alerts; no observed churn outcome |
| `evidence/ml/rolling_month_v5/figures/slides/04_shap_group_importance.svg` | Slide 16 backup | Mean absolute signed group total; not a count or causal ranking |
| `evidence/ml/rolling_month_v5/figures/slides/05_shap_top_features.svg` | Technical Q&A backup | Latest-batch global attribution, not individual care instructions |
| `evidence/ml/rolling_month_v5/figures/slides/06_shap_group_distribution.svg` | Explanation Q&A backup | Positive and negative calibrated log-odds contributions |
| `evidence/ml/rolling_month_v5/figures/slides/07_shap_example_waterfall.svg` | Slide 16 | Purposefully selected highest-scoring example; include all signed groups |
| `evidence/ml/rolling_month_v5/figures/slides/chart_data.json` | Rebuild editable charts if needed | Values omit personal identifiers; preserve cohort and units |
| `evidence/ml/rolling_month_v5/comparison.csv` | Four-candidate slide 15 table | V5 only; baseline rows are context, not eligible selection candidates |
| `evidence/ml/rolling_month_v5/supabase_v5_cutover.json` | Slides 13 and 20 | SQL/local/build evidence; no fresh browser/LLM acceptance |
| `evidence/n8n_agents.json`, `evidence/n8n_workflows.json` | Slide 19 | Historical previous-instance runtime; no quality percentage |
| `evidence/n8n_migration.json` | Slides 18–20 and rehearsal readiness | New workflows unpublished, timers disabled, zero executions |

Backup assets do not authorise extra main slides. If an appendix is requested later, select from these materials without silently changing the agreed 24-slide count.

## Final content checks before PowerPoint authoring

- Keep the exact slide order; no additional cover, dividers or thank-you slide.
- Render 24 slides in English on white, using the palette above. Logo appears only on slide 3, including inside screenshots.
- Verify all four model rows against v5 comparison.csv. Use LightGBM tuned and validation ROC AUC selection.
- Keep September internal figures distinct from the October synthetic latest batch. Do not convert a one-calendar-month rolling window into the remainder of a month or a fixed 30-day duration.
- Use one row per latest-batch customer for global inference/SHAP descriptions. Never call 5,533 inference rows or 409 row-level alerts unique customers/cases.
- Preserve synthetic/exploratory labels; do not call ROC AUC accuracy, SHAP a confirmed cause, or case closure retention.
- Preserve evidence dates and distinguish migrated runtime from historical live results. Never invent a test pass rate, quality score, current screenshot, customer reply or measured business result.
- Keep the financial assumptions and arithmetic together; none are approved FPT inputs. The example's base case is negative.
- Team names, final submission date, dataset URL/license and any newly established demo readiness require the group to finish or confirm. Replace the neutral “Project Team” cover label when the group supplies its formal name; do not invent member identities.
- Authoring the deck is the next task. This document does not authorise deployment, workflow activation, model retraining, data replacement or live customer communication.
