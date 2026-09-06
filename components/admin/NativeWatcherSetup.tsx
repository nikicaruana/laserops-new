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
    "# Double-click run-live-watcher.bat to start. Leave the window open during the game.",
    "# It asks for the folder on first run and remembers it (delete watcher-folder.txt to change).",
    `$ApiBase = "${apiBase}"`,
    `$Token   = "${token}"`,
    "$IntervalSeconds = 2",
    "",
    "Add-Type -AssemblyName System.Windows.Forms | Out-Null",
    "",
    "# Pick the folder to watch (remembered next time in watcher-folder.txt).",
    "$ConfigFile = Join-Path $PSScriptRoot 'watcher-folder.txt'",
    "$Folder = $null",
    "if (Test-Path $ConfigFile) { $saved = (Get-Content $ConfigFile -Raw).Trim(); if ($saved -and (Test-Path $saved)) { $Folder = $saved } }",
    "if (-not $Folder) {",
    "  $dlg = New-Object System.Windows.Forms.FolderBrowserDialog",
    "  $dlg.Description = 'Select the AlphaTag Localfiles folder to watch'",
    "  $dlg.ShowNewFolderButton = $false",
    "  if ($dlg.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) { $Folder = $dlg.SelectedPath; Set-Content -Path $ConfigFile -Value $Folder -Encoding UTF8 }",
    "  else { Write-Host 'No folder selected. Exiting.' -ForegroundColor Yellow; exit 1 }",
    "}",
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

  const isLocal = /localhost|127\.0\.0\.1/.test(apiBase);

  function downloadBlob(name: string, text: string) {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([text], { type: "text/plain" }));
    a.download = name;
    a.click();
    URL.revokeObjectURL(a.href);
  }
  function download() { downloadBlob("live-watcher.ps1", buildScript(apiBase, token)); }
  // A double-clickable launcher that runs the .ps1 sitting next to it.
  function downloadBat() {
    downloadBlob(
      "run-live-watcher.bat",
      ["@echo off", 'cd /d "%~dp0"', 'powershell -NoProfile -STA -ExecutionPolicy Bypass -File "%~dp0live-watcher.ps1"', "pause"].join("\r\n"),
    );
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
        streaming even when Chrome is minimised.
      </p>

      {isLocal && (
        <p className="border border-amber-700 bg-amber-950/30 px-3 py-2 text-xs text-amber-300">
          You&apos;re on <span className="font-mono">localhost</span>, so this download points at your own machine — fine for a
          local test, but the venue tablet can&apos;t reach it. For real games, download this from the <strong>live website</strong>.
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <button type="button" onClick={download} className="border border-accent bg-accent px-4 py-2 text-xs font-bold uppercase tracking-[0.12em] text-bg transition-transform active:scale-[0.98]">
          Download watcher (.ps1)
        </button>
        <button type="button" onClick={downloadBat} className="border border-border-strong px-4 py-2 text-xs font-bold uppercase tracking-[0.12em] text-text-muted hover:text-accent">
          Download launcher (.bat)
        </button>
      </div>

      <ol className="ml-4 list-decimal space-y-1 text-[0.7rem] text-text-muted">
        <li>Download <strong>both</strong> files into the <strong>same folder</strong> on the tablet (e.g. the Desktop).</li>
        <li>Double-click <code className="rounded bg-bg px-1 font-mono">run-live-watcher.bat</code> (double-clicking the .ps1 just opens Notepad — use the .bat).</li>
        <li>First run: a <strong>folder picker</strong> opens — choose your AlphaTag <code className="rounded bg-bg px-1 font-mono">Localfiles</code> folder. It&apos;s remembered next time (delete <code className="rounded bg-bg px-1 font-mono">watcher-folder.txt</code> to change it).</li>
        <li>Leave the window open during the game (minimising is fine). Close it to stop.</li>
        <li>First run may warn &quot;Windows protected your PC&quot; → <strong>More info → Run anyway</strong>.</li>
      </ol>

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
