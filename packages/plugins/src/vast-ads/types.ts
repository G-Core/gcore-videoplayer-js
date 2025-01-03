export type AdRollType = 'preroll' | 'middleroll' | 'repeatableroll' | 'pauseroll' | 'postroll' | 'scteroll';

export type AdRollItem = {
  startTime: number;
  startTimePercent: number;
  tag: string;
};

export type AdRollDesc = {
  data: AdRollItem[];
  oneByOne?: boolean;
};

export type VastAdsOptions = Partial<Record<AdRollType, AdRollDesc>>;
