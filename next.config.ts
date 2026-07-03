import type { NextConfig } from "next";

// Prevent build failures due to missing runtime environment variables (e.g. service role keys)
const BUILD_PLACEHOLDERS: Record<string, string> = {
  NEXT_PUBLIC_SUPABASE_URL: 'https://placeholder.supabase.co',
  NEXT_PUBLIC_SUPABASE_ANON_KEY: 'placeholder_anon_key',
  SUPABASE_SERVICE_ROLE_KEY: 'placeholder_service_role_key',
  SUPABASE_JWT_SECRET: 'placeholder_jwt_secret',
  CRON_SECRET: 'placeholder_cron_secret',
  NEXT_PUBLIC_PRIVY_APP_ID: 'placeholder_privy_app_id',
  PRIVY_APP_SECRET: 'placeholder_privy_app_secret',
  PAYSTACK_SECRET_KEY: 'placeholder_paystack_secret_key',
  RESEND_API_KEY: 're_placeholder'
};

for (const [key, val] of Object.entries(BUILD_PLACEHOLDERS)) {
  if (!process.env[key]) {
    process.env[key] = val;
  }
}

const nextConfig: NextConfig = {
  reactStrictMode: true,
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        fs: false,
        net: false,
        tls: false,
        crypto: false,
        stream: false,
        buffer: require.resolve("buffer/"),
      };
      
      config.resolve.alias = {
        ...config.resolve.alias,
        "@react-native-async-storage/async-storage": false,
      };
    }
    return config;
  },
};

export default nextConfig;