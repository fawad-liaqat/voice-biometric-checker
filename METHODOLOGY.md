# Voice Biometric Feasibility Checker — Methodology

## Purpose

This tool is designed for fintech builders working in voice authentication to test their pre-deployment strategy and surface deployment risks before committing to production infrastructure. It evaluates whether voice biometrics can work under a specific set of real-world constraints — network, device, noise, dialect, and regulation — and provides structured, actionable output that helps teams decide whether to proceed, modify their architecture, or abandon the approach for a given deployment scenario.

## Origin

This framework grew out of a specific technical failure. During the AwaazOnboard project — a voice-based financial onboarding system for underserved populations in Pakistan — I identified a fundamental incompatibility between the G.729 narrowband codec operating at 8 kbps and the acoustic feature requirements of VoiceGesture Doppler-based speaker verification. The codec's compression destroyed the spectral features the verification model depended on. That finding was project-specific, but the question it raised was not: given a set of real-world constraints — network, device, noise, dialect, regulation — can voice biometrics work at all? No generalizable framework existed to answer that question before deployment. This tool is that framework.

## Scoring Rationale

The checker evaluates five dimensions, each scored 0 to 100 and combined using fixed weights.

**Bandwidth Sufficiency (25%)** is the primary gating factor. G.729 narrowband enrollment requires sustained 8 kbps throughput. Real-world 2G GPRS in rural Pakistan delivers 10 to 15 kbps, leaving near-zero headroom for reliable audio transmission. This dimension carries the highest weight because bandwidth failure is binary: the audio either arrives intact or it does not. A special override condition applies to 2G enrollment — the composite is hard-capped at 20 regardless of all other scores, because this failure mode is categorical, not marginal. Authentication over 2G is treated separately. A short utterance against a pre-enrolled voiceprint has a smaller payload and tolerates retries.

**Device Capability (15%)** captures microphone quality and on-device processing headroom. Feature phones have fixed microphones and no processing capacity for local feature extraction. Server-side extraction compensates, which is why this dimension carries the lowest weight — the constraint is architectural, not absolute.

**Environmental Noise (20%)** reflects the irreversibility of enrollment-time audio degradation. Noise captured during the one-time enrollment is permanent. Authentication failure rates compound over time if the enrollment template is noisy. Outdoor environments — urban and rural alike — introduce variability that cannot be corrected post-hoc. This weight reflects the asymmetry between enrollment quality and authentication reliability.

**Regulatory Alignment (20%)** is structured as a gated system, not a linear scale. The SBP's BPRD Circular No. 1 of 2025 mandated biometric verification as the primary onboarding method for all regulated entities. A deployment where voice serves as the standalone primary enrollment method — without a NADRA-verified biometric layer — is non-compliant. The system returns a Regulatory Block before scoring even begins. For compliant configurations, additive adjustments reward NADRA integration, authentication-only use cases, and Tier 1 simplified KYC eligibility.

**Language / Dialect Match (20%)** is the dimension most absent from vendor documentation. Most commercial speaker verification models available for Pakistani deployments are trained on standard Urdu or Hindustani data. The phonological distance between Urdu and Punjabi, Sindhi, Pashto, or Balochi is material. Punjabi's retroflex consonants, Sindhi's implosives, Pashto's ejective consonants — each creates acoustic features absent from the training distribution. These scores are based on phonological divergence analysis and multilingual speaker verification literature, not measured FAR/FRR data for Pakistan. They function as structured risk indicators. Institutions with dialect-specific model training data or Meta MMS-based transfer learning should override this dimension entirely.

All five weights are argued from engineering principles. Bandwidth at 25% is anchored to the G.729 throughput constraint. Dialect at 20% reflects documented phonological divergence. These are transparent assumptions, not black-box coefficients. Arbitrary but transparent is more useful than precise but opaque.

## Limitations

There is no field-tested FAR/FRR data for Pakistani network and dialect conditions to validate these scores against. Noise scores derive from feasibility analysis, not controlled acoustic trials. The 2G enrollment override is a categorical engineering judgment grounded in codec throughput math, not a probabilistic threshold estimated from deployment data. The composite score is a structured decision aid. It does not predict a specific accuracy number. The disclaimer beneath every score makes this explicit: "This score reflects structured feasibility analysis, not empirical field data." With enough deployment data, every dimension's mapping could be replaced with empirical curves. Until then, transparent structured analysis is the most honest tool available.

## Correlated Dimensions in Real Markets

The weighted composite treats dimensions as independent. In real emerging markets, they are often correlated. Rural areas typically have 2G connectivity, minority dialect speakers, outdoor noise environments, and feature phones simultaneously. Urban centers have 4G, Urdu/national language speakers, indoor environments, and modern smartphones. This is not coincidental — it reflects the structural distribution of infrastructure, language, and economic access in these markets.

A rural Balochi speaker on 2G does not have "one weak dimension." They have systematically degraded conditions that compound multiplicatively, not additively. When bandwidth is constrained and the device has a poor microphone and the environment is noisy and the dialect diverges from the training data, each degradation amplifies the others. Packet loss on a narrowband codec is worse when the source audio is already noisy. Dialect mismatch is harder to compensate for when the acoustic signal is degraded by both environmental noise and low-quality hardware. A simple weighted average cannot capture this compounding.

The tool addresses this limitation with an explicit correlation detector. When three or more dimensions are simultaneously degraded, the system displays a correlation warning identifying the deployment profile (Rural Peripheral, Peri-urban Mixed, or Urban Optimal) and advising that the composite score likely overestimates feasibility for that scenario. This does not change the composite calculation — it adds a qualitative flag that practitioners should use to trigger field testing rather than trusting the numerical score alone.

Three deployment archetypes are recognized: Rural Peripheral (Balochistan, rural Sindh, FATA, and analogous regions in Nigeria, Bangladesh, Ethiopia), Peri-urban Mixed (smaller cities with uneven infrastructure), and Urban Optimal (major metropolitan centers). These profiles map to documented patterns of infrastructure and language distribution in Pakistan and are parameterizable for other markets.

## Multi-Market Extensibility

The framework is not Pakistan-specific. Every input dimension is parameterizable. The regulatory gate can be swapped for CBN requirements in Nigeria, Bangladesh Bank regulations, or Bank Negara guidelines in Malaysia. The dialect dimension maps directly to Hausa/Yoruba/Igbo for Nigerian deployments, Bengali regional variants for Bangladesh, Amharic/Oromo for Ethiopia, or Javanese/Sundanese for Indonesia. What changes is dropdown values and regulatory checklist items — the scoring engine, override logic, and recommendation architecture remain identical. This positions the tool for any fintech team evaluating voice authentication in bandwidth-constrained emerging markets, whether they are building in Karachi, Lagos, Dhaka, Nairobi, or Jakarta.

## BPRD Circular 1/2025

The compliance gate exists because of a specific regulatory event. The State Bank of Pakistan's BPRD Circular No. 1 of 2025, issued in July 2025 and effective October 25, 2025, made biometric verification the primary identification method for customer onboarding across all SBP-regulated entities — banks, DFIs, MFBs, digital banks, and EMIs. This converted what had been a best-practice recommendation into a hard compliance requirement. The tool's regulatory dimension reflects this shift: voice cannot serve as standalone primary enrollment verification. Practitioners in other markets should substitute their equivalent regulatory instrument and adjust the compliance gate accordingly.
