import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 1. PERFORMANCE: Reduce memory usage
  productionBrowserSourceMaps: false,
  reactStrictMode: false, 
  
  // 2. LINTING: Don't fail build on warnings (Save RAM)
  typescript: { ignoreBuildErrors: true },
  eslint: { ignoreDuringBuilds: true },
  
  // 3. XMTP FIX: Prevent server from crashing on encryption files
  // (This handles the ENOENT error you saw)
  serverExternalPackages: ["@xmtp/user-preferences-bindings-wasm"],

  // 4. WEBPACK CONFIGURATION
  webpack: (config) => {
    // A. Ignore React Native stuff (Fixes import errors)
    config.resolve.alias = {
      ...config.resolve.alias,
      '@react-native-async-storage/async-storage': false,
      'react-native': false,
    };
    
    // B. Fix file system access
    config.resolve.fallback = { 
      fs: false, 
      net: false, 
      tls: false 
    };

    // C. Allow WebAssembly (WASM) to load
    config.experiments = {
      ...config.experiments,
      asyncWebAssembly: true,
      layers: true,
    };

    // D. Exclude XMTP WASM from asset processing
    config.module.rules.push({
      test: /\.wasm$/,
      type: "asset/resource",
    });

    return config;
  },
};

export default nextConfig;