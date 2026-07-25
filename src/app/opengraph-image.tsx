import { ImageResponse } from "next/og";

export const alt = "Uzzo Store — Moda masculina em Balneário Camboriú";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "#0a0a0a",
          color: "#ffffff",
        }}
      >
        <div style={{ display: "flex", alignItems: "baseline", gap: 18 }}>
          <div style={{ fontSize: 140, fontWeight: 700, letterSpacing: -4 }}>
            UZZO
          </div>
          <div style={{ fontSize: 36, fontWeight: 500, letterSpacing: 18 }}>
            STORE
          </div>
        </div>
        <div
          style={{
            marginTop: 30,
            fontSize: 30,
            color: "#a1a1aa",
            letterSpacing: 2,
          }}
        >
          Tecnologia aplicada ao vestir
        </div>
      </div>
    ),
    { ...size },
  );
}
