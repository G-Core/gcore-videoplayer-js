<!-- Do not edit this file. It is automatically generated by API Documenter. -->

[Home](./index.md) &gt; [@gcorevideo/player](./player.md) &gt; [Player](./player.player.md) &gt; [on](./player.player.on.md)

## Player.on() method

> This API is provided as a beta preview for developers and may change based on feedback that we receive. Do not use this API in a production environment.
> 

Adds a listener to a player event

**Signature:**

```typescript
on<E extends PlayerEvent>(event: E, handler: PlayerEventHandler<E>): void;
```

## Parameters

<table><thead><tr><th>

Parameter


</th><th>

Type


</th><th>

Description


</th></tr></thead>
<tbody><tr><td>

event


</td><td>

E


</td><td>

event type, see [PlayerEvent](./player.playerevent.md)


</td></tr>
<tr><td>

handler


</td><td>

[PlayerEventHandler](./player.playereventhandler.md)<!-- -->&lt;E&gt;


</td><td>

a callback function to handle the event


</td></tr>
</tbody></table>
**Returns:**

void

