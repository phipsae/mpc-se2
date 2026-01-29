# Foundry Test Runner Service

A remote service that runs Foundry/Forge tests for the AI dApp Builder. Also supports automated build orchestration with AI-powered iteration.

## Features

- **Test Running**: Execute Foundry/Forge tests for Solidity contracts
- **Auto Build**: Full build orchestration with automatic fix and retry:
  - Generate code with Claude AI
  - Compile with solc
  - Run security analysis
  - Execute tests with Forge
  - Automatically fix failures and retry

## Deploy to Railway

### Option 1: One-click Deploy

[![Deploy on Railway](https://railway.app/button.svg)](https://railway.app/new)

1. Click the button above
2. Select "Deploy from GitHub repo"
3. Point to this `test-runner` folder
4. Set environment variables (see below)

### Option 2: Railway CLI

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login
railway login

# Initialize project
cd test-runner
railway init

# Deploy
railway up

# Set environment variables
railway variables set FRONTEND_URL=https://your-app.vercel.app
railway variables set ANTHROPIC_API_KEY=sk-ant-...
```

### Option 3: Docker

```bash
# Build image
docker build -t foundry-test-runner .

# Run locally
docker run -p 3001:3001 \
  -e FRONTEND_URL=http://localhost:3000 \
  -e ANTHROPIC_API_KEY=sk-ant-... \
  foundry-test-runner
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | `3001` |
| `FRONTEND_URL` | Your frontend URL for CORS | Required |
| `ANTHROPIC_API_KEY` | Claude API key for auto-build | Required for `/build` |

## API Endpoints

### Health Check
```
GET /health
```

### Run Tests
```
POST /run-tests
Content-Type: application/json

{
  "contracts": [
    { "name": "MyContract.sol", "content": "// solidity code..." }
  ],
  "tests": [
    { "name": "MyContract.t.sol", "content": "// Foundry test code..." }
  ]
}
```

Response:
```json
{
  "success": true,
  "totalTests": 5,
  "passed": 5,
  "failed": 0,
  "output": "...",
  "tests": [
    { "name": "testDeployment", "status": "passed" }
  ]
}
```

### Auto Build (Full Orchestration)
```
POST /build
Content-Type: application/json

{
  "prompt": "Create an NFT collection with minting...",
  "plan": {
    "contractName": "MyNFT",
    "description": "NFT collection contract",
    "features": ["minting", "royalties"],
    "pages": [{ "path": "app/mint/page.tsx", "description": "Mint page" }]
  }
}
```

Response:
```json
{
  "success": true,
  "code": {
    "contracts": [...],
    "pages": [...],
    "tests": [...]
  },
  "testResult": {
    "success": true,
    "totalTests": 10,
    "passed": 10,
    "failed": 0
  },
  "securityWarnings": [],
  "logs": ["[timestamp] Generating code...", ...],
  "iterations": 2,
  "elapsedMs": 45000
}
```

The `/build` endpoint:
1. Generates Solidity contracts and Foundry tests using Claude
2. Compiles contracts (retries up to 3 times with AI fixes)
3. Runs security analysis (fixes critical issues automatically)
4. Executes Forge tests (retries up to 5 times with AI fixes)
5. Returns working code or detailed failure information

## Foundry Test Format

Tests are written in Solidity using Forge:

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/MyContract.sol";

contract MyContractTest is Test {
    MyContract public instance;

    function setUp() public {
        instance = new MyContract();
    }

    function testDeployment() public view {
        assertEq(instance.owner(), address(this));
    }

    function testUnauthorizedAccess() public {
        vm.prank(address(0x1));
        vm.expectRevert();
        instance.ownerOnlyFunction();
    }
}
```

## After Deployment

1. Copy your Railway service URL (e.g., `https://foundry-test-runner-production.up.railway.app`)
2. Add it to your main app's `.env`:
   ```
   NEXT_PUBLIC_TEST_RUNNER_URL=https://your-railway-url.up.railway.app
   ```
