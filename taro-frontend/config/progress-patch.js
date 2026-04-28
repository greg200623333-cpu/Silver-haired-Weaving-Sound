// 修复 webpack ProgressPlugin schema 与 Taro webpack5-runner 不兼容
// Taro 传旧格式 { name, color, reporters } → 转为新格式 { percentBy, handler }
const ProgressPlugin = require('webpack/lib/ProgressPlugin');
const origApply = ProgressPlugin.prototype.apply;

ProgressPlugin.prototype.apply = function (compiler) {
  // 兼容旧格式：将 { name, color, reporters } 转为 handler 函数
  if (this.options && this.options.reporters && !this.handler) {
    const _this = this;
    const handlerFn = function (percentage, msg) {
      // no-op: 静默跳过，不打印进度
    };
    this.handler = handlerFn;
    delete this.options.name;
    delete this.options.color;
    delete this.options.reporters;
    delete this.options.reporter;
    delete this.options.basic;
    delete this.options.fancy;
  }
  return origApply.call(this, compiler);
};
