module.exports = {
  // ... other config
  rules: {
    'no-public-methods-on-actor': 'error'
  },
  plugins: [
    // ... other plugins
  ],
  // Add this section to load custom rules
  overrides: [{
    files: ['**/*.ts', '**/*.tsx'],
    rules: {
      'no-public-methods-on-actor': 'error'
    }
  }],
}; 