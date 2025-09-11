# Tazama Case Management System - Frontend

Modern React frontend application for the Tazama Case Management System, built with TypeScript, Vite, and Tailwind CSS.

## Quick Start

### Prerequisites

- Node.js 18+
- npm 9+

### Installation & Development

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Application will be available at http://localhost:5173
```

## Architecture

### Tech Stack

- **React 19** - Modern UI framework with concurrent features
- **TypeScript** - Type safety and enhanced developer experience
- **Vite** - Fast build tool and development server
- **Tailwind CSS** - Utility-first CSS framework
- **TanStack Query** - Powerful server state management
- **React Router DOM** - Client-side routing
- **React Hot Toast** - Elegant notifications
- **Heroicons** - Beautiful SVG icons

### Project Structure

```
frontend/
├── src/
│   ├── features/           # Feature-based modules
│   │   ├── alerts/         # Alert management
│   │   ├── cases/          # Case management
│   │   ├── auth/           # Authentication
│   │   └── comments/       # Comment system
│   ├── shared/             # Shared utilities and components
│   │   ├── components/     # Reusable UI components
│   │   ├── hooks/          # Custom React hooks
│   │   ├── providers/      # Context providers
│   │   └── services/       # API services
│   ├── router/             # Route configurations
│   └── test/               # Test utilities and setup
├── public/                 # Static assets
└── src/test/               # Test configurations
```

## Testing Strategy

### Test Coverage

- **Unit Tests**: Hook functionality, component behavior
- **Integration Tests**: Provider interactions, API mocking
- **Accessibility Tests**: Keyboard navigation, screen readers
- **Performance Tests**: Virtual scrolling, large datasets

### Running Tests

```bash
# Watch mode - recommended for development
npm run test

# Single run - for CI/CD
npm run test:run

# Visual test UI - interactive test interface
npm run test:ui

# Coverage report - generates detailed coverage analysis
npm run test:coverage

# Watch mode with specific pattern
npm run test:watch
```

### Test Utilities

The project includes comprehensive test utilities:

- **Mock Providers**: Pre-configured providers for testing
- **Test Data**: Realistic test data generators
- **Custom Matchers**: Domain-specific test assertions
- **API Mocking**: MSW (Mock Service Worker) setup

## Key Features

### Alert Management

- **Real-time Dashboard**: Live updates of incoming alerts
- **Advanced Filtering**: Source, priority, time range, and custom filters
- **Risk Analysis**: Detailed risk scoring and breakdown
- **Manual Triage**: Human-in-the-loop decision making
- **Bulk Operations**: Efficient handling of multiple alerts

### Case Investigation

- **Case Creation**: Convert alerts to investigation cases
- **Workflow Management**: Track investigation progress
- **Document Management**: Attach evidence and documentation
- **Collaboration**: Team-based investigation tools
- **Timeline View**: Chronological case progression

### User Experience

- **Responsive Design**: Mobile-first, works on all devices
- **Keyboard Navigation**: Full accessibility support
- **Progressive Loading**: Smooth data loading states

## Development

### Available Scripts

```bash
# Development
npm run dev              # Start development server with hot reload
npm run build            # Build for production
npm run preview          # Preview production build locally

# Code Quality
npm run lint             # Check linting issues
npm run type-check       # TypeScript type checking

# Testing
npm run test             # Interactive test runner
npm run test:run         # Single test run
npm run test:ui          # Visual test interface
npm run test:coverage    # Generate coverage reports
```

### Environment Configuration

Create a `.env` file based on `.env.example`:

```bash
# API Configuration
VITE_API_BASE_URL=http://localhost:3000
VITE_APP_NAME=Tazama Case Management System
VITE_APP_VERSION=0.0.1

# Feature Flags (optional)
VITE_ENABLE_ANALYTICS=false
VITE_ENABLE_DEBUG=true
```

### Code Style

The project follows these conventions:

- **TypeScript Strict Mode**: Enhanced type safety
- **ESLint Configuration**: Automated code quality checks
- **Prettier Integration**: Consistent code formatting
- **Import Organization**: Structured import statements
- **Component Patterns**: Consistent React patterns

## Styling

### Tailwind CSS

The project uses Tailwind CSS v4 for styling:

- **Utility-First**: Rapid UI development
- **Design System**: Consistent spacing, colors, and typography
- **Responsive Design**: Mobile-first approach
- **Dark Mode**: Built-in theme support
- **Custom Components**: Reusable component library

### Component Library

Shared components include:

- **Forms**: Input fields, selectors, validation
- **Navigation**: Breadcrumbs, pagination, menus
- **Data Display**: Tables, cards, lists
- **Feedback**: Loading states, error boundaries, notifications
- **Layout**: Containers, grids, responsive layouts

## API Integration

### TanStack Query

Server state management with:

- **Caching**: Intelligent data caching
- **Background Updates**: Automatic data synchronization
- **Optimistic Updates**: Instant UI feedback
- **Error Handling**: Comprehensive error management
- **Pagination**: Efficient data loading

### API Services

Structured API layer:

```typescript
// Example service structure
class TriageService {
  async getAlerts(filters: AlertsFilter): Promise<AlertsResponse>
  async getAlertById(id: string): Promise<Alert>
  async performManualTriage(data: ManualTriageDto): Promise<void>
}
```

### Error Handling

- **Global Error Boundary**: Catches unexpected errors
- **API Error Handling**: Structured error responses
- **Validation Errors**: Real-time form validation
- **Network Errors**: Offline/connectivity handling

## Performance

### Optimization Strategies

- **Code Splitting**: Lazy-loaded route components
- **Virtual Scrolling**: Efficient large dataset rendering
- **Memoization**: Optimized re-rendering
- **Image Optimization**: Responsive images with lazy loading
- **Bundle Analysis**: Regular bundle size monitoring

### Performance Monitoring

- **Core Web Vitals**: Performance metrics tracking
- **Error Monitoring**: Real-time error reporting
- **User Analytics**: Usage pattern analysis

## Accessibility

### Standards Compliance

- **WCAG 2.1 AA**: Accessibility guidelines compliance
- **Keyboard Navigation**: Full keyboard support
- **Screen Readers**: Semantic HTML and ARIA labels
- **Color Contrast**: High contrast ratios
- **Focus Management**: Logical tab order

### Testing

- **Automated Testing**: axe-core integration
- **Manual Testing**: Keyboard and screen reader testing
- **User Testing**: Regular accessibility audits

## Deployment

### Build Process

```bash
# Production build
npm run build

# Build outputs to dist/ directory
# Optimized for modern browsers
# Tree-shaken and minified
```

### Deployment Targets

- **Static Hosting**: Netlify, Vercel, GitHub Pages
- **CDN Distribution**: CloudFront, CloudFlare
- **Container Deployment**: Docker with nginx
- **Traditional Hosting**: Apache, nginx

### Environment Variables

Production environment setup:

```bash
VITE_API_BASE_URL=https://api.yourdomain.com
VITE_APP_NAME=Tazama Case Management System
VITE_APP_VERSION=1.0.0
VITE_ENABLE_ANALYTICS=true
```

## Contributing

### Development Workflow

1. **Feature Development**: Create feature branches
2. **Code Review**: Pull request process
3. **Testing**: Comprehensive test coverage
4. **Documentation**: Update relevant documentation

### Guidelines

- **TypeScript**: Strict typing for all code
- **Testing**: Write tests for new features
- **Accessibility**: Ensure accessible implementations
- **Performance**: Consider performance impact
- **Documentation**: Keep documentation updated

### Git Hooks

The project includes pre-commit hooks:

- **Linting**: ESLint checks
- **Type Checking**: TypeScript validation
- **Testing**: Run affected tests
- **Formatting**: Prettier formatting

## Resources

### Documentation

- [React Documentation](https://react.dev/)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [Tailwind CSS Docs](https://tailwindcss.com/docs)
- [TanStack Query Docs](https://tanstack.com/query/latest)
- [Vite Guide](https://vitejs.dev/guide/)

### Development Tools

- **VS Code Extensions**: Recommended extensions list
- **Browser DevTools**: React and Redux DevTools
- **Design Tools**: Figma integration
- **API Tools**: Postman collections