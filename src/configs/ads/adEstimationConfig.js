const AD_ESTIMATION_CONFIG = {
  adTypes: {
    1: {
      image: { frequency: 3 },
      video: { frequency: 2.5, viewRate: 0.35 },
    },
    2: {
      image: { frequency: 2.5 },
      video: { frequency: 2, viewRate: 0.45 },
    },
    3: {
      image: { frequency: 2.5 },
      video: { frequency: 2, viewRate: 0.4 },
    },
    4: {
      image: { frequency: 3 },
      video: { frequency: 2.5, viewRate: 0.4 },
    },
  },
  objectives: {
    1: { cpmMultiplier: 1 },
    2: { cpmMultiplier: 1.1 },
    3: { cpmMultiplier: 1.2 },
    4: { cpmMultiplier: 1.2 },
    5: { cpmMultiplier: 1.2 },
    6: { cpmMultiplier: 1.05 },
    7: { cpmMultiplier: 1.05 },
    8: { cpmMultiplier: 0.95 },
  },
};

export default AD_ESTIMATION_CONFIG;