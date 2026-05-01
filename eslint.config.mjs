/**
 * eslint.config.mjs
 * --------------------------------------------------------------------
 * ESLint v9 flat config for the LaserOps portal.
 *
 * ESLint v9 dropped support for the legacy `.eslintrc.json` format; this
 * file is the new "flat config" replacement. It uses FlatCompat to bridge
 * Next.js's still-legacy `eslint-config-next` preset (which exports old-
 * style rules) into the new flat format.
 *
 * Rule overrides:
 *   - `@next/next/no-img-element` is disabled. Our brand assets are small
 *     pre-optimised PNGs (60-100KB each) where Next's <Image /> overhead
 *     and CSS quirks aren't worth the marginal gains. We use plain <img>
 *     elements throughout for simpler styling and predictable layout.
 */

import { FlatCompat } from "@eslint/eslintrc";
import { dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const config = [
  ...compat.extends("next/core-web-vitals"),
  {
    rules: {
      "@next/next/no-img-element": "off",
    },
  },
];

export default config;
