# Hosting Next.js on Microsoft Azure

## Azure Hosting Options

### Option 1: Azure Static Web Apps (Recommended)

**Best for:** Next.js apps with API routes, easiest VS Code integration

**Pros:**
- Free tier available (100GB bandwidth/month)
- Built-in CI/CD from GitHub (automatic)
- Automatic SSL certificates
- Global CDN distribution
- Native VS Code extension support
- Supports Next.js hybrid rendering (SSR + SSG + API routes)

**Cons:**
- Some advanced Next.js features have limitations (ISR, some middleware)

---

### Option 2: Azure App Service

**Best for:** Full control, deployment slots, traditional PaaS

**Pros:**
- Full Node.js runtime support
- Deployment slots for staging/production
- Custom domains and SSL
- VS Code extension available
- More predictable performance

**Cons:**
- Higher cost than Static Web Apps
- Manual scaling configuration

---

### Option 3: Azure Container Apps

**Best for:** Container-based deployment, auto-scaling

**Pros:**
- Container-based (predictable environments)
- Auto-scaling to zero (cost savings)
- Full control over runtime

**Cons:**
- Requires Dockerfile
- More complex initial setup

---

## Recommended: Azure Static Web Apps

For simplicity and continuous deployment from VS Code, **Azure Static Web Apps** is the best choice.

---

## Setting Up Continuous Deployment from VS Code

### Prerequisites

1. **Azure Account** - Sign up at https://azure.microsoft.com/free/
2. **VS Code Extensions:**
   - Azure Account
   - Azure Static Web Apps
   - Azure Resources

### Step-by-Step Setup

#### 1. Install VS Code Extensions

```
Ctrl+Shift+X → Search "Azure Static Web Apps" → Install
```

Also install "Azure Account" if not already installed.

#### 2. Sign in to Azure

- Press `Ctrl+Shift+P` → "Azure: Sign In"
- Complete browser authentication

#### 3. Create Static Web App

**Option A: Via VS Code**
1. Open Azure sidebar (Azure icon in activity bar)
2. Under "Static Web Apps" → Click `+` to create
3. Select subscription
4. Enter app name (e.g., `agentcon-demos`)
5. Select region (e.g., `West Europe`)
6. Select "Next.js" as build preset
7. Confirm settings

**Option B: Via Command Palette**
1. `Ctrl+Shift+P` → "Azure Static Web Apps: Create Static Web App"
2. Follow prompts

#### 4. Connect to GitHub Repository

- During creation, authorize GitHub access
- Select repository and branch (`main`)
- Azure creates a GitHub Actions workflow automatically

#### 5. Configure Environment Variables

In Azure Portal:
1. Go to your Static Web App resource
2. Settings → Configuration
3. Add application settings:
   - `OPENAI_API_KEY` = your key
   - (or `ANTHROPIC_API_KEY` / `GOOGLE_API_KEY`)

#### 6. Automatic Deployments

Once set up:
- Every push to `main` triggers a build
- GitHub Actions runs `npm run build`
- Deploys to Azure automatically
- Preview URLs for pull requests

---

## GitHub Actions Workflow

Azure Static Web Apps creates this workflow automatically in `.github/workflows/`:

```yaml
name: Azure Static Web Apps CI/CD

on:
  push:
    branches:
      - main
  pull_request:
    types: [opened, synchronize, reopened, closed]
    branches:
      - main

jobs:
  build_and_deploy_job:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Build And Deploy
        uses: Azure/static-web-apps-deploy@v1
        with:
          azure_static_web_apps_api_token: ${{ secrets.AZURE_STATIC_WEB_APPS_API_TOKEN }}
          repo_token: ${{ secrets.GITHUB_TOKEN }}
          action: "upload"
          app_location: "/"
          output_location: ".next"
```

---

## Quick Start Commands (CLI Alternative)

```bash
# Install Azure CLI (if needed)
winget install Microsoft.AzureCLI

# Login to Azure
az login

# Create resource group
az group create --name agentcon-rg --location westeurope

# Create Static Web App
az staticwebapp create \
  --name agentcon-demos \
  --resource-group agentcon-rg \
  --source https://github.com/YOUR_USERNAME/AgentCon_Demos \
  --branch main \
  --app-location "/" \
  --output-location ".next" \
  --login-with-github
```

---

## Verification Steps

After deployment:

1. **Check deployment status** in VS Code Azure sidebar
2. **Visit the deployed URL** (shown in Azure Portal/VS Code)
3. **Test API routes** at `https://your-app.azurestaticapps.net/api/copilotkit`
4. **Check logs** in Azure Portal → Static Web App → Monitoring → Logs

---

## Cost Estimates

| Service | Free Tier | Production |
|---------|-----------|------------|
| Static Web Apps | Free (100GB bandwidth) | Standard: ~$9/month |
| App Service | Free (F1 tier, limited) | B1: ~$13/month |
| Container Apps | First 180K vCPU-s free | Pay per use |
