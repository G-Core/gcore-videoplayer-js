<!-- Do not edit this file. It is automatically generated by API Documenter. -->

[Home](./index.md) &gt; [@gcorevideo/player](./player.md) &gt; [PlayerEventHandler](./player.playereventhandler.md)

## PlayerEventHandler type

> This API is provided as a beta preview for developers and may change based on feedback that we receive. Do not use this API in a production environment.
> 

Type of a listener callback function for a player event. See the description of the event parameters in [PlayerEvent](./player.playerevent.md)<!-- -->.

**Signature:**

```typescript
export type PlayerEventHandler<E extends PlayerEvent> = (...args: PlayerEventParams<E>) => void;
```
**References:** [PlayerEvent](./player.playerevent.md)<!-- -->, [PlayerEventParams](./player.playereventparams.md)

