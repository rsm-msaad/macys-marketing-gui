/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // The FastAPI backend serves DAM thumbnails at /images/dam/*.
  // Allow Next/Image to load from there if components opt in.
  images: {
    remotePatterns: [
      { protocol: "http", hostname: "localhost", port: "8000", pathname: "/images/**" },
    ],
  },
};

export default nextConfig;
