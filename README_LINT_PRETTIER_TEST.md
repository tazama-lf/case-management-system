# Case Management System

## Linting, Formatting, and Testing

This project uses ESLint, Prettier, and Jest for code quality and testing. Below are the main commands you will use during development:

---

## Linting

### Run Lint

Checks your code for style and type errors using ESLint:

```
npm run lint
```

### Auto-fix Lint Errors

Automatically fixes fixable lint and formatting errors:

```
npm run lint -- --fix
```

---

## Formatting

### Format Code with Prettier


Formats all files in the workspace (including coverage, prisma, etc.) using Prettier:

```
npx prettier --write .
```

Formats only TypeScript files in `src/` and `test/`:

```
npx prettier --write "src/**/*.ts" "test/**/*.ts"
```

---

## Testing

### Run All Tests

Runs all unit and integration tests using Jest:

```
npm test
```

Or, equivalently:

```
npm run test
```

---

## Notes

- Make sure to fix all lint and formatting errors before committing code.
- If you add new dependencies or scripts, update this README accordingly.
- For environment setup, see `.env.template`.

---

## Troubleshooting

- If you see a large number of TypeScript warnings about `any` usage, consider adding proper types to your code.
- If you have issues with Prettier or ESLint, check your configuration files (`eslint.config.mjs`, `.prettierrc`, etc.).

---

## Security

- Never commit your `.env` file or secrets to version control.
- Always review code for security best practices before deploying.
