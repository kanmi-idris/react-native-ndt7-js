const path = require('path');
const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');

const projectRoot = __dirname;
const libraryRoot = path.resolve(__dirname, '..');

const config = {
  watchFolders: [libraryRoot],
  resolver: {
    nodeModulesPaths: [
      path.resolve(projectRoot, 'node_modules'),
      path.resolve(libraryRoot, 'node_modules'),
    ],
    extraNodeModules: {
      '@_molaidrislabs/react-native-internet-speed-test': libraryRoot,
    },
  },
};

module.exports = mergeConfig(getDefaultConfig(projectRoot), config);
