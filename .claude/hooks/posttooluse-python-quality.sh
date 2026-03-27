#!/bin/bash
set -euo pipefail
#
# Post-Tool-Use Hook: Python Code Quality Checks
# Runs automatically after Claude Code tools are used
#
# This hook runs:
# - Black (code formatting)
# - isort (import sorting)
# - flake8 (style checking)
# - pylint (code analysis)
# - mypy (type checking)
# - pytest (tests if they exist)

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
TOOLS_DIR="tools"
TEST_DIR="tests"
MAKEFILE="Makefile.dev"

# Check if we're in a Python project with our development setup
if [[ ! -f "$MAKEFILE" ]] || [[ ! -d "$TOOLS_DIR" ]] || [[ ! -f "pyproject.toml" ]]; then
    # Not a Python project with our dev setup, skip silently
    exit 0
fi

echo -e "${BLUE}🐍 Running Python Code Quality Checks...${NC}"

# Check if virtual environment exists
if [[ ! -L "venv" ]] && [[ ! -d "venv" ]]; then
    echo -e "${YELLOW}⚠️  Virtual environment not found. Skipping Python checks.${NC}"
    exit 0
fi

# Set up temp directory with cleanup trap
WORK_DIR=$(mktemp -d)
trap 'rm -rf "${WORK_DIR:-}"' EXIT INT TERM

VENV_PYTHON="$PROJECT_DIR/venv/bin/python"
VENV_BIN="$PROJECT_DIR/venv/bin"

# Function to run command and show result
run_check() {
    local name="$1"
    local icon="$2"
    shift 2

    echo -e "${BLUE}${icon} ${name}...${NC}"

    if "$@" > "$WORK_DIR/check.log" 2>&1; then
        echo -e "${GREEN}✅ ${name} passed${NC}"
        return 0
    else
        echo -e "${RED}❌ ${name} failed${NC}"
        echo -e "${YELLOW}📋 Output:${NC}"
        cat "$WORK_DIR/check.log"
        return 1
    fi
}

# Track if any checks failed
FAILED=0

# Check if Python files were modified or if we should force run
FORCE_RUN="${FORCE_PYTHON_CHECKS:-false}"
PYTHON_FILES_EXIST=$(find tools/ -name "*.py" 2>/dev/null | wc -l)

if [[ "$FORCE_RUN" == "true" ]] || [[ "$PYTHON_FILES_EXIST" -gt 0 ]] && [[ -d tools/ ]]; then
    echo -e "${BLUE}📝 Python files detected, running quality checks...${NC}"

    # 1. Code Formatting (Black + isort)
    echo -e "\n${BLUE}🎨 Code Formatting${NC}"
    if ! run_check "Black formatting" "🖤" make -f "$MAKEFILE" dev-format; then
        FAILED=1
    fi

    # 2. Style Checking (flake8)
    echo -e "\n${BLUE}📏 Style Checking${NC}"
    if ! run_check "Flake8 style check" "🔍" "$VENV_BIN/flake8" "$TOOLS_DIR/" --config .flake8; then
        FAILED=1
    fi

    # 3. Code Analysis (pylint) - Allow to fail but show results
    echo -e "\n${BLUE}🔬 Code Analysis${NC}"
    echo -e "${BLUE}🧹 Running pylint...${NC}"
    if "$VENV_BIN/pylint" "$TOOLS_DIR/" --rcfile=pyproject.toml > "$WORK_DIR/pylint.log" 2>&1; then
        # Extract score from output
        SCORE=$(grep "Your code has been rated" "$WORK_DIR/pylint.log" | tail -1 || true)
        echo -e "${GREEN}✅ Pylint completed: ${SCORE:-No score found}${NC}"
    else
        SCORE=$(grep "Your code has been rated" "$WORK_DIR/pylint.log" | tail -1 || true)
        echo -e "${YELLOW}⚠️  Pylint completed with warnings: ${SCORE:-No score found}${NC}"
        # Don't fail on pylint warnings, just show them
    fi

    # 4. Type Checking (mypy) - Allow to fail but show results
    echo -e "\n${BLUE}🔧 Type Checking${NC}"
    echo -e "${BLUE}🔍 Running mypy...${NC}"
    if "$VENV_BIN/mypy" "$TOOLS_DIR/" > "$WORK_DIR/mypy.log" 2>&1; then
        echo -e "${GREEN}✅ Mypy type checking passed${NC}"
    else
        ERROR_COUNT=$(grep -c "error:" "$WORK_DIR/mypy.log" 2>/dev/null || true)
        if [[ "${ERROR_COUNT:-0}" -gt 0 ]]; then
            echo -e "${YELLOW}⚠️  Mypy found ${ERROR_COUNT} type issues (non-blocking)${NC}"
            # Show first few errors
            head -10 "$WORK_DIR/mypy.log"
        else
            echo -e "${GREEN}✅ Mypy type checking passed${NC}"
        fi
    fi

    # 5. Tests (if they exist)
    if [[ -d "$TEST_DIR" ]] && find "$TEST_DIR" -name "test_*.py" 2>/dev/null | grep -q .; then
        echo -e "\n${BLUE}🧪 Running Tests${NC}"
        if ! run_check "pytest tests" "🧪" make -f "$MAKEFILE" dev-test; then
            FAILED=1
        fi
    else
        echo -e "\n${YELLOW}📝 No tests found in $TEST_DIR, skipping test run${NC}"
    fi

    # Summary
    echo -e "\n${BLUE}📊 Python Quality Check Summary${NC}"
    if [[ $FAILED -eq 0 ]]; then
        echo -e "${GREEN}✅ All critical checks passed!${NC}"
        echo -e "${GREEN}🎉 Code is ready for commit${NC}"
    else
        echo -e "${RED}❌ Some critical checks failed${NC}"
        echo -e "${YELLOW}🔧 Please fix the issues above before committing${NC}"
        # Don't exit with error - let user decide whether to commit
    fi

else
    echo -e "${BLUE}📝 No recent Python file changes detected, skipping quality checks${NC}"
fi

echo -e "${BLUE}🏁 Python quality checks completed${NC}"
exit 0
