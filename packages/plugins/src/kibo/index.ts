/* eslint-disable */
// Kibo is released under the MIT License. Copyright (c) 2013 marquete.
// see https://github.com/marquete/kibo

type KeyboardEventHandler = (e: KeyboardEvent) => boolean | undefined;

type KeyboardEventBindings = {
  any: KeyboardEventHandler[];
  [key: string]: KeyboardEventHandler[];
}

type UpDown = 'up' | 'down';

export default class Kibo {
  private lastKeyCode = -1;

  private lastModifiers: Record<string, boolean> = {};

  private keysDown: KeyboardEventBindings = { any: [] }; // TODO
  private keysUp: KeyboardEventBindings = { any: [] };

  private downHandler: (e: KeyboardEvent) => void;

  private upHandler: (e: KeyboardEvent) => void;

  constructor(private element: Document | Element = window.document) {
    for (const mod of MODIFIERS) {
      this.lastModifiers[mod] = false;
    }
  
    this.keysDown = { any: [] };
    this.keysUp = { any: [] };
    this.downHandler = this.handler('down');
    this.upHandler = this.handler('up');
  
    registerEvent(this.element, 'keydown', this.downHandler);
    registerEvent(this.element, 'keyup', this.upHandler);
    const unloader = () => {
      unregisterEvent(this.element, 'keydown', this.downHandler);
      unregisterEvent(this.element, 'keyup', this.upHandler);
      unregisterEvent(window, 'unload', unloader);
    };
    registerEvent(window, 'unload', unloader);
  }

  private handler(upOrDown: UpDown = 'up') {
    return (e: KeyboardEvent) => {
      this.lastKeyCode = e.keyCode; // TODO
      for (const mod of MODIFIERS) {
        this.lastModifiers[mod] = e[(mod + 'Key') as 'shiftKey' | 'ctrlKey' | 'altKey'];
      }
      // for (i = 0; i < Kibo.MODIFIERS.length; i++) {
      //   that.lastModifiers[Kibo.MODIFIERS[i]] = e[Kibo.MODIFIERS[i] + 'Key'];
      // }
      // if (Kibo.arrayIncludes(Kibo.MODIFIERS, Kibo.keyName(that.lastKeyCode))) {
      //   that.lastModifiers[Kibo.keyName(that.lastKeyCode)] = true;
      // }
      const key = keyName(this.lastKeyCode);
      if (key && MODIFIERS.includes(key)) {
        this.lastModifiers[key] = true;
      }
  
      const regKeys: KeyboardEventBindings = upOrDown === 'up' ? this.keysUp : this.keysDown;
      // this['keys' + capitalize(upOrDown)]; // TODO
  
      // for (i = 0; i < registeredKeys.any.length; i++) {
      //   if ((registeredKeys.any[i](e) === false) && e.preventDefault) {
      //     e.preventDefault();
      //   }
      // }
      for (const h of regKeys.any) {
        if (h(e) === false && e.preventDefault) {
          e.preventDefault();
        }
      }
  
      const lastModifiersAndKey = this.lastModifiersAndKey();
      if (regKeys[lastModifiersAndKey]) {
        for (const h of regKeys[lastModifiersAndKey]) {
          if ((h(e) === false) && e.preventDefault) {
            e.preventDefault();
          }
        // for (i = 0; i < registeredKeys[lastModifiersAndKey].length; i++) {
          // if ((registeredKeys[lastModifiersAndKey][i](e) === false) && e.preventDefault) {
            // e.preventDefault();
          // }
        }
      }
    };
  }

  private registerKeys(upOrDown: UpDown, newKeys: string | string[], func: KeyboardEventHandler) {
    const registeredKeys = upOrDown === 'up' ? this.keysUp : this.keysDown;
  
    const normKeys = typeof newKeys === "string" ? [newKeys] : newKeys;
  
    // for (i = 0; i < newKeys.length; i++) {
    //   // keys = newKeys[i];
    //   keys = modifiersAndKey(keys + '');
  
    //   if (registeredKeys[keys]) {
    //     registeredKeys[keys].push(func);
    //   } else {
    //     registeredKeys[keys] = [func];
    //   }
    // }
    for (const k of normKeys) {
      const keys = modifiersAndKey(k);
  
      if (registeredKeys[keys]) {
        registeredKeys[keys].push(func);
      } else {
        registeredKeys[keys] = [func];
      }
    }
  
    return this;
  }

  private unregisterKeys(upOrDown: UpDown, newKeys: string | string[], func: KeyboardEventHandler | null = null) {
    const registeredKeys = upOrDown === 'up' ? this.keysUp : this.keysDown;
    const normKeys = typeof newKeys === "string" ? [newKeys] : newKeys;

    for (const k of normKeys) {
      const keys = modifiersAndKey(k);
      if (func === null) {
        delete registeredKeys[keys];
      } else {
        if (registeredKeys[keys]) {
          const p = registeredKeys[keys].indexOf(func);
          if (p >= 0) {
            registeredKeys[keys].splice(p, 1);
          }
        }
      }
    }
  
    return this;
  }

  off(keys: string | string[]): Kibo {
    return this.unregisterKeys('down', keys, null);
  }

  delegate(upOrDown: UpDown, keys: string | string[], func?: KeyboardEventHandler | null): Kibo {
    return (func !== null && func !== undefined)
      ? this.registerKeys(upOrDown, keys, func)
      : this.unregisterKeys(upOrDown, keys, func);
  }

  down(keys: string | string[], func?: KeyboardEventHandler | null): Kibo {
    return this.delegate('down', keys, func);
  }

  up(keys: string | string[], func?: KeyboardEventHandler | null): Kibo {
    return this.delegate('up', keys, func);
  }

  lastKey(modifier?: string): string | boolean {
    if (!modifier) {
      return keyName(this.lastKeyCode);
    }
  
    return this.lastModifiers[modifier];
  }

  lastModifiersAndKey() {
    const result = MODIFIERS.filter(m => this.lastKey(m));
    const lastKey = keyName(this.lastKeyCode);
    if (lastKey && !result.includes(lastKey)) {
      result.push(lastKey);
    }
    return result.join(' ');
  };
}

function registerEvent(element: Node | Window, eventName: string, func: (e: KeyboardEvent) => void): void {
  element.addEventListener(eventName, func as EventListener, false);
}

function unregisterEvent(element: Node | Window, eventName: string, func: (e: KeyboardEvent) => void): void {
  element.removeEventListener(eventName, func as EventListener, false);
}

const KEY_NAMES_BY_CODE: Record<number, string> = {
  8: 'backspace', 9: 'tab', 13: 'enter',
  16: 'shift', 17: 'ctrl', 18: 'alt',
  20: 'caps_lock',
  27: 'esc',
  32: 'space',
  37: 'left', 38: 'up', 39: 'right', 40: 'down',
  48: '0', 49: '1', 50: '2', 51: '3', 52: '4', 53: '5', 54: '6', 55: '7', 56: '8', 57: '9',
  65: 'a', 66: 'b', 67: 'c', 68: 'd', 69: 'e', 70: 'f', 71: 'g', 72: 'h', 73: 'i', 74: 'j',
  75: 'k', 76: 'l', 77: 'm', 78: 'n', 79: 'o', 80: 'p', 81: 'q', 82: 'r', 83: 's', 84: 't',
  85: 'u', 86: 'v', 87: 'w', 88: 'x', 89: 'y', 90: 'z', 112: 'f1', 113: 'f2', 114: 'f3',
  115: 'f4', 116: 'f5', 117: 'f6', 118: 'f7', 119: 'f8', 120: 'f9', 121: 'f10', 122: 'f11', 123: 'f12'
};

const KEY_CODES_BY_NAME: Record<string, number> = {};

(function () {
  Object.entries(KEY_NAMES_BY_CODE).forEach(([key, name]) => {
    KEY_CODES_BY_NAME[name] = +key;
  });
})();

const MODIFIERS = ['shift', 'ctrl', 'alt'];

function stringContains(string: string, substring: string): boolean {
  return string.indexOf(substring) !== -1;
}

function neatString(string: string): string {
  return string.replace(/^\s+|\s+$/g, '').replace(/\s+/g, ' ');
};

function extractModifiers(keyCombination: string): string[] {
  return MODIFIERS.filter(m => keyCombination.includes(m));
}

function extractKey(keyCombination: string): string | undefined{
  return neatString(keyCombination).split(' ').find(key => !MODIFIERS.includes(key));
};

 function modifiersAndKey(keyCombination: string) {
  var result, key;

  if (stringContains(keyCombination, 'any')) {
    return neatString(keyCombination).split(' ').slice(0, 2).join(' ');
  }

  result = extractModifiers(keyCombination);

  key = extractKey(keyCombination);
  if (key) {
    result.push(key);
  }

  return result.join(' ');
}

function keyName(keyCode: number): string {
  return KEY_NAMES_BY_CODE[keyCode] || '';
};
