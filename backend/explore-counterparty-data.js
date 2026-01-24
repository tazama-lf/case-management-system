const axios = require('axios');

const LAKEHOUSE_URL = 'http://10.10.80.20:8001';

async function runQuery(sql) {
  try {
    const response = await axios.post(`${LAKEHOUSE_URL}/execute_sql`, {
      sql_query: sql,
      limit: 10
    });
    return response.data;
  } catch (error) {
    console.error('Query failed:', error.response?.data || error.message);
    return null;
  }
}

async function exploreLakehouseForCounterparty() {
  console.log('========================================');
  console.log('COUNTERPARTY NETWORK DATA EXPLORATION');
  console.log('========================================\n');

  // 1. Check what tables exist
  console.log('1. Checking available tables...');
  const tablesResult = await runQuery('SHOW TABLES');
  if (tablesResult) {
    console.log('Available tables:');
    console.log(JSON.stringify(tablesResult.data, null, 2));
  }
  console.log('\n');

  // 2. Check transaction_detail schema
  console.log('2. Checking transaction_detail columns...');
  const schemaResult = await runQuery('DESCRIBE transaction_detail');
  if (schemaResult) {
    console.log('Columns:');
    console.log(JSON.stringify(schemaResult.data, null, 2));
  }
  console.log('\n');

  // 3. Check for counterparty-related columns
  console.log('3. Sample transaction_detail data...');
  const sampleResult = await runQuery(`
    SELECT 
      transaction_id,
      debtor_name,
      creditor_name,
      debtor_account_id,
      creditor_account_id,
      interbank_settlement_amount,
      tx_event_ts
    FROM transaction_detail 
    WHERE tenant_id = 'DEFAULT'
    LIMIT 3
  `);
  if (sampleResult) {
    console.log('Sample data:');
    console.log(JSON.stringify(sampleResult.data, null, 2));
  }
  console.log('\n');

  // 4. Check name uniqueness
  console.log('4. Analyzing name vs account uniqueness...');
  const uniquenessResult = await runQuery(`
    SELECT 
      COUNT(DISTINCT debtor_name) as unique_debtor_names,
      COUNT(DISTINCT debtor_account_id) as unique_debtor_accounts,
      COUNT(DISTINCT creditor_name) as unique_creditor_names,
      COUNT(DISTINCT creditor_account_id) as unique_creditor_accounts,
      COUNT(*) as total_transactions
    FROM transaction_detail
    WHERE tenant_id = 'DEFAULT'
  `);
  if (uniquenessResult) {
    console.log('Uniqueness analysis:');
    console.log(JSON.stringify(uniquenessResult.data, null, 2));
  }
  console.log('\n');

  // 5. Check if one entity has multiple accounts
  console.log('5. Checking if entities have multiple accounts...');
  const multiAccountResult = await runQuery(`
    SELECT 
      debtor_name,
      COUNT(DISTINCT debtor_account_id) as account_count,
      STRING_AGG(DISTINCT debtor_account_id, ', ') as accounts
    FROM transaction_detail
    WHERE tenant_id = 'DEFAULT'
    GROUP BY debtor_name
    HAVING COUNT(DISTINCT debtor_account_id) > 1
    LIMIT 5
  `);
  if (multiAccountResult) {
    console.log('Entities with multiple accounts:');
    console.log(JSON.stringify(multiAccountResult.data, null, 2));
  }
  console.log('\n');

  // 6. Build sample counterparty network using names
  console.log('6. Sample counterparty network for "Sarah Grant"...');
  const networkResult = await runQuery(`
    SELECT 
      'Sarah Grant' as center_entity,
      creditor_name as connected_entity,
      'OUTBOUND' as direction,
      COUNT(*) as transaction_count,
      SUM(interbank_settlement_amount) as total_value,
      MAX(tx_event_ts) as last_transaction
    FROM transaction_detail
    WHERE debtor_name = 'Sarah Grant'
      AND tenant_id = 'DEFAULT'
    GROUP BY creditor_name
    
    UNION ALL
    
    SELECT 
      'Sarah Grant' as center_entity,
      debtor_name as connected_entity,
      'INBOUND' as direction,
      COUNT(*) as transaction_count,
      SUM(interbank_settlement_amount) as total_value,
      MAX(tx_event_ts) as last_transaction
    FROM transaction_detail
    WHERE creditor_name = 'Sarah Grant'
      AND tenant_id = 'DEFAULT'
    GROUP BY debtor_name
  `);
  if (networkResult) {
    console.log('Counterparty network connections:');
    console.log(JSON.stringify(networkResult.data, null, 2));
  }
  console.log('\n');

  console.log('========================================');
  console.log('EXPLORATION COMPLETE');
  console.log('========================================');
}

exploreLakehouseForCounterparty();
