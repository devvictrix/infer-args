// jest.config.js
/** @type {import('ts-jest').JestConfigWithTsJest} */
export default {
  preset: "ts-jest/presets/default-esm", // Use the ESM preset for ts-jest
  testEnvironment: "node",
  extensionsToTreatAsEsm: [".ts"], // Treat .ts files as ESM
  moduleNameMapper: {
    // Adjust imports to work correctly in ESM context
    // This helps resolve '.js' extensions added during transformation
    "^(\\.{1,2}/.*)\\.js$": "$1",
  },
  transform: {
    // Specify using ts-jest transformer with ESM support enabled
    "^.+\\.ts$": [
      "ts-jest",
      {
        useESM: true, // Enable ESM output from ts-jest
        tsconfig: "tsconfig.json", // Point to your tsconfig
      },
    ],
  },
};
