<template>
  <div class="demo-player">
    <div ref="container" class="container"></div>
    <div class="settings">
      <div class="label">Settings</div>
      <div class="checkbox-group">
        <label for="option_autoplay">
          <input type="checkbox" id="option_autoplay" v-model="autoPlay">
          Autoplay
        </label>
        <label for="option_mute">
          <input type="checkbox" id="option_mute" v-model="mute">
          Mute
        </label>
        <label for="option_loop">
          <input type="checkbox" id="option_loop" v-model="loop">
          Loop
        </label>
      </div>
      <div class="label">Priority transport</div>
      <div class="radio-group">
        <label for="priority_transport_dash">
          <input type="radio" id="priority_transport_dash" name="priority_transport" value="dash"
            v-model="priorityTransport">
          DASH
        </label>
        <label for="priority_transport_hls">
          <input type="radio" id="priority_transport_hls" name="priority_transport" value="hls"
            v-model="priorityTransport">
          HLS
        </label>
        <label for="priority_transport_mpegts">
          <input type="radio" id="priority_transport_mpegts" name="priority_transport" value="mpegts"
            v-model="priorityTransport">
          No LL HLS
        </label>
        <label for="priority_transport_auto">
          <input type="radio" id="priority_transport_auto" name="priority_transport" value="auto"
            v-model="priorityTransport">
          Auto
        </label>
      </div>
      <div class="label">UI</div>
      <div class="checkbox-group">
        <label for="plugin_big_mute_button">
          <input type="checkbox" id="plugin_big_mute_button" v-model="pluginBigMuteButton">
          Big mute button
        </label>
        <label for="plugin_bottom_gear">
          <input type="checkbox" id="plugin_bottom_gear" v-model="pluginBottomGear">
          Bottom gear
        </label>
        <label for="plugin_click_to_pause">
          <input type="checkbox" id="plugin_click_to_pause" v-model="pluginClickToPause">
          Click to pause
        </label>
        <label for="plugin_disable_controls">
          <input type="checkbox" id="plugin_disable_controls" v-model="pluginDisableControls">
          Disable controls
        </label>
        <label for="plugin_dvr_controls">
          <input type="checkbox" id="plugin_dvr_controls" v-model="pluginDvrControls">
          DVR controls
        </label>
        <label for="plugin_error_screen">
          <input type="checkbox" id="plugin_error_screen" v-model="pluginErrorScreen">
          Error screen
        </label>
        <label for="plugin_level_selector">
          <input type="checkbox" id="plugin_level_selector" v-model="pluginLevelSelector">
          Level selector
        </label>
        <label for="plugin_media_control">
          <input type="checkbox" id="plugin_media_control" v-model="pluginMediaControl">
          Media control
        </label>
        <label for="plugin_multi_camera">
          <input type="checkbox" id="plugin_multi_camera" v-model="pluginMultiCamera">
          Multi camera
        </label>
        <label for="plugin_picture_in_picture">
          <input type="checkbox" id="plugin_picture_in_picture" v-model="pluginPictureInPicture">
          Picture in picture
        </label>
        <label for="plugin_playback_rate">
          <input type="checkbox" id="plugin_playback_rate" v-model="pluginPlaybackRate">
          Playback rate
        </label>
        <label for="plugin_poster">
          <input type="checkbox" id="plugin_poster" v-model="pluginPoster">
          Poster
        </label>
        <label for="plugin_clappr_stats">
          <input type="checkbox" id="plugin_clappr_stats" v-model="pluginClapprStats">
          Stats
        </label>
        <label for="plugin_clappr_nerd_stats">
          <input type="checkbox" id="plugin_clappr_nerd_stats" v-model="pluginClapprNerdStats">
          Stats for nerds
        </label>
        <label for="plugin_spinner">
          <input type="checkbox" id="plugin_spinner" v-model="pluginSpinner">
          Spinner
        </label>
        <label for="plugin_subtitles">
          <input type="checkbox" id="plugin_subtitles" v-model="pluginSubtitles">
          Subtitles
        </label>
        <label for="plugin_thumbnails">
          <input type="checkbox" id="plugin_thumbnails" v-model="pluginThumbnails">
          Thumbnails
        </label>
        <label for="plugin_volume_fade">
          <input type="checkbox" id="plugin_volume_fade" v-model="pluginVolumeFade">
          Volume fade
        </label>
      </div>
      <div class="label"></div>
      <div class="buttons">
        <button @click="applySettings">Apply</button>
        <button @click="resetSettings">Reset</button>
      </div>
    </div>
    <div class="settings controls">
      <div class="buttons label">
        <button @click="play" v-if="!playing">Play</button>
        <button @click="pause" v-if="playing">Pause</button>
        <button @click="stop" v-if="!stopped">Stop</button>
      </div>
      <div class="status">{{ status }}</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";

import {
  Player,
  PlayerEvent,
  trace,
  type PlaybackType,
  type PlayerDebugTag,
  type StreamMediaSourceDto,
  type TransportPreference,
  fromStreamMediaSourceDto,
} from '@gcorevideo/player'

import {
  AudioSelector,
  BigMuteButton,
  BottomGear,
  ClapprNerdStats,
  ClapprStats,
  ClickToPause,
  DisableControls,
  DvrControls,
  ErrorScreen,
  LevelSelector,
  MediaControl,
  MultiCamera,
  PictureInPicture,
  PlaybackRate,
  Poster,
  Subtitles,
  SpinnerThreeBounce,
  Thumbnails,
  VolumeFade,
} from "@gcorevideo/player-plugins"

const T = 'DemoPlayer.vue'

const url = new URL(window.location.href)
const debug = url.searchParams.get('debug') as PlayerDebugTag ?? true;

const video = ref<HTMLVideoElement>()
const container = ref<HTMLDivElement>()
const playing = ref(false)
const paused = ref(false)
const ready = ref(false)
const starting = ref(false)
const stopped = ref(true)

const autoPlay = ref(parseBoolean(url.searchParams.get('autoplay'), false));
const mute = ref(parseBoolean(url.searchParams.get('mute'), true));
const loop = ref(parseBoolean(url.searchParams.get('loop'), false));
const priorityTransport = ref<TransportPreference>(url.searchParams.get('priority_transport') || 'auto')

const defaultPlugins = ['media_control', 'level_selector', 'bottom_gear', 'error_screen', 'poster']
const useDefaultPlugins = !url.searchParams.has('plugins')
const pluginSettings = useDefaultPlugins ? defaultPlugins : url.searchParams.get('plugins')?.split(',') ?? []
const pluginBottomGear = ref(pluginSettings.includes('bottom_gear'))
const pluginBigMuteButton = ref(pluginSettings.includes('big_mute_button'))
const pluginClapprStats = ref(pluginSettings.includes('clappr_stats'))
const pluginClapprNerdStats = ref(pluginSettings.includes('clappr_nerd_stats'))
const pluginClickToPause = ref(pluginSettings.includes('click_to_pause'))
const pluginDisableControls = ref(pluginSettings.includes('disable_controls'))
const pluginDvrControls = ref(pluginSettings.includes('dvr_controls'))
const pluginErrorScreen = ref(pluginSettings.includes('error_screen'))
const pluginLevelSelector = ref(pluginSettings.includes('level_selector'))
const pluginMediaControl = ref(pluginSettings.includes('media_control'))
const pluginMultiCamera = ref(pluginSettings.includes('multi_camera'))
const pluginPictureInPicture = ref(pluginSettings.includes('picture_in_picture'))
const pluginPlaybackRate = ref(pluginSettings.includes('playback_rate'))
const pluginPoster = ref(pluginSettings.includes('poster'))
const pluginSpinner = ref(pluginSettings.includes('spinner'))
const pluginSubtitles = ref(pluginSettings.includes('subtitles'))
const pluginThumbnails = ref(pluginSettings.includes('thumbnails'))
const pluginVolumeFade = ref(pluginSettings.includes('volume_fade'))

const status = computed(() => {
  if (!ready.value) {
    return 'Loading...';
  }
  if (starting.value) {
    return 'Starting...';
  }
  if (playing.value) {
    return 'Playing';
  }
  if (paused.value) {
    return 'Paused';
  }
  return 'Stopped';
})

const config = {
  autoPlay: autoPlay.value,
  debug: true,
  poster: "https://static.gvideo.co/videoplatform/streams/2675/19146/screenshots/last.jpg",
  // TODO
  // realtimeApi: "wss://realtime-api.gvideo.co/ws/subscribe/message/2675_live_19146_0_GWxvgWFBHP3eEter8V9g",
  mute: mute.value,
  width: "100%",
  height: "100%",
  // dash: {
  //   streaming: {
  //     lowLatencyEnabled: true,
  //     liveDelay: 3,
  //     abr: {
  //       initialBitrate: {
  //         video: 2000
  //       }
  //     }
  //   }
  // },
  // language: "en", // strings plugin
  loop: loop.value,
  pluginSettings: {
    // contextMenu: {
    //   label: '',
    //   preventShowContextMenu: true,
    //   url: '',
    // },
    design: { // media_control
      background_color: "rgba(0,0,0,1.0)",
      foreground_color: "rgba(255,255,255,1)",
      hover_color: "rgba(239,144,71,1)",
      text_color: "rgba(255,255,255,1)"
    },
    // disableClickOnPause: true, // vast_ads
    // disableMediaControl: true, // disable_controls, ...
    // embed: true, // share plugin
    // fullscreenDisable: true, // media_control
    levelSelector: {
      labels: {
        '2160': '4K',
        '1080': 'Full HD',
        '720': 'HD',
      }
    },
    // multicameraPlay: true, // multi_camera
    multisourcesMode: "show_all", // multi_camera
    // shareURL: "https://gvideo.co", // share plugin
    subtitles: {
      language: 'en',
    },
    thumbnails: {
      backdropHeight: 200,
      backdropMinOpacity: 0.9,
      backdropMaxOpacity: 0.99,
      spotlightHeight: 100,
      vtt: "1\n00:00:00,000 --> 00:00:10,000\n3dk4NsRt6vWsffEr_sprite.jpg#xywh=0,0,100,56\n\n2\n00:00:10,000 --> 00:00:20,000\n3dk4NsRt6vWsffEr_sprite.jpg#xywh=100,0,100,56\n\n3\n00:00:20,000 --> 00:00:30,000\n3dk4NsRt6vWsffEr_sprite.jpg#xywh=200,0,100,56\n\n4\n00:00:30,000 --> 00:00:40,000\n3dk4NsRt6vWsffEr_sprite.jpg#xywh=300,0,100,56\n\n5\n00:00:40,000 --> 00:00:50,000\n3dk4NsRt6vWsffEr_sprite.jpg#xywh=400,0,100,56\n\n6\n00:00:50,000 --> 00:01:00,000\n3dk4NsRt6vWsffEr_sprite.jpg#xywh=500,0,100,56\n\n7\n00:01:00,000 --> 00:01:10,000\n3dk4NsRt6vWsffEr_sprite.jpg#xywh=600,0,100,56\n\n8\n00:01:10,000 --> 00:01:20,000\n3dk4NsRt6vWsffEr_sprite.jpg#xywh=0,56,100,56\n\n9\n00:01:20,000 --> 00:01:30,000\n3dk4NsRt6vWsffEr_sprite.jpg#xywh=100,56,100,56\n\n10\n00:01:30,000 --> 00:01:40,000\n3dk4NsRt6vWsffEr_sprite.jpg#xywh=200,56,100,56\n\n11\n00:01:40,000 --> 00:01:50,000\n3dk4NsRt6vWsffEr_sprite.jpg#xywh=300,56,100,56\n\n12\n00:01:50,000 --> 00:02:00,000\n3dk4NsRt6vWsffEr_sprite.jpg#xywh=400,56,100,56\n\n13\n00:02:00,000 --> 00:02:10,000\n3dk4NsRt6vWsffEr_sprite.jpg#xywh=500,56,100,56\n\n14\n00:02:10,000 --> 00:02:20,000\n3dk4NsRt6vWsffEr_sprite.jpg#xywh=600,56,100,56\n\n15\n00:02:20,000 --> 00:02:30,000\n3dk4NsRt6vWsffEr_sprite.jpg#xywh=0,112,100,56\n\n16\n00:02:30,000 --> 00:02:40,000\n3dk4NsRt6vWsffEr_sprite.jpg#xywh=100,112,100,56\n\n17\n00:02:40,000 --> 00:02:50,000\n3dk4NsRt6vWsffEr_sprite.jpg#xywh=200,112,100,56\n\n18\n00:02:50,000 --> 00:03:00,000\n3dk4NsRt6vWsffEr_sprite.jpg#xywh=300,112,100,56\n\n19\n00:03:00,000 --> 00:03:10,000\n3dk4NsRt6vWsffEr_sprite.jpg#xywh=400,112,100,56\n\n20\n00:03:10,000 --> 00:03:20,000\n3dk4NsRt6vWsffEr_sprite.jpg#xywh=500,112,100,56\n\n21\n00:03:20,000 --> 00:03:30,000\n3dk4NsRt6vWsffEr_sprite.jpg#xywh=600,112,100,56\n\n22\n00:03:30,000 --> 00:03:40,000\n3dk4NsRt6vWsffEr_sprite.jpg#xywh=0,168,100,56\n\n23\n00:03:40,000 --> 00:03:50,000\n3dk4NsRt6vWsffEr_sprite.jpg#xywh=100,168,100,56\n\n24\n00:03:50,000 --> 00:04:00,000\n3dk4NsRt6vWsffEr_sprite.jpg#xywh=200,168,100,56\n\n25\n00:04:00,000 --> 00:04:10,000\n3dk4NsRt6vWsffEr_sprite.jpg#xywh=300,168,100,56\n\n26\n00:04:10,000 --> 00:04:20,000\n3dk4NsRt6vWsffEr_sprite.jpg#xywh=400,168,100,56\n\n27\n00:04:20,000 --> 00:04:30,000\n3dk4NsRt6vWsffEr_sprite.jpg#xywh=500,168,100,56\n\n28\n00:04:30,000 --> 00:04:40,000\n3dk4NsRt6vWsffEr_sprite.jpg#xywh=600,168,100,56\n\n29\n00:04:40,000 --> 00:04:50,000\n3dk4NsRt6vWsffEr_sprite.jpg#xywh=0,224,100,56\n\n30\n00:04:50,000 --> 00:05:00,000\n3dk4NsRt6vWsffEr_sprite.jpg#xywh=100,224,100,56\n\n31\n00:05:00,000 --> 00:05:10,000\n3dk4NsRt6vWsffEr_sprite.jpg#xywh=200,224,100,56\n\n32\n00:05:10,000 --> 00:05:20,000\n3dk4NsRt6vWsffEr_sprite.jpg#xywh=300,224,100,56\n\n33\n00:05:20,000 --> 00:05:30,000\n3dk4NsRt6vWsffEr_sprite.jpg#xywh=400,224,100,56\n\n34\n00:05:30,000 --> 00:05:40,000\n3dk4NsRt6vWsffEr_sprite.jpg#xywh=500,224,100,56\n\n35\n00:05:40,000 --> 00:05:50,000\n3dk4NsRt6vWsffEr_sprite.jpg#xywh=600,224,100,56\n\n36\n00:05:50,000 --> 00:06:00,000\n3dk4NsRt6vWsffEr_sprite.jpg#xywh=0,280,100,56\n\n37\n00:06:00,000 --> 00:06:10,000\n3dk4NsRt6vWsffEr_sprite.jpg#xywh=100,280,100,56\n\n38\n00:06:10,000 --> 00:06:20,000\n3dk4NsRt6vWsffEr_sprite.jpg#xywh=200,280,100,56\n\n39\n00:06:20,000 --> 00:06:30,000\n3dk4NsRt6vWsffEr_sprite.jpg#xywh=300,280,100,56\n\n40\n00:06:30,000 --> 00:06:40,000\n3dk4NsRt6vWsffEr_sprite.jpg#xywh=400,280,100,56\n\n41\n00:06:40,000 --> 00:06:50,000\n3dk4NsRt6vWsffEr_sprite.jpg#xywh=500,280,100,56\n\n42\n00:06:50,000 --> 00:07:00,000\n3dk4NsRt6vWsffEr_sprite.jpg#xywh=600,280,100,56\n\n43\n00:07:00,000 --> 00:07:10,000\n3dk4NsRt6vWsffEr_sprite.jpg#xywh=0,336,100,56\n\n44\n00:07:10,000 --> 00:07:20,000\n3dk4NsRt6vWsffEr_sprite.jpg#xywh=100,336,100,56\n\n45\n00:07:20,000 --> 00:07:30,000\n3dk4NsRt6vWsffEr_sprite.jpg#xywh=200,336,100,56\n\n46\n00:07:30,000 --> 00:07:40,000\n3dk4NsRt6vWsffEr_sprite.jpg#xywh=300,336,100,56\n\n47\n00:07:40,000 --> 00:07:50,000\n3dk4NsRt6vWsffEr_sprite.jpg#xywh=400,336,100,56\n\n48\n00:07:50,000 --> 00:08:00,000\n3dk4NsRt6vWsffEr_sprite.jpg#xywh=500,336,100,56\n\n49\n00:08:00,000 --> 00:08:10,000\n3dk4NsRt6vWsffEr_sprite.jpg#xywh=600,336,100,56\n",
      sprite: "https://static.gvideo.co/videoplatform/sprites/2675/2452164_3dk4NsRt6vWsffEr.mp4_sprite.jpg",
    },
  },
  // multisources: [{
  //   // "source": "https://demo-public.gvideo.io/cmaf/2675_21627/master.m3u8",
  //   "source": "https://demo-public.gvideo.io/videos/2675_3dk4NsRt6vWsffEr/master.m3u8",
  //   // "source": "https://demo-public.gvideo.io/cmaf/2675_2143086/master.m3u8",
  //   // "source": "https://2627-cdn.preprod.gvideo.io/cmaf/2627_10527209/master.m3u8",
  //   "poster": null,
  //   "sprite": null,
  //   "vtt": null,
  //   "title": "Camera #1",
  //   "description": "",
  //   "id": 21627,
  //   "live": true,
  //   // "source_dash": "https://demo-public.gvideo.io/cmaf/2675_21627/index.mpd",
  //   "source_dash": "https://demo-public.gvideo.io/cmaf/2675_2143086/index.mpd",
  //   // "source_dash": "https://2627-cdn.preprod.gvideo.io/cmaf/2627_10527209/index.mpd",
  //   // "priority_transport": "dash",
  //   "priority_transport": "hls",
  //   "screenshot": "https://static.gvideo.co/videoplatform/streams/2675/21627/screenshots/last.jpg",
  //   // "hls_mpegts_url": "https://demo-public.gvideo.io/mpegts/2675_21627/master_mpegts.m3u8",
  //   "hls_mpegts_url": "https://demo-public.gvideo.io/mpegts/2675_2143086/master_mpegts.m3u8",
  //   // "hls_mpegts_url": "https://2627-cdn.preprod.gvideo.io/mpegts/2627_10527209/master_mpegts.m3u8",
  //   "projection": "regular"
  // }].map(fromStreamMediaSourceDto),
  multisources: [{
    "source": "https://demo-public.gvideo.io/videos/2675_3dk4NsRt6vWsffEr/master.m3u8",
    "poster": "https://static.gvideo.co/videoplatform/thumbnails/2675/2452164_3dk4NsRt6vWsffEr.mp4_1_1080.jpg",
    "sprite": "https://static.gvideo.co/videoplatform/sprites/2675/2452164_3dk4NsRt6vWsffEr.mp4_sprite.jpg",
    "vtt": "1\n00:00:00,000 --> 00:00:10,000\n3dk4NsRt6vWsffEr_sprite.jpg#xywh=0,0,100,56\n\n2\n00:00:10,000 --> 00:00:20,000\n3dk4NsRt6vWsffEr_sprite.jpg#xywh=100,0,100,56\n\n3\n00:00:20,000 --> 00:00:30,000\n3dk4NsRt6vWsffEr_sprite.jpg#xywh=200,0,100,56\n\n4\n00:00:30,000 --> 00:00:40,000\n3dk4NsRt6vWsffEr_sprite.jpg#xywh=300,0,100,56\n\n5\n00:00:40,000 --> 00:00:50,000\n3dk4NsRt6vWsffEr_sprite.jpg#xywh=400,0,100,56\n\n6\n00:00:50,000 --> 00:01:00,000\n3dk4NsRt6vWsffEr_sprite.jpg#xywh=500,0,100,56\n\n7\n00:01:00,000 --> 00:01:10,000\n3dk4NsRt6vWsffEr_sprite.jpg#xywh=600,0,100,56\n\n8\n00:01:10,000 --> 00:01:20,000\n3dk4NsRt6vWsffEr_sprite.jpg#xywh=0,56,100,56\n\n9\n00:01:20,000 --> 00:01:30,000\n3dk4NsRt6vWsffEr_sprite.jpg#xywh=100,56,100,56\n\n10\n00:01:30,000 --> 00:01:40,000\n3dk4NsRt6vWsffEr_sprite.jpg#xywh=200,56,100,56\n\n11\n00:01:40,000 --> 00:01:50,000\n3dk4NsRt6vWsffEr_sprite.jpg#xywh=300,56,100,56\n\n12\n00:01:50,000 --> 00:02:00,000\n3dk4NsRt6vWsffEr_sprite.jpg#xywh=400,56,100,56\n\n13\n00:02:00,000 --> 00:02:10,000\n3dk4NsRt6vWsffEr_sprite.jpg#xywh=500,56,100,56\n\n14\n00:02:10,000 --> 00:02:20,000\n3dk4NsRt6vWsffEr_sprite.jpg#xywh=600,56,100,56\n\n15\n00:02:20,000 --> 00:02:30,000\n3dk4NsRt6vWsffEr_sprite.jpg#xywh=0,112,100,56\n\n16\n00:02:30,000 --> 00:02:40,000\n3dk4NsRt6vWsffEr_sprite.jpg#xywh=100,112,100,56\n\n17\n00:02:40,000 --> 00:02:50,000\n3dk4NsRt6vWsffEr_sprite.jpg#xywh=200,112,100,56\n\n18\n00:02:50,000 --> 00:03:00,000\n3dk4NsRt6vWsffEr_sprite.jpg#xywh=300,112,100,56\n\n19\n00:03:00,000 --> 00:03:10,000\n3dk4NsRt6vWsffEr_sprite.jpg#xywh=400,112,100,56\n\n20\n00:03:10,000 --> 00:03:20,000\n3dk4NsRt6vWsffEr_sprite.jpg#xywh=500,112,100,56\n\n21\n00:03:20,000 --> 00:03:30,000\n3dk4NsRt6vWsffEr_sprite.jpg#xywh=600,112,100,56\n\n22\n00:03:30,000 --> 00:03:40,000\n3dk4NsRt6vWsffEr_sprite.jpg#xywh=0,168,100,56\n\n23\n00:03:40,000 --> 00:03:50,000\n3dk4NsRt6vWsffEr_sprite.jpg#xywh=100,168,100,56\n\n24\n00:03:50,000 --> 00:04:00,000\n3dk4NsRt6vWsffEr_sprite.jpg#xywh=200,168,100,56\n\n25\n00:04:00,000 --> 00:04:10,000\n3dk4NsRt6vWsffEr_sprite.jpg#xywh=300,168,100,56\n\n26\n00:04:10,000 --> 00:04:20,000\n3dk4NsRt6vWsffEr_sprite.jpg#xywh=400,168,100,56\n\n27\n00:04:20,000 --> 00:04:30,000\n3dk4NsRt6vWsffEr_sprite.jpg#xywh=500,168,100,56\n\n28\n00:04:30,000 --> 00:04:40,000\n3dk4NsRt6vWsffEr_sprite.jpg#xywh=600,168,100,56\n\n29\n00:04:40,000 --> 00:04:50,000\n3dk4NsRt6vWsffEr_sprite.jpg#xywh=0,224,100,56\n\n30\n00:04:50,000 --> 00:05:00,000\n3dk4NsRt6vWsffEr_sprite.jpg#xywh=100,224,100,56\n\n31\n00:05:00,000 --> 00:05:10,000\n3dk4NsRt6vWsffEr_sprite.jpg#xywh=200,224,100,56\n\n32\n00:05:10,000 --> 00:05:20,000\n3dk4NsRt6vWsffEr_sprite.jpg#xywh=300,224,100,56\n\n33\n00:05:20,000 --> 00:05:30,000\n3dk4NsRt6vWsffEr_sprite.jpg#xywh=400,224,100,56\n\n34\n00:05:30,000 --> 00:05:40,000\n3dk4NsRt6vWsffEr_sprite.jpg#xywh=500,224,100,56\n\n35\n00:05:40,000 --> 00:05:50,000\n3dk4NsRt6vWsffEr_sprite.jpg#xywh=600,224,100,56\n\n36\n00:05:50,000 --> 00:06:00,000\n3dk4NsRt6vWsffEr_sprite.jpg#xywh=0,280,100,56\n\n37\n00:06:00,000 --> 00:06:10,000\n3dk4NsRt6vWsffEr_sprite.jpg#xywh=100,280,100,56\n\n38\n00:06:10,000 --> 00:06:20,000\n3dk4NsRt6vWsffEr_sprite.jpg#xywh=200,280,100,56\n\n39\n00:06:20,000 --> 00:06:30,000\n3dk4NsRt6vWsffEr_sprite.jpg#xywh=300,280,100,56\n\n40\n00:06:30,000 --> 00:06:40,000\n3dk4NsRt6vWsffEr_sprite.jpg#xywh=400,280,100,56\n\n41\n00:06:40,000 --> 00:06:50,000\n3dk4NsRt6vWsffEr_sprite.jpg#xywh=500,280,100,56\n\n42\n00:06:50,000 --> 00:07:00,000\n3dk4NsRt6vWsffEr_sprite.jpg#xywh=600,280,100,56\n\n43\n00:07:00,000 --> 00:07:10,000\n3dk4NsRt6vWsffEr_sprite.jpg#xywh=0,336,100,56\n\n44\n00:07:10,000 --> 00:07:20,000\n3dk4NsRt6vWsffEr_sprite.jpg#xywh=100,336,100,56\n\n45\n00:07:20,000 --> 00:07:30,000\n3dk4NsRt6vWsffEr_sprite.jpg#xywh=200,336,100,56\n\n46\n00:07:30,000 --> 00:07:40,000\n3dk4NsRt6vWsffEr_sprite.jpg#xywh=300,336,100,56\n\n47\n00:07:40,000 --> 00:07:50,000\n3dk4NsRt6vWsffEr_sprite.jpg#xywh=400,336,100,56\n\n48\n00:07:50,000 --> 00:08:00,000\n3dk4NsRt6vWsffEr_sprite.jpg#xywh=500,336,100,56\n\n49\n00:08:00,000 --> 00:08:10,000\n3dk4NsRt6vWsffEr_sprite.jpg#xywh=600,336,100,56\n",
    "title": "gcore datacenter demo",
    "description": "",
    "id": 2452164,
    "live": true,
    "projection": "regular"
  }].map(fromStreamMediaSourceDto),
  // multisources: [{
  //   "source": "https://demo-public.gvideo.io/cmaf/2675_21627/master.m3u8",
  //   "poster": null,
  //   "sprite": null,
  //   "vtt": null,
  //   "title": "Camera #1",
  //   "description": "",
  //   "id": 21627,
  //   "live": true,
  //   "source_dash": "https://demo-public.gvideo.io/cmaf/2675_21627/index.mpd",
  //   "priority_transport": "dash",
  //   "screenshot": "https://static.gvideo.co/videoplatform/streams/2675/21627/screenshots/last.jpg",
  //   "hls_mpegts_url": "https://demo-public.gvideo.io/mpegts/2675_21627/master_mpegts.m3u8",
  //   "projection": "regular"
  // },
  // {
  //   "source": "https://demo-public.gvideo.io/cmaf/2675_21630/master.m3u8",
  //   "poster": null,
  //   "sprite": null,
  //   "vtt": null,
  //   "title": "Camera #2",
  //   "description": "",
  //   "id": 21630,
  //   "live": true,
  //   "source_dash": "https://demo-public.gvideo.io/cmaf/2675_21630/index.mpd",
  //   "priority_transport": "dash",
  //   "screenshot": "https://static.gvideo.co/videoplatform/streams/2675/21630/screenshots/last.jpg",
  //   "hls_mpegts_url": "https://demo-public.gvideo.io/mpegts/2675_21630/master_mpegts.m3u8",
  //   "projection": "regular"
  // }].map(fromStreamMediaSourceDto),
  // playbackType: "live" as PlaybackType,
  playbackType: "vod" as PlaybackType,
  priorityTransport: priorityTransport.value,
  // strings: JSON.parse(document.head.querySelector("[name=translations]").content),
};

const player = new Player(config)

player.on(PlayerEvent.Ended, () => {
  trace(`${T} onEnded`);
  playing.value = false;
  paused.value = false;
  starting.value = false;
})

player.on(PlayerEvent.Play, () => {
  trace(`${T} onPlay`);
  playing.value = true;
  paused.value = false;
  starting.value = false;
});

player.on(PlayerEvent.Pause, () => {
  trace(`${T} onPause`);
  playing.value = false;
  paused.value = true;
});

player.on(PlayerEvent.Ready, () => {
  trace(`${T} onReady`);
  ready.value = true;
})

player.on(PlayerEvent.Stop, () => {
  trace(`${T} onStop`);
  playing.value = false;
  paused.value = false;
  starting.value = false;
});

onMounted(() => {
  if (!container.value) {
    trace(`${T} onMounted container element is not ready`);
    return;
  }
  const con = container.value;
  configurePlugins();
  setTimeout(() => {
    player.init(con);
  }, 0)
})

watch(pluginClapprNerdStats, (val) => {
  if (val) {
    pluginClapprStats.value = true;
  }
})

watch(pluginClapprStats, (val) => {
  if (!val) {
    pluginClapprNerdStats.value = false;
  }
})

function play() {
  if (!player) {
    trace(`${T} play player is not ready`);
    return;
  }
  starting.value = true
  player.play()
  stopped.value = false
}

function pause() {
  if (!player) {
    trace(`${T} pause player is not ready`)
    return;
  }
  player.pause()
}

function stop() {
  if (!player) {
    trace(`${T} stop player is not ready`)
    return
  }
  stopped.value = true
  player.stop()
}

function applySettings() {
  const usp = new URLSearchParams(url.searchParams);
  // TODO autoPlay, mute, loop
  if (autoPlay.value) {
    usp.set('autoplay', '1');
  } else {
    usp.delete('autoplay');
  }
  if (mute.value) {
    usp.set('mute', '1');
  } else {
    usp.delete('mute');
  }
  if (loop.value) {
    usp.set('loop', '1');
  } else {
    usp.delete('loop');
  }
  usp.set('priority_transport', priorityTransport.value);
  const plugins = [];
  const pvals = [
    ['media_control', pluginMediaControl.value],
    ['multi_camera', pluginMultiCamera.value],
    ['level_selector', pluginLevelSelector.value],
    ['bottom_gear', pluginBottomGear.value],
    ['dvr_controls', pluginDvrControls.value],
    ['error_screen', pluginErrorScreen.value],
    ['picture_in_picture', pluginPictureInPicture.value],
    ['playback_rate', pluginPlaybackRate.value],
    ['poster', pluginPoster.value],
    ['big_mute_button', pluginBigMuteButton.value],
    ['disable_controls', pluginDisableControls.value],
    ['clappr_stats', pluginClapprStats.value],
    ['clappr_nerd_stats', pluginClapprNerdStats.value],
    ['click_to_pause', pluginClickToPause.value],
    ['spinner', pluginSpinner.value],
    ['subtitles', pluginSubtitles.value],
    ['thumbnails', pluginThumbnails.value],
    ['volume_fade', pluginVolumeFade.value],
  ];
  for (const [key, value] of pvals) {
    if (value) {
      plugins.push(key);
    }
  }
  if (plugins.length > 0) {
    usp.set('plugins', plugins.join(','));
  }

  const nextUrl = new URL(url);
  nextUrl.search = usp.toString();
  window.location.href = nextUrl.toString();
}

function parseBoolean(val: string | null, defaultValue: boolean): boolean {
  if (val === null) {
    return defaultValue;
  }
  return ['true', 'yes', '1'].includes(val);
}

function configurePlugins() {
  if (pluginBigMuteButton.value) {
    Player.registerPlugin(BigMuteButton)
  }
  if (pluginBottomGear.value) {
    Player.registerPlugin(BottomGear)
  }
  if (pluginClickToPause.value) {
    Player.registerPlugin(ClickToPause)
  }
  if (pluginClapprStats.value) {
    Player.registerPlugin(ClapprStats)
  }
  // <--- clips, context_menu, favicon, logo
  if (pluginClapprNerdStats.value) {
    Player.registerPlugin(ClapprNerdStats)
  }
  if (pluginDisableControls.value) {
    Player.registerPlugin(DisableControls)
  }
  if (pluginDvrControls.value) {
    Player.registerPlugin(DvrControls)
  }
  if (pluginErrorScreen.value) {
    Player.registerPlugin(ErrorScreen)
  }
  if (pluginLevelSelector.value) {
    Player.registerPlugin(LevelSelector)
  }
  if (pluginMediaControl.value) {
    Player.registerPlugin(MediaControl)
  }
  if (pluginMultiCamera.value) {
    Player.registerPlugin(MultiCamera)
  }
  if (pluginPictureInPicture.value) {
    Player.registerPlugin(PictureInPicture)
  }
  if (pluginPlaybackRate.value) {
    Player.registerPlugin(PlaybackRate)
  }
  if (pluginPoster.value) {
    Player.registerPlugin(Poster)
  }
  // TODO seek_time, share
  if (pluginSpinner.value) {
    Player.registerPlugin(SpinnerThreeBounce)
  }
  if (pluginSubtitles.value) {
    Player.registerPlugin(Subtitles)
  }
  if (pluginThumbnails.value) {
    Player.registerPlugin(Thumbnails)
  }
  if (pluginVolumeFade.value) {
    Player.registerPlugin(VolumeFade)
  }
}
</script>

<style lang="css" scoped>
.container {
  width: 100%;
  height: 0;
  padding-bottom: 56.25%;
  position: relative;
  background-color: black;
  color: #fff;
}

.settings {
  display: grid;
  grid-template-columns: max-content auto;
  grid-auto-rows: minmax(1.5rem, auto);
  gap: 0.5rem 1rem;
  margin: 0.5rem 0;
}

.radio-group {
  display: flex;
  gap: 1rem;
  align-items: center;
}

.label,
h3 {
  font-weight: 500;
}

.checkbox-group {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.5rem 1rem;
}

.buttons {
  display: flex;
  gap: 0.5rem;
}

@media (min-width: 1280px) {
  .checkbox-group {
    grid-template-columns: 1fr 1fr 1fr;
  }
}
</style>
