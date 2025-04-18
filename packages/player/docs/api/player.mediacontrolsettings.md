<!-- Do not edit this file. It is automatically generated by API Documenter. -->

[Home](./index.md) &gt; [@gcorevideo/player](./player.md) &gt; [MediaControlSettings](./player.mediacontrolsettings.md)

## MediaControlSettings type

> This API is provided as a beta preview for developers and may change based on feedback that we receive. Do not use this API in a production environment.
> 

Specifies the allowed media control elements in each area. Can be used to restrict rendered media control elements.

**Signature:**

```typescript
export type MediaControlSettings = {
    left: MediaControlLeftElement[];
    right: MediaControlRightElement[];
    default: MediaControlLayerElement[];
    seekEnabled: boolean;
};
```
**References:** [MediaControlLeftElement](./player.mediacontrolleftelement.md)<!-- -->, [MediaControlRightElement](./player.mediacontrolrightelement.md)<!-- -->, [MediaControlLayerElement](./player.mediacontrollayerelement.md)

