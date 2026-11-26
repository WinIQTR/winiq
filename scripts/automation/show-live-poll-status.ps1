param(
  [string]$TaskName = "WinIQ Live Fixture Poll"
)

$ErrorActionPreference = "Stop"

$projectPath = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot "..\..")).Path
$latestLogPath = Join-Path $projectPath "logs\live-poll\latest.log"
$lockPath = Join-Path $projectPath "data\live-poll.lock"

Write-Host ""
Write-Host "WinIQ live fixture poll status" -ForegroundColor Cyan
Write-Host "Project: $projectPath"

$task = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
if (-not $task) {
  Write-Host "Scheduled task: not installed ($TaskName)" -ForegroundColor Yellow
}
else {
  $info = Get-ScheduledTaskInfo -TaskName $TaskName
  Write-Host "Scheduled task: $($task.State)"
  Write-Host "Last run: $($info.LastRunTime)"
  Write-Host "Last result: $($info.LastTaskResult)"
  Write-Host "Next run: $($info.NextRunTime)"
}

if (Test-Path -LiteralPath $lockPath) {
  Write-Host "Lock: present ($lockPath)" -ForegroundColor Yellow
}
else {
  Write-Host "Lock: clear"
}

if (Test-Path -LiteralPath $latestLogPath) {
  Write-Host ""
  Write-Host "--- latest.log (tail) ---"
  Get-Content -LiteralPath $latestLogPath -Tail 40
}
else {
  Write-Host "No live-poll log yet. Run: pnpm live:poll" -ForegroundColor Yellow
}
