const path = require('node:path');
const CssMinimizerPlugin = require('css-minimizer-webpack-plugin');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');

const isProd = process.env.NODE_ENV === 'production';
const mode = isProd ? 'production' : 'development';
const styleLoader = isProd ? MiniCssExtractPlugin.loader : 'style-loader';
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
    entry: {
      about: './src/renderer/entries/about.tsx',
      history: './src/renderer/entries/history.tsx',
      main: './src/renderer/entries/main.tsx',
      providerSettings: './src/renderer/entries/providerSettings.tsx',
      settings: './src/renderer/entries/settings.tsx',
    },
    target: 'web',
    module: {
      rules: [
        {
          test: /\.tsx?$/,
          use: {
            loader: 'ts-loader',
            options: {
              configFile: path.resolve(__dirname, 'tsconfig.renderer.json'),
            },
          },
          exclude: /node_modules/,
        },
        {
          test: /\.css$/,
          use: [styleLoader, 'css-loader', 'postcss-loader'],
        },
        {
          test: /\.scss$/,
          use: [styleLoader, 'css-loader', 'postcss-loader', 'sass-loader'],
        },
        {
          test: /\.worklet\.js$/,
          type: 'asset/resource',
          generator: {
            filename: 'renderer/assets/[name][ext]',
          },
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
      filename: 'renderer/[name].js',
      chunkFilename: 'renderer/[id].js',
      assetModuleFilename: 'renderer/assets/[name].[contenthash][ext]',
    },
    optimization: {
      ...(isProd
        ? {
            minimizer: ['...', new CssMinimizerPlugin()],
          }
        : {}),
      runtimeChunk: 'single',
      splitChunks: {
        chunks: 'all',
      },
    },
    plugins: [
      ...(isProd
        ? [
            new MiniCssExtractPlugin({
              filename: 'renderer/[name].[contenthash].css',
              chunkFilename: 'renderer/[id].[contenthash].css',
            }),
          ]
        : []),
      new HtmlWebpackPlugin({
        template: './src/renderer/index.html',
        filename: 'index.html',
        title: 'GPT-Voice',
        chunks: ['main'],
      }),
      new HtmlWebpackPlugin({
        template: './src/renderer/index.html',
        filename: 'provider-settings.html',
        title: 'Provider settings',
        chunks: ['providerSettings'],
      }),
      new HtmlWebpackPlugin({
        template: './src/renderer/index.html',
        filename: 'settings.html',
        title: 'Settings',
        chunks: ['settings'],
      }),
      new HtmlWebpackPlugin({
        template: './src/renderer/index.html',
        filename: 'history.html',
        title: 'History',
        chunks: ['history'],
      }),
      new HtmlWebpackPlugin({
        template: './src/renderer/index.html',
        filename: 'about.html',
        title: 'About GPT-Voice',
        chunks: ['about'],
      }),
    ],
  },
];
