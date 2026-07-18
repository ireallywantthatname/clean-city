"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { isValidReportLocation, reportFormSchema } from "@/lib/schemas";
import { TYPE_CONFIG, type TypeConfig } from "@/lib/ui/status";
import type { ReportType } from "@/lib/types";
import { Loader2, Camera, MapPin, Check, ArrowLeft, ArrowRight } from "lucide-react";
import { toast } from "sonner";

type Step = "type" | "details" | "review";
type LocationStatus = "idle" | "loading" | "ok" | "error";

export default function ReportPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("type");
  const [selectedType, setSelectedType] = useState<ReportType | null>(null);
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [locationStatus, setLocationStatus] = useState<LocationStatus>("idle");
  const [locationError, setLocationError] = useState("");

  const form = useForm({
    resolver: zodResolver(reportFormSchema),
    defaultValues: { type: "OVERFLOW" as const, lat: 0, lng: 0, notes: "" },
  });

  const lat = form.watch("lat");
  const lng = form.watch("lng");
  const hasLocation = isValidReportLocation(lat, lng);

  const getLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setLocationStatus("error");
      setLocationError("Geolocation is not supported by this browser.");
      return;
    }
    setLocationStatus("loading");
    setLocationError("");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        form.setValue("lat", pos.coords.latitude, { shouldValidate: true });
        form.setValue("lng", pos.coords.longitude, { shouldValidate: true });
        setLocationStatus("ok");
        setLocationError("");
      },
      (err) => {
        setLocationStatus("error");
        setLocationError(
          err.code === err.PERMISSION_DENIED
            ? "Location permission denied. Enable location to submit a report."
            : "Could not get your location. Try again.",
        );
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 },
    );
  }, [form]);

  // Auto-request geolocation when the user reaches the details step
  useEffect(() => {
    if (step !== "details") return;
    if (locationStatus === "ok" || locationStatus === "loading") return;
    const t = setTimeout(() => getLocation(), 0);
    return () => clearTimeout(t);
  }, [step, locationStatus, getLocation]);

  function handleTypeSelect(type: ReportType) {
    setSelectedType(type);
    form.setValue("type", type);
    setStep("details");
  }

  function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhoto(file);
    const reader = new FileReader();
    reader.onload = (ev) => setPhotoPreview(ev.target?.result as string);
    reader.readAsDataURL(file);
  }

  async function handleSubmit() {
    if (!hasLocation) {
      toast.error("Location is required before submitting");
      return;
    }
    setSubmitting(true);
    try {
      const values = form.getValues();
      const formData = new FormData();
      formData.set("type", values.type);
      formData.set("lat", String(values.lat));
      formData.set("lng", String(values.lng));
      formData.set("notes", values.notes || "");
      if (photo) formData.set("photo", photo);

      const res = await fetch("/api/reports", { method: "POST", body: formData });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.detail || "Submission failed");
      }

      toast.success("Report submitted");
      router.push("/");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to submit report");
    } finally {
      setSubmitting(false);
    }
  }

  const typeConfig = selectedType ? TYPE_CONFIG[selectedType] : null;

  return (
    <main className="min-h-screen bg-background flex flex-col items-center justify-center px-6 py-12">
      <div className="w-full max-w-md">
        {/* Progress */}
        <div className="flex items-center gap-2 mb-10 font-mono text-xs">
          {(["type", "details", "review"] as Step[]).map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              <span className={step === s ? "text-foreground font-bold" : s === "review" && step === "review" ? "text-foreground" : "text-muted-foreground"}>
                {i + 1}. {s === "type" ? "Type" : s === "details" ? "Details" : "Review"}
              </span>
              {i < 2 && <span className="text-border">→</span>}
            </div>
          ))}
        </div>

        {/* Step 1: Type selection */}
        {step === "type" && (
          <div>
            <h2 className="text-xl font-bold mb-2">What are you reporting?</h2>
            <p className="text-sm text-muted-foreground mb-8">Select the issue type.</p>
            <div className="space-y-2">
              {(Object.entries(TYPE_CONFIG) as [ReportType, TypeConfig][]).map(([key, cfg]) => {
                const Icon = cfg.icon;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => handleTypeSelect(key)}
                    className="w-full flex items-center gap-4 p-4 border border-border hover:border-foreground transition-colors text-left"
                  >
                    <Icon className="w-5 h-5 flex-shrink-0" />
                    <div>
                      <div className="font-bold text-sm">{cfg.label}</div>
                      <div className="text-xs text-muted-foreground font-mono">{key.replace(/_/g, " ")}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Step 2: Details */}
        {step === "details" && typeConfig && (
          <div>
            <button type="button" onClick={() => setStep("type")} className="flex items-center gap-1 text-xs font-mono text-muted-foreground hover:text-foreground mb-6">
              <ArrowLeft className="w-3 h-3" /> Back
            </button>

            <div className="flex items-center gap-3 mb-6">
              <typeConfig.icon className="w-6 h-6" />
              <h2 className="text-xl font-bold">{typeConfig.shortLabel}</h2>
            </div>

            {/* Photo upload */}
            <div className="mb-6">
              <label className="block text-xs font-mono text-muted-foreground mb-2 uppercase tracking-wider">
                Photo
              </label>
              {photoPreview ? (
                <div className="relative border border-border">
                  <img src={photoPreview} alt="Preview" className="w-full h-48 object-cover" />
                  <button
                    type="button"
                    onClick={() => { setPhoto(null); setPhotoPreview(null); }}
                    className="absolute top-2 right-2 bg-background border border-border px-2 py-1 text-xs hover:bg-secondary"
                  >
                    Remove
                  </button>
                </div>
              ) : (
                <label className="flex flex-col items-center justify-center h-48 border border-dashed border-border hover:border-foreground transition-colors cursor-pointer">
                  <Camera className="w-8 h-8 text-muted-foreground mb-2" />
                  <span className="text-xs font-mono text-muted-foreground">Tap to take or select a photo</span>
                  <input type="file" accept="image/*" capture="environment" onChange={handlePhotoChange} className="hidden" />
                </label>
              )}
            </div>

            {/* Notes */}
            <div className="mb-6">
              <label className="block text-xs font-mono text-muted-foreground mb-2 uppercase tracking-wider">
                Notes
              </label>
              <textarea
                {...form.register("notes")}
                rows={3}
                placeholder="Describe what you see…"
                className="w-full bg-background border border-border px-3 py-2 text-sm focus:outline-none focus:border-foreground transition-colors resize-none"
              />
            </div>

            {/* Location — required */}
            <div className="mb-6 space-y-2">
              <button
                type="button"
                onClick={getLocation}
                disabled={locationStatus === "loading"}
                className="flex items-center gap-2 text-xs font-mono text-muted-foreground hover:text-foreground transition-colors border border-border px-3 py-2 w-full justify-center disabled:opacity-50"
              >
                {locationStatus === "loading" ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <MapPin className="w-3 h-3" />
                )}
                {hasLocation
                  ? "Location captured"
                  : locationStatus === "loading"
                    ? "Getting location…"
                    : "Use current location"}
              </button>
              {hasLocation && (
                <p className="text-xs font-mono text-muted-foreground text-center">
                  {lat.toFixed(4)}, {lng.toFixed(4)}
                </p>
              )}
              {locationError && (
                <p className="text-xs font-mono text-destructive text-center">{locationError}</p>
              )}
              {!hasLocation && locationStatus !== "loading" && (
                <p className="text-xs font-mono text-muted-foreground text-center">
                  Location is required to continue.
                </p>
              )}
            </div>

            <button
              type="button"
              onClick={() => setStep("review")}
              disabled={!photo || !hasLocation}
              className="w-full bg-foreground text-background px-4 py-3 font-bold text-sm hover:opacity-90 transition-opacity disabled:opacity-30 flex items-center justify-center gap-2"
            >
              Review
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Step 3: Review */}
        {step === "review" && typeConfig && (
          <div>
            <button type="button" onClick={() => setStep("details")} className="flex items-center gap-1 text-xs font-mono text-muted-foreground hover:text-foreground mb-6">
              <ArrowLeft className="w-3 h-3" /> Back
            </button>

            <h2 className="text-xl font-bold mb-6">Review report</h2>

            <div className="space-y-4 mb-8">
              <div className="flex justify-between border-b border-border pb-2">
                <span className="text-xs font-mono text-muted-foreground">Type</span>
                <span className="text-sm font-bold">{typeConfig.label}</span>
              </div>
              {photoPreview && (
                <div className="border border-border">
                  <img src={photoPreview} alt="Preview" className="w-full h-40 object-cover" />
                </div>
              )}
              {form.watch("notes") && (
                <div className="flex justify-between border-b border-border pb-2">
                  <span className="text-xs font-mono text-muted-foreground">Notes</span>
                  <span className="text-sm">{form.watch("notes")}</span>
                </div>
              )}
              <div className="flex justify-between border-b border-border pb-2">
                <span className="text-xs font-mono text-muted-foreground">Location</span>
                <span className="text-sm font-mono">
                  {hasLocation ? `${lat.toFixed(4)}, ${lng.toFixed(4)}` : "Not set"}
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting || !hasLocation || !photo}
              className="w-full bg-foreground text-background px-4 py-3 font-bold text-sm hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Submitting…
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  Submit report
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
