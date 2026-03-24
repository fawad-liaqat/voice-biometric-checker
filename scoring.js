// Voice Biometric Feasibility Checker — Scoring Engine
// Pure JavaScript. No React dependency.
// Implements: compliance gate → 2G override → weighted composite → recommendation engine → correlation detection
//
// PURPOSE: Help fintech builders working in voice authentication test their pre-deployment
// strategy and surface deployment risks before committing to production infrastructure.
//
// KNOWN LIMITATION: The weighted composite treats dimensions as independent. In real emerging
// markets, dimensions are often correlated (rural = 2G + minority dialect + outdoor noise +
// feature phone simultaneously). Correlated degradation compounds multiplicatively, not
// additively. The correlation detector below flags these patterns explicitly.

const BANDWIDTH_SCORES = {
  "2G_ENROLLMENT": null, // override — not scored
  "2G_AUTH": 25,
  "3G": 65,
  "4G": 90,
  WIFI: 100,
};

const DEVICE_SCORES = {
  FEATURE_PHONE: 20,
  LOW_END_SMARTPHONE: 50,
  MID_RANGE_SMARTPHONE: 80,
  MODERN_SMARTPHONE: 95,
};

const NOISE_SCORES = {
  CALL_CENTER: 90,
  INDOOR_HOME: 70,
  RURAL_OUTDOOR: 55,
  URBAN_OUTDOOR: 35,
};

const DIALECT_SCORES = {
  URDU_STANDARD: 90,
  PUNJABI: 65,
  SINDHI: 60,
  PASHTO: 55,
  BALOCHI: 50,
  OTHER: 30,
};

const WEIGHTS = {
  bandwidth: 0.25,
  device: 0.15,
  noise: 0.2,
  regulatory: 0.2,
  dialect: 0.2,
};

function computeRegulatoryScore(flags) {
  // flags: { nadraVerified, authOnly, tier1, standaloneEnrollment }
  if (flags.standaloneEnrollment) {
    return { block: true, score: 0 };
  }
  let score = 50; // base compliant
  if (flags.nadraVerified) score += 20;
  if (flags.authOnly) score += 15;
  if (flags.tier1) score += 15;
  return { block: false, score: Math.min(score, 100) };
}

const RECOMMENDATIONS = {
  bandwidth: {
    threshold: 50,
    text: "Use G.729 narrowband codec (8 kbps). Consider partner-embedded enrollment via a controlled network link rather than live user enrollment. Call center audio capture is the most reliable fallback for constrained connectivity environments.",
  },
  device: {
    threshold: 50,
    text: "Shift voice feature extraction entirely to the server side. Do not rely on on-device processing for feature phones or low-end hardware. Ensure a minimum 100ms audio buffer before transmission to reduce the impact of packet loss.",
  },
  noise: {
    threshold: 60,
    text: "Move enrollment to a controlled acoustic environment. Call center or quiet indoor enrollment is required. Outdoor enrollment degrades template quality irreversibly \u2014 noise captured at enrollment cannot be corrected post-hoc.",
  },
  regulatory_auth: {
    threshold: 60,
    text: "Voice can serve as a second authentication factor. Confirm that NADRA Verisys biometric verification was completed as primary at account opening per BPRD Circular 1/2025 before enabling voice authentication for this account.",
  },
  regulatory_enrollment: {
    threshold: 60,
    text: "Voice enrollment as standalone primary verification is non-compliant under BPRD Circular 1/2025. Restrict to secondary authentication layer, or pursue partner-embedded pre-enrollment through a compliant institutional channel such as a BISP call center or telco KYC recording.",
  },
  dialect: {
    threshold: 60,
    text: "Significant acoustic mismatch between speaker dialect and model training data. Recommend dialect-adapted fine-tuning or transfer learning using Meta\u2019s MMS multilingual model. Do not deploy to Pashto, Balochi, or regional dialect speakers with a standard Urdu-trained model without first conducting dialect-specific accuracy testing.",
  },
};

// --- CORRELATION PROFILES ---
// Real-world deployment archetypes where dimensions cluster together.
// These are not hypothetical — they represent actual field conditions in emerging markets.
const CORRELATION_PROFILES = {
  RURAL_PERIPHERAL: {
    label: "Rural Peripheral",
    description:
      "Rural areas with 2G/3G connectivity, minority dialect speakers, outdoor environments, and feature phones. These conditions co-occur systematically in Balochistan, rural Sindh, FATA, and analogous regions in Nigeria (northern states), Bangladesh (Chittagong Hill Tracts), and Ethiopia (Somali Region).",
    markers: {
      bandwidth: ["2G_AUTH", "2G_ENROLLMENT", "3G"],
      device: ["FEATURE_PHONE", "LOW_END_SMARTPHONE"],
      noise: ["RURAL_OUTDOOR", "URBAN_OUTDOOR"],
      dialect: ["BALOCHI", "PASHTO", "SINDHI", "OTHER"],
    },
  },
  URBAN_OPTIMAL: {
    label: "Urban Optimal",
    description:
      "Urban centers with 4G/WiFi, Urdu/national language speakers, indoor/call center environments, and modern devices. Karachi, Lahore, Islamabad — or Lagos, Dhaka, Nairobi equivalents.",
    markers: {
      bandwidth: ["4G", "WIFI"],
      device: ["MID_RANGE_SMARTPHONE", "MODERN_SMARTPHONE"],
      noise: ["CALL_CENTER", "INDOOR_HOME"],
      dialect: ["URDU_STANDARD"],
    },
  },
  PERI_URBAN_MIXED: {
    label: "Peri-urban Mixed",
    description:
      "Transitional zones with 3G connectivity, low-end smartphones, variable noise, and regional dialect overlap. Typical in smaller cities and market towns where infrastructure is unevenly distributed.",
    markers: {
      bandwidth: ["3G"],
      device: ["LOW_END_SMARTPHONE"],
      noise: ["INDOOR_HOME", "URBAN_OUTDOOR"],
      dialect: ["PUNJABI", "SINDHI"],
    },
  },
};

function detectCorrelationProfile(inputs) {
  const bw = inputs.bandwidth;
  const profiles = [];
  for (const [key, profile] of Object.entries(CORRELATION_PROFILES)) {
    let matchCount = 0;
    let totalDims = 4;
    if (profile.markers.bandwidth.includes(bw)) matchCount++;
    if (profile.markers.device.includes(inputs.device)) matchCount++;
    if (profile.markers.noise.includes(inputs.noise)) matchCount++;
    if (profile.markers.dialect.includes(inputs.dialect)) matchCount++;
    if (matchCount >= 3) {
      profiles.push({
        key,
        label: profile.label,
        description: profile.description,
        matchStrength: matchCount + "/" + totalDims,
      });
    }
  }
  return profiles.length > 0 ? profiles[0] : null;
}

function computeFeasibility(inputs) {
  // inputs: { bandwidth, device, noise, dialect, regulatory: { nadraVerified, authOnly, tier1, standaloneEnrollment } }

  const result = {
    regulatoryBlock: false,
    enrollmentOverride: false,
    composite: null,
    category: null,
    dimensionScores: {},
    recommendations: [],
    messages: [],
    correlationWarning: null,
  };

  // --- STEP 1: Regulatory compliance gate ---
  const regResult = computeRegulatoryScore(inputs.regulatory);
  if (regResult.block) {
    result.regulatoryBlock = true;
    result.messages.push(
      "Regulatory Block \u2014 This configuration violates BPRD Circular 1/2025. Voice cannot serve as standalone primary enrollment verification.",
    );
  }

  // --- STEP 2: 2G enrollment override ---
  if (inputs.bandwidth === "2G_ENROLLMENT") {
    result.enrollmentOverride = true;
    result.composite = 20;
    result.category = "NOT_FEASIBLE";
    result.messages.push(
      "Not Feasible \u2014 Enrollment over 2G is not viable in field conditions. Use partner-embedded enrollment or upgrade connectivity.",
    );
  }

  // If either override fired, return early (but both can fire simultaneously)
  if (result.regulatoryBlock || result.enrollmentOverride) {
    return result;
  }

  // --- STEP 3: Compute dimension scores ---
  const bwScore = BANDWIDTH_SCORES[inputs.bandwidth];
  const deviceScore = DEVICE_SCORES[inputs.device];
  const noiseScore = NOISE_SCORES[inputs.noise];
  const dialectScore = DIALECT_SCORES[inputs.dialect];
  const regScore = regResult.score;

  result.dimensionScores = {
    bandwidth: bwScore,
    device: deviceScore,
    noise: noiseScore,
    regulatory: regScore,
    dialect: dialectScore,
  };

  // --- STEP 4: Weighted composite ---
  const composite =
    bwScore * WEIGHTS.bandwidth +
    deviceScore * WEIGHTS.device +
    noiseScore * WEIGHTS.noise +
    regScore * WEIGHTS.regulatory +
    dialectScore * WEIGHTS.dialect;

  result.composite = Math.round(composite * 100) / 100;

  // --- STEP 5: Category mapping ---
  if (result.composite >= 70) {
    result.category = "PROCEED";
  } else if (result.composite >= 40) {
    result.category = "PROCEED_WITH_MODIFICATIONS";
  } else {
    result.category = "NOT_FEASIBLE";
  }

  // --- STEP 6: Correlation detection ---
  // In real markets, dimensions cluster. A rural Balochi speaker on 2G doesn't have
  // "one weak dimension" — they have systematically degraded conditions that compound
  // multiplicatively, not additively. A simple weighted average underestimates this.
  const lowDimensions = [];
  if (bwScore < 50) lowDimensions.push("bandwidth");
  if (deviceScore < 50) lowDimensions.push("device");
  if (noiseScore < 60) lowDimensions.push("noise");
  if (dialectScore < 60) lowDimensions.push("dialect");

  result.correlationWarning = null;
  if (lowDimensions.length >= 3) {
    result.correlationWarning = {
      severity: "high",
      count: lowDimensions.length,
      dimensions: lowDimensions,
      message:
        "High correlation risk \u2014 " +
        lowDimensions.length +
        " dimensions are simultaneously degraded (" +
        lowDimensions.join(", ") +
        "). In real deployment conditions, these constraints co-occur and compound multiplicatively. The composite score likely overestimates feasibility. Conduct field testing before deployment.",
      profile: detectCorrelationProfile(inputs),
    };
  } else if (lowDimensions.length === 2) {
    result.correlationWarning = {
      severity: "moderate",
      count: lowDimensions.length,
      dimensions: lowDimensions,
      message:
        "Moderate correlation risk \u2014 " +
        lowDimensions.length +
        " dimensions are simultaneously degraded (" +
        lowDimensions.join(", ") +
        "). These constraints often co-occur in field conditions. The composite score may overestimate feasibility for this deployment profile.",
      profile: detectCorrelationProfile(inputs),
    };
  }

  // --- STEP 7: Recommendation engine ---
  if (bwScore < RECOMMENDATIONS.bandwidth.threshold) {
    result.recommendations.push({
      dimension: "Bandwidth",
      text: RECOMMENDATIONS.bandwidth.text,
    });
  }
  if (deviceScore < RECOMMENDATIONS.device.threshold) {
    result.recommendations.push({
      dimension: "Device",
      text: RECOMMENDATIONS.device.text,
    });
  }
  if (noiseScore < RECOMMENDATIONS.noise.threshold) {
    result.recommendations.push({
      dimension: "Noise",
      text: RECOMMENDATIONS.noise.text,
    });
  }
  if (regScore < RECOMMENDATIONS.regulatory_auth.threshold) {
    if (inputs.regulatory.authOnly) {
      result.recommendations.push({
        dimension: "Regulatory",
        text: RECOMMENDATIONS.regulatory_auth.text,
      });
    } else {
      result.recommendations.push({
        dimension: "Regulatory",
        text: RECOMMENDATIONS.regulatory_enrollment.text,
      });
    }
  }
  if (dialectScore < RECOMMENDATIONS.dialect.threshold) {
    result.recommendations.push({
      dimension: "Dialect",
      text: RECOMMENDATIONS.dialect.text,
    });
  }

  return result;
}

// --- TEST HARNESS ---
function runTests() {
  const results = [];

  // TC1: Worst Case — Both Overrides
  const tc1 = computeFeasibility({
    bandwidth: "2G_ENROLLMENT",
    device: "FEATURE_PHONE",
    noise: "URBAN_OUTDOOR",
    dialect: "PUNJABI",
    regulatory: {
      nadraVerified: false,
      authOnly: false,
      tier1: false,
      standaloneEnrollment: true,
    },
  });
  results.push({
    name: "TC1: Worst Case — Both Overrides",
    pass:
      tc1.regulatoryBlock === true &&
      tc1.enrollmentOverride === true &&
      tc1.messages.length === 2,
    result: tc1,
  });

  // TC2: Best Case — Proceed
  const tc2 = computeFeasibility({
    bandwidth: "4G",
    device: "MODERN_SMARTPHONE",
    noise: "CALL_CENTER",
    dialect: "URDU_STANDARD",
    regulatory: {
      nadraVerified: true,
      authOnly: true,
      tier1: true,
      standaloneEnrollment: false,
    },
  });
  results.push({
    name: "TC2: Best Case — Proceed",
    pass:
      tc2.category === "PROCEED" &&
      tc2.composite >= 89 &&
      tc2.composite <= 93 &&
      tc2.recommendations.length === 0,
    result: tc2,
  });

  // TC3: Middle Case — Proceed with Modifications
  const tc3 = computeFeasibility({
    bandwidth: "3G",
    device: "LOW_END_SMARTPHONE",
    noise: "INDOOR_HOME",
    dialect: "PUNJABI",
    regulatory: {
      nadraVerified: false,
      authOnly: false,
      tier1: true,
      standaloneEnrollment: false,
    },
  });
  results.push({
    name: "TC3: Middle Case — Proceed with Modifications",
    pass:
      tc3.category === "PROCEED_WITH_MODIFICATIONS" &&
      tc3.composite >= 63 &&
      tc3.composite <= 64,
    result: tc3,
  });

  // TC4: AwaazOnboard — 2G Auth-Only (Override must NOT fire)
  const tc4 = computeFeasibility({
    bandwidth: "2G_AUTH",
    device: "LOW_END_SMARTPHONE",
    noise: "CALL_CENTER",
    dialect: "URDU_STANDARD",
    regulatory: {
      nadraVerified: true,
      authOnly: true,
      tier1: false,
      standaloneEnrollment: false,
    },
  });
  results.push({
    name: "TC4: 2G Auth-Only",
    pass:
      tc4.enrollmentOverride === false &&
      tc4.regulatoryBlock === false &&
      tc4.category === "PROCEED_WITH_MODIFICATIONS" &&
      tc4.composite >= 66 &&
      tc4.composite <= 67,
    result: tc4,
  });

  // TC5: Correlation Detection — Rural Peripheral Profile
  const tc5 = computeFeasibility({
    bandwidth: "2G_AUTH",
    device: "FEATURE_PHONE",
    noise: "RURAL_OUTDOOR",
    dialect: "BALOCHI",
    regulatory: {
      nadraVerified: true,
      authOnly: true,
      tier1: false,
      standaloneEnrollment: false,
    },
  });
  results.push({
    name: "TC5: Correlation Detection — Rural Peripheral",
    pass:
      tc5.correlationWarning !== null &&
      tc5.correlationWarning.severity === "high" &&
      tc5.correlationWarning.count >= 3 &&
      tc5.correlationWarning.profile !== null &&
      tc5.correlationWarning.profile.key === "RURAL_PERIPHERAL",
    result: tc5,
  });

  // TC6: No Correlation — Urban Optimal (should NOT trigger warning)
  const tc6 = computeFeasibility({
    bandwidth: "4G",
    device: "MODERN_SMARTPHONE",
    noise: "CALL_CENTER",
    dialect: "URDU_STANDARD",
    regulatory: {
      nadraVerified: true,
      authOnly: true,
      tier1: false,
      standaloneEnrollment: false,
    },
  });
  results.push({
    name: "TC6: No Correlation — Urban Optimal",
    pass: tc6.correlationWarning === null,
    result: tc6,
  });

  return results;
}

// Export for Node.js testing
if (typeof module !== "undefined") {
  module.exports = {
    computeFeasibility,
    computeRegulatoryScore,
    detectCorrelationProfile,
    runTests,
    BANDWIDTH_SCORES,
    DEVICE_SCORES,
    NOISE_SCORES,
    DIALECT_SCORES,
    WEIGHTS,
    RECOMMENDATIONS,
    CORRELATION_PROFILES,
  };
}
