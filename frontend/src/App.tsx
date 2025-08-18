import { useState } from 'react';
import Login from './pages/Login';
import HomeDashboard from './pages/HomeDashboard';
import './index.css';

function App() {
  const [currentView, setCurrentView] = useState<'login' | 'dashboard'>('login');

  // Demo toggle function
  const toggleView = () => {
    setCurrentView(currentView === 'login' ? 'dashboard' : 'login');
  };

  return (
    <div className="App">
      {/* Demo Navigation - Remove in production */}
      <div className="fixed top-4 right-4 z-50">
        <button
          onClick={toggleView}
          className="btn btn-secondary btn-sm"
          style={{ 
            backgroundColor: 'rgba(255, 255, 255, 0.9)',
            backdropFilter: 'blur(10px)',
            border: '1px solid rgba(0, 0, 0, 0.1)'
          }}
        >
          Demo: Switch to {currentView === 'login' ? 'Dashboard' : 'Login'}
        </button>
      </div>

      {/* Render current view */}
      {currentView === 'login' ? <Login /> : <HomeDashboard />}
    </div>
  );
}

export default App;
