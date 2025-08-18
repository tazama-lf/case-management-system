import { useState } from 'react';
import Login from './pages/Login';
import HomeDashboard from './pages/HomeDashboard';
import './index.css';

function App() {
  const [currentView, setCurrentView] = useState<'login' | 'dashboard'>('login');

  const handleLoginSuccess = () => {
    setCurrentView('dashboard');
  };

  const handleLogout = () => {
    setCurrentView('login');
  };

  return (
    <div className="App">
      {/* Render current view */}
      {currentView === 'login' ? (
        <Login onLoginSuccess={handleLoginSuccess} />
      ) : (
        <HomeDashboard onLogout={handleLogout} />
      )}
    </div>
  );
}

export default App;
