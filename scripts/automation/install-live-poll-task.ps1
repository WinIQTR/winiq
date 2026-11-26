param(
  [ValidateRange(1, 15)]
  [int]$EveryMinutes = 2,

  [string]$TaskName = "WinIQ Live Fixture Poll",

  [switch]$SkipFirstRun
)

$ErrorActionPreference = "Stop"

$projectPath = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot "..\..")).Path
$runnerPath = Join-Path $PSScriptRoot "run-live-poll.ps1"
$packageJsonPath = Join-Path $projectPath "package.json"
$pnpmCommand = Get-Command pnpm.cmd -ErrorAction SilentlyContinue

if (-not (Test-Path -LiteralPath $packageJsonPath -PathType Leaf)) {
  throw "package.json was not found. Keep this script under scripts\automation in the Bet Project root."
}

if (-not (Test-Path -LiteralPath $runnerPath -PathType Leaf)) {
  throw "Live poll runner was not found: $runnerPath"
}

if (-not $pnpmCommand) {
  throw "pnpm.cmd was not found. Open a new PowerShell window after installing pnpm and try again."
}

$existingTask = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
if ($existingTask -and $existingTask.State -eq "Running") {
  throw "The existing live poll task is still running. Wait for it to finish, then run this installer again."
}

$powerShellPath = (Get-Command powershell.exe -ErrorAction Stop).Source
$pnpmPath = $pnpmCommand.Source
$actionArguments = @(
  "-NoLogo"
  "-NoProfile"
  "-NonInteractive"
  "-WindowStyle Hidden"
  "-ExecutionPolicy Bypass"
  "-File `"$runnerPath`""
  "-ProjectPath `"$projectPath`""
  "-PnpmPath `"$pnpmPath`""
) -join " "

$action = New-ScheduledTaskAction `
  -Execute $powerShellPath `
  -Argument $actionArguments `
  -WorkingDirectory $projectPath

$triggerStart = (Get-Date).AddMinutes(1)
$trigger = New-ScheduledTaskTrigger `
  -Once `
  -At $triggerStart `
  -RepetitionInterval (New-TimeSpan -Minutes $EveryMinutes)

$settings = New-ScheduledTaskSettingsSet `
  -StartWhenAvailable `
  -AllowStartIfOnBatteries `
  -DontStopIfGoingOnBatteries `
  -ExecutionTimeLimit (New-TimeSpan -Minutes 10) `
  -MultipleInstances IgnoreNew

$principal = New-ScheduledTaskPrincipal `
  -UserId ([System.Security.Principal.WindowsIdentity]::GetCurrent().Name) `
  -LogonType Interactive `
  -RunLevel Limited

$task = New-ScheduledTask `
  -Action $action `
  -Trigger $trigger `
  -Settings $settings `
  -Principal $principal `
  -Description "Polls API-Football /fixtures?live=all and reconciles stale SCHEDULED scores into Match. Does not replace the daily production refresh."

Register-ScheduledTask -TaskName $TaskName -InputObject $task -Force | Out-Null

Write-Host ""
Write-Host "Live poll task installed." -ForegroundColor Green
Write-Host "Task: $TaskName"
Write-Host "Interval: every $EveryMinutes minute(s) while this Windows user is signed in"
Write-Host "Does not replace: GammonIQ Bet Project Refresh (daily/6h)"
Write-Host "Logs: $projectPath\logs\live-poll\latest.log"

if ($SkipFirstRun) {
  Write-Host "First run skipped (--SkipFirstRun)."
  return
}

$startRequestedAt = Get-Date
Start-ScheduledTask -TaskName $TaskName
Write-Host "First run started; check show-live-poll-status.ps1 in ~30s."
Write-Host "Started at: $startRequestedAt"
