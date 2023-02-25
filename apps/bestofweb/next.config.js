/** @type {import('next').NextConfig} */
module.exports = {
  transpilePackages: ["@peersky/next-web3-chakra"],
  reactStrictMode: true,
  trailingSlash: true,

  // output: "standalone",
  // target: "serverless",
  webpack: (config, { isServer, webpack }) => {
    // Fixes npm packages that depend on `fs` module
    if (!isServer) {
      // config.node = { fs: 'empty' };
      config.resolve.fallback.fs = false;
      config.resolve.fallback.electron = false;
    }
    config.plugins.push(
      new webpack.IgnorePlugin({
        resourceRegExp: /^electron$/,
      })
    );

    return config;
  },
  experimental: {
    externalDir: true,
    esmExternals: false,
  },
};
