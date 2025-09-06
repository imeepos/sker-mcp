/**
 * Tsup 构建配置
 * 
 * 为 Sker Daemon MCP 服务器提供优化的构建配置，支持：
 * - 多种输出格式（CJS、ESM）
 * - TypeScript 类型声明生成
 * - 多入口点构建
 * - 生产和开发环境优化
 */

import { defineConfig } from 'tsup';
import { readFileSync } from 'fs';
import path from 'path';

// 读取 package.json 获取版本信息
const packageJson = JSON.parse(
  readFileSync(path.resolve('./package.json'), 'utf-8')
);

export default defineConfig((options) => {
  const isDev = !!options.watch;
  const isProd = !isDev;

  return {
    name: 'sker-mcp',
    entry: {
      // 主入口点
      index: 'src/index.ts',
      // CLI 入口
      cli: 'src/cli.ts',
      // 主程序入口
      main: 'src/main.ts'
    },
    format: ['cjs', 'esm'],
    outDir: 'dist',
    dts: true,
    clean: !isDev,
    sourcemap: true,
    minify: isProd,
    splitting: true,
    treeshake: isProd,
    keepNames: true,
    target: 'node18',
    platform: 'node',
    external: [
      '@modelcontextprotocol/sdk',
      '@sker/di',
      'winston',
      'winston-daily-rotate-file',
      'express',
      'reflect-metadata',
      'zod'
    ],
    define: {
      __VERSION__: JSON.stringify(packageJson.version),
      __DEV__: JSON.stringify(isDev)
    },
    banner: {
      js: `/**
 * Sker Daemon MCP Server v${packageJson.version}
 * Built with tsup
 */`
    },
    esbuildOptions(options) {
      options.packages = 'external';
      options.mainFields = ['module', 'main'];
      options.conditions = ['import', 'require'];
    },
    async onSuccess() {
      // 设置可执行权限（在类Unix系统中）
      if (process.platform !== 'win32') {
        const { execSync } = require('child_process');
        try {
          execSync('chmod +x dist/cli.js dist/main.js', { stdio: 'ignore' });
        } catch {
          // 忽略权限设置错误
        }
      }
    }
  };
});