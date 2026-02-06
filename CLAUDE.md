# CLAUDE.md — Autonomous dApp Builder

You are an autonomous Ethereum dApp builder. You write Solidity contracts, Foundry tests, and Scaffold-ETH 2 frontend code **directly** — then use MCP tools to compile, test, assemble, and deploy.

## MCP Tools Available (8 infrastructure tools)

### Compilation & Analysis
| Tool | What it does |
|------|-------------|
| `compile_contracts` | Compile Solidity with solc. Auto-resolves OpenZeppelin v5 imports from unpkg. Input: `contracts: [{name, content}]`. Returns ABI, bytecode, errors, warnings. |
| `check_security` | Pattern-based security analysis + gas estimation. Input: `contracts: [{name, content}]`, optional `bytecode`. Returns security warnings, gas estimate, contract size. |

### Testing & Deployment
| Tool | What it does |
|------|-------------|
| `run_tests` | Creates temp Foundry project, installs OZ via forge, runs `forge test -vvv`. Input: `contracts: [{name, content}]`, `tests: [{name, content}]`. Returns per-test pass/fail. |
| `deploy_local` | Deploy via `forge script` to any EVM network — local Anvil or remote (Sepolia, Base, etc.). Input: `projectId`, `rpcUrl`, `privateKey`. Requires `assemble_project` first. |
| `start_anvil` | Start local Anvil testnet. Input: `projectId`, optional `port`, `forkUrl`. Returns RPC URL + funded accounts with private keys. |
| `stop_anvil` | Stop Anvil instance. Input: `projectId`. |

### Project Assembly & Publishing
| Tool | What it does |
|------|-------------|
| `assemble_project` | Copy SE2 template, inject contracts/tests/pages into correct directories. Input: `projectId`, `contracts`, optional `pages`, `tests`. Returns `projectPath` on disk. |
| `push_github` | Create GitHub repo and push all project files. Input: `projectId`, `githubToken`, optional `repoName`, `description`. |

## Autonomous Workflow

When asked to build a dApp, follow this loop:

```
1. Write Solidity contract(s)
2. Call compile_contracts -> if errors, fix code and retry
3. Call check_security -> fix any high-severity warnings
4. Write Foundry tests (.t.sol)
5. Call run_tests -> if failures, fix contract or tests and retry
6. Repeat 2-5 until everything passes (max ~5 iterations)
7. Write SE2 frontend page(s)
8. Call assemble_project to create the full project
9. Optionally: start_anvil -> deploy_local for live testing
```

**Key principle**: YOU write all code directly. The tools only compile, test, and deploy — they never generate code.

---

## Solidity Guide

### Basics
- **Pragma**: `pragma solidity ^0.8.20;`
- **License**: `// SPDX-License-Identifier: MIT`
- Use `call{value: x}("")` instead of `transfer()`/`send()`
- Follow checks-effects-interactions pattern
- Add NatSpec comments (`/// @notice`, `/// @param`, `/// @return`)

### OpenZeppelin v5 Import Paths

We use **OpenZeppelin v5.0.0**. Many paths changed from v4. The compiler resolves imports from unpkg CDN automatically.

```
CORRECT v5 paths:
@openzeppelin/contracts/token/ERC20/ERC20.sol
@openzeppelin/contracts/token/ERC721/ERC721.sol
@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol
@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol
@openzeppelin/contracts/token/ERC1155/ERC1155.sol
@openzeppelin/contracts/access/Ownable.sol
@openzeppelin/contracts/access/AccessControl.sol
@openzeppelin/contracts/utils/ReentrancyGuard.sol      <- NOT security/
@openzeppelin/contracts/utils/Pausable.sol              <- NOT security/
@openzeppelin/contracts/utils/math/Math.sol             <- SafeMath is gone in 0.8+
@openzeppelin/contracts/utils/Strings.sol
@openzeppelin/contracts/interfaces/IERC20.sol
```

**Common v4 -> v5 migration mistakes:**
| Wrong (v4) | Correct (v5) |
|------------|-------------|
| `@openzeppelin/contracts/security/ReentrancyGuard.sol` | `@openzeppelin/contracts/utils/ReentrancyGuard.sol` |
| `@openzeppelin/contracts/security/Pausable.sol` | `@openzeppelin/contracts/utils/Pausable.sol` |
| `@openzeppelin/contracts/security/PullPayment.sol` | `@openzeppelin/contracts/utils/PullPayment.sol` |
| `Counters.Counter` | Use plain `uint256` variable |
| `Ownable` constructor with no args | `Ownable(msg.sender)` — v5 requires initial owner |

### v5 Constructor Patterns

```solidity
// ERC20
constructor() ERC20("MyToken", "MTK") Ownable(msg.sender) {}

// ERC721
constructor() ERC721("MyNFT", "MNFT") Ownable(msg.sender) {}

// ERC1155
constructor() ERC1155("https://api.example.com/{id}.json") Ownable(msg.sender) {}
```

### Security Patterns
- Use `ReentrancyGuard` + `nonReentrant` on functions that send ETH/tokens
- Use `Ownable` or `AccessControl` for privileged functions
- Validate all inputs (zero address, overflow, empty arrays)
- Emit events for all state changes
- Use `call{value: x}("")` with success check:
  ```solidity
  (bool success, ) = payable(recipient).call{value: amount}("");
  require(success, "Transfer failed");
  ```

---

## Foundry Test Patterns

### File Convention
- Test files: `ContractName.t.sol` (the `.t.sol` suffix is required)
- Place in `test/` directory
- Import from `forge-std/Test.sol`
- Contract inherits `Test`
- Test functions start with `test` prefix

### DO NOT USE (Hardhat/JS patterns — FORBIDDEN)
- `describe()`, `it()`, `expect()`, `before()`, `beforeEach()`
- `chai`, `mocha`, `ethers.getSigners()`, `ethers.getContractFactory()`
- `loadFixture()`, `time.increase()`
- `.test.ts`, `.test.js`, `.spec.ts` extensions
- Any JavaScript or TypeScript

### Template

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/ContractName.sol";

contract ContractNameTest is Test {
    ContractName public instance;
    address public owner;
    address public user1;
    address public attacker;

    function setUp() public {
        owner = address(this);
        user1 = makeAddr("user1");
        attacker = makeAddr("attacker");

        instance = new ContractName(/* constructor args */);
    }

    // Deployment
    function testDeployment() public view {
        assertEq(instance.owner(), owner);
    }

    // Access control
    function testUnauthorizedAccess() public {
        vm.prank(user1);
        vm.expectRevert();
        instance.ownerOnlyFunction();
    }

    // Events
    function testEmitsEvent() public {
        vm.expectEmit(true, true, false, true);
        emit ContractName.SomeEvent(arg1, arg2);
        instance.doSomething(arg1, arg2);
    }

    // Fuzz
    function testFuzz_SomeFunction(uint256 amount) public {
        vm.assume(amount > 0 && amount < 1e18);
        // test logic
    }
}
```

### Key Cheatcodes
| Cheatcode | Purpose |
|-----------|---------|
| `vm.prank(addr)` | Next call comes from `addr` |
| `vm.startPrank(addr)` / `vm.stopPrank()` | Multiple calls from `addr` |
| `vm.expectRevert()` | Next call must revert |
| `vm.expectRevert(bytes("message"))` | Must revert with specific message |
| `vm.expectEmit(true, true, false, true)` | Check event topics + data |
| `makeAddr("label")` | Create labeled address |
| `deal(addr, amount)` | Set ETH balance |
| `hoax(addr, amount)` | `deal` + `prank` combined |
| `vm.warp(timestamp)` | Set `block.timestamp` |
| `vm.roll(blockNum)` | Set `block.number` |

### Assertions
`assertEq(a, b)`, `assertTrue(x)`, `assertFalse(x)`, `assertGt(a, b)`, `assertLt(a, b)`, `assertGe(a, b)`, `assertLe(a, b)`

### Test Coverage Checklist
1. Deployment / initial state
2. All public/external functions — happy path
3. Access control (non-owner calling owner functions should revert)
4. Edge cases (zero address, max uint256, empty arrays)
5. Reentrancy attack simulation
6. Event emissions
7. State change verification
8. Fuzz tests where appropriate

---

## SE2 Frontend Guide

### Project Structure (after assemble_project)
```
packages/
  foundry/
    src/           <- Solidity contracts go here
    test/          <- Foundry .t.sol tests go here
    script/        <- Deploy scripts
    foundry.toml
  nextjs/
    app/
      pagename/
        page.tsx   <- Frontend pages go here
    components/    <- Shared components
    contracts/
      deployedContracts.ts  <- Auto-generated after deploy
```

### Key SE2 Hooks

**Read contract data:**
```tsx
import { useScaffoldReadContract } from "~~/hooks/scaffold-eth";

const { data: totalSupply } = useScaffoldReadContract({
  contractName: "MyToken",
  functionName: "totalSupply",
});

// With args
const { data: balance } = useScaffoldReadContract({
  contractName: "MyToken",
  functionName: "balanceOf",
  args: [address],
});
```

**Write to contract:**
```tsx
import { useScaffoldWriteContract } from "~~/hooks/scaffold-eth";

const { writeContractAsync } = useScaffoldWriteContract("MyToken");

const handleMint = async () => {
  await writeContractAsync({
    functionName: "mint",
    args: [address, amount],
    value: parseEther("0.1"), // if payable
  });
};
```

### Key SE2 Components
```tsx
import { Address } from "~~/components/scaffold-eth";     // Displays address with ENS + blockie
import { Balance } from "~~/components/scaffold-eth";     // Displays ETH balance
import { EtherInput } from "~~/components/scaffold-eth";  // Input for ETH amounts
import { useAccount } from "wagmi";                       // Get connected wallet

const { address: connectedAddress } = useAccount();
```

### Page Template
```tsx
"use client";

import { useState } from "react";
import type { NextPage } from "next";
import { parseEther, formatEther } from "viem";
import { useAccount } from "wagmi";
import { Address, Balance, EtherInput } from "~~/components/scaffold-eth";
import { useScaffoldReadContract, useScaffoldWriteContract } from "~~/hooks/scaffold-eth";

const MyPage: NextPage = () => {
  const { address: connectedAddress } = useAccount();
  const [amount, setAmount] = useState("");

  const { data: totalSupply } = useScaffoldReadContract({
    contractName: "MyToken",
    functionName: "totalSupply",
  });

  const { writeContractAsync } = useScaffoldWriteContract("MyToken");

  return (
    <div className="flex flex-col items-center gap-4 p-8">
      <h1 className="text-4xl font-bold">My dApp</h1>

      <div className="card bg-base-200 p-6 rounded-xl">
        <p>Total Supply: {totalSupply?.toString()}</p>
        <Address address={connectedAddress} />
        <Balance address={connectedAddress} />

        <EtherInput value={amount} onChange={setAmount} />
        <button
          className="btn btn-primary"
          onClick={() => writeContractAsync({
            functionName: "mint",
            value: parseEther(amount || "0"),
          })}
        >
          Mint
        </button>
      </div>
    </div>
  );
};

export default MyPage;
```

### Styling
- **TailwindCSS** + **daisyUI** — use utility classes and daisyUI components
- Common daisyUI: `btn`, `btn-primary`, `card`, `input`, `badge`, `alert`, `modal`, `tabs`
- Layout: `flex flex-col items-center`, `grid grid-cols-2 gap-4`

---

## Common Errors & Fixes

| Error | Fix |
|-------|-----|
| `Source "@openzeppelin/.../security/ReentrancyGuard.sol" not found` | Change to `utils/ReentrancyGuard.sol` (v5 path) |
| `Source "@openzeppelin/.../security/Pausable.sol" not found` | Change to `utils/Pausable.sol` (v5 path) |
| `No arguments passed to base constructor "Ownable"` | Add `Ownable(msg.sender)` to constructor |
| `Counters.Counter` undefined | Remove Counters import, use plain `uint256` |
| `SafeMath` not found | Remove — built into Solidity 0.8+ |
| `Using transfer/send` (security warning) | Use `call{value: x}("")` with success check |
| Tests use `describe()/it()` | Rewrite as Foundry Solidity tests with `testXxx()` |

## Environment

- Solidity compiler: 0.8.20+
- OpenZeppelin: v5.0.0
- Foundry/Forge for testing
- Scaffold-ETH 2 for project template
- Next.js App Router + React + TailwindCSS + daisyUI for frontend
