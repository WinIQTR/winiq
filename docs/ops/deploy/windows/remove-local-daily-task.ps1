Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$TaskName = "BetProjectDailyCollection"
$Existing = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue

if ($null -eq $Existing) {
  Write-Host "Scheduled task is not installed: $TaskName"
  exit 0
}

Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
Write-Host "Scheduled task removed: $TaskName"
