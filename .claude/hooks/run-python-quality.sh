#!/bin/bash
set -euo pipefail
#
# Manual Python Quality Check Runner
# Forces a full run of all Python development tools regardless of file changes
#
# Usage: ./.claude/hooks/run-python-quality.sh [--force-all]

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${BLUE}Running Full Python Quality Check Suite${NC}"

# Set environment variable to force the hook to run
export FORCE_PYTHON_CHECKS=true

# Run the post-tool-use hook
"$SCRIPT_DIR/posttooluse-python-quality.sh"

echo -e "${GREEN}✅ Full Python quality check completed!${NC}"
echo -e "${YELLOW}💡 Tip: Use 'make -f Makefile.dev dev-workflow' for development workflow${NC}"
