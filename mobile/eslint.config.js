const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  ...expoConfig,
  {
    ignores: ['dist-ios/**', 'dist-android/**', '.expo/**', 'src/almostHumanHtml.ts'],
  },
]);
