const fs = require('fs');
const path = require('path');

const target = path.join(__dirname, 'node_modules', 'webpack', 'lib', 'ProgressPlugin.js');
const backup = target + '.orig';

if (!fs.existsSync(backup)) {
  fs.copyFileSync(target, backup);
}

// 保留原始类（webpackbar 需要 extends），仅 patch apply 方法兼容旧 options
fs.writeFileSync(target, `
var OrigPlugin = require('${backup.replace(/\\/g, '\\\\')}');

var origApply = OrigPlugin.prototype.apply;
OrigPlugin.prototype.apply = function(compiler) {
  if (this.options && typeof this.options === 'object' && !this.handler) {
    this.handler = function() {};
    if (this.options.name) delete this.options.name;
    if (this.options.color) delete this.options.color;
    if (this.options.reporters) delete this.options.reporters;
    if (this.options.reporter) delete this.options.reporter;
    if (this.options.basic) delete this.options.basic;
    if (this.options.fancy) delete this.options.fancy;
  }
  return origApply.call(this, compiler);
};

module.exports = OrigPlugin;
`);
console.log('ProgressPlugin patched OK');
