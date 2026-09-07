$ErrorActionPreference = "Stop"

$task = Get-ScheduledTask -TaskName "BetProjectDailyCollection" -ErrorAction Stop
$info = Get-ScheduledTaskInfo -TaskName "BetProjectDailyCollection" -ErrorAction Stop

[PSCustomObject]@{
  taskName = $task.TaskName
  state = $task.State.ToString()
  nextRunTime = $info.NextRunTime.ToString("o")
  lastRunTime = $info.LastRunTime.ToString("o")
  lastTaskResult = [int]$info.LastTaskResult
} | ConvertTo-Json -Compress

