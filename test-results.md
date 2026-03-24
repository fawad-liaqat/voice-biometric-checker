# Test Results — Voice Biometric Feasibility Checker

All six test cases executed against the scoring engine (including correlation detection).

## Test Case 1: Worst Case — Both Overrides Fire

**Inputs:** 2G (Enrollment), Feature Phone, Urban Outdoor, Standalone Enrollment (no NADRA), Punjabi

| Check                        | Expected           | Actual     | Status |
| ---------------------------- | ------------------ | ---------- | ------ |
| Regulatory Block fires       | true               | true       | PASS   |
| 2G Enrollment Override fires | true               | true       | PASS   |
| Both alert messages display  | 2 messages         | 2 messages | PASS   |
| No composite calculated      | N/A (capped at 20) | 20         | PASS   |
| No recommendations display   | 0                  | 0          | PASS   |

**Messages displayed:**

1. Regulatory Block — This configuration violates BPRD Circular 1/2025. Voice cannot serve as standalone primary enrollment verification.
2. Not Feasible — Enrollment over 2G is not viable in field conditions. Use partner-embedded enrollment or upgrade connectivity.

---

## Test Case 2: Best Case — Proceed

**Inputs:** 4G, Modern Smartphone, Call Center, NADRA + Auth-only + Tier 1, Urdu (Standard)

| Dimension     | Raw Score | Weight | Contribution |
| ------------- | --------- | ------ | ------------ |
| Bandwidth     | 90        | 0.25   | 22.50        |
| Device        | 95        | 0.15   | 14.25        |
| Noise         | 90        | 0.20   | 18.00        |
| Regulatory    | 100       | 0.20   | 20.00        |
| Dialect       | 90        | 0.20   | 18.00        |
| **Composite** |           |        | **92.75**    |

| Check              | Expected | Actual  | Status |
| ------------------ | -------- | ------- | ------ |
| Category           | PROCEED  | PROCEED | PASS   |
| No overrides fire  | true     | true    | PASS   |
| No recommendations | 0        | 0       | PASS   |

---

## Test Case 3: Middle Case — Proceed with Modifications

**Inputs:** 3G, Low-end Smartphone, Indoor Home, Tier 1 + no NADRA confirmed, Punjabi

| Dimension     | Raw Score | Weight | Contribution |
| ------------- | --------- | ------ | ------------ |
| Bandwidth     | 65        | 0.25   | 16.25        |
| Device        | 50        | 0.15   | 7.50         |
| Noise         | 70        | 0.20   | 14.00        |
| Regulatory    | 65        | 0.20   | 13.00        |
| Dialect       | 65        | 0.20   | 13.00        |
| **Composite** |           |        | **63.75**    |

| Check                    | Expected                   | Actual                     | Status |
| ------------------------ | -------------------------- | -------------------------- | ------ |
| Category                 | PROCEED_WITH_MODIFICATIONS | PROCEED_WITH_MODIFICATIONS | PASS   |
| No overrides fire        | true                       | true                       | PASS   |
| Composite in 40-69 range | true                       | 63.75                      | PASS   |

**Recommendation analysis:** Using strict `<` thresholds: BW raw 65 is not < 50, Device raw 50 is not < 50, Dialect raw 65 is not < 60. No recommendations fire. The execution instructions note this borderline behavior and advise verifying trigger conditions carefully.

---

## Test Case 4: AwaazOnboard — 2G Auth-Only (Override Must NOT Fire)

**Inputs:** 2G (Auth-only), Low-end Smartphone, Call Center, NADRA + Auth-only, Urdu (Standard)

| Dimension     | Raw Score | Weight | Contribution |
| ------------- | --------- | ------ | ------------ |
| Bandwidth     | 25        | 0.25   | 6.25         |
| Device        | 50        | 0.15   | 7.50         |
| Noise         | 90        | 0.20   | 18.00        |
| Regulatory    | 85        | 0.20   | 17.00        |
| Dialect       | 90        | 0.20   | 18.00        |
| **Composite** |           |        | **66.75**    |

| Check                          | Expected                   | Actual                     | Status |
| ------------------------------ | -------------------------- | -------------------------- | ------ |
| 2G Override does NOT fire      | false                      | false                      | PASS   |
| Regulatory Block does NOT fire | false                      | false                      | PASS   |
| Category                       | PROCEED_WITH_MODIFICATIONS | PROCEED_WITH_MODIFICATIONS | PASS   |
| BW is sole recommendation      | Bandwidth only             | Bandwidth only             | PASS   |

**Critical verification:** The override condition checks `bandwidth === '2G_ENROLLMENT'`, not `bandwidth === '2G'`. Auth-only 2G correctly bypasses the override. This is the AwaazOnboard partner-embedded architecture scenario — high call center noise score compensates for constrained connectivity on authentication.

---

## Test Case 5: Correlation Detection — Rural Peripheral Profile

**Inputs:** 2G (Auth-only), Feature Phone, Rural Outdoor, NADRA + Auth-only, Balochi

| Dimension     | Raw Score | Weight | Contribution |
| ------------- | --------- | ------ | ------------ |
| Bandwidth     | 25        | 0.25   | 6.25         |
| Device        | 20        | 0.15   | 3.00         |
| Noise         | 55        | 0.20   | 11.00        |
| Regulatory    | 85        | 0.20   | 17.00        |
| Dialect       | 50        | 0.20   | 10.00        |
| **Composite** |           |        | **47.25**    |

| Check                     | Expected                          | Actual                            | Status |
| ------------------------- | --------------------------------- | --------------------------------- | ------ |
| Correlation warning fires | severity: high                    | severity: high                    | PASS   |
| Degraded dimension count  | 4                                 | 4                                 | PASS   |
| Degraded dimensions       | bandwidth, device, noise, dialect | bandwidth, device, noise, dialect | PASS   |
| Profile detected          | Rural Peripheral                  | Rural Peripheral                  | PASS   |
| Category                  | PROCEED_WITH_MODIFICATIONS        | PROCEED_WITH_MODIFICATIONS        | PASS   |

**Critical verification:** All four non-regulatory dimensions are simultaneously degraded. The composite of 47.25 lands in PROCEED_WITH_MODIFICATIONS, but the correlation warning explicitly flags that this score likely overestimates feasibility because these conditions compound multiplicatively. A rural Balochi speaker on 2G with a feature phone outdoors faces cascading failure modes that a weighted average cannot capture. Field testing is mandatory before deployment in this profile.

---

## Test Case 6: No Correlation — Urban Optimal

**Inputs:** 4G, Modern Smartphone, Call Center, NADRA + Auth-only, Urdu (Standard)

| Check               | Expected | Actual  | Status |
| ------------------- | -------- | ------- | ------ |
| Correlation warning | null     | null    | PASS   |
| Category            | PROCEED  | PROCEED | PASS   |

**Verification:** No dimensions are degraded. No correlation warning fires. This confirms the detector does not produce false positives for well-resourced urban deployments.

---

## Summary

| Test Case                                     | Status |
| --------------------------------------------- | ------ |
| TC1: Worst Case — Both Overrides              | PASS   |
| TC2: Best Case — Proceed                      | PASS   |
| TC3: Middle Case — Modifications              | PASS   |
| TC4: AwaazOnboard — 2G Auth-Only              | PASS   |
| TC5: Correlation Detection — Rural Peripheral | PASS   |
| TC6: No Correlation — Urban Optimal           | PASS   |

**All 6 test cases passed.**
