# Tazama Case Management System - Theme Documentation

## Overview

The Tazama Case Management System features a comprehensive custom theme system designed specifically for financial crime investigation workflows. The theme system provides a consistent design language across the entire application with full dark/light mode support.

## Theme Features

### 🎨 Design System
- **Custom CSS Variables**: Complete design token system with CSS custom properties
- **Dark/Light Mode**: Automatic system preference detection with manual override
- **Responsive Design**: Mobile-first approach with responsive breakpoints
- **Financial Crime Focus**: Specialized color schemes for alerts, cases, and priority levels

### 🛠️ Technical Implementation
- **No Tailwind Dependencies**: Pure CSS implementation for maximum control
- **CSS Variables**: Dynamic theming using CSS custom properties
- **Component Classes**: Pre-built components for buttons, forms, cards, and badges
- **TypeScript Support**: Full type safety for theme-related functionality

## File Structure

```
frontend/src/
├── index.css                     # Main theme CSS file
├── constants/
│   └── theme.ts                  # Theme configuration constants
├── hooks/
│   ├── useTheme.tsx             # Main theme hook export
│   ├── useThemeProvider.tsx     # Theme provider implementation
│   ├── useThemeHooks.ts         # Core theme functionality
│   └── useLayout.ts             # Layout and responsive utilities
├── utils/
│   └── styles.ts                # Style utility functions
└── components/
    └── ThemeShowcase.tsx        # Theme demonstration component
```

## Color System

### Primary Colors
- **Primary**: Blue-based color scheme for main actions
- **Success**: Green for positive states and completed actions
- **Warning**: Orange for attention-requiring states
- **Error**: Red for critical issues and alerts

### Semantic Colors
```css
:root {
  --color-primary-600: 37 99 235;    /* Main brand color */
  --color-success: 34 197 94;        /* Success states */
  --color-warning: 251 146 60;       /* Warning states */
  --color-error: 239 68 68;          /* Error states */
  --color-info: 59 130 246;          /* Information */
}
```

### Financial Crime Specific Colors
- **High Priority**: Red-based for critical alerts
- **Medium Priority**: Orange-based for moderate alerts
- **Low Priority**: Green-based for minor alerts
- **Case Status**: Blue-based for case states

## Component Classes

### Buttons
```css
.btn .btn-primary .btn-sm         /* Primary small button */
.btn .btn-secondary .btn-md       /* Secondary medium button */
.btn .btn-danger .btn-lg          /* Danger large button */
```

### Cards
```css
.card                             /* Basic card component */
.card-header                      /* Card header section */
.card-title                       /* Card title styling */
.card-description                 /* Card description text */
```

### Forms
```css
.form-field                       /* Form field container */
.form-label                       /* Form label styling */
.form-input                       /* Input field styling */
.form-textarea                    /* Textarea styling */
.form-select                      /* Select dropdown styling */
```

### Status Badges
```css
.badge .badge-high                /* High priority badge */
.badge .badge-medium              /* Medium priority badge */
.badge .badge-low                 /* Low priority badge */
.badge .badge-open                /* Open status badge */
.badge .badge-investigating       /* Investigating status badge */
.badge .badge-closed              /* Closed status badge */
```

## Usage Examples

### Basic Theme Usage
```tsx
import { ThemeProvider, useTheme } from './hooks/useTheme';

function App() {
  return (
    <ThemeProvider>
      <YourComponent />
    </ThemeProvider>
  );
}

function YourComponent() {
  const { mode, toggleTheme } = useTheme();
  
  return (
    <div>
      <p>Current theme: {mode}</p>
      <button onClick={toggleTheme}>Toggle Theme</button>
    </div>
  );
}
```

### Using Component Classes
```tsx
function AlertCard({ alert }) {
  return (
    <div className="card">
      <div className="card-header">
        <h3 className="card-title">Financial Alert</h3>
        <span className={`badge badge-${alert.priority}`}>
          {alert.priority}
        </span>
      </div>
      <div className="card-content">
        <button className="btn btn-primary btn-md">
          Investigate
        </button>
      </div>
    </div>
  );
}
```

### Using CSS Variables
```css
.custom-component {
  background-color: rgb(var(--color-surface));
  border: 1px solid rgb(var(--color-border));
  color: rgb(var(--color-text-primary));
}
```

## Dark Mode Implementation

The theme system automatically detects system preferences and provides manual override capabilities:

```tsx
const { mode, isDark, setTheme } = useTheme();

// Available modes: 'light', 'dark', 'system'
setTheme('dark');  // Force dark mode
setTheme('light'); // Force light mode
setTheme('system'); // Follow system preference
```

## Responsive Design

The theme includes responsive utilities:

```css
.grid-responsive {
  display: grid;
  gap: 1rem;
  grid-template-columns: 1fr;
}

@media (min-width: 640px) {
  .grid-responsive {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (min-width: 1024px) {
  .grid-responsive {
    grid-template-columns: repeat(3, 1fr);
  }
}
```

## Customization

### Adding New Colors
1. Add new CSS variables to `:root` in `index.css`
2. Add dark mode variants in `.dark` selector
3. Update theme constants in `constants/theme.ts`

### Creating New Components
1. Define component styles in `index.css`
2. Add utility functions in `utils/styles.ts`
3. Export reusable classes

### Modifying Existing Styles
- Edit CSS variables for global changes
- Modify component classes for specific components
- Update utility functions for programmatic styling

## Browser Support

- Modern browsers with CSS custom properties support
- Chrome 49+, Firefox 31+, Safari 9.1+, Edge 16+
- Progressive enhancement for older browsers

## Performance

- **Minimal Runtime**: Pure CSS implementation with minimal JavaScript
- **Tree Shaking**: Only used theme functions are included in the bundle
- **CSS Variables**: Efficient theme switching without style recalculation
- **No Dependencies**: No external theme libraries required

## Best Practices

1. **Use CSS Variables**: Always use CSS custom properties for colors
2. **Component Classes**: Utilize pre-built component classes
3. **Consistent Spacing**: Use the defined spacing scale
4. **Semantic Colors**: Use appropriate colors for different states
5. **Accessibility**: Ensure sufficient color contrast in both themes

## Migration from Tailwind

This theme system replaces Tailwind CSS with a custom implementation:

- **Before**: `className="bg-blue-500 text-white px-4 py-2"`
- **After**: `className="btn btn-primary btn-md"`

Benefits:
- Full control over design system
- No utility class conflicts
- Smaller bundle size
- Financial crime specific components

## Development Server

To view the theme showcase:

```bash
cd frontend
npm run dev
# Visit http://localhost:5173/
```

The theme showcase demonstrates all available components, colors, and interactive elements in both light and dark modes.

## Future Enhancements

- [ ] Additional component variants
- [ ] Animation system integration
- [ ] High contrast accessibility mode
- [ ] Custom color scheme builder
- [ ] Theme export/import functionality

---

For questions or contributions, please refer to the main project documentation or create an issue in the repository.
