#!/bin/bash
set -euo pipefail
# Post-tool-use hook to run TypeScript check after dashboard file changes

# Only run on Edit/Write operations
if [[ "${CLAUDE_TOOL_NAME:-}" != "Edit" && "${CLAUDE_TOOL_NAME:-}" != "Write" && "${CLAUDE_TOOL_NAME:-}" != "MultiEdit" ]]; then
    exit 0
fi

# Only run for dashboard TypeScript/React files
if [[ ! "${CLAUDE_TOOL_ARGS:-}" =~ dashboard/.*\.(ts|tsx) ]]; then
    exit 0
fi

# Check if dashboard exists with tsconfig
if [ ! -f "dashboard/tsconfig.json" ]; then
    exit 0
fi

echo "Running TypeScript check on dashboard..."

cd dashboard
npx tsc --noEmit 2>&1

ts_result=$?

if [ $ts_result -ne 0 ]; then
    echo ""
    echo "TypeScript check failed! Fix the type errors above."
    echo ""
else
    echo "TypeScript check passed."
fi
