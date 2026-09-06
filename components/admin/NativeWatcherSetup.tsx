"use client";

/**
 * components/admin/NativeWatcherSetup.tsx
 * --------------------------------------------------------------------
 * Setup for the native (background) live-feed watcher — the robust path that
 * keeps streaming even when Chrome is minimised. Shows the endpoint URL + the
 * shared token (copy / regenerate) and downloads a PowerShell script pre-filled
 * with both, so the venue tablet just double-clicks to run it. Admin-only.
 */
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

function buildScript(apiBase: string, token: string): string {
  return [
    "# LaserOps Malta - live feed watcher (venue tablet).",
    "# Run:  powershell -ExecutionPolicy Bypass -File live-watcher.ps1",
    "# Leave the window open during the game (it can be minimised).",
    `$ApiBase = "${apiBase}"`,
    `$Token   = "${token}"`,
    '$Folder  = "$env:LOCALAPPDATA\\Laserwar\\Alphatag\\Localfiles"   # adjust if your path differs',
    "$IntervalSeconds = 2",
    "",
    "function Read-Shared([string]$path) {",
    "  try {",
    "    $fs = [System.IO.File]::Open($path, [System.IO.FileMode]::Open, [System.IO.FileAccess]::Read, [System.IO.FileShare]::ReadWrite)",
    "    $sr = New-Object System.IO.StreamReader($fs)",
    "    $txt = $sr.ReadToEnd(); $sr.Close(); $fs.Close(); return $txt",
    "  } catch { return $null }",
    "}",
    "",
    'if (-not (Test-Path $Folder)) { Write-Host "Folder not found: $Folder" -ForegroundColor Red; exit 1 }',
    "$seen = @{}",
    "Get-ChildItem -Path $Folder -Filter *.json -File -ErrorAction SilentlyContinue | ForEach-Object { $seen[$_.Name] = $_.Length }",
    'Write-Host "LaserOps live watcher started. Folder: $Folder" -ForegroundColor Green',
    "",
    "while ($true) {",
    "  try {",
    "    foreach ($f in (Get-ChildItem -Path $Folder -Filter *.json -File -ErrorAction SilentlyContinue)) {",
    "      $prev = $seen[$f.Name]",
    "      if ($null -ne $prev -and $prev -eq $f.Length) { continue }",
    "      $raw = Read-Shared $f.FullName",
    "      if ([string]::IsNullOrEmpty($raw)) { continue }",
    "      $body = @{ filename = $f.Name; raw = $raw } | ConvertTo-Json -Compress -Depth 4",
    "      try {",
    '        $resp = Invoke-RestMethod -Uri "$ApiBase/api/ingest/live" -Method Post -Headers @{ Authorization = "Bearer $Token" } -ContentType "application/json" -Body $body -TimeoutSec 20',
    "        $seen[$f.Name] = $f.Length",
    '        if ($resp.ok) { Write-Host ("{0}  {1} -> round {2}" -f (Get-Date -Format T), $f.Name, $resp.round_no) }',
    '        else { Write-Host ("{0}  {1} skipped ({2})" -f (Get-Date -Format T), $f.Name, $resp.skipped) -ForegroundColor DarkGray }',
    "      } catch {",
    '        Write-Host ("{0}  {1} FAILED: {2}" -f (Get-Date -Format T), $f.Name, $_.Exception.Message) -ForegroundColor Yellow',
    "      }",
    "    }",
    '  } catch { Write-Host ("poll error: {0}" -f $_.Exception.Message) -ForegroundColor Yellow }',
    "  Start-Sleep -Seconds $IntervalSeconds",
    "}",
    "",
  ].join("\r\n");
}

export function NativeWatcherSetup({ token: initialToken }: { token: string }) {
  const [token, setToken] = useState(initialToken);
  const [revealed, setRevealed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const apiBase = typeof window !== "undefined" ? window.location.origin : "";

  function download() {
    const blob = new Blob([buildScript(apiBase, token)], { type: "text/plain" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "live-watcher.ps1";
    a.click();
    URL.revokeObjectURL(a.href);
  }

  async function copyToken() {
    try { await navigator.clipboard.writeText(token); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* ignore */ }
  }

  async function regenerate() {
    if (!window.confirm("Regenerate the token? The old one stops working — you'll need to re-download the script on the tablet.")) return;
    setBusy(true);
    const { data, error } = await createClient().rpc("regenerate_live_ingest_token");
    setBusy(false);
    if (!error && typeof data === "string") { setToken(data); setRevealed(true); }
  }

  const masked = token ? token.slice(0, 4) + "…" + token.slice(-4) : "";

  return (
    <div className="space-y-3">
      <p className="text-xs text-text-muted">
        <strong className="text-text">Recommended for real games.</strong> A small script runs on the venue tablet and keeps
        streaming even when Chrome is minimised. Download it (pre-filled), then on the tablet run it once:
        <code className="ml-1 rounded bg-bg px-1 py-0.5 font-mono text-[0.65rem]">powershell -ExecutionPolicy Bypass -File live-watcher.ps1</code>
      </p>

      <div className="flex flex-wrap items-center gap-3">
        <button type="button" onClick={download} className="border border-accent bg-accent px-4 py-2 text-xs font-bold uppercase tracking-[0.12em] text-bg transition-transform active:scale-[0.98]">
          Download watcher script
        </button>
        <span className="text-[0.65rem] text-text-subtle">Pre-filled with this site + your token.</span>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="font-semibold uppercase tracking-[0.12em] text-text-muted">Token</span>
        <code className="rounded bg-bg px-2 py-1 font-mono text-text">{revealed ? token : masked}</code>
        <button type="button" onClick={() => setRevealed((r) => !r)} className="text-[0.65rem] font-semibold uppercase tracking-[0.1em] text-text-subtle hover:text-accent">{revealed ? "Hide" : "Reveal"}</button>
        <button type="button" onClick={copyToken} className="text-[0.65rem] font-semibold uppercase tracking-[0.1em] text-text-subtle hover:text-accent">{copied ? "Copied" : "Copy"}</button>
        <button type="button" onClick={regenerate} disabled={busy} className="text-[0.65rem] font-semibold uppercase tracking-[0.1em] text-text-subtle hover:text-red-400 disabled:opacity-50">{busy ? "…" : "Regenerate"}</button>
      </div>
      <p className="text-[0.65rem] text-text-subtle">
        Endpoint: <code className="font-mono">{apiBase}/api/ingest/live</code>. The watcher auto-attaches to whichever game is live with the feed on.
      </p>
    </div>
  );
}
