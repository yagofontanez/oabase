import { ImageResponse } from "next/og";
import { site } from "@/lib/site";
export const alt = `${site.name} — ${site.tagline}`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export default function OpenGraphImage() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        background: "#0F7B7B",
        padding: 80,
        fontFamily: "sans-serif",
      }}
    >
      <div style={{ display: "flex", fontSize: 46, letterSpacing: -1 }}>
        <span style={{ color: "#FFFFFF", fontWeight: 700 }}>OA</span>
        <span style={{ color: "#F5C518", fontWeight: 700 }}>Base</span>
      </div>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 20,
        }}
      >
        <div
          style={{
            color: "#FFFFFF",
            fontSize: 74,
            fontWeight: 700,
            lineHeight: 1.08,
            letterSpacing: -2,
            maxWidth: 900,
          }}
        >
          Estude pelo que a banca realmente cobra.
        </div>
        <div style={{ color: "#C8E5E2", fontSize: 30 }}>{site.tagline}</div>
      </div>

      <div style={{ display: "flex", height: 10, width: 320 }}>
        <div style={{ flex: 1, background: "#9B2743" }} />
        <div style={{ flex: 1, background: "#F5C518" }} />
        <div style={{ flex: 1, background: "#FFFFFF" }} />
      </div>
    </div>,
    { ...size },
  );
}
