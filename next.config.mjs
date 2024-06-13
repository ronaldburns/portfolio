import { withContentlayer } from "next-contentlayer";

/** @type {import('next').NextConfig} */
const nextConfig = {
  pageExtensions: ["js", "jsx", "ts", "tsx", "md", "mdx"],
  experimental: {
    mdxRs: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "i.ytimg.com",
      },
      {
        protocol: "https",
        hostname: "github.com",
      },
      {
        protocol: "https",
        hostname: "d1nxhf1pnsyhaypz.public.blob.vercel-storage.com",
      },
      {
        protocol: "https",
        hostname: "r2-portfolio.ronaldburns.dev"
      }
    ],
  },
};

export default withContentlayer(nextConfig);
