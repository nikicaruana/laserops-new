# =============================================================================
# LaserOps Malta — live feed watcher (venue tablet)
# -----------------------------------------------------------------------------
# Watches the AlphaTag export folder and streams each round's JSON to the site
# as it is written, so players + the venue screen see the game live. Runs in the
# background independently of Chrome (leave this window open/minimised).
#
# SETUP: fill in the three values below, then run (in PowerShell):
#     powershell -ExecutionPolicy Bypass -File live-watcher.ps1
# (Or download the pre-filled script from the match's Live feed section, which
#  already has the site URL + token in place.)
# =============================================================================
$ApiBase = "https://YOUR-SITE-URL"                                  # e.g. https://laseropsmalta.com
$Token   = "PASTE-YOUR-TOKEN-HERE"                                  # from the match page > Live feed
$Folder  = "$env:LOCALAPPDATA\Laserwar\Alphatag\Localfiles"        # adjust if your path differs
$IntervalSeconds = 2

function Read-Shared([string]$path) {
  # Read a file even while AlphaTag has it open for writing (shared read).
  try {
    $fs = [System.IO.File]::Open($path, [System.IO.FileMode]::Open, [System.IO.FileAccess]::Read, [System.IO.FileShare]::ReadWrite)
    $sr = New-Object System.IO.StreamReader($fs)
    $txt = $sr.ReadToEnd(); $sr.Close(); $fs.Close(); return $txt
  } catch { return $null }
}

if (-not (Test-Path $Folder)) { Write-Host "Folder not found: $Folder" -ForegroundColor Red; exit 1 }

# Baseline the files already there (past games) — only send new/growing files.
$seen = @{}
Get-ChildItem -Path $Folder -Filter *.json -File -ErrorAction SilentlyContinue | ForEach-Object { $seen[$_.Name] = $_.Length }
Write-Host "LaserOps live watcher started. Folder: $Folder" -ForegroundColor Green
Write-Host "Leave this window open during the game (it can be minimised)." -ForegroundColor Green

while ($true) {
  try {
    foreach ($f in (Get-ChildItem -Path $Folder -Filter *.json -File -ErrorAction SilentlyContinue)) {
      $prev = $seen[$f.Name]
      if ($null -ne $prev -and $prev -eq $f.Length) { continue }   # unchanged since last send
      $raw = Read-Shared $f.FullName
      if ([string]::IsNullOrEmpty($raw)) { continue }
      $body = @{ filename = $f.Name; raw = $raw } | ConvertTo-Json -Compress -Depth 4
      try {
        $resp = Invoke-RestMethod -Uri "$ApiBase/api/ingest/live" -Method Post -Headers @{ Authorization = "Bearer $Token" } -ContentType 'application/json' -Body $body -TimeoutSec 20
        $seen[$f.Name] = $f.Length
        if ($resp.ok) { Write-Host ("{0}  {1} -> round {2}" -f (Get-Date -Format T), $f.Name, $resp.round_no) }
        else { Write-Host ("{0}  {1} skipped ({2})" -f (Get-Date -Format T), $f.Name, $resp.skipped) -ForegroundColor DarkGray }
      } catch {
        Write-Host ("{0}  {1} FAILED: {2}" -f (Get-Date -Format T), $f.Name, $_.Exception.Message) -ForegroundColor Yellow
      }
    }
  } catch { Write-Host ("poll error: {0}" -f $_.Exception.Message) -ForegroundColor Yellow }
  Start-Sleep -Seconds $IntervalSeconds
}
