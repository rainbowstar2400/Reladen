// apps/web/lib/evaluation/weight-table.ts
export type WeightTable = {
  tags: Record<string, number>;
  quality: {
    balanced: number;
    skewed: number;
    toneBonus: Record<string, number>;
  };
};

export const defaultWeightTable: WeightTable = {
  tags: {
    "共感": +0.7,
    "感謝": +0.5,
    "励まし": +0.6,
    "軽い雑談": +0.2,
    "謝罪": -0.3,
    "否定": -0.7,
    "皮肉": -1.0,
  },
  quality: {
    balanced: +0.3,
    skewed: -0.2,
    toneBonus: {
      friendly: +0.4,
      calm: +0.2,
      harsh: -0.5,
    },
  },
};
