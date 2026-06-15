!include "LogicLib.nsh"
!include "nsProcess.nsh"

!macro customInit
  # 1. Cleanup stale registry entries that cause "Error 2" (File Not Found)
  # This happens if the app was deleted manually but the registry remains.
  # The installer would try to run a non-existent Uninstall.exe and fail.
  
  # Check HKLM (All Users)
  ReadRegStr $0 HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\com.ekklesienter.app" "UninstallString"
  ${If} $0 != ""
    ReadRegStr $1 HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\com.ekklesienter.app" "InstallLocation"
    ${If} $1 != ""
      ${IfNot} ${FileExists} "$1\Uninstall.exe"
        DeleteRegKey HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\com.ekklesienter.app"
      ${EndIf}
    ${EndIf}
  ${EndIf}

  # Check HKCU (Current User)
  ReadRegStr $0 HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\com.ekklesienter.app" "UninstallString"
  ${If} $0 != ""
    ReadRegStr $1 HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\com.ekklesienter.app" "InstallLocation"
    ${If} $1 != ""
      ${IfNot} ${FileExists} "$1\Uninstall.exe"
        DeleteRegKey HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\com.ekklesienter.app"
      ${EndIf}
    ${EndIf}
  ${EndIf}

  # 2. Robust process termination
  # Kill the app before anything else starts to release file locks.
  ${nsProcess::FindProcess} "Ekklesienter.exe" $R0
  ${If} $R0 == 0
    # First try graceful/standard kill
    ${nsProcess::KillProcess} "Ekklesienter.exe" $R1
    
    # Fallback to aggressive taskkill for process tree / stubborn background instances
    # /F = force, /T = kill child processes
    ExecWait 'taskkill /F /IM "Ekklesienter.exe" /T'
    
    # Wait loop to ensure OS releases file locks
    StrCpy $1 0
    loop_wait:
      Sleep 500
      IntOp $1 $1 + 1
      ${nsProcess::FindProcess} "Ekklesienter.exe" $R0
      ${If} $R0 != 0
        Goto done_init
      ${EndIf}
      ${If} $1 < 10
        Goto loop_wait
      ${EndIf}
  ${EndIf}

  done_init:
!macroend

!macro customCheckAppRunning
  # Suppress the default "App is running" warning.
  # Our customInit handles process killing and stale detection silently.
!macroend

!macro customUnInit
  # Kill the app before uninstallation starts
  ${nsProcess::FindProcess} "Ekklesienter.exe" $R0
  ${If} $R0 == 0
    ${nsProcess::KillProcess} "Ekklesienter.exe" $R1
    ExecWait 'taskkill /F /IM "Ekklesienter.exe" /T'
    Sleep 1000
  ${EndIf}
!macroend




