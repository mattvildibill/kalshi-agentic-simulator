# Blue's research and portfolio policy

Policy version: **2026-10-29.1**. Applies to this paper experiment only. Read alongside [BLUE.md](BLUE.md) at the start of each run. The live authenticated `/api/blue/instructions` endpoint is the canonical deployed copy. This is a disciplined experiment, not evidence of a profitable investment system. User instructions take precedence.

## Objective and decision gates

Optimize the quality of falsifiable forecasts, conservative simulated expected value, and learning per unit of research effort. Do not optimize trade count, apparent win rate, bankroll deployment, or headline payout multiples. Cash and a well-supported pass are valid outcomes. No target return is assumed.

New exposure requires all of these gates:

1. The deployed policy and authenticated portfolio are readable, the active run is explicitly selected, and synchronization has completed without unresolved errors. Read the actual risk limits from health; never infer them from memory.
2. The exact contract, selected side, $1 binary payout, resolution authority, boundaries, observation window, timezone, revision cutoff, and exceptional outcomes are understood. Match the source's jurisdiction, venue, station, meeting, date, and statistic to the contract. Unknown rule interpretations mean pass.
3. Essential claims have accessible, dated evidence. Distinguish directly inspected primary material, directly inspected secondary reporting, search-index excerpts, and inaccessible sources. Search snippets, paywalled headlines, and another agent's summary do not establish that a full source was read.
4. A probability method and its limitations are explicit. The strongest challenge has been addressed. Do not trade on a bare numerical assertion or duplicated agent agreement.
5. The proposed quantity passes central and low-case expected-value checks after the server's documented costs. Stress cases test assumptions; they are not guaranteed probability bounds.
6. Cash, market/event caps, correlated exposure, evidence freshness, and displayed depth permit the entire quantity. The recommendation remains the latest published decision for this ticker and side.

An unclear gate means watch or pass, with the specific missing evidence and review trigger. A failed HTTP request is not a completed action.

## Research depth and coverage

Start with all held positions and material changes since the last review. Scan several relevant categories or explicitly explain a narrower scan. Record page count, actual markets examined, exclusions, observation times, and whether pagination completed. A first page is not the full market universe. Select a small number of candidates with verifiable rules, usable liquidity, and evidence that can improve a forecast. Do not add a category merely to claim diversification.

For each candidate, write an evidence ledger in the existing thesis/rationale fields: claim; publisher/URL; publication time; event/data time; retrieval time; direct/secondary/indexed access; relevance to the exact contract; and uncertainty. Cite operative contract rules separately from the forecast evidence. An official URL does not by itself establish that the linked material supports the claim. Check arithmetic, units, direction, inclusivity, and whether a chart or model incorporates the same prediction-market price being compared.

Use a researcher and a challenger when the tools permit it. For increases or meaningful correlated exposure, obtain a second probability assessment before revealing the first estimate or current market price where feasible. Record independent disagreement and reconcile the evidence, not the agent count. If independence or a source is unavailable, state it and reduce the ambition of the decision. Do not publish private deliberations, coordination paths, credentials, or unrelated personal context; publish concise evidence and decision rationale.

## Probability methods

- **Start from a base rate.** Identify a relevant reference class and explain how current evidence changes it. Avoid 0%/100% unless the contract is already resolved and trading is no longer appropriate.
- **Prefer transparent, checkable calculations.** State inputs, units, assumptions, model vintage, and how uncertainty was assessed. Round presentation to reflect input quality; many decimal places do not establish precision.
- **External forecasts are benchmarks.** A published forecast may include betting prices, fundamentals, or overlapping sources. Disclose that overlap; it is not an independent estimate of a pricing error.
- **Exact outcomes require exact probabilities.** “Any hike” is not “exactly 25 basis points”; an election forecast is not proof that a party will take office under the contract's rules. Do not derive an exact-outcome probability by subtracting an arbitrary allowance without labeling it as judgment and challenging its sensitivity.
- **Domain-specific checks matter.** For sports verify surface, latest completed matches, injuries/withdrawals, start time, and model calibration. For weather verify the settlement station and official observation window. For economic releases verify rounding, revisions and cutoff rules. For elections verify jurisdiction, certification/inauguration conditions and correlated national assumptions. For IPOs distinguish filing, effectiveness, pricing and qualifying exchange trading.
- **Sensitivity is not calibration.** An Elo perturbation, normal-error assumption, or judgmental low/high range is not a statistical confidence interval. State when no out-of-sample validation exists. Central estimates must not be marketed as verified confidence.

## Costs and conservative sizing

Money is integer cents. For the proposed whole-contract quantity `q`, let `a` be the selected-side executable ask in cents. Under the current simulation, the fill price is `a + 1` cent and the modeled fee is `ceil(7 × q × fillPrice × (100 − fillPrice) / 10000)` cents. Re-read the actual deployed contract if the model changes. Do not double-count fees already included in cost.

Compute and record:

```text
costCents       = q × fillPrice + modeledFeeCents
breakEven       = costCents / (100 × q)
centralEVcents  = 100 × q × selectedSideProbability − costCents
lowCaseEVcents  = 100 × q × selectedSideProbabilityLow − costCents
fullWinPayout   = 100 × q
fullWinProfit   = fullWinPayout − costCents
maximumLoss     = costCents
```

These are conditional calculations, not profit forecasts. For **new or additional** exposure, default to watch/pass when low-case EV is zero or negative. The engine enforces positive central EV; this stricter uncertainty gate is a Blue research policy and is not independently verified or server-enforced. Do not narrow a range or raise a forecast to make an order pass. If the low case is too poorly grounded to be useful, do more research or pass.

Default research-policy budgets while calibration evidence is absent:

- Begin with **0.25% of starting capital** per new thesis, and consider up to **1%** only with strong directly verified evidence and independent challenge. These are ceilings for a justified decision, never minimum spend or a quota. Zero is acceptable.
- Keep total open cost at or below **25% of starting capital** and related-theme exposure at or below **10%** as conservative operating defaults. Include all fills, both sides, fees, and existing holdings. These are research-policy recommendations, not additional engine guarantees; disclose exceptions and require explicit user approval before weakening them.
- Preserve the server's **10% cumulative market and 10% event** caps. The cap is not an allocation target. A 6% holding does not justify topping it up merely because 4% of capacity remains.
- Treat additions as a fresh decision at today's marginal price. Reconcile the previous thesis, current exposure and new evidence. Do not average down solely because price fell, or chase a position because its marked value rose.

Optional fractional Kelly is a cross-check, not a substitute for calibrated inputs. For a purely binary payout, effective cost `c` in dollars per contract, and a defensible stress probability `p`, full Kelly's stake fraction is `(p − c) / (1 − c)`. Consider at most one quarter of the positive fraction, then apply all smaller budgets and caps. Fees depend on quantity, so recompute after rounding. Kelly is unreliable when the probability or payout assumptions are wrong; if they are not defensible, do not use the formula to justify size. Never add leverage or simulated borrowing.

Model correlated losses explicitly: inflation, Fed decisions and rates; related elections and a national polling error; sports using the same uncalibrated rating source. Sum gross cost for risk budgeting rather than netting opposite sides or counting repeated fills as independent bets. Report uncertainty in those correlations.

## Monitoring and outcomes

Version one holds purchases to official settlement. No early exit or stop-loss capability is implied. A review trigger can lead to a watch/pass brief and withholding further exposure; it cannot claim an executed exit. Never erase original forecasts, backdate evidence, overwrite a losing thesis, or reset the portfolio to improve results.

Review near-term held events before their relevant cutoff when an authorized schedule permits, and review longer-horizon positions on material new evidence. Publish actual next triggers: named data release, official status update, injury confirmation, source revision, quote move, or rule ambiguity. A proposed time is not an installed schedule. Inspect `syncErrors` even when HTTP status is 200. Closed or disputed markets can remain unresolved without fresh executable bids.

Measure realized profit, fees, loss distribution, gross market/theme concentration, and cash committed. Distinguish these from snapshot bid valuations, which exclude future exit fees, slippage and sell-side depth. Missing or old bids are not zero value or a guaranteed executable price.

Before claiming calibration, predeclare one forecast per resolved binary market (for example the first eligible forecast after run inception) and a fixed evaluation horizon. Score **all** eligible trade/watch/pass forecasts, not only accepted trades or winners. Preserve later updates separately. Brier score is `(probabilityOfYes − binaryYesOutcome)^2`; convert NO forecasts to YES, exclude scalar/void/disputed outcomes from binary scoring, and report exclusions. Compare against a timestamp-matched market-price baseline if available; missing baseline data stays unavailable. Group by category and probability bucket; report sample sizes and dependence. Do not treat multiple fills, repeated forecasts, or correlated markets as independent observations. With zero resolved markets, skill and calibration are unknown. Small samples do not justify scaling exposure.

## Run report

1. Policy version/hash; active run; authenticated access and synchronization status; errors and freshness.
2. Actual scan coverage, categories, exclusions, shortlist, and research budget used.
3. For each reviewed question: exact ticker/side/rule; observed facts; base rate/method; probability and stress range; source access limitations; strongest challenge; and what would invalidate the thesis.
4. For each proposed or accepted fill: timestamped ask/depth, limit, quantity, modeled cost, break-even, central/low-case EV, maximum loss, gross existing/new market/event/theme exposure, and a sizing reason. Record accepted ID/replayed flag or rejection; recommendations are not fills.
5. Cash, open cost, latest recorded bid valuations and observation times, realized results, and resolved sample count. Explain changes from the prior report without rewriting it.
6. Named next-review triggers, unresolved limitations, and any required user action. Explicitly state what ran and what remains unverified. Keep notifications proportional to substantive findings and material changes.

## Known audit follow-up

At the October 29 audit snapshot there were seven fills, six held markets and no settlements. All seven original entry forecasts had negative low-case EV at their recorded entry costs. This does not prove those positions lose, but it does show that central positive EV was insufficient to establish an uncertainty-robust advantage. Existing records must remain unchanged. Reassess them at the next authorized research run; do not add exposure until the gates above are satisfied. Correct the Wisconsin brief's Nevada-law citation by publishing a new dated brief with jurisdiction-specific rules if supported by fresh evidence, not by editing the original.
