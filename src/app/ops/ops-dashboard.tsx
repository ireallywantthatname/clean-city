"use client";

import { useState, useEffect, useCallback } from "react";
import type { Report, SessionUser, CrewUser, AnalyticsSummary, HotspotCell } from "@/lib/types";
import { STATUS_CONFIG, PRIORITY_CONFIG, TYPE_CONFIG, getSlaInfo, getAge } from "@/lib/ui/status";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import {
  Search, SlidersHorizontal, X, Map, List,
  ChevronRight, UserPlus, AlertCircle, ArrowUpRight,
  Loader2, Download, RefreshCw, Brain,
  Plus, Minus,
} from "lucide-react";
import { toast } from "sonner";

// Sub-components defined inline for this file
function KpiStrip({ summary }: { summary: AnalyticsSummary | null }) {
  if (!summary) return null;
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 mb-4">
      <div className="border border-border p-3">
        <div className="text-xs font-mono text-muted-foreground uppercase tracking-wider">Open</div>
        <div className="text-2xl font-bold data-text mt-1">{summary.openCount}</div>
      </div>
      <div className={cn("border p-3", summary.overdueCount > 0 ? "border-l-2 border-l-destructive" : "border-border")}>
        <div className="text-xs font-mono text-muted-foreground uppercase tracking-wider">Overdue</div>
        <div className="text-2xl font-bold data-text mt-1">{summary.overdueCount}</div>
      </div>
      <div className="border border-border p-3">
        <div className="text-xs font-mono text-muted-foreground uppercase tracking-wider">Median close</div>
        <div className="text-2xl font-bold data-text mt-1">{summary.medianCloseHours != null ? `${Math.round(summary.medianCloseHours)}h` : "—"}</div>
      </div>
      <div className="border border-border p-3">
        <div className="text-xs font-mono text-muted-foreground uppercase tracking-wider">Top category</div>
        <div className="text-lg font-bold mt-1 truncate">{summary.topCategory ? TYPE_CONFIG[summary.topCategory as keyof typeof TYPE_CONFIG]?.shortLabel || summary.topCategory : "—"}</div>
      </div>
    </div>
  );
}

function FilterBar({
  search, setSearch, statusFilter, setStatusFilter,
  typeFilter, setTypeFilter, priorityFilter, setPriorityFilter,
}: {
  search: string; setSearch: (v: string) => void;
  statusFilter: string; setStatusFilter: (v: string) => void;
  typeFilter: string; setTypeFilter: (v: string) => void;
  priorityFilter: string; setPriorityFilter: (v: string) => void;
}) {
  const FILTERS = [
    { label: "Status", value: statusFilter, set: setStatusFilter, options: ["all", "open", "NEW", "TRIAGED", "ASSIGNED", "IN_PROGRESS", "BLOCKED", "DONE", "REJECTED"] },
    { label: "Type", value: typeFilter, set: setTypeFilter, options: ["all", "OVERFLOW", "ILLEGAL_DUMP", "MISSED_PICKUP"] },
    { label: "Priority", value: priorityFilter, set: setPriorityFilter, options: ["all", "CRITICAL", "HIGH", "MEDIUM", "LOW"] },
  ];

  return (
    <div className="space-y-2 mb-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search reports…"
          className="w-full bg-background border border-border pl-10 pr-4 py-2 text-sm focus:outline-none focus:border-foreground transition-colors font-mono"
        />
      </div>
      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <div key={f.label} className="flex flex-wrap gap-1 items-center">
            <span className="text-xs font-mono text-muted-foreground mr-1">{f.label}:</span>
            {f.options.map((opt) => (
              <button
                key={opt}
                onClick={() => f.set(opt)}
                className={cn(
                  "px-2 py-0.5 text-xs font-mono border transition-colors",
                  f.value === opt
                    ? "bg-foreground text-background border-foreground"
                    : "border-border hover:border-muted-foreground text-muted-foreground",
                )}
              >
                {opt}
              </button>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function ReportCard({
  report, selected, onClick,
}: {
  report: Report; selected: boolean; onClick: () => void;
}) {
  const statusCfg = STATUS_CONFIG[report.status];
  const StatusIcon = statusCfg.icon;
  const typeCfg = TYPE_CONFIG[report.type];
  const TypeIcon = typeCfg.icon;
  const sla = getSlaInfo(report.slaDueAt || null);
  const age = getAge(report.createdAt);

  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full text-left border border-border p-3 hover:border-muted-foreground transition-colors",
        selected && "border-foreground",
        statusCfg.className,
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <StatusIcon className="w-4 h-4 flex-shrink-0" />
          <TypeIcon className="w-3.5 h-3.5 flex-shrink-0 text-muted-foreground" />
          <span className="font-bold text-sm truncate">{typeCfg.shortLabel}</span>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {report.priority && (
            <span className={cn("text-xs font-mono", PRIORITY_CONFIG[report.priority].className)}>
              {PRIORITY_CONFIG[report.priority].chevrons}
            </span>
          )}
          {sla && sla.state === "overdue" && (
            <AlertCircle className="w-3.5 h-3.5 text-destructive" />
          )}
          <span className="text-xs font-mono text-muted-foreground">{age}</span>
        </div>
      </div>
      <div className="mt-1.5 flex items-center gap-3 text-xs font-mono text-muted-foreground">
        <span className="truncate">{report.id.slice(0, 8)}</span>
        <span>{report.lat.toFixed(3)}, {report.lng.toFixed(3)}</span>
        {report.assignedToName && <span>→ {report.assignedToName}</span>}
      </div>
      {report.ai?.garbageDetector?.label && (
        <div className="mt-1 text-xs font-mono opacity-60">
          AI: {report.ai.garbageDetector.label} ({Math.round(report.ai.garbageDetector.confidence * 100)}%)
        </div>
      )}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Main dashboard
// ---------------------------------------------------------------------------
export function OpsDashboard({ user }: { user: SessionUser }) {
  const supabase = getSupabaseBrowser();
  const [reports, setReports] = useState<Report[]>([]);
  const [crew, setCrew] = useState<CrewUser[]>([]);
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [hotspots, setHotspots] = useState<HotspotCell[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"list" | "map">("list");
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("open");
  const [typeFilter, setTypeFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [detailTab, setDetailTab] = useState<"info" | "timeline" | "ai">("info");

  const selectedReport = reports.find((r) => r.id === selectedId) || null;

  // Fetch reports
  const fetchReports = useCallback(async () => {
    const params = new URLSearchParams();
    if (statusFilter !== "all") params.set("status", statusFilter);
    if (typeFilter !== "all") params.set("type", typeFilter);
    if (priorityFilter !== "all") params.set("priority", priorityFilter);
    params.set("limit", "50");

    const res = await fetch(`/api/reports?${params}`);
    if (res.ok) {
      const data = await res.json();
      setReports(data.reports || []);
    }
    setLoading(false);
  }, [statusFilter, typeFilter, priorityFilter]);

  // Fetch summary & crew & hotspots
  const fetchMeta = useCallback(async () => {
    const [summaryRes, crewRes, hotspotsRes] = await Promise.all([
      fetch("/api/analytics/summary?days=30"),
      fetch("/api/users?role=crew"),
      fetch("/api/analytics/hotspots?days=30"),
    ]);
    if (summaryRes.ok) setSummary(await summaryRes.json());
    if (crewRes.ok) setCrew(await crewRes.json());
    if (hotspotsRes.ok) setHotspots((await hotspotsRes.json()).hotspots || []);
  }, []);

  // Load on mount + when filters change; schedule via timeout so setState is not sync in the effect body
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

  useEffect(() => {
    let cancelled = false;
    const run = () => {
      void fetchMeta().finally(() => {
        if (cancelled) return;
      });
    };
    const initial = setTimeout(run, 0);
    return () => {
      cancelled = true;
      clearTimeout(initial);
    };
  }, [fetchMeta]);

  const filteredReports = reports.filter((r) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      r.id.toLowerCase().includes(q) ||
      (r.notes || "").toLowerCase().includes(q) ||
      (r.assignedToName || "").toLowerCase().includes(q) ||
      r.type.toLowerCase().includes(q)
    );
  });

  async function handleAssign(crewUser: CrewUser) {
    if (!selectedId) return;
    const res = await fetch(`/api/reports/${selectedId}/assign`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ assignedToUserId: crewUser.id, assignedToName: crewUser.name }),
    });
    if (res.ok) {
      toast.success(`Assigned to ${crewUser.name}`);
      fetchReports();
    } else {
      toast.error("Assignment failed");
    }
  }

  async function handleTriage(priority: string) {
    if (!selectedId) return;
    const res = await fetch(`/api/reports/${selectedId}/triage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ priority }),
    });
    if (res.ok) { toast.success(`Triaged as ${priority}`); fetchReports(); }
  }

  async function handleExport() {
    window.open("/api/reports/export", "_blank");
  }

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 border-b border-border flex-shrink-0">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-bold tracking-tight">CleanCity</h1>
          <span className="text-xs font-mono text-muted-foreground">Operations</span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleExport} className="p-2 border border-border hover:bg-secondary transition-colors" title="Export CSV">
            <Download className="w-4 h-4" />
          </button>
          <button onClick={fetchReports} className="p-2 border border-border hover:bg-secondary transition-colors" title="Refresh">
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={async () => { await supabase.auth.signOut(); window.location.href = "/login"; }}
            className="text-xs font-mono text-muted-foreground hover:text-foreground transition-colors px-2"
          >
            Sign out
          </button>
        </div>
      </header>

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left panel — queue */}
        <div className={cn("flex flex-col border-r border-border", selectedReport ? "w-[40%]" : "w-full")}>
          <div className="p-3 border-b border-border space-y-3">
            <KpiStrip summary={summary} />
            <FilterBar
              search={search} setSearch={setSearch}
              statusFilter={statusFilter} setStatusFilter={setStatusFilter}
              typeFilter={typeFilter} setTypeFilter={setTypeFilter}
              priorityFilter={priorityFilter} setPriorityFilter={setPriorityFilter}
            />
            <div className="flex items-center gap-2">
              <button onClick={() => setViewMode("list")} className={cn("p-1.5 border", viewMode === "list" ? "border-foreground" : "border-border")}>
                <List className="w-3.5 h-3.5" />
              </button>
              <button onClick={() => setViewMode("map")} className={cn("p-1.5 border", viewMode === "map" ? "border-foreground" : "border-border")}>
                <Map className="w-3.5 h-3.5" />
              </button>
              <span className="text-xs font-mono text-muted-foreground ml-auto">
                {filteredReports.length} reports
              </span>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : filteredReports.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
                <SlidersHorizontal className="w-8 h-8 mb-2 opacity-30" />
                <p className="text-sm">No reports found</p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {filteredReports.map((r) => (
                  <ReportCard key={r.id} report={r} selected={r.id === selectedId} onClick={() => { setSelectedId(r.id); setDetailTab("info"); }} />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right panel — detail sheet */}
        {selectedReport && (
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Detail header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-sm">{TYPE_CONFIG[selectedReport.type].shortLabel}</h3>
                  <span className="text-xs font-mono text-muted-foreground">{selectedReport.id.slice(0, 8)}</span>
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <span className={cn("text-xs", STATUS_CONFIG[selectedReport.status].className)}>
                    {STATUS_CONFIG[selectedReport.status].label}
                  </span>
                  {selectedReport.priority && (
                    <span className="text-xs font-mono">{PRIORITY_CONFIG[selectedReport.priority].chevrons}</span>
                  )}
                </div>
              </div>
              <button onClick={() => setSelectedId(null)} className="p-1 hover:bg-secondary">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Detail tabs */}
            <div className="flex border-b border-border">
              {(["info", "timeline", "ai"] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setDetailTab(tab)}
                  className={cn(
                    "px-4 py-2 text-xs font-mono uppercase tracking-wider transition-colors",
                    detailTab === tab ? "border-b-2 border-foreground text-foreground" : "text-muted-foreground",
                  )}
                >
                  {tab}
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              {detailTab === "info" && (
                <div className="space-y-4">
                  {/* Photo */}
                  {selectedReport.beforePhotoUrl && (
                    <div className="border border-border">
                      <img src={selectedReport.beforePhotoUrl} alt="Before" className="w-full max-h-64 object-cover" />
                    </div>
                  )}
                  {selectedReport.afterPhotoUrl && (
                    <div className="border border-border">
                      <img src={selectedReport.afterPhotoUrl} alt="After" className="w-full max-h-64 object-cover" />
                    </div>
                  )}

                  {/* Details */}
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between border-b border-border pb-1">
                      <span className="text-xs font-mono text-muted-foreground">Location</span>
                      <span className="font-mono">{selectedReport.lat.toFixed(5)}, {selectedReport.lng.toFixed(5)}</span>
                    </div>
                    <div className="flex justify-between border-b border-border pb-1">
                      <span className="text-xs font-mono text-muted-foreground">Created</span>
                      <span className="font-mono">{new Date(selectedReport.createdAt).toLocaleString()}</span>
                    </div>
                    {selectedReport.notes && (
                      <div className="border-b border-border pb-1">
                        <span className="text-xs font-mono text-muted-foreground block">Notes</span>
                        <span>{selectedReport.notes}</span>
                      </div>
                    )}
                    {selectedReport.assignedToName && (
                      <div className="flex justify-between border-b border-border pb-1">
                        <span className="text-xs font-mono text-muted-foreground">Assigned to</span>
                        <span className="font-bold">{selectedReport.assignedToName}</span>
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  {["NEW", "TRIAGED", "ASSIGNED", "IN_PROGRESS", "BLOCKED"].includes(selectedReport.status) && (
                    <div className="space-y-2 pt-4 border-t border-border">
                      {/* Triage (ops) */}
                      {(selectedReport.status === "NEW") && (
                        <div>
                          <div className="text-xs font-mono text-muted-foreground mb-1">Triage priority:</div>
                          <div className="flex gap-1">
                            {(["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const).map((p) => (
                              <button key={p} onClick={() => handleTriage(p)} className="px-2 py-1 text-xs border border-border hover:border-foreground font-mono">
                                {p}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Assign (ops) */}
                      {(selectedReport.status === "NEW" || selectedReport.status === "TRIAGED") && crew.length > 0 && (
                        <div>
                          <div className="text-xs font-mono text-muted-foreground mb-1">Assign to:</div>
                          <div className="flex flex-wrap gap-1">
                            {crew.map((c) => (
                              <button key={c.id} onClick={() => handleAssign(c)} className="px-2 py-1 text-xs border border-border hover:border-foreground">
                                {c.name}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Status transitions */}
                      <div className="flex flex-wrap gap-1 pt-2">
                        {selectedReport.status === "ASSIGNED" && (
                          <button onClick={async () => {
                            await fetch(`/api/reports/${selectedReport.id}/status`, {
                              method: "PATCH", headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ status: "IN_PROGRESS" }),
                            });
                            toast.success("Status updated"); fetchReports();
                          }} className="px-2 py-1 text-xs border border-border hover:border-foreground">Start work</button>
                        )}
                        {selectedReport.status === "IN_PROGRESS" && (
                          <button onClick={async () => {
                            await fetch(`/api/reports/${selectedReport.id}/status`, {
                              method: "PATCH", headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ status: "BLOCKED" }),
                            });
                            toast.success("Status updated"); fetchReports();
                          }} className="px-2 py-1 text-xs border border-border hover:border-foreground">Block</button>
                        )}
                        {selectedReport.status === "BLOCKED" && (
                          <button onClick={async () => {
                            await fetch(`/api/reports/${selectedReport.id}/status`, {
                              method: "PATCH", headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ status: "IN_PROGRESS" }),
                            });
                            toast.success("Status updated"); fetchReports();
                          }} className="px-2 py-1 text-xs border border-border hover:border-foreground">Unblock</button>
                        )}
                        {["NEW", "TRIAGED"].includes(selectedReport.status) && (
                          <button onClick={async () => {
                            await fetch(`/api/reports/${selectedReport.id}/status`, {
                              method: "PATCH", headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ status: "REJECTED" }),
                            });
                            toast.success("Report rejected"); fetchReports();
                          }} className="px-2 py-1 text-xs border border-border hover:border-foreground text-muted-foreground">Reject</button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {detailTab === "timeline" && (
                <TimelinePanel reportId={selectedReport.id} />
              )}

              {detailTab === "ai" && (
                <div className="space-y-4">
                  {selectedReport.ai?.status === "PENDING" && (
                    <p className="text-xs font-mono text-muted-foreground">AI processing pending…</p>
                  )}
                  {selectedReport.ai?.status === "PROCESSING" && (
                    <div className="flex items-center gap-2 text-xs font-mono text-muted-foreground">
                      <Loader2 className="w-3 h-3 animate-spin" /> Processing…
                    </div>
                  )}
                  {selectedReport.ai?.garbageDetector && (
                    <div className="border border-border p-3">
                      <div className="text-xs font-mono text-muted-foreground uppercase tracking-wider mb-2">Garbage Detection</div>
                      <div className="text-sm font-bold">{selectedReport.ai.garbageDetector.label}</div>
                      <div className="text-xs text-muted-foreground mt-1">{selectedReport.ai.garbageDetector.reason}</div>
                      {selectedReport.ai.garbageDetector.garbageTypes?.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {selectedReport.ai.garbageDetector.garbageTypes.map((t) => (
                            <span key={t} className="px-1.5 py-0.5 text-xs border border-border font-mono">{t}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                  {selectedReport.ai?.visionTriage && (
                    <div className="border border-border p-3">
                      <div className="text-xs font-mono text-muted-foreground uppercase tracking-wider mb-2">Vision Triage</div>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div><span className="text-muted-foreground">Type:</span> {selectedReport.ai.visionTriage.normalizedType}</div>
                        <div><span className="text-muted-foreground">Volume:</span> {selectedReport.ai.visionTriage.estimatedVolume}</div>
                        <div><span className="text-muted-foreground">Crew:</span> {selectedReport.ai.visionTriage.recommendedCrewType}</div>
                        <div><span className="text-muted-foreground">Priority:</span> {selectedReport.ai.visionTriage.priority}</div>
                      </div>
                    </div>
                  )}
                  {selectedReport.ai?.crewBrief && (
                    <div className="border border-border p-3">
                      <div className="text-xs font-mono text-muted-foreground uppercase tracking-wider mb-2">Crew Brief</div>
                      <div className="text-sm">{selectedReport.ai.crewBrief.summary}</div>
                      {selectedReport.ai.crewBrief.checklist?.length > 0 && (
                        <div className="mt-2 space-y-1">
                          {selectedReport.ai.crewBrief.checklist.map((item, i) => (
                            <div key={i} className="text-xs flex items-start gap-1">
                              <span className="font-mono">{i + 1}.</span> {item}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                  {/* Manual AI trigger buttons */}
                  <div className="flex flex-wrap gap-2 pt-2 border-t border-border">
                    <button onClick={async () => {
                      await fetch("/api/ai/garbage-check", {
                        method: "POST", headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ reportId: selectedReport.id }),
                      });
                      toast.success("AI started"); fetchReports();
                    }} className="px-2 py-1 text-xs border border-border hover:border-foreground font-mono flex items-center gap-1">
                      <Brain className="w-3 h-3" /> Detect Garbage
                    </button>
                    <button onClick={async () => {
                      await fetch("/api/ai/triage", {
                        method: "POST", headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ reportId: selectedReport.id }),
                      });
                      toast.success("Triage started"); fetchReports();
                    }} className="px-2 py-1 text-xs border border-border hover:border-foreground font-mono flex items-center gap-1">
                      <ArrowUpRight className="w-3 h-3" /> AI Triage
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Simple timeline panel
function TimelinePanel({ reportId }: { reportId: string }) {
  const [activities, setActivities] = useState<Array<{ id: string; type: string; message: string; created_by_name: string; created_at: string }>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/reports/${reportId}/activities`)
      .then((r) => r.ok ? r.json() : [])
      .then((data) => setActivities(data))
      .finally(() => setLoading(false));
  }, [reportId]);

  if (loading) return <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />;
  if (!activities.length) return <p className="text-xs text-muted-foreground">No activity recorded.</p>;

  return (
    <div className="space-y-0">
      {activities.map((a, i) => (
        <div key={a.id} className="flex gap-3 pb-3">
          <div className="flex flex-col items-center">
            <div className="w-2 h-2 border border-foreground flex-shrink-0 mt-1" />
            {i < activities.length - 1 && <div className="w-px flex-1 bg-border mt-1" />}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-mono text-muted-foreground">{new Date(a.created_at).toLocaleString()}</div>
            <div className="text-sm">{a.message}</div>
            <div className="text-xs text-muted-foreground">{a.created_by_name}</div>
          </div>
        </div>
      ))}
    </div>
  );
}
