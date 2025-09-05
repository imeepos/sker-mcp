import path from 'path';
import os from 'os';

describe('ProjectManager', () => {
  let originalEnv: string | undefined;
  
  beforeEach(() => {
    // Store original environment variable
    originalEnv = process.env.SKER_HOME_DIR;
  });
  
  afterEach(() => {
    // Restore original environment variable
    if (originalEnv !== undefined) {
      process.env.SKER_HOME_DIR = originalEnv;
    } else {
      delete process.env.SKER_HOME_DIR;
    }
  });

  describe('Constructor and Initialization', () => {
    it('should_create_instance_with_default_home_directory', async () => {
      delete process.env.SKER_HOME_DIR;
      
      const { ProjectManager } = await import('../../src/core/project-manager');
      const manager = new ProjectManager();
      
      const expectedPath = path.join(os.homedir(), '.sker');
      expect(manager.getHomeDirectory()).toBe(expectedPath);
    });

    it('should_create_instance_with_custom_home_directory', async () => {
      const customPath = '/custom/sker/path';
      process.env.SKER_HOME_DIR = customPath;
      
      const { ProjectManager } = await import('../../src/core/project-manager');
      const manager = new ProjectManager();
      
      const expectedPath = path.resolve(customPath);
      expect(manager.getHomeDirectory()).toBe(expectedPath);
    });

    it('should_create_instance_with_relative_path', async () => {
      process.env.SKER_HOME_DIR = './test-sker';
      
      const { ProjectManager } = await import('../../src/core/project-manager');
      const manager = new ProjectManager();
      
      const expectedPath = path.resolve('./test-sker');
      expect(manager.getHomeDirectory()).toBe(expectedPath);
    });
  });

  describe('Directory Path Management', () => {
    it('should_return_correct_plugins_directory', async () => {
      const customPath = '/test/sker/home';
      process.env.SKER_HOME_DIR = customPath;
      
      const { ProjectManager } = await import('../../src/core/project-manager');
      const manager = new ProjectManager();
      
      const expectedPluginsPath = path.join(path.resolve(customPath), 'plugins');
      expect(manager.getPluginsDirectory()).toBe(expectedPluginsPath);
    });

    it('should_return_correct_config_directory', async () => {
      const customPath = '/test/sker/home';
      process.env.SKER_HOME_DIR = customPath;
      
      const { ProjectManager } = await import('../../src/core/project-manager');
      const manager = new ProjectManager();
      
      const expectedConfigPath = path.join(path.resolve(customPath), 'config');
      expect(manager.getConfigDirectory()).toBe(expectedConfigPath);
    });

    it('should_return_correct_logs_directory', async () => {
      const customPath = '/test/sker/home';
      process.env.SKER_HOME_DIR = customPath;
      
      const { ProjectManager } = await import('../../src/core/project-manager');
      const manager = new ProjectManager();
      
      const expectedLogsPath = path.join(path.resolve(customPath), 'logs');
      expect(manager.getLogsDirectory()).toBe(expectedLogsPath);
    });
  });

  describe('Path Resolution', () => {
    it('should_resolve_relative_paths_correctly', async () => {
      const { ProjectManager } = await import('../../src/core/project-manager');
      const manager = new ProjectManager();
      
      const relativePath = './some/relative/path';
      const resolved = manager.resolvePath(relativePath);
      
      expect(path.isAbsolute(resolved)).toBe(true);
      expect(resolved).toBe(path.resolve(relativePath));
    });

    it('should_return_absolute_paths_unchanged', async () => {
      const { ProjectManager } = await import('../../src/core/project-manager');
      const manager = new ProjectManager();
      
      const absolutePath = path.join(os.homedir(), 'absolute', 'path');
      const resolved = manager.resolvePath(absolutePath);
      
      expect(resolved).toBe(absolutePath);
    });

    it('should_resolve_paths_relative_to_home_directory', async () => {
      const customPath = '/test/sker/home';
      process.env.SKER_HOME_DIR = customPath;
      
      const { ProjectManager } = await import('../../src/core/project-manager');
      const manager = new ProjectManager();
      
      const relativePath = 'some/sub/path';
      const resolved = manager.resolveFromHome(relativePath);
      
      const expectedPath = path.join(path.resolve(customPath), relativePath);
      expect(resolved).toBe(expectedPath);
    });
  });

  describe('Directory Creation', () => {
    it('should_have_ensureDirectoryExists_method', async () => {
      const { ProjectManager } = await import('../../src/core/project-manager');
      const manager = new ProjectManager();
      
      expect(typeof manager.ensureDirectoryExists).toBe('function');
    });

    it('should_have_createProjectStructure_method', async () => {
      const { ProjectManager } = await import('../../src/core/project-manager');
      const manager = new ProjectManager();
      
      expect(typeof manager.createProjectStructure).toBe('function');
    });
  });

  describe('Plugin Directory Scanning', () => {
    it('should_have_scanPluginsDirectory_method', async () => {
      const { ProjectManager } = await import('../../src/core/project-manager');
      const manager = new ProjectManager();
      
      expect(typeof manager.scanPluginsDirectory).toBe('function');
    });

    it('should_scan_plugins_directory_and_return_array', async () => {
      const { ProjectManager } = await import('../../src/core/project-manager');
      const manager = new ProjectManager();
      
      const pluginDirs = await manager.scanPluginsDirectory();
      expect(Array.isArray(pluginDirs)).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should_handle_invalid_environment_paths_gracefully', async () => {
      process.env.SKER_HOME_DIR = '';
      
      const { ProjectManager } = await import('../../src/core/project-manager');
      
      expect(() => new ProjectManager()).not.toThrow();
    });
  });
});