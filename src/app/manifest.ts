import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "WINIQ",
    short_name: "WINIQ",
    description: "Futbol analiz masası · günün net üçü · track-record",
    start_url: "/member",
    scope: "/",
    display: "standalone",
    background_color: "#050a12",
    theme_color: "#0b192d",
    lang: "tr",
    categories: ["sports", "productivity"],
    icons: [
      {
        src: "/favicon.ico",
        sizes: "48x48",
        type: "image/x-icon",
      },
    ],
  };
}
