import type { MetadataRoute } from "next";

export const dynamic = "force-static";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "OABase — questões da OAB comentadas",
    short_name: "OABase",
    description:
      "Questões comentadas e legislação organizada para a 1ª fase da OAB.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#f5f8f6",
    theme_color: "#0f7a5f",
    orientation: "portrait-primary",
    categories: ["education", "utilities"],
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  };
}