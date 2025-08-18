# How to Apply Your Tailwind Config to Global index.css

## Overview

Your Tailwind CSS v4 configuration is now successfully integrated with your global `index.css` file. Here's everything you need to know about how it works and how to use it.

## Current Setup

### 1. Tailwind CSS v4 Configuration

Your `tailwind.config.js` includes:

- **Custom Colors**: Primary, secondary, success, warning, danger palettes
- **Financial Crime Specific Colors**: Priority and status colors
- **Typography**: Inter font family and custom font sizes
- **Spacing & Layout**: Custom spacing, border radius, shadows
- **Animations**: Fade-in, slide-in, bounce-gentle effects
- **Custom Components**: Pre-built button, card, input, and badge styles

### 2. Global CSS Integration (`src/index.css`)

```css
@import "tailwindcss";

/* Your custom styles and enhancements here */
```

The `@import "tailwindcss"` directive automatically includes:
- All your custom colors from the config
- All component classes defined in the config's plugins
- Tailwind's utility classes with your customizations

## How Your Configuration is Applied

### Colors Available as Utility Classes

All colors from your config are automatically available:

```tsx
// Primary colors
<div className="bg-primary-600 text-white">Primary Button</div>
<div className="text-primary-500 hover:text-primary-700">Link</div>

// Custom financial colors
<div className="bg-danger-50 text-danger-800 border border-danger-200">Alert</div>
<div className="text-success-600">Success Message</div>

// Priority colors (from your config)
<span style={{ color: 'rgb(34 197 94)' }}>Low Priority</span> // --color-priority-low
<span style={{ color: 'rgb(245 158 11)' }}>Medium Priority</span> // --color-priority-medium
```

### Pre-built Component Classes

Your Tailwind config defines these components automatically:

```tsx
// Buttons (from your config's addComponents)
<button className="btn btn-primary">Primary Button</button>
<button className="btn btn-secondary">Secondary Button</button>
<button className="btn btn-danger">Danger Button</button>
<button className="btn btn-outline">Outline Button</button>

// Cards
<div className="card">Basic Card</div>
<div className="card card-dark">Dark Mode Card</div>

// Forms
<input className="input" type="text" placeholder="Form input" />

// Priority Badges
<span className="badge-priority-low">Low</span>
<span className="badge-priority-medium">Medium</span>
<span className="badge-priority-high">High</span>
<span className="badge-priority-critical">Critical</span>

// Status Badge
<span className="badge-status">General Status</span>
```

### Layout Utilities

```tsx
// Custom grid layouts from your config
<div className="grid grid-cols-sidebar">Sidebar Layout</div>
<div className="grid grid-cols-dashboard">Dashboard Grid</div>

// Page container
<div className="page-container">Centered content with max-width</div>

// Sidebar widths
<aside className="sidebar-width">250px sidebar</aside>
<aside className="sidebar-collapsed-width">64px collapsed</aside>
```

### Animations and Effects

```tsx
// Custom animations from your config
<div className="animate-fade-in">Fades in</div>
<div className="animate-slide-in">Slides in from left</div>
<div className="animate-bounce-gentle">Gentle bounce</div>
<div className="animate-pulse-slow">Slow pulse</div>
```

## Dark Mode Implementation

Your configuration supports dark mode through the `class` strategy:

```tsx
function App() {
  const [darkMode, setDarkMode] = useState(false);

  const toggleDarkMode = () => {
    setDarkMode(!darkMode);
    document.documentElement.classList.toggle('dark');
  };

  return (
    <div className={darkMode ? 'dark' : ''}>
      <div className="bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100">
        {/* Content automatically adapts to dark mode */}
        <button onClick={toggleDarkMode}>Toggle Theme</button>
      </div>
    </div>
  );
}
```

## Using Financial Crime Specific Features

### Priority System

```tsx
// Using priority colors from your config
const PriorityBadge = ({ level }: { level: keyof typeof priorities }) => {
  const priorities = {
    low: 'badge-priority-low',
    medium: 'badge-priority-medium', 
    high: 'badge-priority-high',
    critical: 'badge-priority-critical'
  };

  return <span className={priorities[level]}>{level}</span>;
};
```

### Status System

```tsx
// Using status colors for cases
const StatusBadge = ({ status }: { status: string }) => {
  const getStatusClass = (status: string) => {
    switch (status) {
      case 'draft': return 'text-gray-600 bg-gray-50 border-gray-200';
      case 'pending': return 'text-warning-600 bg-warning-50 border-warning-200';
      case 'assigned': return 'text-primary-600 bg-primary-50 border-primary-200';
      case 'progress': return 'text-purple-600 bg-purple-50 border-purple-200';
      case 'suspended': return 'text-danger-600 bg-danger-50 border-danger-200';
      case 'closed': return 'text-success-600 bg-success-50 border-success-200';
      case 'reopened': return 'text-orange-600 bg-orange-50 border-orange-200';
      default: return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  return (
    <span className={`px-2 py-1 rounded-md text-xs font-medium border ${getStatusClass(status)}`}>
      {status}
    </span>
  );
};
```

## Extending the Configuration

### Adding New Colors

1. Add to `tailwind.config.js`:
```javascript
extend: {
  colors: {
    // Add new color
    brand: {
      50: '#f0f9ff',
      500: '#3b82f6',
      900: '#1e3a8a',
    }
  }
}
```

2. Use immediately:
```tsx
<div className="bg-brand-500 text-brand-50">New Brand Color</div>
```

### Adding New Components

1. Add to the `addComponents` function in your config:
```javascript
addComponents({
  '.alert-box': {
    padding: theme('spacing.4'),
    borderRadius: theme('borderRadius.lg'),
    borderWidth: '1px',
    borderColor: theme('colors.gray.200'),
  }
})
```

2. Use the new component:
```tsx
<div className="alert-box">Custom Alert Component</div>
```

## Best Practices

### 1. Use Semantic Color Names
```tsx
// Good - semantic meaning
<button className="btn btn-danger">Delete</button>
<div className="text-success-600">Operation completed</div>

// Avoid - hard-coded colors
<button className="bg-red-600">Delete</button>
```

### 2. Leverage Your Custom Components
```tsx
// Good - use predefined components
<div className="card">
  <h3 className="text-lg font-semibold mb-2">Alert Details</h3>
  <button className="btn btn-primary">Investigate</button>
</div>

// Works but less consistent
<div className="bg-white p-6 rounded-lg shadow-card">
  <h3 className="text-lg font-semibold mb-2">Alert Details</h3>
  <button className="bg-primary-600 text-white px-4 py-2 rounded-md">Investigate</button>
</div>
```

### 3. Use Your Custom Grid Systems
```tsx
// Dashboard layout
<div className="grid grid-cols-dashboard gap-6">
  <div className="card">Card 1</div>
  <div className="card">Card 2</div>
  <div className="card">Card 3</div>
</div>

// Sidebar layout
<div className="grid grid-cols-sidebar">
  <aside className="sidebar-width">Sidebar</aside>
  <main>Main Content</main>
</div>
```

## Troubleshooting

### If Tailwind Classes Don't Work

1. **Check the build process**: Make sure Vite is running with the Tailwind plugin
2. **Verify the import**: Ensure `@import "tailwindcss";` is at the top of your CSS
3. **Check the content paths**: Your config should scan `"./src/**/*.{js,ts,jsx,tsx}"`

### If Custom Colors Don't Apply

1. **Restart the dev server**: After config changes, restart `npm run dev`
2. **Check color format**: Ensure colors are in the correct format in your config
3. **Verify class names**: Custom colors follow the pattern `text-{colorName}-{shade}`

### Performance Tips

1. **Purge unused styles**: Tailwind v4 automatically purges unused styles
2. **Use custom components**: Reduce bundle size by using your predefined components
3. **Optimize animations**: Your custom animations are already optimized for performance

## Summary

Your Tailwind configuration is now fully integrated and provides:

✅ **Complete color system** for financial crime management
✅ **Pre-built components** for consistent UI
✅ **Dark mode support** with automatic color adaptation
✅ **Custom animations** and transitions
✅ **Responsive design** utilities
✅ **Financial domain-specific** utilities for priorities and statuses

You can now use all Tailwind utilities along with your custom components and colors throughout your application!
