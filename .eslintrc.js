module.exports = {
    parser: "@typescript-eslint/parser",
    extends: [
        "plugin:@typescript-eslint/recommended"
    ],
    parserOptions: {
        ecmaVersion: 2020,
        sourceType: "module"
    },
    env: {
        es6: true,
        node: true
    },
    rules: {
        "no-var": "error",
        indent: ["error", 4, { SwitchCase: 2 }],
        "no-multi-spaces": "error",
        "space-in-parens": "error",
        "no-multiple-empty-lines": "error",
        "prefer-const": "error",
        '@typescript-eslint/no-explicit-any': "off",
        '@typescript-eslint/explicit-module-boundary-types': "off",
        '@typescript-eslint/no-non-null-assertion': "off",
        '@typescript-eslint/no-var-requires': "off",
        '@typescript-eslint/ban-ts-comment': "off"
    }
};