param(
  [ValidatePattern("^([01]\d|2[0-3]):[0-5]\d$")]
  [string]$At = "06:30"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$TaskName = "BetProjectDailyCollection"
$RunnerPath = (Resolve-Path (Join-Path $PSScriptRoot "run-local-daily-collection.ps1")).Path
$UserId = "{0}\{1}" -f $env:USERDOMAIN, $env:USERNAME
$Action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument ("-NoProfile -ExecutionPolicy Bypass -File `"{0}`"" -f $RunnerPath)
$Trigger = New-ScheduledTaskTrigger -Daily -At $At
$Settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -WakeToRun -RunOnlyIfNetworkAvailable -MultipleInstances IgnoreNew -ExecutionTimeLimit (New-TimeSpan -Hours 6)
$Principal = New-ScheduledTaskPrincipal -UserId $UserId -LogonType Interactive -RunLevel Limited

Register-ScheduledTask -TaskName $TaskName -Action $Action -Trigger $Trigger -Settings $Settings -Principal $Principal -Description "Bet Project daily local data collection; no automatic model activation." -Force | Out-Null

Write-Host "Scheduled task installed: $TaskName"
Write-Host "Daily time: $At"
Write-Host "The task runs only for the current Windows user and never changes model weights."
