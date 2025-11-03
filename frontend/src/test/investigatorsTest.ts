import authService from '../features/auth/services/authService';

async function testInvestigators() {
  try {
    await authService.fetchAllInvestigators();
  } catch (error) {
    console.error('Error fetching investigators:', error);
  }
}

testInvestigators();