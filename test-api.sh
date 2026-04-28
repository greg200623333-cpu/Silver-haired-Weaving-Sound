#!/bin/bash
# ================================================================
# 银发织音 - 自动化测试脚本
# 用于验证所有 API 端点和核心功能
# ================================================================

set -e  # 遇到错误立即退出

API_BASE="https://nrs.greg.asia"
PASSED=0
FAILED=0

# 颜色输出
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "========================================"
echo "  银发织音 - API 自动化测试"
echo "  API Base: $API_BASE"
echo "========================================"
echo ""

# 测试函数
test_api() {
    local name=$1
    local method=$2
    local endpoint=$3
    local data=$4
    local expected=$5

    echo -n "测试: $name ... "

    if [ "$method" = "GET" ]; then
        response=$(curl -s "$API_BASE$endpoint")
    else
        response=$(curl -s -X "$method" "$API_BASE$endpoint" \
            -H "Content-Type: application/json" \
            -d "$data")
    fi

    if echo "$response" | grep -q "$expected"; then
        echo -e "${GREEN}✓ 通过${NC}"
        ((PASSED++))
    else
        echo -e "${RED}✗ 失败${NC}"
        echo "  响应: $response"
        ((FAILED++))
    fi
}

# ================================================================
# 1. 核心 API 测试
# ================================================================
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "1. 核心 API 测试"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

test_api "双模型路由健康检查" "GET" "/api/voice-chat" "" "dual-model-routing"

test_api "双模型路由演示模式" "POST" "/api/voice-chat?demo=true" \
    '{"raw_text":"我今天翻到一张老照片","user_id":"test"}' \
    "reply_text"

test_api "情绪预警端点" "GET" "/api/guardian/alert?guardian_id=test" "" "alerts"

test_api "STT 健康检查" "GET" "/api/stt/transcribe" "" "youdao-stt"

test_api "TTS 健康检查" "GET" "/api/tts/synthesize" "" "youdao-tts"

# ================================================================
# 2. 新增 API 测试（本次修复）
# ================================================================
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "2. 新增 API 测试（架构修复）"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

test_api "微信登录 API（演示模式）" "POST" "/api/auth/wx-login?demo=true" \
    '{"code":"test-code"}' \
    "user_id"

test_api "时间线 API（演示模式）" "GET" "/api/memory/timeline?elder_id=test&demo=true" "" "memories"

test_api "时间线 API（年份筛选）" "GET" "/api/memory/timeline?elder_id=test&year=1962&demo=true" "" "memories"

# ================================================================
# 3. 子女端功能测试
# ================================================================
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "3. 子女端功能测试"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

test_api "记忆处理健康检查" "GET" "/api/memory/process" "" "status"

test_api "PDF 导出健康检查" "GET" "/api/memory/export-pdf" "" "status"

# ================================================================
# 4. 性能测试（SSE 超时优化验证）
# ================================================================
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "4. 性能测试"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

echo -n "测试: SSE 流式对话（30s 超时）... "
start_time=$(date +%s)
response=$(timeout 35 curl -s -X POST "$API_BASE/api/voice-chat/stream" \
    -H "Content-Type: application/json" \
    -d '{"raw_text":"测试","user_id":"test"}' 2>&1 || echo "timeout")
end_time=$(date +%s)
duration=$((end_time - start_time))

if [ "$response" != "timeout" ] && [ $duration -lt 30 ]; then
    echo -e "${GREEN}✓ 通过 (${duration}s)${NC}"
    ((PASSED++))
else
    echo -e "${RED}✗ 失败 (${duration}s)${NC}"
    ((FAILED++))
fi

# ================================================================
# 5. 数据完整性测试
# ================================================================
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "5. 数据完整性测试"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

echo -n "测试: 微信登录返回完整字段 ... "
response=$(curl -s -X POST "$API_BASE/api/auth/wx-login?demo=true" \
    -H "Content-Type: application/json" \
    -d '{"code":"test"}')

if echo "$response" | grep -q "user_id" && \
   echo "$response" | grep -q "session_token" && \
   echo "$response" | grep -q "openid"; then
    echo -e "${GREEN}✓ 通过${NC}"
    ((PASSED++))
else
    echo -e "${RED}✗ 失败${NC}"
    echo "  响应: $response"
    ((FAILED++))
fi

echo -n "测试: 时间线返回完整字段 ... "
response=$(curl -s "$API_BASE/api/memory/timeline?elder_id=test&demo=true")

if echo "$response" | grep -q "memories" && \
   echo "$response" | grep -q "total" && \
   echo "$response" | grep -q "limit"; then
    echo -e "${GREEN}✓ 通过${NC}"
    ((PASSED++))
else
    echo -e "${RED}✗ 失败${NC}"
    echo "  响应: $response"
    ((FAILED++))
fi

# ================================================================
# 6. 错误处理测试
# ================================================================
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "6. 错误处理测试"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

echo -n "测试: 微信登录缺少参数 ... "
response=$(curl -s -X POST "$API_BASE/api/auth/wx-login" \
    -H "Content-Type: application/json" \
    -d '{}')

if echo "$response" | grep -q "error"; then
    echo -e "${GREEN}✓ 通过（正确返回错误）${NC}"
    ((PASSED++))
else
    echo -e "${RED}✗ 失败${NC}"
    ((FAILED++))
fi

echo -n "测试: 时间线缺少 elder_id ... "
response=$(curl -s "$API_BASE/api/memory/timeline")

if echo "$response" | grep -q "error"; then
    echo -e "${GREEN}✓ 通过（正确返回错误）${NC}"
    ((PASSED++))
else
    echo -e "${RED}✗ 失败${NC}"
    ((FAILED++))
fi

# ================================================================
# 测试总结
# ================================================================
echo ""
echo "========================================"
echo "  测试总结"
echo "========================================"
echo -e "通过: ${GREEN}$PASSED${NC}"
echo -e "失败: ${RED}$FAILED${NC}"
echo "总计: $((PASSED + FAILED))"
echo ""

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}✓ 所有测试通过！${NC}"
    exit 0
else
    echo -e "${RED}✗ 有 $FAILED 个测试失败${NC}"
    exit 1
fi
