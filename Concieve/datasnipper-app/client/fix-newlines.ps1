# PowerShell script to fix escaped newlines in TypeScript/TSX files

$files = @(
    "src\components\Layout\Layout.tsx",
    "src\components\Notifications\NotificationPanel.tsx",
    "src\components\SearchBar\SearchBar.tsx",
    "src\pages\Auth\Login.tsx",
    "src\pages\Auth\Register.tsx",
    "src\pages\Dashboard\Dashboard.tsx",
    "src\pages\Profile\Profile.tsx",
    "src\pages\Project\ProjectList.tsx",
    "src\pages\Project\ProjectWorkspace.tsx",
    "src\pages\Settings\Settings.tsx",
    "src\services\authService.ts",
    "src\services\socketService.ts",
    "src\store\authStore.ts",
    "src\store\themeStore.ts"
)

foreach ($file in $files) {
    if (Test-Path $file) {
        Write-Host "Processing: $file"
        
        # Read the content
        $content = Get-Content -Path $file -Raw
        
        # Check if the file has the issue (contains literal \n)
        if ($content -match '\\n') {
            Write-Host "  - Found escaped newlines, fixing..."
            
            # Replace literal \n with actual newlines
            $fixedContent = $content -replace '\\n', "`n"
            
            # Replace literal \t with actual tabs (if any)
            $fixedContent = $fixedContent -replace '\\t', "`t"
            
            # Replace escaped quotes
            $fixedContent = $fixedContent -replace '\\"', '"'
            
            # Save the fixed content
            Set-Content -Path $file -Value $fixedContent -NoNewline
            Write-Host "  - Fixed!"
        } else {
            Write-Host "  - File is already correct"
        }
    } else {
        Write-Host "File not found: $file"
    }
}

Write-Host "`nAll files processed!"