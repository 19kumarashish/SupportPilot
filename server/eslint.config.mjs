import clientConfig from "../client/eslint.config.mjs";

export default [
  ...clientConfig,
  {
    files: ["src/**/*.ts"],
    rules: {
      "@next/next/no-assign-module-variable": "off",
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          destructuredArrayIgnorePattern: "^_",
          ignoreRestSiblings: true,
        },
      ],
    },
  },
];
