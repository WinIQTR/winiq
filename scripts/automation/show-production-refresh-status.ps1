param(
  [string]$TaskName = "GammonIQ Bet Project Refresh"
)

$ErrorActionPreference = "Stop"
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
[Console]::OutputEncoding = $utf8NoBom

$projectPath = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot "..\..")).Path
$latestLogPath = Join-Path $projectPath "logs\production-refresh\latest.log"
$task = Get-ScheduledTask -TaskName $TaskName -ErrorAction Stop
$taskInfo = Get-ScheduledTaskInfo -TaskName $TaskName -ErrorAction Stop

function Get-TaskResultDescription([long]$Result) {
  switch ($Result) {
    0 { return "Success" }
    1 { return "Refresh failed - inspect the log below" }
    2 { return "Refresh skipped because another refresh is still running" }
    267009 { return "Running" }
    267011 { return "Task has not run yet" }
    3221225786 { return "Interrupted by Windows or the console (0xC000013A)" }
    default { return "Windows Task Scheduler result" }
  }
}

$latestRefresh = "No log yet"

if (Test-Path -LiteralPath $latestLogPath -PathType Leaf) {
  $logLines = [System.IO.File]::ReadAllLines($latestLogPath, $utf8NoBom)
  $exitCodeLine = $logLines | Where-Object { $_ -match "^Exit code: " } | Select-Object -Last 1

  if ($exitCodeLine -eq "Exit code: 0") {
    $latestRefresh = "Completed successfully"
  }
  elseif ($logLines -match "^FAILED:") {
    $latestRefresh = "Failed - inspect the log below"
  }
  elseif ($logLines -match "Refresh skipped") {
    $latestRefresh = "Skipped because another refresh is running"
  }
  else {
    $latestRefresh = "Running or incomplete"
  }
}

Write-Host ""
Write-Host "AUTOMATIC REFRESH STATUS" -ForegroundColor Cyan
[PSCustomObject]@{
  Task = $TaskName
  State = $task.State
  LastRun = $taskInfo.LastRunTime
  LastResult = "$($taskInfo.LastTaskResult) - $(Get-TaskResultDescription $taskInfo.LastTaskResult)"
  LatestRefresh = $latestRefresh
  NextRun = $taskInfo.NextRunTime
} | Format-List

if (Test-Path -LiteralPath $latestLogPath -PathType Leaf) {
  Write-Host "LATEST LOG" -ForegroundColor Cyan
  $logLines | Select-Object -Last 35
}
else {
  Write-Host "No refresh log exists yet. The first run may still be in progress." -ForegroundColor Yellow
}
