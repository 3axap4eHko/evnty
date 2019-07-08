module.exports = {
  verbose: true,
  collectCoverage: !!process.env.TRAVIS || !!process.env.COVERAGE,
  collectCoverageFrom: [
    'src/**/*.js',
  ],
  coveragePathIgnorePatterns: [
    '/node_modules/',
    '__fixtures__',
    '__mocks__',
    '__tests__',
  ],
  coverageDirectory: './coverage',
};
