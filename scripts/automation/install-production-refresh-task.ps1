param(
  [ValidateRange(1, 24)]
  [int]$EveryHours = 6,

  [ValidateRange(1, 120)]
  [int]$FirstRunTimeoutMinutes = 30,

  [string]$TaskName = "GammonIQ Bet Project Refresh"
)

$ErrorActionPreference = "Stop"

$projectPath = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot "..\..")).Path
$runnerPath = Join-Path $PSScriptRoot "run-production-refresh.ps1"
$packageJsonPath = Join-Path $projectPath "package.json"
$pnpmCommand = Get-Command pnpm.cmd -ErrorAction SilentlyContinue

if (-not (Test-Path -LiteralPath $packageJsonPath -PathType Leaf)) {
  throw "package.json was not found. Keep this script under scripts\automation in the Bet Project root."
}

if (-not (Test-Path -LiteralPath $runnerPath -PathType Leaf)) {
  throw "Automation runner was not found: $runnerPath"
}

if (-not $pnpmCommand) {
  throw "pnpm.cmd was not found. Open a new PowerShell window after installing pnpm and try again."
}

$existingTask = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue

if ($existingTask -and $existingTask.State -eq "Running") {
  throw "The existing automatic refresh is still running. It was not interrupted. Wait for it to finish, then run this installer again."
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

$triggerStart = (Get-Date).AddHours($EveryHours)
$trigger = New-ScheduledTaskTrigger `
  -Once `
  -At $triggerStart `
  -RepetitionInterval (New-TimeSpan -Hours $EveryHours)

$settings = New-ScheduledTaskSettingsSet `
  -StartWhenAvailable `
  -AllowStartIfOnBatteries `
  -DontStopIfGoingOnBatteries `
  -ExecutionTimeLimit (New-TimeSpan -Hours 4) `
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
  -Description "Refreshes API-Football data, publishes predictions, settles completed picks and updates the Dashboard snapshot."

Register-ScheduledTask -TaskName $TaskName -InputObject $task -Force | Out-Null

$startRequestedAt = Get-Date
Start-ScheduledTask -TaskName $TaskName

Write-Host ""
Write-Host "Automatic refresh task installed." -ForegroundColor Green
Write-Host "Task: $TaskName"
Write-Host "Interval: every $EveryHours hours while this Windows user is signed in"
Write-Host "Missed runs: start automatically when the computer becomes available"
Write-Host "First run: waiting for verification; do not press Ctrl+C"

$deadline = (Get-Date).AddMinutes($FirstRunTimeoutMinutes)
$firstRunObserved = $false

do {
  Start-Sleep -Seconds 1
  $taskState = Get-ScheduledTask -TaskName $TaskName -ErrorAction Stop
  $taskInfo = Get-ScheduledTaskInfo -TaskName $TaskName -ErrorAction Stop

  if ($taskInfo.LastRunTime -ge $startRequestedAt.AddSeconds(-2)) {
    $firstRunObserved = $true
  }

  if ((Get-Date) -ge $deadline) {
    throw "The first automatic refresh did not finish within $FirstRunTimeoutMinutes minutes. It was not stopped. Check its status with show-production-refresh-status.ps1."
  }
} while (-not $firstRunObserved -or $taskState.State -eq "Running" -or $taskInfo.LastTaskResult -eq 267009)

if ($taskInfo.LastTaskResult -ne 0) {
  throw "The task was installed, but its first refresh failed with Windows result $($taskInfo.LastTaskResult). Run show-production-refresh-status.ps1 to inspect the log."
}

Write-Host "First run: verified successfully" -ForegroundColor Green
Write-Host "Last result: 0 - Success"
Write-Host "Next scheduled run: $($taskInfo.NextRunTime)"
Write-Host "Latest log: $projectPath\logs\production-refresh\latest.log"
