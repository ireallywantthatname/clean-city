import Link from "next/link";
import { ArrowRight, MapPin, Trash2 } from "lucide-react";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-background flex flex-col items-center justify-center px-6">
      <div className="max-w-lg w-full text-center">
        {/* Logo mark */}
        <div className="mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 border-2 border-foreground">
            <Trash2 className="w-8 h-8" />
          </div>
        </div>

        <h1 className="text-4xl font-bold tracking-tight mb-3">
          CleanCity
        </h1>
        <p className="text-muted-foreground text-sm font-mono mb-12 max-w-xs mx-auto">
          Report overflowing bins, illegal dumping, and missed pickups.
          <br />
          SDG 11.6 — sustainable urban environments.
        </p>

        {/* Primary CTA */}
        <Link
          href="/report"
          className="inline-flex items-center gap-3 bg-foreground text-background px-8 py-4 font-bold text-sm hover:opacity-90 transition-opacity mb-8"
        >
          <MapPin className="w-4 h-4" />
          Report an Issue
          <ArrowRight className="w-4 h-4" />
        </Link>

        {/* Secondary links */}
        <div className="flex items-center justify-center gap-6 text-xs font-mono text-muted-foreground">
          <Link href="/login" className="hover:text-foreground transition-colors border-b border-transparent hover:border-muted-foreground pb-0.5">
            Staff access
          </Link>
          <span className="text-border">|</span>
          <Link href="/ops" className="hover:text-foreground transition-colors border-b border-transparent hover:border-muted-foreground pb-0.5">
            Operations
          </Link>
          <span className="text-border">|</span>
          <Link href="/crew" className="hover:text-foreground transition-colors border-b border-transparent hover:border-muted-foreground pb-0.5">
            Crew
          </Link>
        </div>
      </div>

      <footer className="absolute bottom-6 text-xs font-mono text-muted-foreground">
        CleanCity v0.1.0
      </footer>
    </main>
  );
}
