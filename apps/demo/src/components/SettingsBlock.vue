<template>
  <div class="settings">
    <div class="checkbox-group block">
      <label for="option_autoplay">
        <input type="checkbox" id="option_autoplay" :checked="settings.autoplay"
          @change="e => settings.setAutoplay(e.target.checked)">
        Autoplay
      </label>
      <label for="option_mute">
        <input type="checkbox" id="option_mute" :checked="settings.mute"
          @change="e => settings.setMute(e.target.checked)">
        Mute
      </label>
      <label for="option_loop">
        <input type="checkbox" id="option_loop" :checked="settings.loop"
          @change="e => settings.setLoop(e.target.checked)">
        Loop
      </label>
    </div>
    <div class="heading">Priority transport</div>
    <div class="radio-group block">
      <label v-for="t of TRANSPORTS" :key="t" :for="`priority_transport_${t}`">
        <input type="radio" :id="`priority_transport_${t}`" name="priority_transport" :value="t"
          :checked="settings.priorityTransport === t" @change="e => settings.setPriorityTransport(e.target.value)">
        {{ TRANSPORT_LABELS[t] }}
      </label>
    </div>
    <div class="heading">UI</div>
    <plugin-settings class="block"/>
    <div class="heading"></div>
    <div class="buttons">
      <!-- <button @click="applySettings">Configure</button> -->
      <button @click="settings.reset()">Reset</button>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { ref } from 'vue'

import useSettingsStore from "../store/settings";
import PluginSettings from './PluginSettings.vue'

const TRANSPORTS = ['dash', 'hls', 'mpegts', 'auto']
const TRANSPORT_LABELS = {
  'dash': 'DASH',
  'hls': 'HLS',
  'mpegts': 'No-LL HLS',
  'auto': 'Auto',
}

const settings = useSettingsStore()

function applySettings() {
  const url = new URL(location.href);
  const usp = new URLSearchParams(url.searchParams);
  // TODO autoPlay, mute, loop
  if (settings.autoplay) {
    usp.set('autoplay', '1');
  } else {
    usp.delete('autoplay');
  }
  if (settings.mute) {
    usp.set('mute', '1');
  } else {
    usp.delete('mute');
  }
  if (settings.loop) {
    usp.set('loop', '1');
  } else {
    usp.delete('loop');
  }
  usp.set('priority_transport', settings.priorityTransport);
  if (settings.plugins.length > 0) {
    usp.set('plugins', settings.plugins.join(','));
  }

  const nextUrl = new URL(url);
  nextUrl.search = usp.toString();
  window.location.href = nextUrl.toString();
}
</script>

<style lang="css" scoped>
.heading {
  font-weight: 600;
  line-height: 1.5;
}
.block {
  margin-bottom: 1rem;
}
</style>