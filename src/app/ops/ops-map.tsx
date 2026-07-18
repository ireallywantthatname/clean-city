"use client";

import { useEffect, useRef, useState } from "react";
import type { Report, HotspotCell } from "@/lib/types";
import { STATUS_CONFIG } from "@/lib/ui/status";
import { Loader } from "lucide-react";
import type { Map as LeafletMap, CircleMarker, Circle } from "leaflet";
import "leaflet/dist/leaflet.css";

interface OpsMapProps {
  reports: Report[];
  hotspots: HotspotCell[];
  selectedId: string | null;
  onSelectReport: (id: string) => void;
}

const DEFAULT_CENTER: [number, number] = [6.5244, 3.3792]; // Lagos
const DEFAULT_ZOOM = 12;

export function OpsMap({ reports, hotspots, selectedId, onSelectReport }: OpsMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const markersRef = useRef<Map<string, CircleMarker>>(new Map());
  const circlesRef = useRef<Circle[]>([]);
  const onSelectRef = useRef(onSelectReport);
  onSelectRef.current = onSelectReport;
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");

  // Init Leaflet + OSM tiles (client-only)
  useEffect(() => {
    let cancelled = false;

    async function init() {
      try {
        const L = (await import("leaflet")).default;

        if (cancelled || !containerRef.current || mapRef.current) return;

        const map = L.map(containerRef.current, {
          center: DEFAULT_CENTER,
          zoom: DEFAULT_ZOOM,
          zoomControl: true,
          attributionControl: true,
        });

        L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
          attribution:
            '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
          subdomains: "abcd",
          maxZoom: 20,
        }).addTo(map);

        mapRef.current = map;
        setReady(true);

        // Fix layout if container was zero-sized on mount
        requestAnimationFrame(() => map.invalidateSize());
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to load map");
        }
      }
    }

    init();

    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
      markersRef.current.clear();
      circlesRef.current = [];
    };
  }, []);

  // Markers + hotspots
  useEffect(() => {
    if (!mapRef.current || !ready) return;
    let cancelled = false;

    (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled || !mapRef.current) return;

      // Clear previous layers
      markersRef.current.forEach((m) => m.remove());
      markersRef.current.clear();
      circlesRef.current.forEach((c) => c.remove());
      circlesRef.current = [];

      for (const report of reports) {
        const isDone = report.status === "DONE" || report.status === "REJECTED";
        const isSelected = report.id === selectedId;
        const cfg = STATUS_CONFIG[report.status];

        const marker = L.circleMarker([report.lat, report.lng], {
          radius: isSelected ? 10 : isDone ? 6 : 8,
          color: isSelected ? "#fff" : isDone ? "#555" : "#fafafa",
          weight: isSelected ? 2 : 1,
          fillColor: isDone ? "#555" : "#fafafa",
          fillOpacity: isDone ? 0.35 : isSelected ? 1 : 0.9,
          opacity: isDone ? 0.5 : 1,
        });

        marker.bindTooltip(
          `${report.type} · ${cfg?.label || report.status}`,
          { direction: "top", opacity: 0.9 },
        );
        marker.on("click", () => onSelectRef.current(report.id));
        marker.addTo(mapRef.current!);
        markersRef.current.set(report.id, marker);
      }

      for (const h of hotspots) {
        const alpha = Math.min(0.15 + h.count * 0.01, 0.4);
        const circle = L.circle([h.centerLat, h.centerLng], {
          radius: 300 + h.count * 30,
          color: "#888",
          weight: 1,
          fillColor: "#ffffff",
          fillOpacity: alpha,
          opacity: 0.5,
          interactive: false,
        });
        circle.addTo(mapRef.current!);
        circlesRef.current.push(circle);
      }

      // Fit bounds when we have points
      if (reports.length > 0) {
        const bounds = L.latLngBounds(reports.map((r) => [r.lat, r.lng] as [number, number]));
        mapRef.current.fitBounds(bounds.pad(0.2), { maxZoom: 15 });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [reports, hotspots, ready, selectedId]);

  if (error) {
    return (
      <div className="flex items-center justify-center h-full text-xs font-mono text-muted-foreground">
        {error}
      </div>
    );
  }

  return (
    <div className="relative w-full h-full min-h-[240px]">
      {!ready && (
        <div className="absolute inset-0 z-[500] flex items-center justify-center bg-background/60">
          <Loader className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      )}
      <div ref={containerRef} className="w-full h-full" />
    </div>
  );
}
