#!/bin/bash

# 同步推送到 GitHub 和 Gitee
# 使用方法: bash push-all.sh

echo "📤 正在推送到 Gitee..."
git push origin main

if [ $? -eq 0 ]; then
    echo "✅ Gitee 推送成功"
else
    echo "❌ Gitee 推送失败"
    exit 1
fi

echo ""
echo "📤 正在推送到 GitHub..."
git push github main

if [ $? -eq 0 ]; then
    echo "✅ GitHub 推送成功"
else
    echo "❌ GitHub 推送失败"
    exit 1
fi

echo ""
echo "🎉 所有远程仓库已同步更新！"
