# Voice Biometric Feasibility Checker

A pre-deployment strategy testing tool for fintech builders working in voice authentication. It evaluates whether voice biometric authentication is viable given real-world deployment constraints — network bandwidth, device capability, ambient noise, speaker dialect, and regulatory requirements — and surfaces deployment risks before production commitment.

Built from findings during the AwaazOnboard project, where a G.729/VoiceGesture Doppler incompatibility revealed that voice biometric feasibility depends on a constellation of infrastructure and linguistic factors that no existing tool evaluated systematically.

## What It Does

The tool takes five inputs describing a deployment scenario and outputs a composite feasibility score (0 to 100) with a category recommendation (Proceed, Proceed with Modifications, or Not Feasible). Two override conditions bypass the composite: a hard disqualifier for 2G enrollment and a regulatory block for configurations that violate SBP BPRD Circular 1/2025.

## Five Scoring Dimensions

| Dimension | Weight | What It Captures |
|-----------|--------|------------------|
| Bandwidth Sufficiency | 25% | G.729 codec throughput vs. available connectivity |
| Device Capability | 15% | Microphone quality and on-device processing capacity |
| Environmental Noise | 20% | Acoustic conditions at enrollment (irreversible degradation) |
| Regulatory Alignment | 20% | BPRD Circular 1/2025 compliance gate + additive scoring |
| Language / Dialect Match | 20% | Phonological distance from Urdu-trained model baseline |

## Override Conditions

**2G Enrollment Override:** If bandwidth is 2G and the use case is enrollment, the composite is capped at 20 regardless of other scores. G.729 at 8 kbps cannot sustain enrollment audio on real-world 2G throughput.

**Regulatory Block:** If voice is configured as standalone primary enrollment without NADRA verification, the system returns a compliance block per BPRD Circular 1/2025.

## Correlation Detection

The framework assumes independent dimensions, but in real emerging markets they are often correlated. Rural areas have 2G + Balochi speakers + outdoor noise + feature phones simultaneously. Urban centers have 4G + Urdu + indoor + smartphones. A rural Balochi speaker on 2G doesn't have "one weak dimension" — they have systematically degraded conditions that compound multiplicatively, not additively.

The tool detects these patterns. When three or more dimensions are simultaneously degraded, it displays a correlation warning with a matched deployment profile (Rural Peripheral, Peri-urban Mixed, or Urban Optimal) and advises that the composite score likely overestimates feasibility. This signal should trigger field testing before deployment.

## Known Limitations

The composite score treats dimensions as independent and combines them additively. Correlated degradation compounds in ways a weighted average cannot capture. Dialect scores are phonological divergence estimates, not measured FAR/FRR data. The 2G enrollment override is a categorical engineering judgment, not a probabilistic threshold. No field-tested accuracy data for Pakistani network and dialect conditions exists to validate against. All weights are argued from engineering principles, not derived from deployment data. The disclaimer beneath every score makes this explicit: the output is a structured decision aid for pre-deployment strategy testing, not a deployment guarantee.

## Multi-Market Applicability

The framework is not Pakistan-specific. The regulatory input can be swapped for CBN (Nigeria), Bangladesh Bank, or Bank Negara (Malaysia) requirements. The dialect dimension maps to Hausa/Yoruba/Igbo, Bengali dialects, Amharic/Oromo, or Javanese/Sundanese depending on the target market. The scoring engine and override logic are market-agnostic.

## How to Run Locally

Open `index.html` in any modern browser. No build step required. The tool uses React 18 and Tailwind CSS via CDN.

## Methodology

See [METHODOLOGY.md](METHODOLOGY.md) for the full scoring rationale, limitations disclosure, and multi-market extensibility notes.

## Technology

Single-page React application with Tailwind CSS. No backend, no API keys, no build tools required. The scoring engine is pure JavaScript with no external dependencies.

