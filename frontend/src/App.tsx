import { useState } from 'react';
import Login from './pages/Login';
import HomeDashboard from './pages/HomeDashboard';
import AlertsDashboard from './pages/AlertsDashboard';
import './index.css';

function App() {
  const [currentView, setCurrentView] = useState<'login' | 'dashboard' | 'alerts'>('login');

  const handleLoginSuccess = () => {
    setCurrentView('dashboard');
  };

  const handleLogout = () => {
    setCurrentView('login');
  };

  const handleNavigateToAlerts = () => {
    setCurrentView('alerts');
  };

  const handleBackToDashboard = () => {
    setCurrentView('dashboard');
  };

  const renderCurrentView = () => {
    switch (currentView) {
      case 'login':
        return <Login onLoginSuccess={handleLoginSuccess} />;
      case 'dashboard':
        return <HomeDashboard onLogout={handleLogout} onNavigateToAlerts={handleNavigateToAlerts} />;
      case 'alerts':
        return <AlertsDashboard onBack={handleBackToDashboard} />;
      default:
        return <Login onLoginSuccess={handleLoginSuccess} />;
    }
  };

  return (
    <div className="App">
      {renderCurrentView()}
    </div>
  );
}

export default App;
