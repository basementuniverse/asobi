const path = require('path');
const { CleanWebpackPlugin } = require('clean-webpack-plugin');

module.exports = {
  mode: process.env.NODE_ENV || 'development',
  entry: './src/index.ts',
  devtool: 'inline-source-map',
  watchOptions: {
    aggregateTimeout: 500,
    ignored: [
      '**/node_modules',
    ],
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        use: 'ts-loader',
        exclude: /node_modules/,
      },
    ],
  },
  resolve: {
    extensions: ['.tsx', '.ts', '.js'],
  },
  output: {
    libraryTarget: 'umd',
    publicPath: '/build/',
    filename: 'client.js',
    path: path.resolve(__dirname, 'build'),
  },
  performance: {
    hints: false,
    maxEntrypointSize: 512000,
    maxAssetSize: 512000,
  },
  externals: [],
  plugins: [
    new CleanWebpackPlugin(),
  ],
};
