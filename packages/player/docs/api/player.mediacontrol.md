<!-- Do not edit this file. It is automatically generated by API Documenter. -->

[Home](./index.md) &gt; [@gcorevideo/player](./player.md) &gt; [MediaControl](./player.mediacontrol.md)

## MediaControl class

> This API is provided as a beta preview for developers and may change based on feedback that we receive. Do not use this API in a production environment.
> 

`PLUGIN` that provides basic playback controls UI and a foundation for developing custom UI.

**Signature:**

```typescript
export declare class MediaControl extends UICorePlugin 
```
**Extends:** UICorePlugin

## Remarks

The methods exposed are to be used by the other plugins that extend the media control UI.

Configuration options:

- `mediaControl`<!-- -->: [MediaControlSettings](./player.mediacontrolsettings.md) - specifies the allowed media control elements in each area

- `persistConfig`<!-- -->: boolean - `common` option, makes the plugin persist the media control settings

- `chromeless`<!-- -->: boolean

## Constructors

<table><thead><tr><th>

Constructor


</th><th>

Modifiers


</th><th>

Description


</th></tr></thead>
<tbody><tr><td>

[(constructor)(core)](./player.mediacontrol._constructor_.md)


</td><td>


</td><td>

**_(BETA)_** Constructs a new instance of the `MediaControl` class


</td></tr>
</tbody></table>

## Properties

<table><thead><tr><th>

Property


</th><th>

Modifiers


</th><th>

Type


</th><th>

Description


</th></tr></thead>
<tbody><tr><td>

[currentSeekPos](./player.mediacontrol.currentseekpos.md)


</td><td>

`readonly`


</td><td>

number


</td><td>

**_(BETA)_**


</td></tr>
<tr><td>

[muted](./player.mediacontrol.muted.md)


</td><td>

`readonly`


</td><td>

boolean


</td><td>

**_(BETA)_** Muted state


</td></tr>
<tr><td>

[volume](./player.mediacontrol.volume.md)


</td><td>

`readonly`


</td><td>

number


</td><td>

**_(BETA)_** Current volume \[0..100\]


</td></tr>
</tbody></table>

## Methods

<table><thead><tr><th>

Method


</th><th>

Modifiers


</th><th>

Description


</th></tr></thead>
<tbody><tr><td>

[disable()](./player.mediacontrol.disable.md)


</td><td>


</td><td>

**_(BETA)_** Hides the media control UI


</td></tr>
<tr><td>

[disabledControlButton()](./player.mediacontrol.disabledcontrolbutton.md)


</td><td>


</td><td>

**_(BETA)_** Disable the user interaction for the control buttons


</td></tr>
<tr><td>

[enable()](./player.mediacontrol.enable.md)


</td><td>


</td><td>

**_(BETA)_** Reenables the plugin disabled earlier with the [MediaControl.disable()](./player.mediacontrol.disable.md) method


</td></tr>
<tr><td>

[enableControlButton()](./player.mediacontrol.enablecontrolbutton.md)


</td><td>


</td><td>

**_(BETA)_** Enable the user interaction disabled earlier


</td></tr>
<tr><td>

[getAvailableHeight()](./player.mediacontrol.getavailableheight.md)


</td><td>


</td><td>

**_(BETA)_**


</td></tr>
<tr><td>

[mount(name, element)](./player.mediacontrol.mount.md)


</td><td>


</td><td>

**_(BETA)_** Get a media control element DOM node


</td></tr>
<tr><td>

[setInitialVolume()](./player.mediacontrol.setinitialvolume.md)


</td><td>


</td><td>

**_(BETA)_** Set the initial volume, which is preserved when playback is interrupted by an advertisement


</td></tr>
<tr><td>

[setVolume(value, isInitialVolume)](./player.mediacontrol.setvolume.md)


</td><td>


</td><td>

**_(BETA)_** Set the volume


</td></tr>
<tr><td>

[toggleElement(area, show)](./player.mediacontrol.toggleelement.md)


</td><td>


</td><td>

**_(BETA)_** Toggle the visibility of a media control element


</td></tr>
</tbody></table>
