"use client";

import { useState, useEffect, useCallback } from "react";
import type { Report, SessionUser } from "@/lib/types";
import { STATUS_CONFIG, PRIORITY_CONFIG, TYPE_CONFIG, getSlaInfo, getAge } from "@/lib/ui/status";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { Loader2, CheckCircle2, PauseCircle, Camera, AlertCircle, Brain } from "lucide-react";
import { toast } from "sonner";

export function CrewDashboard({ user }: { user: SessionUser }) {
  const supabase = getSupabaseBrowser();
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [completionOpen, setCompletionOpen] = useState(false);
  const [completionNotes, setCompletionNotes] = useState("");
  const [afterPhoto, setAfterPhoto] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const fetchReports = useCallback(async () => {
    const res = await fetch(`/api/reports?assignedTo=${user.id}&status=open&limit=50`);
    if (res.ok) {
      const data = await res.json();
      // Also fetch my done reports (last 10)
      const doneRes = await fetch(`/api/reports?assignedTo=${user.id}&status=DONE&limit=10`);
      const doneData = doneRes.ok ? await doneRes.json() : { reports: [] };
      setReports([...(data.reports || []), ...(doneData.reports || [])]);
    }
    setLoading(false);
  }, [user.id]);

  // Load on mount + poll; schedule via interval so setState is not sync in the effect body
  useEffect(() => {
    let cancelled = false;
    const run = () => {
      void fetchReports().finally(() => {
        if (cancelled) return;
      });
    };
    const initial = setTimeout(run, 0);
    const interval = setInterval(run, 15000);
    return () => {
      cancelled = true;
      clearTimeout(initial);
      clearInterval(interval);
    };
  }, [fetchReports]);

  const selectedReport = reports.find((r) => r.id === selectedId) || null;

  async function handleStatusChange(newStatus: string) {
    if (!selectedId) return;
    const res = await fetch(`/api/reports/${selectedId}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });
    if (res.ok) { toast.success(`Status: ${newStatus}`); fetchReports(); }
    else toast.error("Status change failed");
  }

  async function handleComplete(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedId) return;
    setSubmitting(true);
    const formData = new FormData();
    formData.set("completionNotes", completionNotes);
    if (afterPhoto) formData.set("afterPhoto", afterPhoto);

    const res = await fetch(`/api/reports/${selectedId}/complete`, {
      method: "POST", body: formData,
    });
    if (res.ok) {
      toast.success("Job completed");
      setCompletionOpen(false);
      setCompletionNotes("");
      setAfterPhoto(null);
      fetchReports();
    } else {
      toast.error("Completion failed");
    }
    setSubmitting(false);
  }

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 border-b border-border flex-shrink-0">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-bold tracking-tight">CleanCity</h1>
          <span className="text-xs font-mono text-muted-foreground">Crew</span>
          <span className="text-xs font-mono text-muted-foreground ml-2">—</span>
          <span className="text-xs font-mono">{user.name}</span>
        </div>
        <button
          onClick={async () => { await supabase.auth.signOut(); window.location.href = "/login"; }}
          className="text-xs font-mono text-muted-foreground hover:text-foreground transition-colors"
        >
          Sign out
        </button>
      </header>

      {/* Job list */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : reports.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
            <CheckCircle2 className="w-8 h-8 mb-2 opacity-30" />
            <p className="text-sm">No jobs assigned</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {reports.map((report) => {
              const typeCfg = TYPE_CONFIG[report.type];
              const TypeIcon = typeCfg.icon;
              const statusCfg = STATUS_CONFIG[report.status];
              const StatusIcon = statusCfg.icon;
              const sla = getSlaInfo(report.slaDueAt || null);
              const age = getAge(report.createdAt);
              const isDone = report.status === "DONE";

              return (
                <div key={report.id} className={cn("p-4", statusCfg.className)}>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <TypeIcon className="w-5 h-5" />
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold">{typeCfg.shortLabel}</span>
                          <StatusIcon className="w-3.5 h-3.5" />
                          <span className="text-xs font-mono text-muted-foreground">{statusCfg.label}</span>
                        </div>
                        <div className="flex items-center gap-3 mt-1 text-xs font-mono text-muted-foreground">
                          <span>{report.id.slice(0, 8)}</span>
                          <span>{age}</span>
                          {report.priority && <span>{PRIORITY_CONFIG[report.priority].chevrons}</span>}
                          {sla && <span className={sla.className}>{sla.label}</span>}
                        </div>
                        {report.ai?.crewBrief?.summary && (
                          <div className="mt-1 text-xs opacity-70 max-w-md truncate">{report.ai.crewBrief.summary}</div>
                        )}
                      </div>
                    </div>

                    {!isDone && (
                      <div className="flex items-center gap-1">
                        {report.status === "ASSIGNED" && (
                          <button onClick={() => handleStatusChange("IN_PROGRESS")}
                            className="px-3 py-1.5 text-xs font-bold bg-foreground text-background hover:opacity-90 transition-opacity">
                            Start
                          </button>
                        )}
                        {report.status === "IN_PROGRESS" && (
                          <>
                            <button onClick={() => { setSelectedId(report.id); setCompletionOpen(true); }}
                              className="px-3 py-1.5 text-xs font-bold bg-foreground text-background hover:opacity-90 transition-opacity flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3" /> Complete
                            </button>
                            <button onClick={() => handleStatusChange("BLOCKED")}
                              className="px-2 py-1.5 text-xs border border-border hover:border-foreground"
                              title="Block">
                              <PauseCircle className="w-3.5 h-3.5" />
                            </button>
                          </>
                        )}
                        {report.status === "BLOCKED" && (
                          <button onClick={() => handleStatusChange("IN_PROGRESS")}
                            className="px-3 py-1.5 text-xs font-bold border border-border hover:border-foreground">
                            Unblock
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Photos */}
                  {report.beforePhotoUrl && (
                    <div className="mt-3 border border-border">
                      <img src={report.beforePhotoUrl} alt="Before" className="w-full max-h-48 object-cover" />
                    </div>
                  )}
                  {report.afterPhotoUrl && (
                    <div className="mt-2 border border-border">
                      <img src={report.afterPhotoUrl} alt="After" className="w-full max-h-48 object-cover" />
                    </div>
                  )}

                  {report.notes && (
                    <p className="mt-2 text-sm text-muted-foreground">{report.notes}</p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Complete dialog */}
      {completionOpen && selectedReport && (
        <div className="fixed inset-0 bg-background/80 flex items-center justify-center z-50" onClick={() => setCompletionOpen(false)}>
          <form onSubmit={handleComplete} className="bg-card border border-border p-6 w-full max-w-md mx-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-bold mb-4">Complete job: {TYPE_CONFIG[selectedReport.type].shortLabel}</h3>
            <p className="text-xs font-mono text-muted-foreground mb-4">{selectedReport.id}</p>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-mono text-muted-foreground mb-1 uppercase tracking-wider">After photo</label>
                {afterPhoto ? (
                  <div className="relative border border-border">
                    <img src={URL.createObjectURL(afterPhoto)} alt="Preview" className="w-full h-32 object-cover" />
                    <button type="button" onClick={() => setAfterPhoto(null)} className="absolute top-1 right-1 bg-background border border-border px-1.5 py-0.5 text-xs">Remove</button>
                  </div>
                ) : (
                  <label className="flex flex-col items-center justify-center h-24 border border-dashed border-border hover:border-foreground cursor-pointer transition-colors">
                    <Camera className="w-5 h-5 text-muted-foreground mb-1" />
                    <span className="text-xs font-mono text-muted-foreground">Add photo</span>
                    <input type="file" accept="image/*" capture="environment" onChange={(e) => setAfterPhoto(e.target.files?.[0] || null)} className="hidden" />
                  </label>
                )}
              </div>

              <div>
                <label className="block text-xs font-mono text-muted-foreground mb-1 uppercase tracking-wider">Notes</label>
                <textarea value={completionNotes} onChange={(e) => setCompletionNotes(e.target.value)} rows={2}
                  className="w-full bg-background border border-border px-3 py-2 text-sm focus:outline-none focus:border-foreground transition-colors resize-none"
                  placeholder="What was done?" />
              </div>

              <div className="flex gap-2">
                <button type="button" onClick={() => setCompletionOpen(false)} className="flex-1 px-3 py-2 text-xs border border-border hover:bg-secondary transition-colors">
                  Cancel
                </button>
                <button type="submit" disabled={submitting}
                  className="flex-1 px-3 py-2 text-xs font-bold bg-foreground text-background hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-1">
                  {submitting ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3" />}
                  Complete
                </button>
              </div>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
