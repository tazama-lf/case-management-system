-- DWH Test Data Seeder
-- This script populates the Data Warehouse with 5 test customers, accounts, and transactions
-- 
-- Usage:
-- cd backend
-- Get-Content prismaDWH\setup-five-customers.sql | npx prisma db execute --schema=prismaDWH/schema.dwh.prisma --stdin
--
-- Clean slate: Remove existing test data
DELETE FROM transaction WHERE tenant_id IN ('T001', 'T002', 'T003', 'T004', 'T005', 'DEFAULT');
DELETE FROM account WHERE tenant_id IN ('T001', 'T002', 'T003', 'T004', 'T005', 'DEFAULT');
DELETE FROM customer WHERE tenant_id IN ('T001', 'T002', 'T003', 'T004', 'T005', 'DEFAULT');

-- Create 10 customers (2 per tenant for sender/receiver distinction)
INSERT INTO customer (id, tenant_id, name, date_of_birth, email, phone, address) VALUES 
('CUST-001', 'T001', 'John Smith', '1985-03-15', 'john.smith@email.com', '+1-555-0101', '{"street":"123 Main St","city":"New York","state":"NY","postalCode":"10001","country":"USA"}'),
('CUST-001B', 'T001', 'Alice Cooper', '1992-06-12', 'alice.c@email.com', '+1-555-0111', '{"street":"789 Park Ave","city":"New York","state":"NY","postalCode":"10002","country":"USA"}'),
('CUST-002', 'T002', 'Jane Doe', '1990-07-22', 'jane.doe@email.com', '+1-555-0102', '{"street":"456 Oak Ave","city":"Los Angeles","state":"CA","postalCode":"90001","country":"USA"}'),
('CUST-002B', 'T002', 'Tom Harris', '1988-04-30', 'tom.h@email.com', '+1-555-0112', '{"street":"321 Beach Blvd","city":"Los Angeles","state":"CA","postalCode":"90002","country":"USA"}'),
('CUST-003', 'T003', 'Robert Johnson', '1978-11-05', 'robert.j@email.com', '+1-555-0103', '{"street":"789 Pine Rd","city":"Houston","state":"TX","postalCode":"77001","country":"USA"}'),
('CUST-003B', 'T003', 'Maria Garcia', '1986-09-18', 'maria.g@email.com', '+1-555-0113', '{"street":"654 West St","city":"Houston","state":"TX","postalCode":"77002","country":"USA"}'),
('CUST-004', 'T004', 'Sarah Williams', '1995-02-18', 'sarah.w@email.com', '+1-555-0104', '{"street":"321 Elm St","city":"Chicago","state":"IL","postalCode":"60601","country":"USA"}'),
('CUST-004B', 'T004', 'David Lee', '1991-11-25', 'david.l@email.com', '+1-555-0114', '{"street":"987 Lake Dr","city":"Chicago","state":"IL","postalCode":"60602","country":"USA"}'),
('CUST-005', 'T005', 'Michael Brown', '1982-09-30', 'michael.b@email.com', '+1-555-0105', '{"street":"654 Maple Dr","city":"Phoenix","state":"AZ","postalCode":"85001","country":"USA"}'),
('CUST-005B', 'T005', 'Linda Martinez', '1987-07-14', 'linda.m@email.com', '+1-555-0115', '{"street":"432 Desert Rd","city":"Phoenix","state":"AZ","postalCode":"85002","country":"USA"}');

-- Create 10 accounts (2 per tenant, different customers)
INSERT INTO account (id, tenant_id, customer_id, account_type, opened_date, balance, risk_rating) VALUES 
('fsp001', 'T001', 'CUST-001', 'personal', '2020-01-15', 25000.00, 'Low'),
('fsp001b', 'T001', 'CUST-001B', 'personal', '2020-02-20', 18000.00, 'Low'),
('fsp002', 'T002', 'CUST-002', 'savings', '2019-06-10', 45000.00, 'Medium'),
('fsp002b', 'T002', 'CUST-002B', 'business', '2019-07-15', 32000.00, 'Medium'),
('fsp003', 'T003', 'CUST-003', 'business', '2018-11-01', 85000.00, 'High'),
('fsp003b', 'T003', 'CUST-003B', 'personal', '2018-12-05', 42000.00, 'High'),
('fsp004', 'T004', 'CUST-004', 'personal', '2021-03-20', 15000.00, 'Low'),
('fsp004b', 'T004', 'CUST-004B', 'savings', '2021-04-10', 22000.00, 'Low'),
('fsp005', 'T005', 'CUST-005', 'business', '2017-08-12', 120000.00, 'Medium'),
('fsp005b', 'T005', 'CUST-005B', 'personal', '2017-09-20', 68000.00, 'Medium');

-- Create varied transactions for each customer (as both sender and receiver)

-- Customer 1 (T001) transactions - between fsp001 and fsp001b
INSERT INTO transaction (end_to_end_id, tx_tp, tenant_id, transaction, amt, ccy, msg_id, cre_dt_tm, tx_sts, source, destination, role, geography, channel) VALUES 
('TXN-001-01', 'Payment', 'T001', '{"Amt": "500.00", "Ccy": "USD", "Role": "Debtor", "TxTp": "Payment", "MsgId": "MSG-001-01", "TxSts": "Completed", "Channel": "Online", "CreDtTm": "2025-11-15", "TenantId": "T001", "Geography": "Domestic", "EndToEndId": "TXN-001-01"}', 500.00, 'USD', 'MSG-001-01', '2025-11-15', 'Completed', 'fsp001', 'fsp001b', 'Debtor', 'Domestic', 'Online'),
('TXN-001-02', 'Transfer', 'T001', '{"Amt": "1200.00", "Ccy": "USD", "Role": "Creditor", "TxTp": "Transfer", "MsgId": "MSG-001-02", "TxSts": "Completed", "Channel": "Mobile", "CreDtTm": "2025-11-18", "TenantId": "T001", "Geography": "Domestic", "EndToEndId": "TXN-001-02"}', 1200.00, 'USD', 'MSG-001-02', '2025-11-18', 'Completed', 'fsp001b', 'fsp001', 'Creditor', 'Domestic', 'Mobile'),
('TXN-001-03', 'Payment', 'T001', '{"Amt": "300.00", "Ccy": "USD", "Role": "Debtor", "TxTp": "Payment", "MsgId": "MSG-001-03", "TxSts": "Completed", "Channel": "ATM", "CreDtTm": "2025-11-20", "TenantId": "T001", "Geography": "Domestic", "EndToEndId": "TXN-001-03"}', 300.00, 'USD', 'MSG-001-03', '2025-11-20', 'Completed', 'fsp001', 'fsp001b', 'Debtor', 'Domestic', 'ATM');

-- Customer 2 (T002) transactions - between fsp002 and fsp002b
INSERT INTO transaction (end_to_end_id, tx_tp, tenant_id, transaction, amt, ccy, msg_id, cre_dt_tm, tx_sts, source, destination, role, geography, channel) VALUES 
('TXN-002-01', 'Payment', 'T002', '{"Amt": "2500.00", "Ccy": "USD", "Role": "Creditor", "TxTp": "Payment", "MsgId": "MSG-002-01", "TxSts": "Completed", "Channel": "Online", "CreDtTm": "2025-11-16", "TenantId": "T002", "Geography": "Domestic", "EndToEndId": "TXN-002-01"}', 2500.00, 'USD', 'MSG-002-01', '2025-11-16', 'Completed', 'fsp002b', 'fsp002', 'Creditor', 'Domestic', 'Online'),
('TXN-002-02', 'Transfer', 'T002', '{"Amt": "800.00", "Ccy": "USD", "Role": "Debtor", "TxTp": "Transfer", "MsgId": "MSG-002-02", "TxSts": "Completed", "Channel": "Branch", "CreDtTm": "2025-11-19", "TenantId": "T002", "Geography": "Cross-border", "EndToEndId": "TXN-002-02"}', 800.00, 'USD', 'MSG-002-02', '2025-11-19', 'Completed', 'fsp002', 'fsp002b', 'Debtor', 'Cross-border', 'Branch'),
('TXN-002-03', 'Payment', 'T002', '{"Amt": "5000.00", "Ccy": "USD", "Role": "Creditor", "TxTp": "Payment", "MsgId": "MSG-002-03", "TxSts": "Completed", "Channel": "Branch", "CreDtTm": "2025-11-21", "TenantId": "T002", "Geography": "Domestic", "EndToEndId": "TXN-002-03"}', 5000.00, 'USD', 'MSG-002-03', '2025-11-21', 'Completed', 'fsp002b', 'fsp002', 'Creditor', 'Domestic', 'Branch');

-- Customer 3 (T003) transactions - between fsp003 and fsp003b
INSERT INTO transaction (end_to_end_id, tx_tp, tenant_id, transaction, amt, ccy, msg_id, cre_dt_tm, tx_sts, source, destination, role, geography, channel) VALUES 
('TXN-003-01', 'Payment', 'T003', '{"Amt": "15000.00", "Ccy": "USD", "Role": "Debtor", "TxTp": "Payment", "MsgId": "MSG-003-01", "TxSts": "Completed", "Channel": "Online", "CreDtTm": "2025-11-17", "TenantId": "T003", "Geography": "Cross-border", "EndToEndId": "TXN-003-01"}', 15000.00, 'USD', 'MSG-003-01', '2025-11-17', 'Completed', 'fsp003', 'fsp003b', 'Debtor', 'Cross-border', 'Online'),
('TXN-003-02', 'Transfer', 'T003', '{"Amt": "3200.00", "Ccy": "USD", "Role": "Creditor", "TxTp": "Transfer", "MsgId": "MSG-003-02", "TxSts": "Completed", "Channel": "Mobile", "CreDtTm": "2025-11-22", "TenantId": "T003", "Geography": "Domestic", "EndToEndId": "TXN-003-02"}', 3200.00, 'USD', 'MSG-003-02', '2025-11-22', 'Completed', 'fsp003b', 'fsp003', 'Creditor', 'Domestic', 'Mobile'),
('TXN-003-03', 'Payment', 'T003', '{"Amt": "7800.00", "Ccy": "USD", "Role": "Debtor", "TxTp": "Payment", "MsgId": "MSG-003-03", "TxSts": "Completed", "Channel": "Online", "CreDtTm": "2025-11-25", "TenantId": "T003", "Geography": "Domestic", "EndToEndId": "TXN-003-03"}', 7800.00, 'USD', 'MSG-003-03', '2025-11-25', 'Completed', 'fsp003', 'fsp003b', 'Debtor', 'Domestic', 'Online');

-- Customer 4 (T004) transactions - between fsp004 and fsp004b
INSERT INTO transaction (end_to_end_id, tx_tp, tenant_id, transaction, amt, ccy, msg_id, cre_dt_tm, tx_sts, source, destination, role, geography, channel) VALUES 
('TXN-004-01', 'Payment', 'T004', '{"Amt": "450.00", "Ccy": "USD", "Role": "Debtor", "TxTp": "Payment", "MsgId": "MSG-004-01", "TxSts": "Completed", "Channel": "ATM", "CreDtTm": "2025-11-14", "TenantId": "T004", "Geography": "Domestic", "EndToEndId": "TXN-004-01"}', 450.00, 'USD', 'MSG-004-01', '2025-11-14', 'Completed', 'fsp004', 'fsp004b', 'Debtor', 'Domestic', 'ATM'),
('TXN-004-02', 'Payment', 'T004', '{"Amt": "1800.00", "Ccy": "USD", "Role": "Debtor", "TxTp": "Payment", "MsgId": "MSG-004-02", "TxSts": "Completed", "Channel": "Mobile", "CreDtTm": "2025-11-23", "TenantId": "T004", "Geography": "Domestic", "EndToEndId": "TXN-004-02"}', 1800.00, 'USD', 'MSG-004-02', '2025-11-23', 'Completed', 'fsp004', 'fsp004b', 'Debtor', 'Domestic', 'Mobile'),
('TXN-004-03', 'Transfer', 'T004', '{"Amt": "950.00", "Ccy": "USD", "Role": "Creditor", "TxTp": "Transfer", "MsgId": "MSG-004-03", "TxSts": "Completed", "Channel": "Online", "CreDtTm": "2025-11-26", "TenantId": "T004", "Geography": "Domestic", "EndToEndId": "TXN-004-03"}', 950.00, 'USD', 'MSG-004-03', '2025-11-26', 'Completed', 'fsp004b', 'fsp004', 'Creditor', 'Domestic', 'Online');

-- Customer 5 (T005) transactions - between fsp005 and fsp005b
INSERT INTO transaction (end_to_end_id, tx_tp, tenant_id, transaction, amt, ccy, msg_id, cre_dt_tm, tx_sts, source, destination, role, geography, channel) VALUES 
('TXN-005-01', 'Payment', 'T005', '{"Amt": "25000.00", "Ccy": "USD", "Role": "Creditor", "TxTp": "Payment", "MsgId": "MSG-005-01", "TxSts": "Completed", "Channel": "Branch", "CreDtTm": "2025-11-13", "TenantId": "T005", "Geography": "Cross-border", "EndToEndId": "TXN-005-01"}', 25000.00, 'USD', 'MSG-005-01', '2025-11-13', 'Completed', 'fsp005b', 'fsp005', 'Creditor', 'Cross-border', 'Branch'),
('TXN-005-02', 'Transfer', 'T005', '{"Amt": "4500.00", "Ccy": "USD", "Role": "Debtor", "TxTp": "Transfer", "MsgId": "MSG-005-02", "TxSts": "Completed", "Channel": "Online", "CreDtTm": "2025-11-24", "TenantId": "T005", "Geography": "Domestic", "EndToEndId": "TXN-005-02"}', 4500.00, 'USD', 'MSG-005-02', '2025-11-24', 'Completed', 'fsp005', 'fsp005b', 'Debtor', 'Domestic', 'Online'),
('TXN-005-03', 'Payment', 'T005', '{"Amt": "10000.00", "Ccy": "USD", "Role": "Creditor", "TxTp": "Payment", "MsgId": "MSG-005-03", "TxSts": "Completed", "Channel": "Branch", "CreDtTm": "2025-11-27", "TenantId": "T005", "Geography": "Domestic", "EndToEndId": "TXN-005-03"}', 10000.00, 'USD', 'MSG-005-03', '2025-11-27', 'Completed', 'fsp005b', 'fsp005', 'Creditor', 'Domestic', 'Branch');
