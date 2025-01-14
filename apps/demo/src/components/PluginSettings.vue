<template>
  <div class="checkbox-group">
    <plugin-item v-for="plugin of PLUGIN_NAMES" :key="plugin" :name="plugin">{{ PLUGIN_LABELS[plugin] }}</plugin-item>
  </div>
</template>

<script lang="ts" setup>

import PluginItem from './PluginItem.vue'

const PLUGIN_LABELS: Record<string, string> = {
  big_mute_button: "Big mute button",
  bottom_gear: "Bottom gear",
  click_to_pause: "Click to pause",
  clappr_nerd_stats: "Stats for nerds",
  clappr_stats: "Stats",
  disable_controls: "Disable controls",
  dvr_controls: "DVR controls",
  error_screen: "Error screen",
  level_selector: "Level selector",
  media_control: "Media control",
  multi_camera: "Multi camera",
  picture_in_picture: "Picture in picture",
  playback_rate: "Playback rate",
  poster: "Poster",
  spinner: "Spinner",
  subtitles: "Subtitles",
  thumbnails: "Thumbnails",
  volume_fade: "Volume fade",
}

const PLUGIN_NAMES = Object.keys(PLUGIN_LABELS)

</script>