import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /*
   * Opt-in standalone build, for hosts too small for a normal deploy.
   *
   * The shared cPanel account has a 2GB quota with ~246MB free, and a
   * production `npm install` for this app is roughly 350MB — `next` plus its
   * Linux SWC binary is most of that. The install died with EDQUOT partway
   * through.
   *
   * `standalone` makes Next trace the modules actually reached at runtime and
   * copy just those into `.next/standalone`, which lands far smaller and needs
   * no `npm install` on the server at all. Left off by default so the normal
   * build and the existing CI pipeline are unchanged; set
   * NEXT_OUTPUT_STANDALONE=1 to produce a deployable-to-cPanel build.
   */
  output: process.env.NEXT_OUTPUT_STANDALONE === '1' ? 'standalone' : undefined,
  images: {
    unoptimized: true,
    remotePatterns: [
      { protocol: 'https', hostname: 'ui-avatars.com' },
      { protocol: 'https', hostname: 'images.unsplash.com' },
    ],
  },
};

export default nextConfig;
