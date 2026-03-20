# The Gcore videoplayer source code.

Is built on top of Clappr and follows architecture of the latter.

## Project source code structure:

* src/plugins - standard plugins
* src/\* - (everything else) core and auxiliary code

## Typical plugin structure

Example plugin - [audo-selector](../../packages/player/src/plugins/audio-selector/AudioTracks.ts) (a.k.a. AudioTracks)

### Source code

Example: (AudioTracks.ts)\[../../packages/player/src/plugins/audio-selector/AudioTracks.ts].
Defines a class inheriting from Clappr's `UICorePlugin` or `ContainerPlugin`.
Must export the class, which is then imported by an app and added to the player's configuration.

If a plugin has any non-trivial UI, then it uses a template.
Templates are handlebars-style and its implementation is provided by Clappr.
Example: [audio-tracks/template.ejs](../../gcore-videoplayer-js/packages/player/assets/audio-tracks/template.ejs)
The template source code is loaded and parsed in the plugin class and used during rendering or update phase.

It can optionally use custom stylesheet, which must be imported by the plugin's main module.
Example: [big-mute-button.scss](../../gcore-videoplayer-js/packages/player/assets/big-mute-button/big-mute-button.scss).
A stylesheet file resides in the same assets directory as the template(s).

SASS is supported. However, restrain from any non-native CSS feature whenever possible.

## Media control

There is a special plugin - [MediaControl](../../packages/player/src/plugins/media-control/).
It handles all the standard user interaction. A typical development task (bug fix or small improvement) has to do with the plugin in one way or another.

MediaControl implements the conventional controls bar, which includes playback (play/stop/pause), seek bar, and volume control.
The bar is extensible and many plugins are built on top of it.

## Tasks
