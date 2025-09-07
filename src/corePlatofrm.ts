import { createPlatformFactory } from "@sker/di";
import { createPlatformProviders, createMcpProviders } from "./core/providers";
import { McpApplication } from "./core/mcp-application";
import { AppBootstrap } from "./common/app-bootstrap";

export const corePlatform = createPlatformFactory(null, {
    config: {
        name: 'core platform',
    },
    providers: [
        ...createPlatformProviders()
    ],
    extensions: []
})

/**
 * 创建 MCP 服务器应用
 */
export async function createMcpApplication() {
    // 首先创建平台实例
    const platform = corePlatform([]);
    
    // 然后通过平台创建应用
    const applicationRef = await platform.bootstrapApplication([
        ...createMcpProviders()
    ]);
    
    return applicationRef.injector.get(McpApplication);
}

/**
 * 创建 CLI 应用 (使用 AppBootstrap 方式)
 */
export async function createCliApplication() {
    // 首先创建平台实例
    const platform = corePlatform([]);
    
    // 然后通过平台创建应用
    const applicationRef = await platform.bootstrapApplication([
        AppBootstrap,
        ...createMcpProviders() // CLI 也需要 MCP 提供者来使用 ProjectManager 等服务
    ]);
    
    return applicationRef.injector.get(AppBootstrap);
}

/**
 * 统一的应用程序启动和错误处理
 */
export async function runApplication(appFactory: () => Promise<void>): Promise<void> {
    try {
        // 设置全局错误处理器
        AppBootstrap.setupGlobalErrorHandlers();
        
        // 运行应用程序
        await appFactory();
    } catch (error) {
        // 统一的错误处理
        console.error('💥 应用程序执行失败:', (error as Error).message);
        process.exit(1);
    }
}
