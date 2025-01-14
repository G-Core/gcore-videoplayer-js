import { onBeforeMount, onMounted, watch } from 'vue';
import { Player, type PlayerPlugin } from '@gcorevideo/player';
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
} from '@gcorevideo/player-plugins';

import useSettingsStore from '../store/settings';

const PLUGINS: Record<string, PlayerPlugin> = {
  big_mute_button: BigMuteButton,
  bottom_gear: BottomGear,
  click_to_pause: ClickToPause,
  clappr_nerd_stats: ClapprNerdStats,
  clappr_stats: ClapprStats,
  disable_controls: DisableControls,
  dvr_controls: DvrControls,
  error_screen: ErrorScreen,
  level_selector: LevelSelector,
  media_control: MediaControl,
  multi_camera: MultiCamera,
  picture_in_picture: PictureInPicture,
  playback_rate: PlaybackRate,
  poster: Poster,
  spinner: SpinnerThreeBounce,
  subtitles: Subtitles,
  thumbnails: Thumbnails,
  volume_fade: VolumeFade,
}

const usePluginsConfig = () => {
  const settings = useSettingsStore();

  onBeforeMount(configurePlugins);
  watch(() => settings.plugins, (plugins, oldPlugins) => {
    const deactivated = oldPlugins.filter(p => !plugins.includes(p));
    const activatged = plugins.filter(p => !oldPlugins.includes(p));
    deactivated.forEach(p => {
      Player.unregisterPlugin(PLUGINS[p]);
    });
    activatged.forEach(p => {
      Player.registerPlugin(PLUGINS[p]);
    });
  });

  function configurePlugins() {
    Object.entries(PLUGINS).forEach(([name, plugin]) => {
      if (settings.plugins.includes(name)) {
        Player.registerPlugin(plugin)
      }
    })
  }
}

export default usePluginsConfig
