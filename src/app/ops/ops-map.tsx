"use client";

import { useEffect, useRef, useState } from "react";
import type { Report, HotspotCell } from "@/lib/types";
import { STATUS_CONFIG } from "@/lib/ui/status";
import { Loader } from "lucide-react";

// Dynamically load Google Maps
function loadGoogleMapsScript(apiKey: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.google?.maps) { resolve(); return; }
    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&v=weekly`;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load Google Maps"));
    document.head.appendChild(script);
  });
}

interface OpsMapProps {
  reports: Report[];
  hotspots: HotspotCell[];
  selectedId: string | null;
  onSelectReport: (id: string) => void;
}

export function OpsMap({ reports, hotspots, selectedId, onSelectReport }: OpsMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<Map<string, google.maps.marker.AdvancedMarkerElement>>(new Map());
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");

  // Load maps
  useEffect(() => {
    const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    if (!key) { setError("Maps API key not configured"); return; }
    loadGoogleMapsScript(key)
      .then(() => setReady(true))
      .catch((e) => setError(e.message));
  }, []);

  // Init map
  useEffect(() => {
    if (!ready || !containerRef.current || mapRef.current) return;

    mapRef.current = new google.maps.Map(containerRef.current, {
      center: { lat: 6.5244, lng: 3.3792 }, // Lagos
      zoom: 12,
      mapId: "CLEANCITY_MAP",
      styles: [
        { featureType: "all", elementType: "labels.text.fill", stylers: [{ color: "#a0a0a0" }] },
        { featureType: "all", elementType: "labels.text.stroke", stylers: [{ visibility: "off" }] },
        { featureType: "administrative", elementType: "geometry.stroke", stylers: [{ color: "#333" }] },
        { featureType: "road", elementType: "geometry", stylers: [{ color: "#222" }] },
        { featureType: "water", elementType: "geometry", stylers: [{ color: "#111" }] },
        { featureType: "poi", elementType: "geometry", stylers: [{ color: "#1a1a1a" }] },
        { featureType: "landscape", elementType: "geometry", stylers: [{ color: "#0d0d0d" }] },
      ],
      disableDefaultUI: true,
      zoomControl: true,
    });
  }, [ready]);

  // Update markers
  useEffect(() => {
    if (!mapRef.current || !ready) return;

    // Clear old markers
    markersRef.current.forEach((m) => (m.map = null));
    markersRef.current.clear();

    // Monochrome dot pin
    const pinSvg = (opacity: number) => `
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="8" y="8" width="8" height="8" fill="white" fill-opacity="${opacity}" />
        <rect x="10" y="16" width="4" height="6" fill="white" fill-opacity="${opacity / 2}" />
      </svg>`;

    for (const report of reports) {
      const cfg = STATUS_CONFIG[report.status];
      const isDone = report.status === "DONE" || report.status === "REJECTED";
      const opacity = isDone ? 0.3 : 1;

      const pin = new google.maps.marker.PinElement({
        glyph: "",
        background: isDone ? "#555" : "#fafafa",
        borderColor: isDone ? "#333" : "#fafafa",
        scale: isDone ? 0.8 : 1,
      });

      const marker = new google.maps.marker.AdvancedMarkerElement({
        map: mapRef.current,
        position: { lat: report.lat, lng: report.lng },
        title: `${report.type} - ${report.status}`,
        content: pin.element,
      });

      marker.addListener("click", () => onSelectReport(report.id));
      markersRef.current.set(report.id, marker);
    }

    // Hotspot circles
    for (const h of hotspots) {
      const alpha = Math.min(0.15 + h.count * 0.01, 0.4);
      new google.maps.Circle({
        map: mapRef.current,
        center: { lat: h.centerLat, lng: h.centerLng },
        radius: 300 + h.count * 30,
        fillColor: "#ffffff",
        fillOpacity: alpha,
        strokeColor: "#555",
        strokeWeight: 1,
        strokeOpacity: 0.5,
      });
    }
  }, [reports, hotspots, ready, onSelectReport]);

  if (error) return <div className="flex items-center justify-center h-full text-xs font-mono text-muted-foreground">{error}</div>;
  if (!ready) return <div className="flex items-center justify-center h-full"><Loader className="w-6 h-6 animate-spin text-muted-foreground" /></div>;

  return <div ref={containerRef} className="w-full h-full" />;
}
