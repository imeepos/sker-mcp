import { defineConfig } from 'tsup';

export default defineConfig({
  // 入口文件
  entry: ['src/index.ts', 'src/main.ts'],
  
  // 输出格式
  format: ['cjs', 'esm'],
  
  // 输出目录
  outDir: 'dist',
  
  // 生成类型声明文件
  dts: true,
  
  // 清理输出目录
  clean: true,
  
  // 代码分割
  splitting: false,
  
  // 生成 sourcemap
  sourcemap: true,
  
  // 压缩代码
  minify: false,
  
  // 目标环境
  target: 'node14',
  
  // 外部依赖（不打包进 bundle）
  external: ['reflect-metadata'],
  
  // 保持文件名
  keepNames: true,
  
  // 输出文件名格式
  outExtension({ format }) {
    return {
      js: format === 'cjs' ? '.cjs' : '.mjs'
    };
  }
});