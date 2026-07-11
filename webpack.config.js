const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');

const isProd = process.env.NODE_ENV === 'production';
const mode = isProd ? 'production' : 'development';
const aliases = {
  '@main': path.resolve(__dirname, 'src/main'),
  '@renderer': path.resolve(__dirname, 'src/renderer'),
  '@shared': path.resolve(__dirname, 'src/shared'),
};

module.exports = [
  // Main process
  {
    mode,
    entry: './src/main/main.ts',
    target: 'electron-main',
    node: {
      __dirname: false,
      __filename: false,
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
      extensions: ['.ts', '.js'],
      alias: aliases,
    },
    output: {
      path: path.resolve(__dirname, 'dist'),
      filename: 'main.js',
    },
    externals: {
      'playwright-core': 'commonjs playwright-core',
    },
  },
  // Preload script
  {
    mode,
    entry: './src/main/preload.ts',
    target: 'electron-preload',
    node: {
      __dirname: false,
      __filename: false,
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
      extensions: ['.ts', '.js'],
      alias: aliases,
    },
    output: {
      path: path.resolve(__dirname, 'dist'),
      filename: 'preload.js',
    },
  },
  // Renderer process
  {
    mode,
    devtool: isProd ? false : 'source-map',
    entry: './src/renderer/index.tsx',
    target: 'web',
    module: {
      rules: [
        {
          test: /\.tsx?$/,
          use: 'ts-loader',
          exclude: /node_modules/,
        },
        {
          test: /\.css$/,
          use: ['style-loader', 'css-loader', 'postcss-loader'],
        },
        {
          test: /\.scss$/,
          use: ['style-loader', 'css-loader', 'postcss-loader', 'sass-loader'],
        },
        {
          test: /\.(png|svg)$/,
          type: 'asset/resource',
        },
      ],
    },
    resolve: {
      extensions: ['.tsx', '.ts', '.js'],
      alias: aliases,
    },
    output: {
      path: path.resolve(__dirname, 'dist'),
      filename: 'renderer.js',
      assetModuleFilename: 'assets/[name].[contenthash][ext]',
    },
    plugins: [
      new HtmlWebpackPlugin({
        template: './src/renderer/index.html',
        filename: 'index.html',
        title: 'GPT-Voice',
      }),
      new HtmlWebpackPlugin({
        template: './src/renderer/index.html',
        filename: 'settings.html',
        title: 'Settings',
      }),
      new HtmlWebpackPlugin({
        template: './src/renderer/index.html',
        filename: 'history.html',
        title: 'History',
      }),
      new HtmlWebpackPlugin({
        template: './src/renderer/index.html',
        filename: 'about.html',
        title: 'About GPT-Voice',
      }),
    ],
  },
];
