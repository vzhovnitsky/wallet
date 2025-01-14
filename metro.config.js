const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');

const {
  createSentryMetroSerializer
} = require("@sentry/react-native/dist/js/tools/sentryMetroSerializer");

const defaultConfig = getDefaultConfig(__dirname);
const {
  resolver: { sourceExts, assetExts }
} = defaultConfig;


/**
 * Metro configuration
 * https://facebook.github.io/metro/docs/configuration
 *
 * @type {import('metro-config').MetroConfig}
 */
const config = {
  transformer: {
    babelTransformerPath: require.resolve('react-native-svg-transformer')
  },

  resolver: {
    assetExts: assetExts.filter((ext) => ext !== 'svg'),
    sourceExts: [...sourceExts, 'svg'],
    extraNodeModules: {
      stream: require.resolve('stream-browserify'),
    },
  },

  serializer: {
    customSerializer: createSentryMetroSerializer()
  }
};

module.exports = mergeConfig(defaultConfig, config);