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
    console.error('Query failed:', error.response?.data?.detail || error.message);
    return null;
  }
}

async function findTestCounterparty() {
  console.log('Finding test counterparty with connections and names...\n');

  // Get counterparty IDs with most connections
  const result = await runQuery(`
    SELECT 
      from_counterparty_id,
      COUNT(*) as connection_count,
      SUM(tx_count) as total_transactions,
      SUM(total_amount) as total_value
    FROM tx_network_counterparties_edges
    WHERE tenant_id = 'DEFAULT'
    GROUP BY from_counterparty_id
    ORDER BY connection_count DESC
    LIMIT 10
  `);

  if (result?.data) {
    console.log('Top 10 counterparties by connections:');
    console.log(JSON.stringify(result.data, null, 2));
    
    // Pick the first one and get full network
    const testId = result.data[0].from_counterparty_id;
    console.log(`\n\nUsing test counterparty: ${testId}\n`);
    
    // Get the name from transaction_detail
    const nameResult = await runQuery(`
      SELECT DISTINCT debtor_name
      FROM transaction_detail
      WHERE debtor_account_id IN (
        SELECT account_id 
        FROM counterparty_account_links 
        WHERE counterparty_id = '${testId}'
        LIMIT 1
      )
      LIMIT 1
    `);
    
    if (nameResult?.data?.[0]) {
      console.log(`Counterparty name: ${nameResult.data[0].debtor_name}\n`);
    }
    
    // Get full network for this counterparty
    console.log('Getting network connections...\n');
    const network = await runQuery(`
      SELECT 
        from_counterparty_id,
        to_counterparty_id,
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
    `);
    
    if (network?.data) {
      console.log('Outbound connections:');
      console.log(JSON.stringify(network.data, null, 2));
    }
  }
}

findTestCounterparty();
