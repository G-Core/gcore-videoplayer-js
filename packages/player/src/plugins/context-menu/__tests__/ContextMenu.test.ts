import { beforeEach, describe, expect, it } from 'vitest'

import { ContextMenu } from '../ContextMenu'
import { createMockContainer } from '../../../testUtils'

function setup(options: any[]) {
  const container: any = createMockContainer({ contextMenu: { options } })
  return new ContextMenu(container)
}

describe('ContextMenu', () => {
  describe('XSS: malicious menu option fields', () => {
    const LABEL_PAYLOAD = '<img src=x onerror=__xss_label__()>'
    const NAME_PAYLOAD = '"><img src=x onerror=__xss_name__()>'
    const CLASS_PAYLOAD = '"><img src=x onerror=__xss_class__()>'

    let plugin: ContextMenu
    beforeEach(() => {
      plugin = setup([
        { name: NAME_PAYLOAD, label: LABEL_PAYLOAD, class: CLASS_PAYLOAD },
      ])
    })

    it('should not inject an element with an event handler', () => {
      expect(plugin.el.querySelectorAll('[onerror]').length).toBe(0)
    })
    it('should not materialize any injected image element', () => {
      expect(plugin.el.querySelectorAll('img').length).toBe(0)
    })
    it('should render a menu item label as literal text', () => {
      expect(plugin.$el.find('[role="menuitem"]').text()).toContain(
        LABEL_PAYLOAD,
      )
    })
    it('should keep a malicious item name confined to its attribute value', () => {
      expect(plugin.$el.find('[role="menuitem"]').attr('data-name')).toBe(
        NAME_PAYLOAD,
      )
    })
  })
})
