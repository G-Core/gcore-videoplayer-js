import type { PlayerDebugTag, TransportPreference } from '@gcorevideo/player';
import { defineStore } from 'pinia'

import usePersistence from '@/composables/use-persistence';

type State = {
  plugins: string[];
  autoplay: boolean;
  mute: boolean;
  loop: boolean;
  priorityTransport: TransportPreference;
  source: StreamSource;
}

const persistedSource = usePersistence<StreamSource>('settings.source', JSON.stringify, JSON.parse);
const persistedPlugins = usePersistence<string[]>('settings.plugins', (a: string[]) => a.join(), (v: string) => v.split(','));

const url = new URL(window.location.href)
const debug = debugTag(url.searchParams.get('debug') || 'all') ?? true;
const autoplay = parseBoolean(url.searchParams.get('autoplay'), false);
const mute = parseBoolean(url.searchParams.get('mute'), true);
const loop = parseBoolean(url.searchParams.get('loop'), false);
const priorityTransport = transportPreference(url.searchParams.get('priority_transport') || 'auto')
const defaultPlugins = ['media_control', 'level_selector', 'bottom_gear', 'error_screen', 'poster']
const usePersistedPlugins = !url.searchParams.has('plugins')
const plugins = (usePersistedPlugins ? persistedPlugins.get(defaultPlugins) : url.searchParams.get('plugins')?.split(',')) ?? []
const source = persistedSource.get({
  master: '',
}) as StreamSource;

type StreamSource = {
  master: string;
  dash?: string;
  hlsMpegts?: string;
  hlsCmaf?: string;
  poster?: string;
}

const useSettingsStore = defineStore<'settings', State>('settings', {
  state: () => ({
    autoplay,
    debug,
    loop,
    mute,
    plugins,
    priorityTransport,
    source,
  }),
  getters: {
    multisources() {
      if (!this.source.master) {
        return [];
      }
      const item = {
        description: '',
        dvr: false,
        hlsCmafUrl: this.source.hlsCmaf,
        hlsMpegtsUrl: this.source.hlsMpegts,
        id: 1,
        live: true,
        priorityTransport: this.priorityTransport,
        poster: this.source.poster,
        source: this.source.master,
        sourceDash: this.source.dash,
        sprite: null,
        title: 'Live stream',
        vtt: null,
      };
      return [item];
    },
  },
  actions: {
    addPlugin(name: string) {
      if (this.plugins.includes(name)) {
        return;
      }
      this.plugins.push(name);
      if (name === "clappr_nerd_stats" && !this.plugins.includes("clappr_stats")) {
        this.plugins.push("clappr_stats");
      }
      persistedPlugins.set(this.plugins);
    },
    removePlugin(name: string) {
      const index = this.plugins.indexOf(name);
      if (index === -1) {
        return;
      }
      this.plugins.splice(index, 1);
      if (name === "clappr_stats" && this.plugins.includes("clappr_nerd_stats")) {
        this.plugins.splice(this.plugins.indexOf("clappr_nerd_stats"), 1);
      }
      persistedPlugins.set(this.plugins);
    },
    setAutoplay(value: boolean) {
      this.autoplay = value;
    },
    setLoop(value: boolean) {
      this.loop = value;
    },
    setMute(value: boolean) {
      this.mute = value;
    },
    setPriorityTransport(value: TransportPreference) {
      this.priorityTransport = value;
    },
    setStreamSource(value: StreamSource) {
      this.source = value;
      persistedSource.set(value);
    },
    // TODO
    reset() {
      this.autoplay = false;
      this.mute = true;
      this.loop = false;
      this.plugins = defaultPlugins;
      this.priorityTransport = 'auto';
    }
  },
});

function debugTag(input: string): PlayerDebugTag | undefined {
  if (['all', 'clappr', 'dash', 'hls', 'none'].includes(input)) {
    return input as PlayerDebugTag;
  }
}

function transportPreference(input: string): TransportPreference {
  if (['hls', 'dash', 'mpegts'].includes(input)) {
    return input as TransportPreference;
  }
  return 'auto';
}

function parseBoolean(val: string | null, defaultValue: boolean): boolean {
  if (val === null) {
    return defaultValue;
  }
  return ['true', 'yes', '1'].includes(val);
}

export default useSettingsStore;
