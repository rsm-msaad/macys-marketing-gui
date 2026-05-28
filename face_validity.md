# Face Validity Check: Does This Make Sense in the Real World?

## What This Document Does

Face validity does not prove that a system is correct. It shows that the results are not obviously unrealistic, backwards, or disconnected from the real business context. This document inspects four dimensions of plausibility for our Macy's AI Coworker analysis: whether the direction of the result makes sense, whether the size of the effect is plausible, whether the AI output matches the evidence shown to the user, and whether the result respects practical constraints. Each dimension is evaluated against anchors from M1's process documentation, industry benchmarks, and our M3/M4 implementation.

## Dimension 1: Does the Direction Make Sense?

Our estimates predict the largest time reductions at the steps M1 identified as the bottleneck zone — Steps 4 through 7, where manual coordination consumes the most calendar time relative to the creative or strategic judgment involved. Specifically:

- Creative Production (Step 4): 5-10 business days to 1-2 business days
- Layout Assembly (Step 5): 5-7 business days to 1-2 business days
- Localization (Step 7): 5-8 business days to 1-2 hours

These are the same steps M1 documented as having the worst manual coordination friction: "complete disconnection between pricing data and creative production," "40 to 50 file variants manually created per campaign," and "designers spend significant time on data entry rather than creative work." The AI coworker eliminates the coordination overhead while preserving the creative and strategic work.

Conversely, the smallest time reductions are at the steps where human judgment matters most. Final Approval (Step 6) drops from 3-7 days to 2-4 hours, but the human review time is preserved as the dominant activity within that window. Monitoring (Step 9) barely changes in review time. Reporting (Step 10) drops from 1-2 weeks to 1-2 days but still requires executive sign-off on learnings and recommendations.

This pattern — maximum savings on coordination, minimal cuts on judgment — is exactly what we would expect from a well-designed AI coworker. If the analysis had predicted huge savings on judgment steps and modest savings on coordination steps, that would be a face validity red flag. It does not.

## Dimension 2: Is the Size of the Effect Plausible?

Our headline number is 70-80% reduction in end-to-end campaign cycle time (6-8 weeks to 1-2 weeks). The M4 assignment guidance notes that "a 20% time reduction may be reasonable, while a 95% reduction may need a strong explanation." Our 70-80% sits in the zone that requires justification but is not implausible. Two anchors support it.

**Anchor 1: Industry benchmarks for AI-assisted marketing operations.** Public reporting and case studies on AI-supported marketing automation suggest 30-70% time savings on isolated creative production cycles when AI handles initial drafts and humans refine. Our 70-80% sits at the high end of this range. The high end is defensible because we automate not just one workflow segment but the entire 10-step process end-to-end. M1 documented that "every single transfer is manual" across all 10 steps; eliminating those transfers cumulatively produces a larger end-to-end reduction than automating any single step in isolation. A 30% reduction on each of 10 sequential steps compounds to well over 70% end-to-end when the handoff delays between steps (not just the work within each step) are eliminated.

**Anchor 2: M1 user stories projections.** M1's own user stories projected per-step reductions that individually exceed our end-to-end estimate:

- Segmentation: 2-3 days to 2-4 hours (roughly 95% reduction)
- Creative production: 10-17 days to 2-4 hours (roughly 98% reduction)
- Localization: 5-8 days to 1-2 hours (roughly 97% reduction)
- DAM search: 15-30 minutes per asset to seconds (roughly 99% reduction)

We are not inventing these numbers. They come from the team's own M1 analysis. Our overall 70-80% end-to-end estimate is actually more conservative than summing M1's per-step projections, because we account for the reality that some steps (briefing, activation, monitoring) see more modest improvements.

**What we are NOT claiming:**

- We are not claiming 90%+ end-to-end reduction. That would require eliminating human review entirely, which our design explicitly does not do.
- We are not claiming the time savings translate dollar-for-dollar to bottom line. Organizational change, adoption friction, and tool costs consume a portion of the savings.
- We are not claiming the AI is more accurate than a careful human reviewer on first pass. We are claiming faster-plus-comparable accuracy, with explicit human review at the consequential gates to catch AI errors before they reach customers.

## Dimension 3: Does the AI Output Match the Evidence?

This dimension asks whether the AI's reasoning is traceable to its sources, or whether it just produces confident-sounding text with no verifiable grounding. Our M4 implementation operationalizes this check through the Evidence screen, the Evidence pill on AI cards, and the audit log.

For each AI output, the Evidence panel displays:

- The retrieved RAG documents with specific passages used, document IDs, and relevance scores
- The MCP tool calls with input parameters (e.g., SKU IDs, discount percentage) and output JSON (e.g., pass/fail per SKU)
- The data sources accessed with row counts and filters applied
- Prior step outputs referenced, showing the lineage of decisions across the cascade
- Assumptions and limitations stated explicitly by the skill

A face validity check at this dimension would ask: if a Macy's compliance officer reviewed an AI compliance result and clicked "View Evidence," would the passages, tool outputs, and assumptions actually support the AI's conclusion? Our Evidence panel is designed to make that check possible in seconds rather than minutes. If the cited passage from BRAND-GL-2026-001 does not actually contain the rule the AI invokes, the reviewer sees the mismatch immediately and can Reject or Edit before the campaign advances.

The audit log preserves every decision and edit with timestamps and persona identity, so the post-hoc face validity question ("how did we end up approving this campaign?") is answerable from the persisted trail rather than from manual reconstruction across email and Slack threads.

**Where this dimension is weakest:** Confidence indicators are derived heuristically (zero fails = "High," one fail = "Medium," two or more = "Low") and can read "High" even when the underlying reasoning is factually wrong. This is Failure Case 4 in `failure_cases.md` and is partially mitigated by the M4 Review screen requiring an explicit 5-action decision rather than passive one-click approval.

## Dimension 4: Does the Result Respect Practical Constraints?

A technically sound analysis that ignores real-world friction fails face validity. The following constraints could break the analysis if ignored; our design accounts for each.

**Approvals and compliance.** We retain human approval at the consequential gates: Step 6 (compliance and brief review), Step 7 (localization sign-off), Step 8 (activation confirmation), and Step 10 (final report sign-off). M1 documented Macy's existing approval policy and its frictions; we did not eliminate the approval step, we accelerated it. Legal exposure — M1 referenced FTC representative pricing enforcement risks documented in PRICE-RULES-2026-001 — is mitigated by the Compliance Pre Check skill flagging issues before they reach the VP or legal review, not by bypassing legal review.

**Staffing.** The AI coworker does not eliminate any role. It changes what each role does. Campaign Managers spend less time chasing data across systems, more time on strategy and stakeholder alignment. Designers spend less time on file production and DAM metadata hunting, more time on creative direction. Analysts focus on interpretation and recommendation rather than report assembly. This is consistent with industry research on AI augmentation in knowledge work: the roles persist but the task mix shifts toward higher-value activities.

**Customer expectations.** M1 cited Amazon (real-time personalized promotions) and Shein (hours-not-weeks cycle times) as the competitive context pressuring Macy's. Our 1-2 week AI-supported cycle is still slower than Shein's fast-fashion speed but represents a significant step toward closing the competitive gap. The 70-80% reduction brings Macy's from "months behind" to "weeks behind," which may be sufficient for a department store whose brand identity is built on curation rather than speed.

**Data availability.** The M3 implementation simulates the real Star Rewards database (30M members), Xinet WebNative DAM (100K+ images), and Pricing Engine with SQLite (50K synthetic customers), JSON (61 SKUs), and a local image cache (5K assets). Production deployment requires the data integration work documented in M1's data requirements section. Time and cost savings will not materialize until those integrations are built. This is a known precondition, not a flaw in the design.

**Organizational change management.** Macy's adopting this workflow at scale requires training, change management, and executive sponsorship. M1 referenced CEO Tony Spring's "A Bold New Chapter" strategy which prioritizes modernizing operations and leveraging data; that organizational mandate is the precondition for adoption. Without it, the technical capability sits unused. Our process design attempts to minimize adoption friction through familiar UI patterns, structured review screens, and progressive disclosure of AI evidence, but organizational willingness is ultimately outside the system's control.

## Where Face Validity Is Weakest

Three soft spots in our face validity argument, stated honestly:

1. **Simulated data scale.** We use 50K synthetic customers, 5K DAM assets, 61 SKUs, and 12 RAG documents. Real Macy's data is orders of magnitude larger and messier. Our quality estimates (50-70% compliance defect reduction, 80%+ brief consistency improvement) may not survive the noise, edge cases, and data quality issues present at production scale. The HyQ retrieval benchmark (8/8 correct) was run on 8 test queries, not thousands.

2. **No primary user testing.** We have not run the AI coworker with real Macy's marketing operators. Our claims about adoption, friction reduction, and quality improvement come from M1 secondary research and our own reasoning, not from observed user behavior. A grader or investor familiar with Macy's operations might reasonably ask: "Did anyone at Macy's actually try this?" The honest answer is no. This is a class project that simulates the production system.

3. **API cost at scale.** The TritonAI/Claude API is provided by the course at no direct cost. In production, Claude API costs across thousands of campaigns per year would add up. Our cost analysis treats API costs as negligible ($0.50-$2.00 per campaign run) because they are dwarfed by labor savings at our estimated volume. But if Macy's runs 5,000+ AI invocations per day across all concurrent campaigns, the math should be validated with actual API pricing rather than assumed.

## Summary

The Macy's AI Coworker analysis passes a basic face validity check on all four dimensions: direction (savings concentrate at the coordination-heavy steps, not the judgment-heavy ones), size (within plausible industry ranges and consistent with M1's own projections), evidence (operationalized via the Evidence screen and audit log so reviewers can verify in real time), and practical constraints (preserves human authority, respects compliance requirements, acknowledges data integration as a precondition for production value). Face validity is necessary but not sufficient; the M4 testing section (`test_report.md`) provides the empirical complement by running adversarial and edge-case inputs through the AI skills and scoring the outputs against defined rubrics.
