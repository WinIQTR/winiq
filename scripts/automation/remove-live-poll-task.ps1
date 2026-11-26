param(
  [string]$TaskName = "WinIQ Live Fixture Poll"
)

$ErrorActionPreference = "Stop"

$existingTask = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
if (-not $existingTask) {
  Write-Host "Live poll task was not found: $TaskName" -ForegroundColor Yellow
  return
}

if ($existingTask.State -eq "Running") {
  throw "The live poll is currently running and was not interrupted. Wait for it to finish before removing the task."
}

Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
Write-Host "Live poll task removed: $TaskName" -ForegroundColor Green
