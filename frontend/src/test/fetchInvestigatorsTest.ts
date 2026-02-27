import authService from '../features/auth/services/authService';

async function testFetchInvestigators() {
  try {
    const investigators = await authService.fetchAllInvestigators();
    return investigators;
  } catch (error) {
    console.error('Error fetching investigators:', error);
    throw error;
  }
}

if (typeof window !== 'undefined') {
  testFetchInvestigators()
    .then(() => {
      console.log('Test completed successfully');
    })
    .catch((error) => {
      console.error('Test failed:', error);
    });
}

export { testFetchInvestigators };
