const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const webpack = require('webpack');

const isProd = process.env.NODE_ENV === 'production';
const mode = isProd ? 'production' : 'development';

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
    },
    output: {
      path: path.resolve(__dirname, 'dist'),
      filename: 'main.js',
    },
    externals: {
      'playwright': 'commonjs playwright',
      'playwright-extra': 'commonjs playwright-extra',
      'puppeteer-extra-plugin-stealth': 'commonjs puppeteer-extra-plugin-stealth',
    },
    plugins: [
      new webpack.DefinePlugin({
        'process.env.NODE_ENV': JSON.stringify(mode),
      }),
    ],
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
          test: /\.s?css$/,
          use: ['style-loader', 'css-loader', 'sass-loader'],
        },
      ],
    },
    resolve: {
      extensions: ['.tsx', '.ts', '.js'],
    },
    output: {
      path: path.resolve(__dirname, 'dist'),
      filename: 'renderer.js',
    },
    plugins: [
      new HtmlWebpackPlugin({
        template: './src/renderer/index.html',
      }),
    ],
  },
];
