import React from 'react';
import Header from './Header';
import Sidebar from './Sidebar';

const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Header />
      <Sidebar />
      <main className="ml-60 pt-14">
        <div className="p-6">
          {children}
        </div>
      </main>
    </div>
  );
};

export default Layout;
