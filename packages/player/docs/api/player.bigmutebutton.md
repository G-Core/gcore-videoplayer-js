<!-- Do not edit this file. It is automatically generated by API Documenter. -->

[Home](./index.md) &gt; [@gcorevideo/player](./player.md) &gt; [BigMuteButton](./player.bigmutebutton.md)

## BigMuteButton class

> This API is provided as a beta preview for developers and may change based on feedback that we receive. Do not use this API in a production environment.
> 

`PLUGIN` that displays a big mute button over the video when it's being played muted.

**Signature:**

```typescript
export declare class BigMuteButton extends UICorePlugin 
```
**Extends:** UICorePlugin

## Remarks

When pressed, it unmutes the video.

## Example


```ts
import { BigMuteButton } from '@gcorevideo/player'
Player.registerPlugin(BigMuteButton)
```

