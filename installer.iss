; ============================================================================
; ServerEye - Inno Setup Installer Script
; Build: iscc installer.iss
; ============================================================================

#define MyAppName       "ServerEye"
#define MyAppVersion    "1.0.0"
#define MyAppPublisher  "ServerEye"
#define MyAppURL        "https://github.com/servereye"
#define MyAppExeName    "ServerEye.exe"

[Setup]
; Basic identifiers
AppId={{B8F3A2D1-47E6-4C9A-8E5D-2F1A3B7C9D0E}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppVerName={#MyAppName} {#MyAppVersion}
AppPublisher={#MyAppPublisher}
AppPublisherURL={#MyAppURL}
AppSupportURL={#MyAppURL}
AppUpdatesURL={#MyAppURL}

; Install directories
DefaultDirName={autopf}\{#MyAppName}
DefaultGroupName={#MyAppName}
DisableProgramGroupPage=yes

; Output
OutputDir=installer_output
OutputBaseFilename=ServerEye_Setup_{#MyAppVersion}

; Compression
Compression=lzma2/ultra64
SolidCompression=yes

; Appearance
WizardStyle=modern
SetupIconFile=compiler:SetupClassicIcon.ico

; Privileges (per-user install also supported, but default to admin)
PrivilegesRequired=admin
PrivilegesRequiredOverridesAllowed=dialog

; Uninstaller
Uninstallable=yes
UninstallDisplayIcon={app}\{#MyAppExeName}
UninstallDisplayName={#MyAppName}

; License
LicenseFile=

; Korean language by default
; (English also available as fallback)

; Misc
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
AllowNoIcons=yes
CloseApplications=force

[Languages]
Name: "korean";   MessagesFile: "compiler:Languages\Korean.isl"
Name: "english";  MessagesFile: "compiler:Default.isl"

; ============================================================================
; License text (inline MIT-style placeholder)
; ============================================================================
[Messages]
korean.WelcomeLabel2=ServerEye {#MyAppVersion} 서버 모니터링 시스템을 설치합니다.%n%n계속하기 전에 다른 응용 프로그램을 모두 닫는 것이 좋습니다.
english.WelcomeLabel2=This will install ServerEye {#MyAppVersion} server monitoring system.%n%nIt is recommended that you close all other applications before continuing.

[Code]
// Inline license text displayed on the license page
function GetLicenseText(): String;
begin
  Result :=
    'MIT License' + #13#10 +
    '' + #13#10 +
    'Copyright (c) 2024-2026 ServerEye' + #13#10 +
    '' + #13#10 +
    'Permission is hereby granted, free of charge, to any person obtaining a copy' + #13#10 +
    'of this software and associated documentation files (the "Software"), to deal' + #13#10 +
    'in the Software without restriction, including without limitation the rights' + #13#10 +
    'to use, copy, modify, merge, publish, distribute, sublicense, and/or sell' + #13#10 +
    'copies of the Software, and to permit persons to whom the Software is' + #13#10 +
    'furnished to do so, subject to the following conditions:' + #13#10 +
    '' + #13#10 +
    'The above copyright notice and this permission notice shall be included in all' + #13#10 +
    'copies or substantial portions of the Software.' + #13#10 +
    '' + #13#10 +
    'THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR' + #13#10 +
    'IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,' + #13#10 +
    'FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE' + #13#10 +
    'AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER' + #13#10 +
    'LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,' + #13#10 +
    'OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE' + #13#10 +
    'SOFTWARE.';
end;

// ── Create user data directory on install ──
procedure CurStepChanged(CurStep: TSetupStep);
var
  DataDir: String;
begin
  if CurStep = ssPostInstall then
  begin
    DataDir := ExpandConstant('{localappdata}\{#MyAppName}');
    if not DirExists(DataDir) then
      ForceDirectories(DataDir);
    if not DirExists(DataDir + '\reports') then
      ForceDirectories(DataDir + '\reports');
  end;
end;

// ── Clean up user data on uninstall (optional, prompt user) ──
procedure CurUninstallStepChanged(CurUninstallStep: TUninstallStep);
var
  DataDir: String;
begin
  if CurUninstallStep = usPostUninstall then
  begin
    DataDir := ExpandConstant('{localappdata}\{#MyAppName}');
    if DirExists(DataDir) then
    begin
      if MsgBox('사용자 데이터(데이터베이스, 로그, 리포트)를 삭제하시겠습니까?' + #13#10 +
                '(' + DataDir + ')',
                mbConfirmation, MB_YESNO) = IDYES then
      begin
        DelTree(DataDir, True, True, True);
      end;
    end;
  end;
end;

; ============================================================================
; Files: copy everything from PyInstaller dist/ServerEye/ into {app}
; ============================================================================
[Files]
; Main executable and all PyInstaller output
Source: "dist\ServerEye\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

; ============================================================================
; Installed directory structure:
;   {app}\ServerEye.exe
;   {app}\web\index.html
;   {app}\web\assets\...
;   {app}\*.dll, *.pyd, etc.  (PyInstaller dependencies)
;
; User data (created at runtime):
;   {localappdata}\ServerEye\servereye.db
;   {localappdata}\ServerEye\servereye.log
;   {localappdata}\ServerEye\reports\
; ============================================================================

[Dirs]
; Pre-create user data directory
Name: "{localappdata}\{#MyAppName}";          Permissions: users-modify
Name: "{localappdata}\{#MyAppName}\reports";  Permissions: users-modify

; ============================================================================
; Icons (shortcuts)
; ============================================================================
[Icons]
; Start Menu shortcut (always created)
Name: "{group}\{#MyAppName}";            Filename: "{app}\{#MyAppExeName}"; \
                                          Comment: "ServerEye 서버 모니터링"
; Start Menu uninstall shortcut
Name: "{group}\{#MyAppName} 제거";       Filename: "{uninstallexe}"; \
                                          Comment: "ServerEye 제거"
; Desktop shortcut (optional, controlled by task)
Name: "{commondesktop}\{#MyAppName}";    Filename: "{app}\{#MyAppExeName}"; \
                                          Comment: "ServerEye 서버 모니터링"; \
                                          Tasks: desktopicon

; ============================================================================
; Tasks (optional choices shown to user during install)
; ============================================================================
[Tasks]
Name: "desktopicon";  Description: "바탕화면에 바로가기 만들기";          GroupDescription: "추가 옵션:"
Name: "autostart";    Description: "Windows 시작 시 자동 실행 (최소화)";  GroupDescription: "추가 옵션:"; Flags: checkedonce

; ============================================================================
; Registry: auto-start with Windows (if task selected)
; ============================================================================
[Registry]
; HKCU Run key — launches ServerEye minimized to tray on Windows startup
Root: HKCU; Subkey: "Software\Microsoft\Windows\CurrentVersion\Run"; \
    ValueType: string; ValueName: "{#MyAppName}"; \
    ValueData: """{app}\{#MyAppExeName}"" --minimized"; \
    Flags: uninsdeletevalue; Tasks: autostart

; ============================================================================
; Run after install (launch app)
; ============================================================================
[Run]
Filename: "{app}\{#MyAppExeName}"; \
    Description: "ServerEye 실행"; \
    Flags: nowait postinstall skipifsilent
