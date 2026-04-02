# Gcore Video Player SDK - AI Agent Instructions

> **Project Identity**: Professional JavaScript video player SDK for HLS, DASH, and MP4 streaming
>
> **Repository**: https://github.com/G-Core/gcore-videoplayer-js
>
> **NPM Package**: `@gcorevideo/player` (main), `@gcorevideo/utils` (utilities)

## Quick Context

This is a production video player SDK built on Clappr architecture, supporting:
- ✅ HLS, LL-HLS, MPEG-DASH, LL-DASH, MP4
- ✅ Plugin-based architecture (20+ official plugins)
- ✅ Framework-agnostic (works with React, Vue, vanilla JS)
- ✅ TypeScript with full type definitions
- ✅ Modular build system (tree-shakeable)

**Key Facts**:
- Used by Gcore CDN customers globally
- Production-grade stability required
- Public API must remain backward-compatible
- Comprehensive test coverage expected

---

## Project Structure

```
gcore-videoplayer-js/
├── packages/
│   ├── player/          # Main video player package
│   │   ├── src/
│   │   │   ├── Player.ts           # Core player class
│   │   │   ├── types.ts            # Public TypeScript types
│   │   │   ├── plugins/            # All plugins (20+ modules)
│   │   │   ├── playback/           # Playback engines (HLS, DASH, HTML5)
│   │   │   └── utils/              # Internal utilities
│   │   ├── assets/                 # Templates and styles
│   │   ├── docs/api/               # Auto-generated API docs
│   │   └── package.json
│   └── utils/           # Shared utilities (@gcorevideo/utils)
├── CLAUDE.md            # This file - AI instructions
├── DOCS.md              # Project knowledge base (read on demand)
├── AI-DEVELOPMENT.md    # AI-assisted development guide
└── EXAMPLES.md          # Code examples and recipes
```

**See [DOCS.md](./DOCS.md)** for architecture deep-dive, patterns, and conventions.

---

## Behavioral Rules

### Code Quality Standards

1. **TypeScript Strictness**
   - All new code must have proper TypeScript types
   - Avoid `any` - use `unknown` and type guards instead
   - Export public types for consumer use
   - Keep internal types in `internal.types.ts`

2. **Backward Compatibility**
   - NEVER break existing public APIs
   - Deprecate before removing (with console warnings)
   - Add new features via optional parameters
   - Maintain plugin interface contracts

3. **Testing Requirements**
   - Write tests for all new features
   - Use Vitest with happy-dom
   - Mock external dependencies (dash.js, hls.js)
   - Run tests before committing: `npm test`

4. **Code Style**
   - Use Prettier (format on save)
   - Run oxlint before committing: `npm run lint`
   - Follow existing naming conventions
   - Keep functions small and focused

### Plugin Development Rules

When working with plugins (most common task):

1. **Plugin Structure**
   ```typescript
   // Extend UICorePlugin or ContainerPlugin from @clappr/core
   export class MyPlugin extends UICorePlugin {
     name = 'my_plugin'
     static type = 'core' // or 'container'

     bindEvents() {
       this.listenTo(this.core, ClapprEvents.PLAYER_PLAY, this.onPlay)
     }
   }
   ```

2. **Template Usage**
   - Templates go in `assets/[plugin-name]/template.ejs`
   - Styles go in `assets/[plugin-name]/[plugin-name].scss`
   - Import both in plugin file

3. **Event Handling**
   - Use `listenTo()` for event binding (auto-cleanup)
   - Follow Clappr event naming conventions
   - Document custom events in plugin header

4. **Configuration**
   - Accept config via `this.options[pluginName]`
   - Provide sensible defaults
   - Document all config options in types

### Common Pitfalls to Avoid

❌ **Don't**:
- Modify Clappr core behavior directly
- Use jQuery (Clappr provides Zepto `$`)
- Add heavy dependencies without discussion
- Break plugin isolation (plugins shouldn't directly reference each other)
- Commit without running lint and tests

✅ **Do**:
- Use Clappr's event system for communication
- Leverage existing plugins as examples
- Keep plugins small and focused
- Document public APIs with TSDoc
- Test across browsers (especially Safari for video)

---

## Development Workflows

### Local Development Setup

```bash
# Install dependencies
npm install

# Build player package
cd packages/player
npm run build

# Watch mode during development
npm run dev

# Run tests
npm test

# Lint and format
npm run lint
npm run format
```

### Adding a New Plugin

1. **Create plugin file**: `packages/player/src/plugins/my-feature/MyFeature.ts`
2. **Add template** (if UI): `packages/player/assets/my-feature/template.ejs`
3. **Add styles** (if needed): `packages/player/assets/my-feature/my-feature.scss`
4. **Export from**: `packages/player/src/index.plugins.ts`
5. **Write tests**: `packages/player/src/plugins/my-feature/__tests__/MyFeature.test.ts`
6. **Update API docs**: Run `npm run docs`

### Modifying Existing Code

1. **Read first**: Always read the existing implementation before modifying
2. **Check tests**: Run tests to ensure changes don't break existing behavior
3. **Update docs**: If public API changes, update TSDoc comments
4. **Test thoroughly**: Add tests for new behavior
5. **Check examples**: Ensure example code still works

### Debugging

Enable detailed logs during development:

```typescript
import { Logger } from '@gcorevideo/utils'

Logger.enable('*')               // Everything
Logger.enable('gplayer')         // Player core only
Logger.enable('plugins.*')       // All plugins
Logger.enable('playback.*')      // Playback engines
```

---

## Testing Guidelines

### Test Structure

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { Player } from '../Player'

describe('MyFeature', () => {
  let player: Player

  beforeEach(() => {
    player = new Player({
      sources: ['http://example.com/video.mp4']
    })
  })

  it('should do something', () => {
    // Arrange
    // Act
    // Assert
  })
})
```

### What to Test

- ✅ Public API methods
- ✅ Event emissions
- ✅ Configuration options
- ✅ Error handling
- ✅ Edge cases

### What Not to Test

- ❌ Clappr core functionality
- ❌ Browser APIs (mock them)
- ❌ Third-party libraries (dash.js, hls.js)

---

## Common Tasks

### Task 1: Add a new configuration option

```typescript
// 1. Add to PlayerConfig interface in types.ts
export interface PlayerConfig {
  myNewOption?: boolean  // Add this
}

// 2. Add default in Player.ts
const DEFAULT_OPTIONS: PlayerConfig = {
  myNewOption: false,  // Add this
}

// 3. Use in plugin
if (this.options.myNewOption) {
  // do something
}
```

### Task 2: Add a new event

```typescript
// 1. Add to PlayerEvent enum in types.ts
export enum PlayerEvent {
  MyNewEvent = 'mynew',
}

// 2. Define event parameters in PlayerEventParams
export type PlayerEventParams<E extends PlayerEvent> =
  E extends PlayerEvent.MyNewEvent ? [string, number] : // Add this
  // ... other events

// 3. Emit event
this.trigger(PlayerEvent.MyNewEvent, 'data', 42)
```

### Task 3: Fix a bug in a plugin

1. Read plugin source: `packages/player/src/plugins/[name]/`
2. Read tests: `packages/player/src/plugins/[name]/__tests__/`
3. Add failing test case that reproduces bug
4. Fix implementation
5. Verify test passes
6. Check for side effects in other tests

### Task 4: Add a new playback feature

1. Check if it belongs in:
   - `playback/HTML5Video.ts` (native HTML5)
   - `playback/hls-playback/HlsPlayback.ts` (HLS streams)
   - `playback/dash-playback/DashPlayback.ts` (DASH streams)
2. Update relevant playback engine
3. Add tests with mocked media element
4. Update types if API changes

---

## Working with AI Assistants

### For AI Agents (Claude, Copilot, etc.)

When you need information:
1. **Read DOCS.md** for architecture and patterns
2. **Read relevant plugin source** before modifying
3. **Check existing tests** for usage examples
4. **Use Grep/Glob** to find similar implementations

### For External Developers Using AI

See [AI-DEVELOPMENT.md](./AI-DEVELOPMENT.md) for:
- Quick-start prompts
- Common AI workflows
- Example conversations
- Troubleshooting tips

---

## Reference Documentation

- **API Reference**: [packages/player/docs/api/](./packages/player/docs/api/index.md)
- **Official Docs**: https://gcore.com/docs/streaming/api/player-api-tutorial
- **Clappr Docs**: https://github.com/clappr/clappr/wiki
- **Examples**: See [EXAMPLES.md](./EXAMPLES.md)

---

## Getting Help

- **Issues**: https://github.com/G-Core/gcore-videoplayer-js/issues
- **Clappr Issues**: https://github.com/clappr/clappr/issues
- **Internal Docs**: `.claude/` directory contains additional context

---

## Summary Checklist

Before committing code, ensure:

- [ ] TypeScript types are correct and exported
- [ ] Tests are written and passing (`npm test`)
- [ ] Code is linted (`npm run lint`)
- [ ] Code is formatted (`npm run format`)
- [ ] Public API is backward-compatible
- [ ] Documentation is updated (TSDoc comments)
- [ ] Changes are tested in example app
- [ ] No console errors in browser

**Ready to build? Read [DOCS.md](./DOCS.md) for deep architectural knowledge, then check [EXAMPLES.md](./EXAMPLES.md) for code patterns.**
