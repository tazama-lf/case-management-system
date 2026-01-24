const axios = require('axios');

async function testTransactionNetwork() {
  try {
    console.log('=== Testing Transaction Network Analysis Endpoint ===\n');
    
    const accountId = 'dbtrAcct_d5beee734b4747b2bc420e1e81167fae';
    const url = `http://localhost:3000/api/v1/lakehouse/network-analysis/transaction/${accountId}?timeRange=30d&tenantId=DEFAULT`;
    
    console.log(`Calling: ${url}\n`);
    
    const response = await axios.get(url);
    
    console.log('✓ SUCCESS! Response:');
    console.log(JSON.stringify(response.data, null, 2));
    
    // Summary
    if (response.data.centerAccount) {
      console.log('\n=== SUMMARY ===');
      console.log(`Center Account: ${response.data.centerAccount.accountId}`);
      console.log(`Account Holder: ${response.data.centerAccount.accountHolder}`);
      console.log(`Connected Accounts: ${response.data.connectedAccounts?.length || 0}`);
      console.log(`Edges: ${response.data.edges?.length || 0}`);
    }
    
  } catch (error) {
    console.error('✗ ERROR:', error.response?.data || error.message);
    if (error.response?.data) {
      console.error('Full error:', JSON.stringify(error.response.data, null, 2));
    }
  }
}

testTransactionNetwork();
