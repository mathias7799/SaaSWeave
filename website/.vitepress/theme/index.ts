import DefaultTheme from 'vitepress/theme'
import type { Theme } from 'vitepress'

// Match the product's own typeface (the app ships Geist) so the docs feel like
// part of SaaSWeave rather than a generic template.
import '@fontsource-variable/geist'
import '@fontsource-variable/geist-mono'

import './custom.css'

export default {
  extends: DefaultTheme,
} satisfies Theme
