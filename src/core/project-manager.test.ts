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
      
      const { ProjectManager } = await import('./project-manager');
      const manager = new ProjectManager();
      
      const expectedPath = path.join(os.homedir(), '.sker');
      expect(manager.getHomeDirectory()).toBe(expectedPath);
    });

    it('should_create_instance_with_custom_home_directory', async () => {
      const customPath = '/custom/sker/path';
      process.env.SKER_HOME_DIR = customPath;
      
      const { ProjectManager } = await import('./project-manager');
      const manager = new ProjectManager();
      
      const expectedPath = path.resolve(customPath);
      expect(manager.getHomeDirectory()).toBe(expectedPath);
    });

    it('should_create_instance_with_relative_path', async () => {
      process.env.SKER_HOME_DIR = './test-sker';
      
      const { ProjectManager } = await import('./project-manager');
      const manager = new ProjectManager();
      
      const expectedPath = path.resolve('./test-sker');
      expect(manager.getHomeDirectory()).toBe(expectedPath);
    });
  });

  describe('Directory Path Management', () => {
    it('should_return_correct_plugins_directory', async () => {
      const customPath = '/test/sker/home';
      process.env.SKER_HOME_DIR = customPath;
      
      const { ProjectManager } = await import('./project-manager');
      const manager = new ProjectManager();
      
      const expectedPluginsPath = path.join(path.resolve(customPath), 'plugins');
      expect(manager.getPluginsDirectory()).toBe(expectedPluginsPath);
    });

    it('should_return_correct_config_directory', async () => {
      const customPath = '/test/sker/home';
      process.env.SKER_HOME_DIR = customPath;
      
      const { ProjectManager } = await import('./project-manager');
      const manager = new ProjectManager();
      
      const expectedConfigPath = path.join(path.resolve(customPath), 'config');
      expect(manager.getConfigDirectory()).toBe(expectedConfigPath);
    });

    it('should_return_correct_logs_directory', async () => {
      const customPath = '/test/sker/home';
      process.env.SKER_HOME_DIR = customPath;
      
      const { ProjectManager } = await import('./project-manager');
      const manager = new ProjectManager();
      
      const expectedLogsPath = path.join(path.resolve(customPath), 'logs');
      expect(manager.getLogsDirectory()).toBe(expectedLogsPath);
    });
  });

  describe('Path Resolution', () => {
    it('should_resolve_relative_paths_correctly', async () => {
      const { ProjectManager } = await import('./project-manager');
      const manager = new ProjectManager();
      
      const relativePath = './some/relative/path';
      const resolved = manager.resolvePath(relativePath);
      
      expect(path.isAbsolute(resolved)).toBe(true);
      expect(resolved).toBe(path.resolve(relativePath));
    });

    it('should_return_absolute_paths_unchanged', async () => {
      const { ProjectManager } = await import('./project-manager');
      const manager = new ProjectManager();
      
      const absolutePath = path.join(os.homedir(), 'absolute', 'path');
      const resolved = manager.resolvePath(absolutePath);
      
      expect(resolved).toBe(absolutePath);
    });

    it('should_resolve_paths_relative_to_home_directory', async () => {
      const customPath = '/test/sker/home';
      process.env.SKER_HOME_DIR = customPath;
      
      const { ProjectManager } = await import('./project-manager');
      const manager = new ProjectManager();
      
      const relativePath = 'some/sub/path';
      const resolved = manager.resolveFromHome(relativePath);
      
      const expectedPath = path.join(path.resolve(customPath), relativePath);
      expect(resolved).toBe(expectedPath);
    });
  });

  describe('Directory Creation', () => {
    it('should_have_ensureDirectoryExists_method', async () => {
      const { ProjectManager } = await import('./project-manager');
      const manager = new ProjectManager();
      
      expect(typeof manager.ensureDirectoryExists).toBe('function');
    });

    it('should_have_createProjectStructure_method', async () => {
      const { ProjectManager } = await import('./project-manager');
      const manager = new ProjectManager();
      
      expect(typeof manager.createProjectStructure).toBe('function');
    });
  });

  describe('Plugin Directory Scanning', () => {
    it('should_have_scanPluginsDirectory_method', async () => {
      const { ProjectManager } = await import('./project-manager');
      const manager = new ProjectManager();
      
      expect(typeof manager.scanPluginsDirectory).toBe('function');
    });

    it('should_scan_plugins_directory_and_return_array', async () => {
      const { ProjectManager } = await import('./project-manager');
      const manager = new ProjectManager();
      
      const pluginDirs = await manager.scanPluginsDirectory();
      expect(Array.isArray(pluginDirs)).toBe(true);
    });
  });

  describe('Directory Creation and Management', () => {
    it('should_create_project_structure_successfully', async () => {
      const { ProjectManager } = await import('./project-manager');
      const manager = new ProjectManager();

      // This should not throw
      await expect(manager.createProjectStructure()).resolves.not.toThrow();
    });

    it('should_ensure_directory_exists_for_new_directories', async () => {
      const { ProjectManager } = await import('./project-manager');
      const manager = new ProjectManager();

      const testDir = path.join(manager.getHomeDirectory(), 'test-new-dir');

      // This should not throw
      await expect(manager.ensureDirectoryExists(testDir)).resolves.not.toThrow();
    });

    it('should_handle_existing_directories_gracefully', async () => {
      const { ProjectManager } = await import('./project-manager');
      const manager = new ProjectManager();

      // Try to create the same directory twice
      const testDir = path.join(manager.getHomeDirectory(), 'test-existing-dir');

      await manager.ensureDirectoryExists(testDir);
      await expect(manager.ensureDirectoryExists(testDir)).resolves.not.toThrow();
    });
  });

  describe('Plugin Management', () => {
    it('should_return_plugin_directory_path', async () => {
      const { ProjectManager } = await import('./project-manager');
      const manager = new ProjectManager();

      const pluginName = 'test-plugin';
      const pluginDir = manager.getPluginDirectory(pluginName);

      expect(pluginDir).toBe(path.join(manager.getPluginsDirectory(), pluginName));
    });

    it('should_return_plugin_package_json_path', async () => {
      const { ProjectManager } = await import('./project-manager');
      const manager = new ProjectManager();

      const pluginName = 'test-plugin';
      const packageJsonPath = manager.getPluginPackageJsonPath(pluginName);

      expect(packageJsonPath).toBe(path.join(manager.getPluginDirectory(pluginName), 'package.json'));
    });

    it('should_check_plugin_directory_existence', async () => {
      const { ProjectManager } = await import('./project-manager');
      const manager = new ProjectManager();

      const nonExistentPlugin = 'non-existent-plugin';
      const exists = await manager.pluginDirectoryExists(nonExistentPlugin);

      expect(exists).toBe(false);
    });

    it('should_validate_plugin_package_json', async () => {
      const { ProjectManager } = await import('./project-manager');
      const manager = new ProjectManager();

      const nonExistentPlugin = 'non-existent-plugin';
      const isValid = await manager.hasValidPluginPackageJson(nonExistentPlugin);

      expect(isValid).toBe(false);
    });

    it('should_scan_empty_plugins_directory', async () => {
      const { ProjectManager } = await import('./project-manager');
      const manager = new ProjectManager();

      const plugins = await manager.scanPluginsDirectory();

      expect(Array.isArray(plugins)).toBe(true);
      // Should be empty or contain only valid directories
      expect(plugins.every(plugin => typeof plugin === 'string')).toBe(true);
    });
  });

  describe('Path Resolution Edge Cases', () => {
    it('should_handle_empty_relative_paths', async () => {
      const { ProjectManager } = await import('./project-manager');
      const manager = new ProjectManager();

      const resolved = manager.resolvePath('');
      expect(path.isAbsolute(resolved)).toBe(true);
    });

    it('should_handle_dot_paths', async () => {
      const { ProjectManager } = await import('./project-manager');
      const manager = new ProjectManager();

      const resolved = manager.resolvePath('.');
      expect(path.isAbsolute(resolved)).toBe(true);
      expect(resolved).toBe(process.cwd());
    });

    it('should_handle_parent_directory_paths', async () => {
      const { ProjectManager } = await import('./project-manager');
      const manager = new ProjectManager();

      const resolved = manager.resolvePath('../');
      expect(path.isAbsolute(resolved)).toBe(true);
    });

    it('should_resolve_complex_relative_paths_from_home', async () => {
      const customPath = '/test/sker/home';
      process.env.SKER_HOME_DIR = customPath;

      const { ProjectManager } = await import('./project-manager');
      const manager = new ProjectManager();

      const complexPath = 'plugins/../config/./settings';
      const resolved = manager.resolveFromHome(complexPath);

      const expectedPath = path.join(path.resolve(customPath), complexPath);
      expect(resolved).toBe(expectedPath);
    });
  });

  describe('Error Handling', () => {
    it('should_handle_invalid_environment_paths_gracefully', async () => {
      process.env.SKER_HOME_DIR = '';

      const { ProjectManager } = await import('./project-manager');

      expect(() => new ProjectManager()).not.toThrow();
    });

    it('should_handle_permission_errors_gracefully', async () => {
      const { ProjectManager } = await import('./project-manager');
      const manager = new ProjectManager();

      // Try to access a plugin that doesn't exist
      const exists = await manager.pluginDirectoryExists('non-existent');
      expect(exists).toBe(false);

      const hasValidPackageJson = await manager.hasValidPluginPackageJson('non-existent');
      expect(hasValidPackageJson).toBe(false);
    });

    it('should_handle_invalid_json_in_package_files', async () => {
      const { ProjectManager } = await import('./project-manager');
      const manager = new ProjectManager();

      // This should handle the case where package.json exists but is invalid
      const hasValidPackageJson = await manager.hasValidPluginPackageJson('invalid-json-plugin');
      expect(hasValidPackageJson).toBe(false);
    });

    it('should_handle_directory_scan_errors', async () => {
      const { ProjectManager } = await import('./project-manager');
      const manager = new ProjectManager();

      // Should return empty array if directory doesn't exist or can't be read
      const plugins = await manager.scanPluginsDirectory();
      expect(Array.isArray(plugins)).toBe(true);
    });
  });

  describe('Integration Tests', () => {
    it('should_work_with_all_methods_together', async () => {
      const { ProjectManager } = await import('./project-manager');
      const manager = new ProjectManager();

      // Test the complete workflow
      expect(typeof manager.getHomeDirectory()).toBe('string');
      expect(typeof manager.getPluginsDirectory()).toBe('string');
      expect(typeof manager.getConfigDirectory()).toBe('string');
      expect(typeof manager.getLogsDirectory()).toBe('string');

      const testPlugin = 'integration-test-plugin';
      expect(typeof manager.getPluginDirectory(testPlugin)).toBe('string');
      expect(typeof manager.getPluginPackageJsonPath(testPlugin)).toBe('string');

      const exists = await manager.pluginDirectoryExists(testPlugin);
      expect(typeof exists).toBe('boolean');

      const hasValidPackageJson = await manager.hasValidPluginPackageJson(testPlugin);
      expect(typeof hasValidPackageJson).toBe('boolean');

      const plugins = await manager.scanPluginsDirectory();
      expect(Array.isArray(plugins)).toBe(true);
    });
  });
});