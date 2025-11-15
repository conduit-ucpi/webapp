# Contributing to Conduit UCPI Web Application

Thank you for your interest in contributing to the Conduit UCPI web application! This Next.js frontend provides the user interface for trustless escrow transactions.

## Code of Conduct

By participating in this project, you agree to maintain a respectful and collaborative environment for all contributors.

## How to Contribute

### Reporting Bugs

1. Check if the bug has already been reported in [Issues](https://github.com/conduit-ucpi/webapp/issues)
2. If not, create a new issue with:
   - Clear title and description
   - Steps to reproduce
   - Expected vs actual behavior
   - Browser and device information
   - Screenshots or screen recordings if applicable
   - Console errors or network logs

### Suggesting Enhancements

1. Check existing [Issues](https://github.com/conduit-ucpi/webapp/issues) for similar suggestions
2. Create a new issue describing:
   - The enhancement and user benefits
   - Potential implementation approach
   - UI/UX mockups if applicable

### Pull Requests

1. **Fork the repository** and create a new branch from `main`
2. **Make your changes** following our coding standards
3. **Add tests** for new functionality
4. **Run tests**: `npm test`
5. **Type check**: `npm run type-check`
6. **Lint code**: `npm run lint`
7. **Update documentation** if needed
8. **Submit a pull request** with clear description

## Development Workflow

### Setup

```bash
# Clone your fork
git clone https://github.com/conduit-ucpi/webapp.git
cd webapp

# Install dependencies
npm install

# Create .env file
cp .env.example .env.local
# Edit .env.local with your configuration

# Start development server
npm run dev
```

### Testing

```bash
# Run all tests
npm test

# Run specific test file
npm test -- __tests__/path/to/test.tsx

# Run with coverage
npm test -- --coverage

# Watch mode
npm test -- --watch
```

### Before Submitting

- [ ] All tests pass (`npm test`)
- [ ] Type checking passes (`npm run type-check`)
- [ ] Linting passes (`npm run lint`)
- [ ] Code follows TypeScript/React best practices
- [ ] New tests added for new functionality
- [ ] Documentation updated
- [ ] No console errors or warnings
- [ ] Tested on multiple browsers (Chrome, Firefox, Safari)
- [ ] Tested on mobile devices

## Coding Standards

### TypeScript Style Guide

- Use TypeScript for all new code
- Define proper interfaces and types
- Avoid `any` type - use specific types or `unknown`
- Use strict null checks
- Prefer functional components with hooks

### React Best Practices

- Use functional components
- Leverage React hooks appropriately
- Keep components focused and small
- Extract reusable logic into custom hooks
- Use proper key props in lists
- Implement error boundaries

### Wallet Abstraction

**CRITICAL**: Maintain wallet provider abstraction:
- ✅ Use `useWallet()` hook in components
- ✅ All wallet operations through `WalletProvider` interface
- ❌ Never import Web3Auth directly in components
- ❌ Never create provider-specific code paths

See README.md for architecture details.

### Git Commit Messages

- Use present tense ("Add feature" not "Added feature")
- Use imperative mood
- First line: brief summary (50 chars or less)
- Reference issues when relevant

Example:
```
Add MetaMask provider implementation

- Implement MetaMask wallet provider adapter
- Add MetaMask detection and connection logic
- Include comprehensive tests for provider
- Update documentation with MetaMask example

Closes #789
```

## Component Guidelines

### Component Structure

```typescript
// Good component structure
interface MyComponentProps {
  title: string;
  onAction: () => void;
}

export function MyComponent({ title, onAction }: MyComponentProps) {
  // Hooks at the top
  const [state, setState] = useState<string>('');
  const { walletProvider } = useWallet();

  // Event handlers
  const handleClick = () => {
    onAction();
  };

  // Render
  return (
    <div>
      <h1>{title}</h1>
      <button onClick={handleClick}>Action</button>
    </div>
  );
}
```

### Testing Components

```typescript
import { render, screen, fireEvent } from '@testing-library/react';
import { MyComponent } from './MyComponent';

describe('MyComponent', () => {
  it('should render title', () => {
    render(<MyComponent title="Test" onAction={() => {}} />);
    expect(screen.getByText('Test')).toBeInTheDocument();
  });

  it('should call onAction when button clicked', () => {
    const onAction = jest.fn();
    render(<MyComponent title="Test" onAction={onAction} />);

    fireEvent.click(screen.getByText('Action'));
    expect(onAction).toHaveBeenCalled();
  });
});
```

## Architecture Compliance

### Wallet Provider Abstraction

The app uses an abstract wallet provider system. When contributing:

1. **Never bypass the abstraction**: Always use `useWallet()` hook
2. **Provider-agnostic code**: Components shouldn't know which wallet is connected
3. **Test with multiple providers**: Ensure features work with all wallet types
4. **Run architecture tests**: `npm test -- __tests__/architecture/`

### API Routes

- Use Next.js API routes for server-side logic
- Validate all inputs
- Forward auth cookies to backend services
- Handle errors gracefully
- Return consistent response formats

## UI/UX Guidelines

- Follow existing design patterns
- Ensure mobile responsiveness
- Provide loading states for async operations
- Show clear error messages
- Implement proper accessibility (ARIA labels, keyboard navigation)
- Test with screen readers

## Review Process

1. Automated tests must pass
2. Code review by at least one maintainer
3. UI/UX review for frontend changes
4. Cross-browser testing
5. Final approval and merge

## Questions?

Feel free to open an issue with the `question` label or reach out to the maintainers.

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
