const path = require('path');

module.exports = {
    entry: './state_machine.js', // Path to your main file exposing the API functions
    output: {
        filename: 'txf.min.js',
        path: path.resolve(__dirname, 'dist'),
        library: 'TXF', // The global variable name for your API in the browser
        libraryTarget: 'umd', // Universal Module Definition for compatibility
    },
    mode: 'production', // Minifies the output
    target: 'web', // Ensures compatibility with browser environment
};
