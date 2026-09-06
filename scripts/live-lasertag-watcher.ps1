# =============================================================================
# LaserOps Malta — live feed watcher (venue tablet)
# -----------------------------------------------------------------------------
# Watches the AlphaTag export folder and streams each round's JSON to the site
# as it is written, so players + the venue screen see the game live. Runs in the
# background independently of Chrome (leave this window open/minimised).
#
# SETUP: fill in the values below, then run via run-live-lasertag-watcher.bat
# (double-click). Or download both pre-filled from the match's Live feed section,
# which already has the site URL + token in place.
# =============================================================================
$ApiBase = "https://YOUR-SITE-URL"                                  # e.g. https://laseropsmalta.com
$Token   = "PASTE-YOUR-TOKEN-HERE"                                  # from the match page > Live feed
$IntervalSeconds = 2

Add-Type -AssemblyName System.Windows.Forms | Out-Null

# Pick the folder to watch on first run; remembered next time in watcher-folder.txt
# (delete that file to be asked again).
$ConfigFile = Join-Path $PSScriptRoot 'watcher-folder.txt'
$Folder = $null
if (Test-Path $ConfigFile) { $saved = (Get-Content $ConfigFile -Raw).Trim(); if ($saved -and (Test-Path $saved)) { $Folder = $saved } }
if ($Folder) {
  Write-Host "Remembered folder: $Folder" -ForegroundColor Cyan
  Write-Host 'Press C in the next 3s to choose a different folder, or wait to continue...'
  $deadline = (Get-Date).AddSeconds(3)
  while ((Get-Date) -lt $deadline) { if ([Console]::KeyAvailable) { if ([Console]::ReadKey($true).Key -eq 'C') { $Folder = $null }; break }; Start-Sleep -Milliseconds 100 }
}
if (-not $Folder) {
  # Standard Explorer dialog (address bar + Quick Access) used to pick a folder:
  # navigate into the Localfiles folder, then click Open.
  $dlg = New-Object System.Windows.Forms.OpenFileDialog
  $dlg.Title = 'Open your AlphaTag Localfiles folder (use the address bar / Quick Access), then click Open'
  $dlg.Filter = 'Folder|no-files'
  $dlg.CheckFileExists = $false
  $dlg.CheckPathExists = $true
  $dlg.ValidateNames = $false
  $dlg.FileName = 'Open this folder'
  if ($dlg.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) { $Folder = Split-Path -Parent $dlg.FileName; Set-Content -Path $ConfigFile -Value $Folder -Encoding UTF8 }
  else { Write-Host 'No folder selected. Exiting.' -ForegroundColor Yellow; exit 1 }
}

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
        if ($resp.ok) { $seen[$f.Name] = $f.Length; Write-Host ("{0}  {1} -> round {2}" -f (Get-Date -Format T), $f.Name, $resp.round_no) }
        elseif ($resp.skipped -ne 'no-live-match') { $seen[$f.Name] = $f.Length; Write-Host ("{0}  {1} skipped ({2})" -f (Get-Date -Format T), $f.Name, $resp.skipped) -ForegroundColor DarkGray }
        else { Write-Host ("{0}  waiting for a live match with the feed on..." -f (Get-Date -Format T)) -ForegroundColor DarkGray }
      } catch {
        Write-Host ("{0}  {1} FAILED: {2}" -f (Get-Date -Format T), $f.Name, $_.Exception.Message) -ForegroundColor Yellow
      }
    }
  } catch { Write-Host ("poll error: {0}" -f $_.Exception.Message) -ForegroundColor Yellow }
  Start-Sleep -Seconds $IntervalSeconds
}
