$ErrorActionPreference = "Stop"

$task = Get-ScheduledTask -TaskName "BetProjectDailyCollection" -ErrorAction Stop
$info = Get-ScheduledTaskInfo -TaskName "BetProjectDailyCollection" -ErrorAction Stop

[PSCustomObject]@{
  taskName = $task.TaskName
  state = $task.State.ToString()
  nextRunTime = $info.NextRunTime.ToString("o")
  lastRunTime = $info.LastRunTime.ToString("o")
  # LastTaskResult can exceed Int32 (e.g. 0xC000013A-style codes) — keep as string.
  lastTaskResult = [string]$info.LastTaskResult
  runner = ($task.Actions | ForEach-Object { $_.Arguments }) -join " | "
} | ConvertTo-Json -Compress
