<!-- Do not edit this file. It is automatically generated by API Documenter. -->

[Home](./index.md) &gt; [@gcorevideo/player](./player.md) &gt; [SourceController](./player.sourcecontroller.md)

## SourceController class

> This API is provided as a beta preview for developers and may change based on feedback that we receive. Do not use this API in a production environment.
> 

`PLUGIN` that is responsible for managing the automatic failover between sources.

**Signature:**

```typescript
export declare class SourceController extends CorePlugin 
```
**Extends:** CorePlugin

## Remarks

Have a look at the [source failover diagram](https://miro.com/app/board/uXjVLiN15tY=/?share_link_id=390327585787) for the details on how sources ordering and selection works.

This plugin does not expose any public methods apart from required by the Clappr plugin interface. It is supposed to work autonomously.

The constructor for this class is marked as internal. Third-party code should not call the constructor directly or create subclasses that extend the `SourceController` class.

## Example


```ts
import { SourceController } from '@gcorevideo/player'

Player.registerPlugin(SourceController)
```

