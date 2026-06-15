' Marionette hidden, self-restarting launcher.
'
' Runs with NO visible window and acts as the watchdog-of-the-watchdog:
' it launches the supervisor and, if the supervisor ever exits/crashes,
' relaunches it after a short delay -- forever. Task-Scheduler-style
' "restart on failure" with zero admin rights required.
'
' Uses "python" from PATH (the supported way to launch Store Python; the
' concrete C:\Program Files\WindowsApps path is ACL-blocked -> error 800A0046).
' The window is hidden by this launcher (style 0), so a plain console python
' produces no visible window.
'
' Auto-started at every logon via a shortcut in the user's Startup folder.
Option Explicit
Dim sh, fso, py, here
Set sh  = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
' Self-locating: run from whatever folder this script lives in (portable).
here = fso.GetParentFolderName(WScript.ScriptFullName)
sh.CurrentDirectory = here

' Use the user-AppData Store-Python alias by FULL PATH. It executes directly
' (the C:\Program Files\WindowsApps copy is ACL-blocked -> 800A0046), and this
' alias path is stable across Python patch updates. Fall back to cmd-resolved
' "python" if the alias path is ever absent.
py = sh.ExpandEnvironmentStrings("%LOCALAPPDATA%\Microsoft\WindowsApps\python.exe")
Dim runCmd
If fso.FileExists(py) Then
    runCmd = """" & py & """ marionette_daemon.py"
Else
    runCmd = "cmd /c python marionette_daemon.py"
End If

Do
    ' window style 0 = hidden, True = WAIT until the supervisor exits
    sh.Run runCmd, 0, True
    ' supervisor exited (crash, kill, etc.) -> pause, then bring it back
    WScript.Sleep 30000
Loop
