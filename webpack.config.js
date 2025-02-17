const path = require("path");
const webpack = require("webpack");
const NodePolyfillPlugin = require("node-polyfill-webpack-plugin");
const HtmlWebpackPlugin = require("html-webpack-plugin");

module.exports = [
  // Browser Build (txf.min.js)
  {
    entry: "./state_machine.js",
    output: {
      filename: "txf.min.js",
      path: path.resolve(__dirname, "docs"),
      library: "TXF", // The global variable for your library
      libraryTarget: "umd", // UMD format for browser and Node.js compatibility
      globalObject: "this", // Ensures compatibility in browser and Node.js
    },
    mode: "development", // Change to 'production' for minified output
    module: {
      rules: [
        {
          test: /\.js$/,
          exclude: /node_modules/,
          use: {
            loader: "babel-loader",
            options: {
              presets: ["@babel/preset-env"],
            },
          },
        },
      ],
    },
    resolve: {
      fullySpecified: false,
      fallback: {
        buffer: require.resolve("buffer/"),
      },
    },
    target: ["web", "es5"],
    plugins: [
      new NodePolyfillPlugin(),
      new HtmlWebpackPlugin({
        template: "./src/ipts.html",
        inject: "body",
      }),
    ],
  },

  // Node Build (txf.node.js)
 {
  entry: "./state_machine.js",
  output: {
    filename: "txf.node.js",
    path: path.resolve(__dirname, "docs"),
    library: "TXF",
    libraryTarget: "umd",
    globalObject: "this",
  },
  mode: "development",
  module: {
    rules: [
      {
        test: /\.js$/,
        exclude: /node_modules/,
        use: {
          loader: "babel-loader",
          options: {
            presets: ["@babel/preset-env"],
          },
        },
      },
    ],
  },
  resolve: {
    fullySpecified: false,
    fallback: {
      buffer: require.resolve("buffer/"),
    },
  },
  target: ["web", "es5"],  // <-- Ensure this targets Node.js only
  plugins: [
    new NodePolyfillPlugin(),
  ],
 },
];
