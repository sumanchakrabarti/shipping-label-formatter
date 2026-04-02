# Shipping Label Formatter - Azure App Service Deployment

## Application
**Name**: shipping-label-tool  
**Resource Group**: shippinglabeltool  
**Subscription**: MSFT VS Enterprise Subscription - $150 (115a7818-1482-4285-948a-a8f0f40dac98)  
**Region**: West US 3  
**Runtime**: Node 22 LTS (Linux)  
**URL**: https://shipping-label-tool-hfetezcvckaghmdy.westus3-01.azurewebsites.net

## Quick Deploy (Copy-Paste Ready)

### 1. Verify Setup
```powershell
az account show
az webapp show --resource-group shippinglabeltool --name shipping-label-tool --query "{state:state,runtime:linuxFxVersion}"
```

### 2. Build
```powershell
cd "C:\git\shipping-label-formatter\src"
yarn build
```

### 3. Package & Deploy
```powershell
# Package
if (Test-Path dist.zip) { Remove-Item dist.zip -Force }
Compress-Archive -Path "dist\*" -DestinationPath "dist.zip" -Force

# Deploy
az webapp deploy `
  --resource-group shippinglabeltool `
  --name shipping-label-tool `
  --src-path "dist.zip" `
  --type zip `
  --restart true
```

### 4. Validate (wait 30-60 seconds after deploy completes)
```powershell
$url = "https://shipping-label-tool-hfetezcvckaghmdy.westus3-01.azurewebsites.net"
Invoke-WebRequest -Uri $url -UseBasicParsing | Select-Object StatusCode
```

## What Gets Deployed

From `C:\git\shipping-label-formatter\src`:
- **src/** → compiled TypeScript backend (Express server, PDF/image processing)
- **client/** → compiled Vite React frontend
- **public/** → static assets (icons, service worker)
- **dist/package.json** → production dependencies (auto-generated)
- **dist/.deployment** → Kudu deployment metadata (auto-generated)

## Features Enabled
- Multi-page PDF selection (page picker in UI)
- Image crop/rotate editing
- 4×6, 4×8, 2×7, letter label sizes
- Landscape print layout (two labels per 8.5×11" page)
- Supported inputs: PDF, PNG, JPG, BMP, WEBP, TIFF

## Local Testing Before Deploy
```powershell
cd "C:\git\shipping-label-formatter\src"
yarn dev
# Opens http://localhost:5173 in dev mode
```

## Common Issues

| Issue | Solution |
|-------|----------|
| Build fails | Run `yarn install` in `src/` folder first |
| "No such file" error | Verify paths are absolute; run from repo root |
| Deployment times out | Normal for first deploy (can take 2+ min). Check Azure Portal > App Service > Deployments. |
| App won't start | Check `az webapp log tail --resource-group shippinglabeltool --name shipping-label-tool` |
| Old version cached | Clear browser cache or use DevTools "Disable cache" |
