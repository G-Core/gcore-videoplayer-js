<template>
  <div class="checkbox-group">
    <plugin-item v-for="plugin of PLUGIN_NAMES" :key="plugin" :name="plugin">{{ PLUGIN_LABELS[plugin] }}</plugin-item>
  </div>
</template>

<script lang="ts" setup>
import { ref, watch } from 'vue';

import {
  Player,
  PlayerPlugin,
} from '@gcorevideo/player'

// import {
//   AudioSelector,
//   BigMuteButton,
//   BottomGear,
//   ClapprNerdStats,
//   ClapprStats,
//   ClickToPause,
//   DisableControls,
//   DvrControls,
//   ErrorScreen,
//   LevelSelector,
//   MediaControl,
//   MultiCamera,
//   PictureInPicture,
//   PlaybackRate,
//   Poster,
//   Subtitles,
//   SpinnerThreeBounce,
//   Thumbnails,
//   VolumeFade,
// } from '@gcorevideo/player-plugins'

import PluginItem from './PluginItem.vue'

// import useSettingsStore from "../store/settings";

// import usePluginsConfig from "../composables/use-plugins-config";

// const PLUGINS: Record<string, PlayerPlugin> = {
//   big_mute_button: BigMuteButton,
//   bottom_gear: BottomGear,
//   click_to_pause: ClickToPause,
//   clappr_nerd_stats: ClapprNerdStats,
//   clappr_stats: ClapprStats,
//   disable_controls: DisableControls,
//   dvr_controls: DvrControls,
//   error_screen: ErrorScreen,
//   level_selector: LevelSelector,
//   media_control: MediaControl,
//   multi_camera: MultiCamera,
//   picture_in_picture: PictureInPicture,
//   playback_rate: PlaybackRate,
//   poster: Poster,
//   spinner: SpinnerThreeBounce,
//   subtitles: Subtitles,
//   thumbnails: Thumbnails,
//   volume_fade: VolumeFade,
// }

const PLUGIN_LABELS = {
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

// const settings = useSettingsStore()

// before onMounted
// configurePlugins();

// function configurePlugins() {
//   Object.entries(PLUGINS).forEach(([name, plugin]) => {
//     console.log("configurePlugins", name, settings.plugins.includes(name))
//     if (settings.plugins.includes(name)) {
//       Player.registerPlugin(plugin)
//     }
//   })
// }

</script>