import humanFormat, { ScaleLike } from 'human-format';
import type { MetricsKind, MetricsType } from './types';

const timeScale = new humanFormat.Scale({
  ms: 1,
  sec: 1000,
  min: 60000,
  hours: 3600000
});

const percentScale = new humanFormat.Scale({
  '%': 1
});

type FormatParams = {
  scale?: ScaleLike;
  unit?: 'bps';
  decimals?: number;
}

const formattingTemplate: Record<MetricsKind, Partial<Record<MetricsType, FormatParams>>> = {
  general: {
    volume: {
      scale: percentScale
    }
  },
  timers: {
    startup: {
      scale: timeScale
    },
    watch: {
      scale: timeScale
    },
    pause: {
      scale: timeScale
    },
    buffering: {
      scale: timeScale
    },
    session: {
      scale: timeScale
    },
    latency: {
      scale: timeScale
    }
  },
  extra: {
    buffersize: {
      scale: timeScale
    },
    duration: {
      scale: timeScale
    },
    currentTime: {
      scale: timeScale
    },
    bitrateWeightedMean: {
      unit: 'bps'
    },
    bitrateMostUsed: {
      unit: 'bps'
    },
    bandwidth: {
      unit: 'bps'
    },
    watchedPercentage: {
      scale: percentScale
    },
    bufferingPercentage: {
      scale: percentScale
    }
  }
};

type MetricsValue = number | string;
type Metrics = Partial<Record<MetricsKind, Partial<Record<MetricsType, MetricsValue>>>>;

export default class Formatter {
  static format(metrics: Metrics): Metrics {
    const formattedMetrics: Metrics = {};

    Object.entries(metrics).forEach(([type, mm]) => {
      const fmt: Partial<Record<MetricsType, MetricsValue>> = {};
      formattedMetrics[type as MetricsKind] = fmt;
      const typeTemplate = formattingTemplate[type as MetricsKind];

      Object.entries(mm).forEach(([name, value]) => {
        // const value = mm[name];

        if (typeTemplate && typeTemplate[name as MetricsType] && (typeof value === 'number') && !isNaN(value)) {
          // @ts-ignore
          const templateScale = typeTemplate[name as MetricsType].scale || 'SI';
          // @ts-ignore
          const templateUnit = typeTemplate[name as MetricsType].unit || '';

          fmt[name as MetricsType] = humanFormat(value, {
            scale: templateScale,
            unit: templateUnit,
            decimals: 2
          });
        } else {
          fmt[name as MetricsType] = value;
        }
      });
    });

    return formattedMetrics;
  }
}
