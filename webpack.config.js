const path = require('path');
const NodePolyfillPlugin = require('node-polyfill-webpack-plugin');

module.exports = {
    entry: './state_machine.js', // Replace with your main entry file
    output: {
        filename: 'txf.min.js',
        path: path.resolve(__dirname, 'dist'),
        library: 'TXF', // The global variable for your library
        libraryTarget: 'umd', // UMD format for browser and Node.js compatibility
        globalObject: 'this', // Ensures compatibility in browser and Node.js
    },
    mode: 'development', // Minifies the output
    module: {
        rules: [
            {
                test: /\.js$/,
                exclude: /node_modules/,
                use: {
                    loader: 'babel-loader',
                    options: {
                        presets: ['@babel/preset-env'],
                    },
                },
            },
        ],
    },
    resolve: {
        fullySpecified: false, // Resolves mixed module types (CommonJS/ESM)
	fallback: {
            buffer: require.resolve('buffer/'),
        },
    },
    target: ['web', 'es5'], // Ensures browser and ES5 compatibility
    plugins: [new NodePolyfillPlugin()],
};
