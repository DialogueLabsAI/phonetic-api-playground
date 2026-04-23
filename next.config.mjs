/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  experimental: {
    // Don't try to bundle these — they're Node-only libraries with
    // dynamic require()s and native deps that webpack can't statically
    // analyse. Next resolves them at runtime from node_modules, which
    // is exactly what they expect.
    //
    // - playwright / playwright-extra: drive the real browser via a
    //   native binary, must stay external.
    // - puppeteer-extra + plugins: use `require(…, …)` tricks (in
    //   clone-deep, debug, etc.) that webpack flags as "can't
    //   statically analyse".
    serverComponentsExternalPackages: [
      "playwright",
      "playwright-core",
      "playwright-extra",
      "puppeteer-extra",
      "puppeteer-extra-plugin-stealth",
      "puppeteer-extra-plugin",
      "clone-deep",
    ],
  },
};

export default nextConfig;
