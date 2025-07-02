module.exports = {
  env: {
    test: {
      presets: [
        ['next/babel'],
        ['@babel/preset-env', { 
          targets: { node: 'current' },
          modules: 'commonjs'
        }],
        ['@babel/preset-react', { runtime: 'automatic' }],
        '@babel/preset-typescript',
      ],
      plugins: [
        '@babel/plugin-transform-runtime',
        '@babel/plugin-transform-private-methods',
        '@babel/plugin-transform-class-properties',
      ],
    },
  },
};