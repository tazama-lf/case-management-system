const axios = require('axios');

const LAKEHOUSE_URL = 'http://10.10.80.20:8001';

async function runQuery(sql) {
  try {
    const response = await axios.post(`${LAKEHOUSE_URL}/execute_sql`, {
      sql_query: sql,
      limit: 20
    });
    return response.data;
  } catch (error) {
    console.error('Query failed:', error.response?.data || error.message);
    return null;
  }
}

async function exploreCounterpartyTables() {
  console.log('========================================');
  console.log('COUNTERPARTY NETWORK TABLES EXPLORATION');
  console.log('========================================\n');

  // 1. Explore tx_network_counterparties_edges
  console.log('1. COUNTERPARTY EDGES TABLE (tx_network_counterparties_edges)');
  console.log('-----------------------------------------------------------');
  
  console.log('\n  Schema:');
  const schema1 = await runQuery('DESCRIBE tx_network_counterparties_edges');
  if (schema1?.data) {
    schema1.data.forEach(col => {
      console.log(`    - ${col.column_name}: ${col.column_type}`);
    });
  }

  console.log('\n  Sample data:');
  const sample1 = await runQuery(`
    SELECT * 
    FROM tx_network_counterparties_edges 
    WHERE tenant_id = 'DEFAULT'
    LIMIT 5
  `);
  if (sample1?.data) {
    console.log(JSON.stringify(sample1.data, null, 2));
  }

  console.log('\n  Statistics:');
  const stats1 = await runQuery(`
    SELECT 
      COUNT(*) as total_edges,
      COUNT(DISTINCT from_counterparty_id) as unique_from_counterparties,
      COUNT(DISTINCT to_counterparty_id) as unique_to_counterparties
    FROM tx_network_counterparties_edges
    WHERE tenant_id = 'DEFAULT'
  `);
  if (stats1?.data) {
    console.log(JSON.stringify(stats1.data, null, 2));
  }

  // 2. Explore counterparty_account_links
  console.log('\n\n2. COUNTERPARTY-ACCOUNT LINKS TABLE (counterparty_account_links)');
  console.log('------------------------------------------------------------------');
  
  console.log('\n  Schema:');
  const schema2 = await runQuery('DESCRIBE counterparty_account_links');
  if (schema2?.data) {
    schema2.data.forEach(col => {
      console.log(`    - ${col.column_name}: ${col.column_type}`);
    });
  }

  console.log('\n  Sample data:');
  const sample2 = await runQuery(`
    SELECT * 
    FROM counterparty_account_links 
    WHERE tenant_id = 'DEFAULT'
    LIMIT 10
  `);
  if (sample2?.data) {
    console.log(JSON.stringify(sample2.data, null, 2));
  }

  console.log('\n  Statistics:');
  const stats2 = await runQuery(`
    SELECT 
      COUNT(*) as total_links,
      COUNT(DISTINCT counterparty_id) as unique_counterparties,
      COUNT(DISTINCT account_id) as unique_accounts
    FROM counterparty_account_links
    WHERE tenant_id = 'DEFAULT'
  `);
  if (stats2?.data) {
    console.log(JSON.stringify(stats2.data, null, 2));
  }

  // 3. Find a good test counterparty with connections
  console.log('\n\n3. FINDING TEST COUNTERPARTY WITH CONNECTIONS');
  console.log('----------------------------------------------');
  
  const testCounterparty = await runQuery(`
    SELECT 
      from_counterparty_id,
      from_counterparty_name,
      COUNT(*) as connection_count,
      SUM(tx_count) as total_transactions,
      SUM(total_amount) as total_value
    FROM tx_network_counterparties_edges
    WHERE tenant_id = 'DEFAULT'
    GROUP BY from_counterparty_id, from_counterparty_name
    ORDER BY connection_count DESC
    LIMIT 5
  `);
  if (testCounterparty?.data) {
    console.log('Top counterparties by connections:');
    console.log(JSON.stringify(testCounterparty.data, null, 2));
  }

  // 4. Sample counterparty network for first test counterparty
  if (testCounterparty?.data?.[0]) {
    const testId = testCounterparty.data[0].from_counterparty_id;
    const testName = testCounterparty.data[0].from_counterparty_name;
    
    console.log(`\n\n4. SAMPLE NETWORK FOR: ${testName} (${testId})`);
    console.log('----------------------------------------------');
    
    const network = await runQuery(`
      SELECT 
        from_counterparty_id,
        from_counterparty_name,
        to_counterparty_id,
        to_counterparty_name,
        tx_count,
        total_amount,
        is_alerted_edge,
        is_investigated_edge,
        first_event_ts,
        last_event_ts
      FROM tx_network_counterparties_edges
      WHERE from_counterparty_id = '${testId}'
        AND tenant_id = 'DEFAULT'
      ORDER BY tx_count DESC
      LIMIT 10
    `);
    if (network?.data) {
      console.log('Direct connections (outbound):');
      console.log(JSON.stringify(network.data, null, 2));
    }

    // Check inbound connections too
    const inbound = await runQuery(`
      SELECT 
        from_counterparty_id,
        from_counterparty_name,
        to_counterparty_id,
        to_counterparty_name,
        tx_count,
        total_amount,
        is_alerted_edge,
        is_investigated_edge
      FROM tx_network_counterparties_edges
      WHERE to_counterparty_id = '${testId}'
        AND tenant_id = 'DEFAULT'
      ORDER BY tx_count DESC
      LIMIT 5
    `);
    if (inbound?.data && inbound.data.length > 0) {
      console.log('\nDirect connections (inbound):');
      console.log(JSON.stringify(inbound.data, null, 2));
    }
  }

  // 5. Check counterparty-account mapping for test counterparty
  if (testCounterparty?.data?.[0]) {
    const testId = testCounterparty.data[0].from_counterparty_id;
    
    console.log(`\n\n5. ACCOUNTS FOR TEST COUNTERPARTY: ${testId}`);
    console.log('----------------------------------------------');
    
    const accounts = await runQuery(`
      SELECT 
        counterparty_id,
        counterparty_name,
        account_id,
        account_role
      FROM counterparty_account_links
      WHERE counterparty_id = '${testId}'
        AND tenant_id = 'DEFAULT'
    `);
    if (accounts?.data) {
      console.log(JSON.stringify(accounts.data, null, 2));
    }
  }

  console.log('\n========================================');
  console.log('EXPLORATION COMPLETE');
  console.log('========================================\n');

  console.log('KEY FINDINGS SUMMARY:');
  console.log('- tx_network_counterparties_edges: Contains counterparty relationships');
  console.log('- counterparty_account_links: Maps counterparties to their accounts');
  console.log('- Ready to implement Counterparty Network Analysis!');
}

exploreCounterpartyTables();
