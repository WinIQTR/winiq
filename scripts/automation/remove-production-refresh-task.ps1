param(
  [string]$TaskName = "GammonIQ Bet Project Refresh"
)

$ErrorActionPreference = "Stop"
$task = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue

if (-not $task) {
  Write-Host "Automatic refresh task was not found: $TaskName" -ForegroundColor Yellow
  exit 0
}

if ($task.State -eq "Running") {
  throw "The automatic refresh is currently running and was not interrupted. Wait for it to finish before removing the task."
}

Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
Write-Host "Automatic refresh task removed: $TaskName" -ForegroundColor Green
