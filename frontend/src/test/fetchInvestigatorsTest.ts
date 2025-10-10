// Simple test to verify the fetchAllInvestigators function works
import authService from '../features/auth/services/authService';

async function testFetchInvestigators() {
  try {
    console.log('Testing fetchAllInvestigators...');
    const investigators = await authService.fetchAllInvestigators();
    console.log('Investigators fetched successfully:', investigators);
    return investigators;
  } catch (error) {
    console.error('Error fetching investigators:', error);
    throw error;
  }
}

// Run the test if we're in a browser environment
if (typeof window !== 'undefined') {
  testFetchInvestigators().then(() => {
    console.log('Test completed successfully');
  }).catch((error) => {
    console.error('Test failed:', error);
  });
}

export { testFetchInvestigators };