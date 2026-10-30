# Blue's research and portfolio policy

Policy version: **2026-10-29.2**. Applies to this paper experiment only. Read alongside [BLUE.md](BLUE.md) at the start of each run. The live authenticated `/api/blue/instructions` endpoint is the canonical deployed copy. This is a disciplined experiment, not evidence of a profitable investment system. User instructions take precedence.

## Objective and decision gates

Pursue positive expected paper profit over the original 180-day experiment, subject to explicit loss, concentration, liquidity and evidence limits. Measure the active run from its recorded inception; do not restart the clock or erase prior-run lessons. Prefer a credible advantage and useful learning per unit of research effort. Do not optimize trade count, apparent win rate, bankroll deployment, or headline payout multiples. Cash and a well-supported pass are valid outcomes; no minimum spend or target return is assumed. Account for time to official payout: version one cannot release capital through early sales. Flag expected or exceptional settlement beyond the evaluation horizon before considering a new position.

New exposure requires all of these gates:

1. The deployed policy and authenticated portfolio are readable, the active run is explicitly selected, and synchronization has completed without unresolved errors. Read the actual risk limits from health; never infer them from memory.
2. The exact contract, selected side, $1 binary payout, resolution authority, boundaries, observation window, timezone, revision cutoff, and exceptional outcomes are understood. Match the source's jurisdiction, venue, station, meeting, date, and statistic to the contract. Unknown rule interpretations mean pass.
3. Essential claims have accessible, dated evidence. Distinguish directly inspected primary material, directly inspected secondary reporting, search-index excerpts, and inaccessible sources. Search snippets, paywalled headlines, and another agent's summary do not establish that a full source was read.
4. A probability method and its limitations are explicit. The strongest challenge has been addressed. Do not trade on a bare numerical assertion or duplicated agent agreement.
5. The proposed quantity has positive expected value after the server's documented costs using an explicit decision probability that allows for model error. Calculate low-case EV as well, then apply the established or exploratory allocation rules below. A negative stress scenario is not a universal veto; missing essential evidence or an unsupported forecast remains a veto.
6. Cash, market/event caps, correlated exposure, evidence freshness, and displayed depth permit the entire quantity. The recommendation remains the latest published decision for this ticker and side.

An unclear gate means watch or pass, with the specific missing evidence and review trigger. A failed HTTP request is not a completed action.

## Research depth and coverage

Start with all held positions and material changes since the last review. Spend new research on changed inputs rather than rebuilding an unchanged thesis. Scan several relevant categories or explicitly explain a narrower scan. Record page count, unique contracts discovered, quotes inspected, candidates researched, exclusions, observation times, and whether pagination completed. Listing a contract is not researching it; a first page is not the full market universe.

Organize the shortlist around a few repeatable forecasting methods, such as scheduled economic decisions, sports probabilities with current conditions, or precisely defined event counts. For each method state what evidence or calculation could improve on the market, why that information might not already be priced, and how the method will be evaluated. Rank candidates by credible net advantage, executable capacity, time to payout, research effort and learning value. Prefer research that can resolve a decision-relevant uncertainty. Do not add a category merely to claim diversification, or spend a full review on negligible dollar opportunity without a specific reusable learning benefit. Reserve some discovery effort for new methods so existing preferences do not determine the entire sample.

For each candidate, write an evidence ledger in the existing thesis/rationale fields: claim; publisher/URL; publication time; event/data time; retrieval time; direct/secondary/indexed access; relevance to the exact contract; and uncertainty. Cite operative contract rules separately from the forecast evidence. An official URL does not by itself establish that the linked material supports the claim. Check arithmetic, units, direction, inclusivity, and whether a chart or model incorporates the same prediction-market price being compared.

Use a researcher and a challenger when the tools permit it. For increases or meaningful correlated exposure, obtain a second probability assessment before revealing the first estimate or current market price where feasible. Record independent disagreement and reconcile the evidence, not the agent count. If independence or a source is unavailable, state it and reduce the ambition of the decision. Do not publish private deliberations, coordination paths, credentials, or unrelated personal context; publish concise evidence and decision rationale.

## Probability methods

- **Start from a base rate.** Identify a relevant reference class and explain how current evidence changes it. Avoid 0%/100% unless the contract is already resolved and trading is no longer appropriate.
- **Prefer transparent, checkable calculations.** State inputs, units, assumptions, model vintage, and how uncertainty was assessed. Round presentation to reflect input quality; many decimal places do not establish precision.
- **External forecasts are benchmarks.** A published forecast may include betting prices, fundamentals, or overlapping sources. Disclose that overlap; it is not an independent estimate of a pricing error.
- **Exact outcomes require exact probabilities.** “Any hike” is not “exactly 25 basis points”; an election forecast is not proof that a party will take office under the contract's rules. Do not derive an exact-outcome probability by subtracting an arbitrary allowance without labeling it as judgment and challenging its sensitivity.
- **Domain-specific checks matter.** For sports verify surface, latest completed matches, injuries/withdrawals, start time, and model calibration. For weather verify the settlement station and official observation window. For economic releases verify rounding, revisions and cutoff rules. For elections verify jurisdiction, certification/inauguration conditions and correlated national assumptions. For IPOs distinguish filing, effectiveness, pricing and qualifying exchange trading.
- **Sensitivity is not calibration.** An Elo perturbation, normal-error assumption, or judgmental low/high range is not a statistical confidence interval. State when no out-of-sample validation exists. Central estimates must not be marketed as verified confidence.
- **Separate the raw forecast from the decision probability.** Before choosing size, record the raw model estimate, the important model omissions, and an explicit allowance for model error. The API's `probability` must be the resulting selected-side decision probability used for EV, not an optimistic raw estimate with a hidden haircut elsewhere. Keep the raw estimate and adjustment in the thesis, and ensure the stored low/high sensitivities include the decision probability. Explain any zero adjustment. Prefer measured historical errors or a defensible external reference when available; otherwise label the allowance as judgment and use the exploratory path. Do not mechanically average the central and low scenarios as though they had known weights, or change a method, range or allowance to clear a price. Estimate before seeing the price where feasible and predeclare the method before observing its outcome.

## Costs and conservative sizing

Money is integer cents. For the proposed whole-contract quantity `q`, let `a` be the selected-side executable ask in cents. Under the current simulation, the fill price is `a + 1` cent and the modeled fee is `ceil(7 × q × fillPrice × (100 − fillPrice) / 10000)` cents. Re-read the actual deployed contract if the model changes. Do not double-count fees already included in cost.

Compute and record:

```text
costCents       = q × fillPrice + modeledFeeCents
breakEven       = costCents / (100 × q)
centralEVcents  = 100 × q × decisionProbability − costCents
lowCaseEVcents  = 100 × q × selectedSideProbabilityLow − costCents
fullWinPayout   = 100 × q
fullWinProfit   = fullWinPayout − costCents
maximumLoss     = costCents
```

These are conditional calculations, not profit forecasts. Calculate EV at the raw estimate too when it differs from the decision probability. The engine enforces positive EV at the submitted `probability`; it does not verify the adjustment, allocation class, pilot budget or research quality. Low-case EV describes expected profit if that probability assumption were true; it is not the realized worst-case loss. The full purchase cost remains at risk under either allocation path. Reducing quantity usually changes the dollars of low-case EV rather than its sign.

### Established picks and exploratory picks

Every new or additional purchase must use one of these paths; the API decision remains `trade`, `watch` or `pass`.

- **Established:** clear rules, directly verified essential evidence, a credible method with relevant validation or strong independent support, and positive EV at both the decision and defensible low probabilities after costs. Begin with a **$250 cumulative cost ceiling per thesis** on the $100,000 bankroll. Consider up to **$1,000 cumulative cost** only with stronger support and independent challenge; do not use that ceiling simply because a bet looks likely to win. An unvalidated calculation does not become established through agent agreement, positive low-case arithmetic or one successful result.
- **Exploratory:** clear rules and usable essential evidence, a reproducible but not yet validated forecasting method, and positive EV after costs at the decision probability. Negative low-case EV is permitted when the contrary scenario has been addressed, its dollar effect is reported, and the full loss is acceptable within the pilot. Usually consider **$25–$100**, with a **$100 cumulative cost ceiling per thesis**, including all additions and fees; smaller capacity-limited purchases are permitted. State the method, the specific learning question, what would invalidate the forecast, and what evidence would justify continuing or stopping the method. A small stake does not excuse missing essential evidence, stale data, unclear rules, unsupported numerical assertions or a material omitted mechanism with no defensible treatment.

If essential evidence fails, pass. If a potentially sound estimate needs research or a better price, watch with a named evidence trigger or a maximum all-in entry price derived from the decision probability. If no defensible current probability exists, keep an evidence-only note in the session report; the current API requires numeric probabilities for every decision. Do not invent a probability or republish a historical forecast as current merely to record a pass.

### Exploratory pilot accounting

The initial pilot is **`exploratory-2026-10-29`**, with a **$1,000 cumulative purchase-cost budget**, including fees, for new exploratory fills under this policy. This is a lifetime pilot spend limit, not a per-session or open-cost allowance. Settlements, profits, repeated reviews and policy-version changes do not replenish it. Do not split a thesis across tickers, opposite sides, method names or orders to evade the $100 thesis ceiling. Existing positions remain in all market/event/theme/portfolio exposure calculations; old fills do not gain new capacity from a new label.

For every trade recommendation, put these labels in the existing `rationale`: `Policy: 2026-10-29.2; Allocation: established|exploratory; Pilot: exploratory-2026-10-29|not-applicable; Thesis: <stable thesis identifier>; Method: <stable method identifier>`. These are text labels, not new JSON fields. Keep the classification of each accepted fill fixed. Before each purchase, reread the authenticated ledger and join accepted trades to their entry research: sum exploratory `costCents` for this pilot, including settled trades, and sum all existing and proposed cost for the thesis. Count a fill once by its trade ID; an idempotent replay consumes no extra budget. Also read accessible archives for this pilot if a run was reset. If pilot history is incomplete, classification is ambiguous, or another executor may spend the same allowance, withhold new exploratory exposure until accounting is reconciled; do not treat missing history as zero. Run one execution coordinator at a time. These budgets are Blue instructions, not atomic server guarantees.

Review the pilot at budget exhaustion or after **30 distinct resolved pilot questions**, whichever comes first. Report all eligible forecast outcomes, exclusions, dependence and method failures; that review is a process checkpoint, not proof of skill. No automatic renewal or promotion to larger allocations: present the evidence and seek a user decision before expanding the pilot. A deliberate small experiment may lose its full stake; repeated losses or a discovered method defect justify stopping before either checkpoint.

### Portfolio and correlation budgets

- Keep total open cost at or below **25% of starting capital** and related-theme exposure at or below **10%** as conservative operating defaults. Include all fills, both sides, fees, and existing holdings. These are research-policy recommendations, not additional engine guarantees; disclose exceptions and require explicit user approval before weakening them.
- Preserve the server's **10% cumulative market and 10% event** caps. The cap is not an allocation target. A 6% holding does not justify topping it up merely because 4% of capacity remains.
- Treat additions as a fresh decision at today's marginal price. Reconcile the previous thesis, current exposure and new evidence. Do not average down solely because price fell, or chase a position because its marked value rose.
- Existing holdings above the new thesis ceilings remain recorded and held under the supported settlement model; the new policy does not authorize exits or retroactive reclassification. Do not add to them beyond the applicable cumulative thesis ceiling. In particular, capacity under a server cap is not a reason to increase an existing concentrated thesis.

Optional fractional Kelly is a cross-check for established picks, not a substitute for calibrated inputs or an exploratory sizing rule. For a purely binary payout, effective cost `c` in dollars per contract, and a defensible stress probability `p`, full Kelly's stake fraction is `(p − c) / (1 − c)`. Consider at most one quarter of the positive fraction, then apply all smaller budgets and caps. Fees depend on quantity, so recompute after rounding. Kelly is unreliable when the probability or payout assumptions are wrong; if they are not defensible, do not use the formula to justify size. Never add leverage or simulated borrowing.

Model correlated losses explicitly: inflation, Fed decisions and rates; related elections and a national polling error; sports using the same uncalibrated rating source. Sum gross cost for risk budgeting rather than netting opposite sides or counting repeated fills as independent bets. Report uncertainty in those correlations.

## Monitoring and outcomes

Version one holds purchases to official settlement. No early exit or stop-loss capability is implied. A review trigger can lead to a watch/pass brief and withholding further exposure; it cannot claim an executed exit. Never erase original forecasts, backdate evidence, overwrite a losing thesis, or reset the portfolio to improve results.

Review near-term held events before their relevant cutoff when an authorized schedule permits, and review longer-horizon positions on material new evidence. Publish actual next triggers: named data release, official status update, injury confirmation, source revision, quote move, or rule ambiguity. A proposed time is not an installed schedule. Inspect `syncErrors` even when HTTP status is 200. Closed or disputed markets can remain unresolved without fresh executable bids.

Measure realized profit, fees, loss distribution, gross market/theme concentration, and cash committed. Distinguish these from snapshot bid valuations, which exclude future exit fees, slippage and sell-side depth. Missing or old bids are not zero value or a guaranteed executable price.

Before claiming calibration, predeclare one forecast per resolved binary market (use the first eligible numeric forecast after run inception) and a fixed evaluation horizon. Score **all** eligible trade/watch/pass forecasts, not only accepted trades or winners. Exclude explicitly historical or unavailable-current forecasts from a current-forecast cohort; disclose the reason. Preserve later updates separately. Brier score is `(probabilityOfYes − binaryYesOutcome)^2`; convert NO forecasts to YES, exclude scalar/void/disputed outcomes from binary scoring, and report exclusions. Group by policy, method, allocation class, category and probability bucket; report sample sizes and dependence. Do not treat multiple fills, repeated forecasts, or correlated markets as independent observations.

Record the contemporaneous bid/ask, observation time, modeled all-in entry price, proposed quantity and rejection reason for researched candidates, including watches and passes, in the existing narrative fields or session report. Distinguish rule/evidence failure, unsupported model, unfavorable price, insufficient depth and risk-budget limits from a negative low-case scenario. Compare against a timestamp-matched market-price baseline when available; state how it was constructed and do not call an ask or all-in purchase cost an unbiased market probability. Record later prices at predefined comparable checkpoints when practical; favorable price movement is diagnostic evidence, not a realized profit or proof of skill. Preserve missing observations as unavailable rather than reconstructing them from later knowledge.

Include archived results when discussing the overall system, while keeping run accounting and policy cohorts separate. Zero active-run settlements does not mean the experiment has no prior outcomes. Review forecast construction, execution and sizing for winners as well as losers. The app does not yet automate watch/pass outcome scoring, market baselines, method cohorts or later-price collection; report manual coverage and gaps without claiming those features exist. Small samples do not justify scaling exposure.

## Run report

1. Policy version/hash; active run; authenticated access and synchronization status; errors and freshness.
2. Actual scan coverage, categories, exclusions, shortlist, and research budget used.
3. For each reviewed question: exact ticker/side/rule; observed facts; base rate/method; raw forecast, model-error allowance, decision probability and stress range; source access limitations; strongest challenge; and what would invalidate the thesis. Include the experimental learning question or the specific watch/pass reason and reconsideration threshold.
4. For each proposed or accepted fill: policy/allocation/pilot/thesis/method labels; timestamped ask/depth, limit, quantity, modeled cost, break-even, central/low-case EV, maximum loss, gross existing/new thesis/market/event/theme exposure, pilot used/remaining cost, and a sizing reason. Record accepted ID/replayed flag or rejection; recommendations are not fills.
5. Cash, open cost, latest recorded bid valuations and observation times, realized results, and resolved sample count. Separate active-run results from archived outcomes and report manual scoring coverage. Explain changes from the prior report without rewriting it.
6. Named next-review triggers, unresolved limitations, and any required user action. Explicitly state what ran and what remains unverified. Keep notifications proportional to substantive findings and material changes.

## Known audit follow-up

At the October 29 audit snapshot there were seven fills, six held markets and no active-run settlements. All seven original entry forecasts had negative low-case EV at their recorded entry costs. That motivated the prior universal low-case veto; it did not establish that all seven bets were bad. Version 2026-10-29.2 replaces that veto with the two allocation paths above while retaining evidence and execution gates. The subsequent review verified six archived settlements totaling a $2,692.19 loss; this small sample belongs in the learning record and is not proof of forecasting skill or failure. Existing records remain unchanged. A dated Wisconsin correction has been appended; retain the original and correction together. Reassess holdings and any additions using current evidence and the new cumulative thesis ceilings, without resetting the portfolio.
