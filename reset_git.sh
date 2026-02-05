#!/bin/bash

# Repository URL
REPO_URL="https://github.com/Gbangbolaoluwagbemiga/orbitwork.git"

# Function to safely commit
safe_commit() {
    msg="$1"
    if git diff --staged --quiet; then
        echo "⚠️  Nothing to commit for: $msg"
    else
        git commit -m "$msg"
        echo "✅  Committed: $msg"
    fi
}

# Reset Git
echo "🔄 Removing existing git configuration..."
rm -rf .git
git init
git checkout -b main
git remote add origin "$REPO_URL"

echo "🚀 Starting 20-step commit process..."

# Commit 1
git add README.md .gitignore CHANGELOG.md 2>/dev/null || true
safe_commit "chore: initial project setup and documentation"

# Commit 2
git add package.json package-lock.json hardhat.config.js tailwind.config.js postcss.config.mjs next.config.mjs .prettierrc .solhint.json vercel.json 2>/dev/null || true
safe_commit "chore: add project configuration and dependencies"

# Commit 3
git add contracts/interfaces
safe_commit "feat(contracts): add smart contract interfaces"

# Commit 4
git add contracts/MockERC20.sol 2>/dev/null || true
safe_commit "test(contracts): add mock ERC20 token for testing"

# Commit 5
git add contracts/modules/EscrowCore.sol
safe_commit "feat(core): implement EscrowCore module"

# Commit 6
git add contracts/modules/EscrowManagement.sol
safe_commit "feat(core): implement EscrowManagement module"

# Commit 7
git add contracts/modules/WorkLifecycle.sol
safe_commit "feat(core): implement WorkLifecycle module"

# Commit 8
git add contracts/modules/AdminFunctions.sol 2>/dev/null || true
safe_commit "feat(admin): add administrative controls"

# Commit 9
git add contracts/modules/Marketplace.sol 2>/dev/null || true
safe_commit "feat(market): implement marketplace"

# Commit 10
git add contracts/modules/RatingSystem.sol 2>/dev/null || true
safe_commit "feat(reputation): add rating and reputation system"

# Commit 11
git add contracts/modules/RefundSystem.sol 2>/dev/null || true
safe_commit "feat(escrow): implement refund logic"

# Commit 12
git add contracts/modules/ViewFunctions.sol 2>/dev/null || true
safe_commit "feat(utils): add view functions"

# Commit 13
git add contracts/SecureFlow.sol
safe_commit "feat(contracts): integrate SecureFlow main contract"

# Commit 14
git add secureflow-hook/src
safe_commit "feat(hook): implement Uniswap v4 Hook"

# Commit 15
git add secureflow-hook/script
safe_commit "ops(hook): add deployment scripts"

# Commit 16
git add secureflow-hook/test
safe_commit "test(hook): add hook validation tests"

# Commit 17
git add secureflow-hook/foundry.toml secureflow-hook/remappings.txt secureflow-hook/lib 2>/dev/null || true
safe_commit "chore(hook): configure Foundry environment"

# Commit 18
git add frontend/app
safe_commit "feat(ui): add main application pages"

# Commit 19
git add frontend/components
safe_commit "feat(ui): implement UI components"

# Commit 20
git add frontend
safe_commit "feat(ui): add remaining frontend assets and libs"

# Commit 21
git add scripts
safe_commit "ops: add project maintenance scripts"

# Commit 22
git add .
safe_commit "chore: finalize project structure"

# Stats
count=$(git rev-list --count HEAD)
echo "📈 Total commits: $count"

# Push
echo "⬆️  Pushing to remote..."
git push -u origin main --force

echo "🎉 Done! Repository successfully reset and pushed."
