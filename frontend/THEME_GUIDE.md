# Tazama CMS Theme System

This document describes the comprehensive theme system implemented for the Tazama Case Management System frontend.

## Overview

The theme system provides:
- **Consistent Design Language**: Unified color palette, typography, and component styling
- **Dark/Light Mode Support**: Automatic system preference detection with manual override
- **Financial Crime Domain-Specific**: Purpose-built for case management workflows
- **Accessibility**: WCAG compliant color contrasts and focus management
- **Developer Experience**: Type-safe utilities and reusable component classes

## Architecture

### Core Files

```
src/
├── constants/
│   ├── theme.ts          # Theme configuration and constants
│   └── index.ts          # Exported constants and enums
├── hooks/
│   └── useTheme.ts       # Theme context and hooks
├── utils/
│   └── styles.ts         # CSS class generation utilities
└── components/
    └── ThemeShowcase.tsx # Theme demonstration component
```

### Configuration Files

- `tailwind.config.js` - Main Tailwind configuration with custom theme
- `src/index.css` - Global styles and Tailwind imports

## Usage

### 1. Theme Provider Setup

Wrap your app with the `ThemeProvider`:

```tsx
import { ThemeProvider } from './hooks/useTheme';

function App() {
  return (
    <ThemeProvider defaultTheme="system">
      {/* Your app content */}
    </ThemeProvider>
  );
}
```

### 2. Using Theme Hooks

```tsx
import { useTheme, useThemeColors } from './hooks/useTheme';

function MyComponent() {
  const { mode, isDark, toggleTheme } = useTheme();
  const { getBgColor, getTextColor } = useThemeColors();

  return (
    <div className={`${getBgColor()} ${getTextColor()}`}>
      <button onClick={toggleTheme}>
        Switch to {isDark ? 'light' : 'dark'} mode
      </button>
    </div>
  );
}
```

### 3. Using Style Utilities

```tsx
import { getPriorityClasses, getButtonClasses, cn } from './utils/styles';

function AlertCard({ priority, status }) {
  const priorityClasses = getPriorityClasses(priority);
  
  return (
    <div className="card">
      <div className={priorityClasses.badge}>
        <div className={priorityClasses.dot} />
        {priority}
      </div>
      <button className={getButtonClasses('primary', 'md')}>
        Take Action
      </button>
    </div>
  );
}
```

## Color System

### Primary Palette
- **Primary Blue**: #2563eb (brand color for primary actions)
- **Secondary Gray**: #475569 (neutral actions and text)
- **Success Green**: #16a34a (completed cases, positive actions)
- **Warning Amber**: #d97706 (pending alerts, caution states)
- **Danger Red**: #dc2626 (critical alerts, destructive actions)

### Domain-Specific Colors
- **Priority Levels**: Low (green), Medium (amber), High (orange), Critical (red + pulse)
- **Case Statuses**: Color-coded based on workflow state
- **Alert Types**: Distinct colors for fraud vs. AML alerts

## Component System

### Buttons
```tsx
// Available variants: primary, secondary, outline, ghost, danger
// Available sizes: sm, md, lg
<button className={getButtonClasses('primary', 'md')}>
  Primary Action
</button>
```

### Form Inputs
```tsx
// Available variants: default, error, success
// Available sizes: sm, md, lg
<input className={getInputClasses('default', 'md')} />
```

### Cards
```tsx
// Available variants: default, elevated, outlined
// Available padding: sm, md, lg
<div className={getCardClasses('default', 'md')}>
  Card content
</div>
```

### Status Badges
```tsx
// For alerts or cases
const statusClasses = getStatusClasses('alert', 'pending');
<span className={statusClasses.badge}>Pending</span>
```

### Priority Indicators
```tsx
const priorityClasses = getPriorityClasses('high');
<div className={priorityClasses.badge}>
  <div className={priorityClasses.dot} />
  High Priority
</div>
```

## Layout System

### Responsive Grid
```tsx
// Responsive columns
<div className={getGridClasses({ sm: 1, md: 2, lg: 3, xl: 4 })}>
  {items.map(item => <Card key={item.id} />)}
</div>
```

### Sidebar Layout
```tsx
import { useSidebar } from './hooks/useTheme';

function Layout() {
  const { isCollapsed, toggleSidebar, sidebarWidth } = useSidebar();
  
  return (
    <div className="flex">
      <aside 
        className={getSidebarClasses(isCollapsed, false)}
        style={{ width: sidebarWidth }}
      >
        {/* Sidebar content */}
      </aside>
      <main className="flex-1">
        {/* Main content */}
      </main>
    </div>
  );
}
```

## Dark Mode

### Automatic Detection
The theme system automatically detects the user's system preference and applies the appropriate theme.

### Manual Control
Users can override the system preference:
- Light mode
- Dark mode  
- System preference (default)

### CSS Variables
The system uses CSS custom properties for dynamic theming:

```css
:root {
  --color-bg-primary: #ffffff;
  --color-text-primary: #111827;
}

.dark {
  --color-bg-primary: #111827;
  --color-text-primary: #f9fafb;
}
```

## Accessibility

### Color Contrast
All color combinations meet WCAG AA standards:
- Text: minimum 4.5:1 contrast ratio
- Large text: minimum 3:1 contrast ratio
- UI components: minimum 3:1 contrast ratio

### Focus Management
- Visible focus indicators on all interactive elements
- Consistent focus ring styling using `getFocusClasses()`
- Keyboard navigation support

### Screen Reader Support
- Semantic HTML structure
- Proper ARIA labels and roles
- High contrast mode support

## Customization

### Adding New Colors
1. Update `tailwind.config.js` with new color scales
2. Add corresponding CSS variables in `src/index.css`
3. Update theme constants in `src/constants/theme.ts`

### Creating New Component Variants
1. Add utility function in `src/utils/styles.ts`
2. Define variants in theme configuration
3. Export types for TypeScript support

### Extending Animations
1. Add keyframes in `tailwind.config.js`
2. Reference in component classes
3. Consider reduced motion preferences

## Performance

### CSS Optimization
- Purged unused styles in production
- Minimal runtime CSS-in-JS
- Efficient Tailwind class generation

### Bundle Size
- Tree-shakeable utility functions
- Conditional imports for theme features
- Optimized font loading

## Best Practices

### Class Naming
```tsx
// ✅ Good: Use semantic utility functions
const classes = getButtonClasses('primary', 'md');

// ❌ Avoid: Hardcoded Tailwind classes
const classes = 'bg-blue-600 text-white px-4 py-2 rounded-md';
```

### Component Composition
```tsx
// ✅ Good: Composable utilities
<div className={cn(
  getCardClasses('default'),
  'hover:shadow-lg',
  isSelected && 'ring-2 ring-primary-500'
)}>
```

### Theme Consistency
- Always use theme colors instead of arbitrary values
- Follow established spacing scale
- Maintain consistent border radius and shadows

### Responsive Design
- Mobile-first approach
- Use responsive utilities
- Test across all breakpoints

## Testing

### Visual Regression
- Component screenshots in both light and dark modes
- Cross-browser compatibility testing
- Mobile device testing

### Accessibility Testing
- Screen reader testing
- Keyboard navigation testing
- Color contrast validation

## Migration Guide

### From Default Styles
1. Replace hardcoded colors with theme utilities
2. Update component classes to use design system
3. Implement theme provider in app root
4. Test all components in both light and dark modes

### Adding to Existing Components
1. Import required utilities
2. Replace inline styles with utility classes
3. Add theme-aware conditional styling
4. Test accessibility compliance

## Browser Support

- **Modern browsers**: Full support (Chrome 90+, Firefox 88+, Safari 14+)
- **Legacy browsers**: Graceful degradation (IE 11 basic support)
- **CSS Grid**: Used for complex layouts with flexbox fallbacks
- **CSS Custom Properties**: Used extensively (with fallbacks)

## Resources

- [Tailwind CSS Documentation](https://tailwindcss.com/docs)
- [WCAG Color Contrast Guidelines](https://www.w3.org/WAI/WCAG21/Understanding/contrast-minimum.html)
- [Design System Best Practices](https://designsystemsrepo.com/design-systems/)
- [Accessibility Guidelines](https://webaim.org/)
