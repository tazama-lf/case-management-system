import React from 'react';
import { Outlet } from 'react-router-dom';
import Layout from './Layout';

const LayoutWithProvider: React.FC = () => (
  <Layout>
    <Outlet />
  </Layout>
);

export default LayoutWithProvider;
