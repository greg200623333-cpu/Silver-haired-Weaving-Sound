import { defineConfig } from '@tarojs/cli';

export default defineConfig({
  projectName: 'silver-hair-weaver',
  framework: 'react',
  compiler: 'webpack5',
  sourceRoot: 'src',
  outputRoot: 'dist',
  plugins: [
    '@tarojs/plugin-framework-react',
    '@tarojs/plugin-platform-weapp',
    '@tarojs/plugin-platform-h5',
  ],
  mini: {
    postcss: {
      pxtransform: {
        enable: true,
      },
    },
  },
  h5: {
    publicPath: '/',
    staticDirectory: 'static',
    postcss: {
      autoprefixer: {
        enable: true,
      },
    },
  },
});
