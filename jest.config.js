module.exports = {
  verbose: true,
  collectCoverage: !!process.env.CI || !!process.env.COVERAGE,
  preset: 'ts-jest',
  collectCoverageFrom: ['src/**/*.ts'],
  coveragePathIgnorePatterns: ['/node_modules/', '__fixtures__', '__mocks__', '__tests__'],
  coverageDirectory: './coverage',
};
