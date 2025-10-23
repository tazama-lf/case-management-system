import authService from '../features/auth/services/authService';

async function testInvestigators() {
  console.log('Testing investigators fetch...');

  try {
    const investigators = await authService.fetchAllInvestigators();
    console.log('Investigators fetched:', investigators);
    console.log('Number of investigators:', investigators.length);

    if (investigators.length > 0) {
      console.log('First investigator:', investigators[0]);
    }
  } catch (error) {
    console.error('Error fetching investigators:', error);
  }
}

testInvestigators();