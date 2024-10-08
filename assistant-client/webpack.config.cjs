const path = require('path');

module.exports = {
  entry: './src/PaccarAssistant.tsx', // your entry point
  output: {
    filename: 'paccarassistant.js',
    path: path.resolve(__dirname, 'dist'),
    library: 'PaccarAssistant',  // Expose your library globally
    libraryTarget: 'umd', // Make it usable in different environments (CommonJS, AMD, browser)
  },
  module: {
    rules: [
      {
        test: /\.tsx?$/,  // Handle .ts/.tsx files
        use: 'ts-loader',
        exclude: /node_modules/,
      },
      {
        test: /\.jsx?$/,  // Handle .js/.jsx files
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader',
        },
      },
      {
        test: /\.css$/,  // Handle .css files
        use: ['style-loader', 'css-loader','postcss-loader'],
        exclude: /node_modules/,
      },
      {
        test: /\.svg$/,  // Handle .svg files
        use: [
          {
            loader: '@svgr/webpack',
            options: {
              svgo: false, // Disable SVGO optimization if needed
            },
          },
          'file-loader', // Fallback to file-loader for other cases
        ],
        exclude: /node_modules/,
      }
    ]
  },
  resolve: {
    extensions: ['.tsx', '.ts', '.js'],  // File extensions handled
  },
  mode: 'production',  // Minifies the output
  // mode: 'development',  
  externals: {
    // react: 'React', // This will avoid bundling React separately
    // 'react-dom': 'ReactDOM',
  }
};
